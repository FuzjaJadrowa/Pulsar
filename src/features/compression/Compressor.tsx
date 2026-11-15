import { ICON_ASSETS } from "../../utils/icons";
import React, { useState, useEffect, useRef } from "react";
import { MediaFilePickerBar } from "../../components/media/MediaFilePickerBar";
import { createFileSelectionHandlers } from "../media/fileSelection";
import { useTranslation } from "../../services/i18n";
import { useConfig } from "../../services/config";
import { usePresets } from "../../services/presets";
import { enqueue } from "../queue/queue";
import { animateQueueOrb } from "../queue/animation";
import { useUiState } from "../../services/uiState";
import { showNotification } from "../../services/notifications";
import { formatBytes } from "../../utils/format";
import { PathSelector } from "../../components/ui/PathSelector";
import { useTauriMetadata } from "../../hooks/useTauriMetadata";
import { useFileDragDrop } from "../../hooks/useFileDragDrop";
import { PresetGrid } from "../../components/presets/PresetGrid";
import type { FormatEntry } from "../../services/formats";
import { loadFormatCatalog } from "../../services/formats";
import type { MediaFileMetadata } from "../../types/media";
import type { Preset } from "../../services/presets";
import { BatchInfoCard } from "../../components/media/BatchInfoCard";

import { PRESET_DEFAULT_ICON, CATEGORY_ICONS } from "../../utils/icons";
import { extractFileName, extractFolderPath, normalizeFormatKey, parseSizeInput } from "./files";
import styles from "./Compressor.module.css";
import { CompressorFileInfo } from "./components/CompressorFileInfo";
import { CompressorModeControls } from "./components/CompressorModeControls";
import { EstimatedSizeRow } from "../../components/media/EstimatedSizeRow";
import { OutputCodecField } from "../../components/media/OutputCodecField";
import { OutputTextField } from "../../components/media/OutputTextField";
import { sanitizeBitrateInput } from "../../utils/bitrate";

const SUPPORTED_CATEGORIES = new Set(["video", "audio", "image"]);
const SUPPORTED_IMAGE_FORMATS = new Set([
  "bmp", "gif", "jfif", "jpg", "jpeg", "png", "tga", "tif", "tiff", "webp"
]);

const isSupportedCompressorMetadata = (metadata: MediaFileMetadata) => {
  const category = String(metadata.category || "").toLowerCase();
  if (!SUPPORTED_CATEGORIES.has(category)) return false;
  if (category !== "image") return true;
  const extension = normalizeFormatKey(metadata.extension || metadata.format || "");
  return SUPPORTED_IMAGE_FORMATS.has(extension);
};

interface CompressorProps {
  active?: boolean;
}

export const Compressor: React.FC<CompressorProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { presets, loadPreset } = usePresets();

  const [filePath, setFilePath] = useState("");
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<MediaFileMetadata[]>([]);

  const {
    metadata,
    isLoading: isConfirmLoading,
    fetchMetadata: triggerFetchMetadata,
    reset: resetMetadataState,
    setMetadata
  } = useTauriMetadata<MediaFileMetadata>({
    pickerCommand: "fetch_metadata_converter",
    onSuccess: (data) => {
      if (!isSupportedCompressorMetadata(data)) {
        showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
        resetView();
        return;
      }
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error"), err, "error");
    }
  });

  const { showDropOverlay } = useFileDragDrop({
    pageClass: "page-compressor",
    onFileDrop: (paths) => {
      handleFilesSelected(paths);
    }
  });

  const [currentName, setCurrentName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [savePath, setSavePath] = useState("");

  const [selectedMode, setSelectedMode] = useState<"percent" | "size" | "quality">("percent");
  const [percentValue, setPercentValue] = useState<number | "">(60);
  const [sizeInputValue, setSizeInputValue] = useState("");
  const [crfValue, setCrfValue] = useState("26");

  // Specs options
  const [videoCodec, setVideoCodec] = useState("");
  const [videoAudioCodec, setVideoAudioCodec] = useState("");
  const [audioCodec, setAudioCodec] = useState("");
  const [videoBitrate, setVideoBitrate] = useState("");
  const [videoAudioBitrate, setVideoAudioBitrate] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");

  // Local size estimation
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  // Presets
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Format Data Map
  const [formatData, setFormatData] = useState<FormatEntry[]>([]);

  const pathInputRef = useRef<HTMLInputElement | null>(null);

  const compressorPresets = presets.filter(p => p.preset_type === "compressor" && !p.hidden);

  const { updateUiState } = useUiState();

  useEffect(() => {
    if (!active) return;
    updateUiState({
      compressorDashboardVisible: isDashboardVisible,
    });
  }, [active, isDashboardVisible, updateUiState]);

  useEffect(() => {
    // Load formats definition
    loadFormatCatalog()
      .then((catalog) => setFormatData(catalog.cformats))
      .catch((err) => console.error("Failed to load cformats:", err));
  }, []);

  useEffect(() => {
    if (!metadata || !Number.isFinite(Number(metadata.size_bytes))) {
      setEstimatedSize(null);
      return;
    }

    const baseSize = Number(metadata.size_bytes);

    if (selectedMode === "percent") {
      const pct = typeof percentValue === "number" ? percentValue : 60;
      const estimated = Math.round(baseSize * (pct / 100));
      setEstimatedSize(formatBytes(estimated));
    } else if (selectedMode === "size") {
      const targetBytes = parseSizeInput(sizeInputValue);
      setEstimatedSize(targetBytes !== null ? formatBytes(targetBytes) : null);
    } else if (selectedMode === "quality") {
      const crfNum = Number(crfValue);
      const estimated = estimateFromCrf(baseSize, crfNum);
      setEstimatedSize(estimated !== null ? formatBytes(estimated) : null);
    } else {
      setEstimatedSize(null);
    }
  }, [
    metadata,
    selectedMode,
    percentValue,
    sizeInputValue,
    crfValue
  ]);

  const handleMetadataLoaded = (data: MediaFileMetadata) => {
    setMetadata(data);
    const defaultName = data.name || extractFileName(data.path || "");
    setCurrentName(defaultName);
    setSavePath("");
    setSelectedMode("percent");
    setPercentValue(60);
    setSizeInputValue("");
    setCrfValue("26");
    setVideoCodec("");
    setVideoAudioCodec("");
    setAudioCodec("");
    setVideoBitrate("");
    setVideoAudioBitrate("");
    setAudioBitrate("");
    setActivePresetId(null);

    setTimeout(() => {
      setIsDashboardVisible(true);
    }, 150);
  };

  const clearActivePreset = () => {
    setActivePresetId(null);
  };

  const resetView = () => {
    setFilePath("");
    setLoadedFiles([]);
    setIsDashboardVisible(false);
    resetMetadataState();
    setCurrentName("");
    setSavePath("");
    setVideoBitrate("");
    setVideoAudioBitrate("");
    setAudioBitrate("");
    clearActivePreset();
  };

  const { handleFilesSelected, handleConfirmPath, openPicker, removeFileFromBatch } = createFileSelectionHandlers({
    filePath,
    loadedFiles,
    inputRef: pathInputRef,
    pageName: "compressor",
    errorTitle: t("common.error"),
    infoTitle: t("common.info"),
    invalidFilesMessage: t("common.errors.unsupportedFormat"),
    mixedCategoryMessage: t("compressor.bulk.mixedCategoryError"),
    setFilePath,
    setLoadedFiles,
    setMetadata,
    fetchMetadata: triggerFetchMetadata,
    onMetadataLoaded: handleMetadataLoaded,
    resetView,
    isSupportedMetadata: isSupportedCompressorMetadata,
  });

  const estimateFromCrf = (sizeBytes: number, crf: number) => {
    if (!Number.isFinite(sizeBytes) || !Number.isFinite(crf)) return null;
    const normalized = Math.max(0, Math.min(51, crf)) / 51;
    const ratio = Math.exp(-2.6 * normalized);
    const safeRatio = Math.max(0.05, Math.min(1, ratio));
    return Math.round(sizeBytes * safeRatio);
  };

  const resolveSpecsCategory = (value: string) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "video" || normalized === "audio" || normalized === "image") {
      return normalized;
    }
    return "other";
  };

  const getDefaultOutputName = () => metadata?.name || extractFileName(metadata?.path || "") || "";
  const beginNameEdit = () => {
    setNameDraft(currentName || getDefaultOutputName());
    setIsEditingName(true);
  };
  const finishNameEdit = () => {
    setCurrentName(nameDraft.trim() || getDefaultOutputName());
    setIsEditingName(false);
  };

  const handlePresetClick = async (pr: Preset) => {
    if (!pr.id) return;
    if (activePresetId === pr.id) {
      clearActivePreset();
      return;
    }
    try {
      const preset = await loadPreset(pr.id);
      if (preset && preset.compressor) {
        const comp = preset.compressor;
        const mode = (comp.mode || "percent") as "percent" | "size" | "quality";
        setSelectedMode(mode);
        if (mode === "percent") {
          setPercentValue(comp.target_percent ?? 60);
        } else if (mode === "size") {
          setSizeInputValue(comp.target_size || "");
        } else if (mode === "quality") {
          setCrfValue(String(comp.crf ?? 26));
        }
        setActivePresetId(pr.id);
      }
    } catch (e) {
      console.error("Failed to load preset:", e);
    }
  };

  const buildCompressPayload = () => {
    if (!metadata) return null;
    const category = String(metadata.category || "").toLowerCase();
    if (category !== "video" && category !== "audio" && category !== "image") return null;

    const outputDir = savePath.trim() || config.default_save_path.trim() || extractFolderPath(metadata.path);
    const rawName = currentName.trim() || metadata.name || "output";
    const inputFormat = normalizeFormatKey(metadata.extension || metadata.format || "");

    let baseName = rawName;
    if (inputFormat) {
      const suffix = `.${inputFormat}`;
      if (baseName.toLowerCase().endsWith(suffix)) {
        baseName = baseName.slice(0, -suffix.length);
      }
    }
    if (!baseName) baseName = "output";

    const joinPath = (dir: string, file: string) => {
      const sep = dir.includes("/") ? "/" : "\\";
      return dir.endsWith(sep) ? `${dir}${file}` : `${dir}${sep}${file}`;
    };

    let outputPath = inputFormat ? joinPath(outputDir, `${baseName}.${inputFormat}`) : joinPath(outputDir, baseName);

    const targetPercent = selectedMode === "percent" ? percentValue : null;
    const targetSize = selectedMode === "size" ? parseSizeInput(sizeInputValue) : null;
    if (selectedMode === "size" && !Number.isFinite(targetSize)) {
      return null;
    }

    const crfNum = selectedMode === "quality" ? Number(crfValue) : null;

    return {
      input_path: metadata.path,
      output_dir: outputDir,
      output_name: baseName,
      output_format: inputFormat,
      category,
      compress_mode: selectedMode,
      target_percent: Number.isFinite(targetPercent) ? targetPercent : null,
      target_size_bytes: Number.isFinite(targetSize) ? targetSize : null,
      crf: Number.isFinite(crfNum) ? crfNum : null,
      video_codec: category === "video" ? videoCodec : "",
      audio_codec: category === "audio"
        ? audioCodec
        : (category === "video" ? videoAudioCodec : ""),
      video_bitrate: category === "video" ? videoBitrate : "",
      audio_bitrate: category === "audio" ? audioBitrate : (category === "video" ? videoAudioBitrate : ""),
      source_duration_seconds: Number.isFinite(Number(metadata.duration_seconds))
        ? Number(metadata.duration_seconds)
        : null,
      source_size_bytes: Number.isFinite(Number(metadata.size_bytes)) ? Number(metadata.size_bytes) : null,
      source_format: String(metadata.extension || ""),
      path: outputPath
    };
  };

  const handleStartCompress = async (autoStart: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!metadata) return;

    if (loadedFiles.length > 1) {
      // Bulk compressor
      const payloads = loadedFiles.map(file => {
        const category = String(file.category || "").toLowerCase();
    const outputDir = savePath.trim() || config.default_save_path.trim() || extractFolderPath(file.path);
        const rawName = extractFileName(file.path);
        const inputFormat = normalizeFormatKey(file.extension || file.format || "");
        let baseName = rawName;
        if (inputFormat && baseName.toLowerCase().endsWith(`.${inputFormat}`)) {
          baseName = baseName.slice(0, -(inputFormat.length + 1));
        }
        if (!baseName) baseName = "output";

        const targetPercent = selectedMode === "percent" ? percentValue : null;
        const targetSize = selectedMode === "size" ? parseSizeInput(sizeInputValue) : null;
        const crfNum = selectedMode === "quality" ? Number(crfValue) : null;

        return {
          input_path: file.path,
          output_dir: outputDir,
          output_name: baseName,
          output_format: inputFormat,
          category,
          compress_mode: selectedMode,
          target_percent: Number.isFinite(targetPercent) ? targetPercent : null,
          target_size_bytes: Number.isFinite(targetSize) ? targetSize : null,
          crf: Number.isFinite(crfNum) ? crfNum : null,
          video_codec: category === "video" ? videoCodec : "",
          audio_codec: category === "audio"
            ? audioCodec
            : (category === "video" ? videoAudioCodec : ""),
          video_bitrate: category === "video" ? videoBitrate : "",
          audio_bitrate: category === "audio" ? audioBitrate : (category === "video" ? videoAudioBitrate : ""),
          source_duration_seconds: Number.isFinite(Number(file.duration_seconds)) ? Number(file.duration_seconds) : null,
          source_size_bytes: Number.isFinite(Number(file.size_bytes)) ? Number(file.size_bytes) : null,
          source_format: String(file.extension || "")
        };
      });

      const firstCategory = String(loadedFiles[0].category || "").toLowerCase();
      const batchPayload = {
        is_batch: true,
        category: firstCategory,
        items: payloads
      };

      const meta = {
        title: `${t(`common.meta.category.${initialCategory}`, initialCategory.toUpperCase())} (${loadedFiles.length})`,
        thumbnail: "",
        path: savePath.trim() || config.default_save_path.trim() || extractFolderPath(loadedFiles[0].path),
        source: autoStart ? "compress" : "queue"
      };

      const sourceRect = e.currentTarget.getBoundingClientRect();
      try {
        await enqueue("compress", batchPayload, meta, { autoStart, startReason: autoStart ? "compress" : undefined });
        if (sourceRect) {
          animateQueueOrb(sourceRect);
        }
        setTimeout(() => {
          resetView();
        }, 40);
      } catch (err) {
        console.error("Bulk compress enqueue error:", err);
        showNotification(t("common.error"), t("common.errors.startPrefix", { error: String(err) }), "error");
      }
      return;
    }

    const payload = buildCompressPayload();
    if (!payload) {
      showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
      return;
    }

    const meta = {
      title: currentName || metadata.name || t("common.unknownTitle"),
      thumbnail: "",
      path: payload.path || "",
      source: autoStart ? "compress" : "queue"
    };

    const sourceRect = e.currentTarget.getBoundingClientRect();
    try {
      await enqueue("compress", payload, meta, { autoStart, startReason: autoStart ? "compress" : undefined });
      if (sourceRect) {
        animateQueueOrb(sourceRect);
      }
      setTimeout(() => {
        resetView();
      }, 40);
    } catch (err) {
      console.error("Compress enqueue error:", err);
      showNotification(t("common.error"), t("common.errors.startPrefix",  { error: String(err) }), "error");
    }
  };

  const initialCategory = metadata ? String(metadata.category || "").toLowerCase() : "";
  const extKey = metadata ? normalizeFormatKey(metadata.extension || metadata.format || "") : "";
  const extFormatMeta = formatData.find((format) => format.id.toLowerCase() === extKey);

  const videoCodecsOptions = extFormatMeta?.video_codecs || [];
  const audioCodecsOptions = extFormatMeta?.audio_codecs || [];

  const hasDuration = initialCategory === "video" || initialCategory === "audio";
  const targetCategory = metadata ? resolveSpecsCategory(metadata.category || "") : "other";

  const isValid = !!(metadata && (selectedMode !== "size" || Number.isFinite(parseSizeInput(sizeInputValue))));

  return (
    <div className={`${styles.scope} page-root compressor-page`}>
      <div className="page-scroll app-scroll">

        {/* Picker / Input Bar */}
        <MediaFilePickerBar
          idPrefix="compress"
          pageClass="compressor-bar"
          zenClass="compressor-zen"
          dropHintClass="compress-drop-hint"
          placeholder={t("compressor.path.placeholder")}
          value={filePath}
          isLoading={isConfirmLoading}
          hasMetadata={Boolean(metadata)}
          isDashboardVisible={isDashboardVisible}
          inputRef={pathInputRef}
          browseTitle={t("common.browse")}
          clearTitle={t("common.clearSelection")}
          dropHint={t("common.dropHint")}
          onValueChange={(value) => {
            setFilePath(value);
            if (!value.trim()) resetView();
          }}
          onConfirm={handleConfirmPath}
          onBrowse={openPicker}
          onClear={resetView}
        />

        {/* Dashboard area */}
        {isDashboardVisible && metadata && (
          <div id="compress-dashboard" className="compressor-dashboard">
            {loadedFiles.length > 1 ? (
              <BatchInfoCard
                categoryIcon={CATEGORY_ICONS[initialCategory] || PRESET_DEFAULT_ICON}
                categoryLabel={`${t(`common.meta.category.${initialCategory}`, initialCategory ? initialCategory.toUpperCase() : "FILE")} (${loadedFiles.length})`}
                files={loadedFiles}
                removeTitle={t("compressor.bulk.removeFile")}
                onRemove={removeFileFromBatch}
              />
            ) : (
              <CompressorFileInfo
                metadata={metadata}
                currentName={currentName}
                nameDraft={nameDraft}
                isEditingName={isEditingName}
                category={initialCategory}
                hasDuration={hasDuration}
                fallbackName={extractFileName(metadata.path || "")}
                folderPath={extractFolderPath(metadata.path)}
                onNameDraftChange={setNameDraft}
                onFinishNameEdit={finishNameEdit}
                onBeginNameEdit={beginNameEdit}
                onCancelNameEdit={() => {
                  setNameDraft(getDefaultOutputName());
                  setCurrentName(getDefaultOutputName());
                  setIsEditingName(false);
                }}
              />
            )}

            {/* Presets Grid */}
            {compressorPresets.length > 0 && (
              <div id="compress-preset-section" className="preset-section fade-in">
                <span className="option-label">{t("downloader.options.presets")}</span>
                <PresetGrid id="compress-preset-grid" presets={compressorPresets} activeId={activePresetId} onSelect={handlePresetClick} />
              </div>
            )}

            <CompressorModeControls
              selectedMode={selectedMode}
              percentValue={percentValue}
              sizeInputValue={sizeInputValue}
              crfValue={crfValue}
              setSelectedMode={setSelectedMode}
              setPercentValue={setPercentValue}
              setSizeInputValue={setSizeInputValue}
              setCrfValue={setCrfValue}
              clearActivePreset={clearActivePreset}
            />

            {/* Options Panel */}
            <div className="compressor-options-panel fade-in">
              <span className="option-label compressor-options-title">{t("common.options.title")}</span>

              {/* Destination Save Path */}
              <PathSelector
                className="compressor-path-selector fade-in"
                id="compress-save-path-input"
                placeholder={t("common.noSavePathSelected")}
                value={savePath}
                onChange={(selected) => {
                  setSavePath(selected);
                  clearActivePreset();
                }}
                pickerCommand="pick_download_directory"
                title={t("common.browse")}
                useLastPathTitle={t("common.useLastPath")}
                buttonClassName="compressor-small-btn"
              />

              {/* Specs Card */}
              <div id="compress-specs-panel" className="compressor-specs-card fade-in">
                <div className="compressor-specs-grid">
                  <div className="compressor-specs-column" data-side="output">
                    {/* VIDEO SPECS */}
                    {targetCategory === "video" && (
                      <div className="compressor-specs-section" data-section="video">
                        <EstimatedSizeRow classPrefix="compressor" id="compress-estimated-video-size" value={estimatedSize} />
                        <OutputCodecField classPrefix="compressor" label={t("common.videoCodec")} codecs={videoCodecsOptions} value={videoCodec} onChange={(value) => { setVideoCodec(value); clearActivePreset(); }} />
                        <OutputCodecField classPrefix="compressor" label={t("common.audioCodec")} codecs={audioCodecsOptions} value={videoAudioCodec} onChange={(value) => { setVideoAudioCodec(value); clearActivePreset(); }} />
                        <OutputTextField classPrefix="compressor" id="compress-output-video-bitrate" label={t("common.videoBitrate")} placeholder={t("common.auto")} value={videoBitrate} onChange={(value) => { setVideoBitrate(sanitizeBitrateInput(value, 100000)); clearActivePreset(); }} />
                        <OutputTextField classPrefix="compressor" id="compress-output-video-audio-bitrate" label={t("common.audioBitrate")} placeholder={t("common.auto")} value={videoAudioBitrate} onChange={(value) => { setVideoAudioBitrate(sanitizeBitrateInput(value, 1000)); clearActivePreset(); }} />
                      </div>
                    )}

                    {/* AUDIO SPECS */}
                    {targetCategory === "audio" && (
                      <div className="compressor-specs-section" data-section="audio">
                        <EstimatedSizeRow classPrefix="compressor" id="compress-estimated-audio-size" value={estimatedSize} />
                        <OutputCodecField classPrefix="compressor" label={t("common.audioCodec")} codecs={audioCodecsOptions} value={audioCodec} onChange={(value) => { setAudioCodec(value); clearActivePreset(); }} />
                        <OutputTextField classPrefix="compressor" id="compress-output-audio-bitrate" label={t("common.audioBitrate")} placeholder={t("common.auto")} value={audioBitrate} onChange={(value) => { setAudioBitrate(sanitizeBitrateInput(value, 1000)); clearActivePreset(); }} />
                      </div>
                    )}

                    {/* IMAGE SPECS */}
                    {targetCategory === "image" && (
                      <div className="compressor-specs-section" data-section="image">
                        <EstimatedSizeRow classPrefix="compressor" id="compress-estimated-image-size" value={estimatedSize} />
                      </div>
                    )}

                    {/* OTHER SPECS */}
                    {targetCategory === "other" && (
                      <div className="compressor-specs-section" data-section="other">
                        <EstimatedSizeRow classPrefix="compressor" id="compress-estimated-other-size" value={estimatedSize} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer action buttons */}
            <div className="action-footer compressor-action-footer fade-in">
              <button
                id="compress-action-btn"
                className={`big-action-btn ${isValid ? "ready" : ""}`}
                onClick={(e) => handleStartCompress(true, e)}
                disabled={!isValid}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["compress"]} /></svg>
                <span>{t("compressor.actions.compress")}</span>
              </button>
              <button
                id="compress-queue-btn"
                className={`big-action-btn ${isValid ? "ready" : ""}`}
                onClick={(e) => handleStartCompress(false, e)}
                disabled={!isValid}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["add-to-queue"]} /></svg>
                <span>{t("common.addToQueue")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drag & drop overlay */}
      <div id="compress-drop-overlay" className={`compress-drop-overlay ${showDropOverlay ? "visible" : ""}`} aria-hidden={!showDropOverlay}>
        <div className="compress-drop-content">
          <div className="compress-drop-icon" aria-hidden="true">
            <svg viewBox="0 0 512 512"><use href={ICON_ASSETS["download-circle"]} /></svg>
          </div>
          <div className="compress-drop-text">{t("compressor.drop.text")}</div>
        </div>
      </div>
    </div>
  );
};

export default Compressor;