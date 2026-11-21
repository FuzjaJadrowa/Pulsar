import { ICON_ASSETS } from "../../utils/icons";
import React, { useState, useEffect, useRef } from "react";
import { MediaFilePickerBar } from "../../components/media/MediaFilePickerBar";
import { PathSelector } from "../../components/ui/PathSelector";
import { createFileSelectionHandlers } from "../media/fileSelection";
import { EstimatedSizeRow } from "../../components/media/EstimatedSizeRow";
import { OutputCodecField } from "../../components/media/OutputCodecField";
import { OutputSelectField } from "../../components/media/OutputSelectField";
import { OutputTextField } from "../../components/media/OutputTextField";
import { useTranslation } from "../../services/i18n";
import { useConfig } from "../../services/config";
import { invoke } from "../../services/tauri";
import { usePresets } from "../../services/presets";
import { enqueue } from "../queue/queue";
import { animateQueueOrb } from "../queue/animation";
import { useUiState } from "../../services/uiState";
import { showNotification } from "../../services/notifications";
import { formatBytes } from "../../utils/format";
import { useTauriMetadata } from "../../hooks/useTauriMetadata";
import { useFileDragDrop } from "../../hooks/useFileDragDrop";
import { PresetGrid } from "../../components/presets/PresetGrid";
import type { FormatEntry } from "../../services/formats";
import { loadFormatCatalog } from "../../services/formats";
import type { MediaFileMetadata } from "../../types/media";
import type { Preset } from "../../services/presets";
import { BatchInfoCard } from "../../components/media/BatchInfoCard";
import styles from "./Converter.module.css";
import { ConverterFileInfo } from "./components/ConverterFileInfo";
import { sanitizeBitrateInput } from "../../utils/bitrate";
import { extractFileName, extractFolderPath, joinPath } from "../../utils/path";

import { CATEGORY_ICONS } from "../../utils/icons";

interface ConverterProps {
  active?: boolean;
}

export const Converter: React.FC<ConverterProps> = ({ active = true }) => {
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
    setMetadata,
  } = useTauriMetadata<MediaFileMetadata>({
    pickerCommand: "fetch_metadata_converter",
    onSuccess: (data) => {
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error"), err, "error");
    },
  });

  const { showDropOverlay } = useFileDragDrop({
    pageClass: "page-converter",
    onFileDrop: (paths) => {
      handleFilesSelected(paths);
    },
  });

  const [currentName, setCurrentName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"video" | "audio">("video");
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [savePath, setSavePath] = useState("");

  const [videoQuality, setVideoQuality] = useState("");
  const [videoCodec, setVideoCodec] = useState("");
  const [videoBitrate, setVideoBitrate] = useState("");
  const [videoFps, setVideoFps] = useState("");
  const [videoAudioCodec, setVideoAudioCodec] = useState("");
  const [videoAudioBitrate, setVideoAudioBitrate] = useState("");

  const [audioCodec, setAudioCodec] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");

  const [imageWidth, setImageWidth] = useState<number | "">("");
  const [imageHeight, setImageHeight] = useState<number | "">("");
  const [imageQuality, setImageQuality] = useState<number | "">(100);

  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [formatData, setFormatData] = useState<FormatEntry[]>([]);

  const pathInputRef = useRef<HTMLInputElement | null>(null);

  const converterPresets = presets.filter(
    (p) => p.preset_type === "converter" && !p.hidden,
  );

  const { updateUiState } = useUiState();

  useEffect(() => {
    if (!active) return;
    updateUiState({
      converterDashboardVisible: isDashboardVisible,
    });
  }, [active, isDashboardVisible, updateUiState]);

  useEffect(() => {
    // Load formats definition
    loadFormatCatalog()
      .then((catalog) => setFormatData(catalog.cformats))
      .catch((err) => console.error("Failed to load cformats:", err));
  }, []);

  // Debounced estimation calculation
  useEffect(() => {
    if (!selectedFormat || !metadata) {
      setEstimatedSize(null);
      return;
    }

    const timer = setTimeout(() => {
      runEstimate();
    }, 350);

    return () => clearTimeout(timer);
  }, [
    selectedFormat,
    selectedMode,
    videoQuality,
    videoCodec,
    videoBitrate,
    videoFps,
    videoAudioCodec,
    videoAudioBitrate,
    audioCodec,
    audioBitrate,
    imageWidth,
    imageHeight,
    imageQuality,
    metadata,
  ]);

  const handleMetadataLoaded = (data: MediaFileMetadata) => {
    setMetadata(data);
    setCurrentName(data.name || "");
    setNameDraft(data.name || "");
    const initialCategory = String(data.category || "").toLowerCase();

    // Choose default conversion mode
    if (initialCategory === "audio") {
      setSelectedMode("audio");
    } else {
      setSelectedMode("video");
    }

    setSelectedFormat(null);
    setSavePath("");
    setVideoQuality("");
    setVideoCodec("");
    setVideoBitrate("");
    setVideoFps("");
    setVideoAudioCodec("");
    setVideoAudioBitrate("");
    setAudioCodec("");
    setAudioBitrate("");
    setImageWidth("");
    setImageHeight("");
    setImageQuality(100);

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
    setNameDraft("");
    setSelectedFormat(null);
    setSavePath("");
    clearActivePreset();
  };

  const {
    handleFilesSelected,
    handleConfirmPath,
    openPicker,
    removeFileFromBatch,
  } = createFileSelectionHandlers({
    filePath,
    loadedFiles,
    inputRef: pathInputRef,
    pageName: "converter",
    errorTitle: t("common.error"),
    infoTitle: t("common.info"),
    invalidFilesMessage: t("common.errors.invalidFileOrLink"),
    mixedCategoryMessage: t("converter.bulk.mixedCategoryError"),
    setFilePath,
    setLoadedFiles,
    setMetadata,
    fetchMetadata: triggerFetchMetadata,
    onMetadataLoaded: handleMetadataLoaded,
    resetView,
  });

  const runEstimate = async () => {
    if (!selectedFormat || !metadata) {
      setEstimatedSize(null);
      return;
    }

    const formatMeta = formatData.find(
      (format) => format.id.toLowerCase() === selectedFormat.toLowerCase(),
    );
    const targetCategory =
      selectedFormat?.toLowerCase() === "gif" && metadata.category === "video"
        ? "video"
        : formatMeta?.type ||
          (metadata.category === "video" ? selectedMode : metadata.category);

    const payload = {
      source_size_bytes: Number.isFinite(Number(metadata.size_bytes))
        ? Number(metadata.size_bytes)
        : null,
      source_duration_seconds: Number.isFinite(
        Number(metadata.duration_seconds),
      )
        ? Number(metadata.duration_seconds)
        : null,
      source_width: Number.isFinite(Number(metadata.width))
        ? Number(metadata.width)
        : null,
      source_height: Number.isFinite(Number(metadata.height))
        ? Number(metadata.height)
        : null,
      source_category: String(metadata.category || "").toLowerCase(),
      category: targetCategory,
      format: String(selectedFormat).trim(),
      video_quality: targetCategory === "video" ? videoQuality : "",
      video_codec:
        selectedFormat.toLowerCase() === "gif"
          ? ""
          : targetCategory === "video"
            ? videoCodec
            : "",
      video_bitrate:
        selectedFormat.toLowerCase() === "gif"
          ? ""
          : targetCategory === "video"
            ? videoBitrate
            : "",
      video_fps: targetCategory === "video" ? videoFps : "",
      audio_codec:
        selectedFormat.toLowerCase() === "gif"
          ? ""
          : targetCategory === "audio"
            ? audioCodec
            : videoAudioCodec || "",
      audio_bitrate:
        selectedFormat.toLowerCase() === "gif"
          ? ""
          : targetCategory === "audio"
            ? audioBitrate
            : videoAudioBitrate || "",
      image_width:
        targetCategory === "image"
          ? parseInt(String(imageWidth)) || null
          : null,
      image_height:
        targetCategory === "image"
          ? parseInt(String(imageHeight)) || null
          : null,
      image_quality:
        targetCategory === "image"
          ? parseInt(String(imageQuality)) || null
          : null,
    };

    try {
      const result = await invoke<number>("estimate_convert_size", { payload });
      if (Number.isFinite(result)) {
        setEstimatedSize(formatBytes(result));
      } else {
        setEstimatedSize(null);
      }
    } catch (e) {
      console.error("Size estimation failed:", e);
      setEstimatedSize(null);
    }
  };

  const handlePresetClick = async (presetSummary: Preset) => {
    if (!presetSummary.id) return;
    if (activePresetId === presetSummary.id) {
      clearActivePreset();
      return;
    }
    try {
      const preset = await loadPreset(presetSummary.id);
      if (preset && preset.converter) {
        const c = preset.converter;
        if (c.path) {
          setSavePath(c.path);
        }

        const fmt = c.format ? c.format.toLowerCase() : "";
        setSelectedFormat(fmt);

        const formatMeta = formatData.find(
          (format) => format.id.toLowerCase() === fmt,
        );
        const isAudioTarget = formatMeta?.type === "audio";

        if (isAudioTarget) {
          setAudioCodec(c.audio_codec || "");
          setAudioBitrate(c.audio_bitrate || "");
        } else {
          setVideoQuality(c.video_quality || "");
          setVideoCodec(c.video_codec || "");
          setVideoBitrate(c.video_bitrate || "");
          setVideoFps(c.video_fps || "");
          setVideoAudioCodec(c.audio_codec || "");
          setVideoAudioBitrate(c.audio_bitrate || "");
        }

        setActivePresetId(presetSummary.id);
      }
    } catch (error) {
      console.error("Failed to load preset:", error);
    }
  };

  const sanitizeOutputName = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace(/[\\/]+/g, " ").trim();
  };

  const getDefaultOutputName = () =>
    metadata?.name || extractFileName(metadata?.path || "") || "";
  const beginNameEdit = () => {
    setNameDraft(currentName || getDefaultOutputName());
    setIsEditingName(true);
  };
  const finishNameEdit = () => {
    setCurrentName(nameDraft.trim() || getDefaultOutputName());
    setIsEditingName(false);
  };

  const normalizeOutputFormat = (value: string) => {
    if (!value) return "";
    let raw = String(value || "")
      .trim()
      .toLowerCase();
    while (raw.startsWith(".")) raw = raw.slice(1);
    return raw;
  };

  const buildConvertPayload = () => {
    if (!selectedFormat || !metadata) return null;

    const formatMeta = formatData.find(
      (format) => format.id.toLowerCase() === selectedFormat.toLowerCase(),
    );
    const targetCategory =
      selectedFormat?.toLowerCase() === "gif" && metadata.category === "video"
        ? "video"
        : formatMeta?.type ||
          (metadata.category === "video" ? selectedMode : metadata.category);
    if (!targetCategory) return null;

    const outputFormat = normalizeOutputFormat(selectedFormat);
    if (!outputFormat) return null;

    const outputDir =
      savePath.trim() ||
      config.default_save_path.trim() ||
      extractFolderPath(metadata.path);
    const rawName = sanitizeOutputName(
      currentName || metadata.name || "output",
    );

    let baseName = rawName;
    const lowerName = rawName.toLowerCase();
    const suffix = `.${outputFormat}`;
    if (lowerName.endsWith(suffix)) {
      baseName = rawName.slice(0, -suffix.length);
    }
    if (!baseName) baseName = "output";

    const outputPath = joinPath(outputDir, `${baseName}.${outputFormat}`);

    return {
      input_path: metadata.path,
      output_dir: outputDir,
      output_name: baseName,
      output_format: outputFormat,
      category: targetCategory,
      source_category: String(metadata.category || "").toLowerCase(),
      image_width:
        targetCategory === "image"
          ? parseInt(String(imageWidth)) || null
          : null,
      image_height:
        targetCategory === "image"
          ? parseInt(String(imageHeight)) || null
          : null,
      image_quality:
        targetCategory === "image"
          ? parseInt(String(imageQuality)) || null
          : null,
      video_quality: targetCategory === "video" ? videoQuality : "",
      video_codec:
        outputFormat === "gif"
          ? ""
          : targetCategory === "video"
            ? videoCodec
            : "",
      video_bitrate:
        outputFormat === "gif"
          ? ""
          : targetCategory === "video"
            ? videoBitrate
            : "",
      video_fps: targetCategory === "video" ? videoFps : "",
      audio_codec:
        outputFormat === "gif"
          ? ""
          : targetCategory === "audio"
            ? audioCodec
            : videoAudioCodec || "",
      audio_bitrate:
        outputFormat === "gif"
          ? ""
          : targetCategory === "audio"
            ? audioBitrate
            : videoAudioBitrate || "",
      source_duration_seconds: Number.isFinite(
        Number(metadata.duration_seconds),
      )
        ? Number(metadata.duration_seconds)
        : null,
      source_size_bytes: Number.isFinite(Number(metadata.size_bytes))
        ? Number(metadata.size_bytes)
        : null,
      source_format: String(metadata.extension || ""),
      path: outputPath,
    };
  };

  const handleStartConvert = async (
    autoStart: boolean,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!selectedFormat || !metadata) return;

    if (loadedFiles.length > 1) {
      // Bulk conversion
      const formatMeta = formatData.find(
        (format) => format.id.toLowerCase() === selectedFormat.toLowerCase(),
      );
      const outputFormat = normalizeOutputFormat(selectedFormat);
      if (!outputFormat) {
        showNotification(
          t("common.error"),
          t("common.errors.unsupportedFormat"),
          "error",
        );
        return;
      }

      const payloads = loadedFiles.map((file) => {
        const targetCategory =
          selectedFormat?.toLowerCase() === "gif" && file.category === "video"
            ? "video"
            : formatMeta?.type ||
              (file.category === "video" ? selectedMode : file.category);
        const outputDir =
          savePath.trim() ||
          config.default_save_path.trim() ||
          extractFolderPath(file.path);
        const rawName = sanitizeOutputName(
          file.name || extractFileName(file.path) || "output",
        );

        let baseName = rawName;
        const suffix = `.${outputFormat}`;
        if (baseName.toLowerCase().endsWith(suffix)) {
          baseName = baseName.slice(0, -suffix.length);
        }
        if (!baseName) baseName = "output";

        return {
          input_path: file.path,
          output_dir: outputDir,
          output_name: baseName,
          output_format: outputFormat,
          category: targetCategory,
          source_category: String(file.category || "").toLowerCase(),
          image_width:
            targetCategory === "image"
              ? parseInt(String(imageWidth)) || null
              : null,
          image_height:
            targetCategory === "image"
              ? parseInt(String(imageHeight)) || null
              : null,
          image_quality:
            targetCategory === "image"
              ? parseInt(String(imageQuality)) || null
              : null,
          video_quality: targetCategory === "video" ? videoQuality : "",
          video_codec:
            selectedFormat.toLowerCase() === "gif"
              ? ""
              : targetCategory === "video"
                ? videoCodec
                : "",
          video_bitrate:
            selectedFormat.toLowerCase() === "gif"
              ? ""
              : targetCategory === "video"
                ? videoBitrate
                : "",
          video_fps: targetCategory === "video" ? videoFps : "",
          audio_codec:
            selectedFormat.toLowerCase() === "gif"
              ? ""
              : targetCategory === "audio"
                ? audioCodec
                : videoAudioCodec || "",
          audio_bitrate:
            selectedFormat.toLowerCase() === "gif"
              ? ""
              : targetCategory === "audio"
                ? audioBitrate
                : videoAudioBitrate || "",
          source_duration_seconds: Number.isFinite(
            Number(file.duration_seconds),
          )
            ? Number(file.duration_seconds)
            : null,
          source_size_bytes: Number.isFinite(Number(file.size_bytes))
            ? Number(file.size_bytes)
            : null,
          source_format: String(file.extension || ""),
        };
      });

      const firstCategory =
        formatMeta?.type ||
        (loadedFiles[0].category === "video"
          ? selectedMode
          : loadedFiles[0].category);
      const batchPayload = {
        is_batch: true,
        category: firstCategory,
        items: payloads,
      };

      const meta = {
        title: `${t(`common.meta.category.${initialCategory}`, initialCategory.toUpperCase())} (${loadedFiles.length})`,
        thumbnail: "",
        path:
          savePath.trim() ||
          config.default_save_path.trim() ||
          extractFolderPath(loadedFiles[0].path),
        source: autoStart ? "convert" : "queue",
      };

      const sourceRect = e.currentTarget.getBoundingClientRect();
      try {
        await enqueue("convert", batchPayload, meta, {
          autoStart,
          startReason: autoStart ? "convert" : undefined,
        });
        if (sourceRect) {
          animateQueueOrb(sourceRect);
        }
        setTimeout(() => {
          resetView();
        }, 40);
      } catch (err) {
        console.error("Bulk convert enqueue error:", err);
        showNotification(
          t("common.error"),
          t("common.errors.startPrefix", { error: String(err) }),
          "error",
        );
      }
      return;
    }

    const payload = buildConvertPayload();
    if (!payload) {
      showNotification(
        t("common.error"),
        t("common.errors.unsupportedFormat"),
        "error",
      );
      return;
    }

    const meta = {
      title: currentName || metadata.name || t("common.unknownTitle"),
      thumbnail: "",
      path: payload.path || "",
      source: autoStart ? "convert" : "queue",
    };

    const sourceRect = e.currentTarget.getBoundingClientRect();
    try {
      await enqueue("convert", payload, meta, {
        autoStart,
        startReason: autoStart ? "convert" : undefined,
      });
      if (sourceRect) {
        animateQueueOrb(sourceRect);
      }
      setTimeout(() => {
        resetView();
      }, 40);
    } catch (err) {
      console.error("Convert enqueue error:", err);
      showNotification(
        t("common.error"),
        t("common.errors.startPrefix", { error: String(err) }),
        "error",
      );
    }
  };

  const initialCategory = metadata
    ? String(metadata.category || "").toLowerCase()
    : "";
  const isVideoSource = initialCategory === "video";
  const showModeToggle = isVideoSource;

  // Selected format metadata
  const selectedFormatMeta = selectedFormat
    ? formatData.find(
        (f) => f.id.toLowerCase() === selectedFormat.toLowerCase(),
      )
    : null;
  const isGifOutput =
    selectedFormat?.toLowerCase() === "gif" && metadata?.category === "video";
  const targetCategory = isGifOutput
    ? "video"
    : selectedFormatMeta?.type ||
      (isVideoSource ? selectedMode : initialCategory);

  const formatsToRender = formatData.filter((f) => {
    if (isVideoSource) {
      return (
        f.type === selectedMode ||
        (selectedMode === "video" && f.id.toLowerCase() === "gif")
      );
    }
    return f.type === initialCategory;
  });

  const isValid = !!(
    selectedFormat &&
    (savePath.trim().length > 0 || metadata)
  );

  return (
    <div className={`${styles.scope} page-root converter-page`}>
      <div className="page-scroll app-scroll">
        <MediaFilePickerBar
          idPrefix="convert"
          pageClass="converter-bar"
          zenClass="converter-zen"
          dropHintClass="convert-drop-hint"
          placeholder={t("converter.path.placeholder")}
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

        {/* Converter Dashboard */}
        {isDashboardVisible && metadata && (
          <div id="convert-dashboard" className="converter-dashboard">
            {/* File info card */}
            {loadedFiles.length > 1 ? (
              <BatchInfoCard
                categoryIcon={CATEGORY_ICONS[initialCategory] || ""}
                categoryLabel={`${t(`common.meta.category.${initialCategory}`, initialCategory.toUpperCase())} (${loadedFiles.length})`}
                files={loadedFiles}
                removeTitle={t("converter.bulk.removeFile")}
                onRemove={removeFileFromBatch}
              />
            ) : (
              <ConverterFileInfo
                metadata={metadata}
                currentName={currentName}
                nameDraft={nameDraft}
                isEditingName={isEditingName}
                category={initialCategory}
                fallbackName={extractFileName(metadata.path || "")}
                folderPath={extractFolderPath(metadata.path)}
                onNameDraftChange={setNameDraft}
                onFinishNameEdit={finishNameEdit}
                onBeginNameEdit={beginNameEdit}
              />
            )}

            {/* Presets List */}
            {converterPresets.length > 0 && (
              <div
                className="preset-section fade-in"
                id="convert-preset-section"
              >
                <span className="option-label">
                  {t("downloader.options.presets")}
                </span>
                <PresetGrid
                  id="convert-preset-grid"
                  presets={converterPresets}
                  activeId={activePresetId}
                  onSelect={handlePresetClick}
                />
              </div>
            )}

            {/* Format Conversion grid */}
            <div className="converter-options-panel fade-in">
              <div className="converter-options-block">
                <span className="option-label converter-options-title">
                  {t("converter.options.convertTo")}
                </span>
                {showModeToggle && (
                  <div
                    id="convert-media-toggle"
                    className="converter-media-toggle"
                    role="group"
                  >
                    <button
                      type="button"
                      className={`converter-toggle-option ${selectedMode === "video" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedMode("video");
                        setSelectedFormat(null);
                        clearActivePreset();
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <use href={ICON_ASSETS["video"]} />
                      </svg>
                      <span>{t("common.mode.video")}</span>
                    </button>
                    <button
                      type="button"
                      className={`converter-toggle-option ${selectedMode === "audio" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedMode("audio");
                        setSelectedFormat(null);
                        clearActivePreset();
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <use href={ICON_ASSETS["audio"]} />
                      </svg>
                      <span>{t("common.mode.audio")}</span>
                    </button>
                  </div>
                )}
                <div
                  id="convert-format-grid"
                  className="converter-format-grid content-transition"
                >
                  {formatsToRender.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`tile converter-format-tile ${selectedFormat === item.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedFormat(item.id);
                        clearActivePreset();
                      }}
                    >
                      {item.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details Settings Panel */}
              <div
                id="convert-details-panel"
                className={`converter-details-panel ${selectedFormat ? "open" : ""}`}
                aria-hidden={!selectedFormat}
              >
                <div
                  id="convert-specs-panel"
                  className="converter-specs-card fade-in"
                >
                  <div className="converter-specs-grid">
                    <div className="converter-specs-column" data-side="output">
                      <span className="option-label converter-options-title">
                        {t("common.options.title")}
                      </span>

                      {/* Custom save path */}
                      <PathSelector
                        className="converter-path-selector fade-in"
                        id="convert-save-path-input"
                        placeholder={t("common.noSavePathSelected")}
                        value={savePath}
                        onChange={(path) => {
                          setSavePath(path);
                          clearActivePreset();
                        }}
                        pickerCommand="pick_download_directory"
                        title={t("common.browse")}
                        useLastPathTitle={t("common.useLastPath")}
                        buttonClassName="converter-small-btn"
                      />

                      {/* VIDEO Specs */}
                      {targetCategory === "video" && (
                        <div
                          className="converter-specs-section"
                          data-section="video"
                        >
                          <EstimatedSizeRow
                            classPrefix="converter"
                            id="convert-output-video-size"
                            value={estimatedSize}
                          />
                          <OutputSelectField
                            classPrefix="converter"
                            label={t("common.videoQuality")}
                            options={[
                              "",
                              "2160p",
                              "1440p",
                              "1080p",
                              "720p",
                              "480p",
                              "360p",
                              "240p",
                              "144p",
                            ].map((quality) => ({
                              value: quality,
                              label: quality || t("common.auto"),
                            }))}
                            value={videoQuality}
                            onChange={(value) => {
                              setVideoQuality(value);
                              clearActivePreset();
                            }}
                          />
                          {!isGifOutput && (
                            <OutputCodecField
                              classPrefix="converter"
                              label={t("common.videoCodec")}
                              codecs={selectedFormatMeta?.video_codecs || []}
                              value={videoCodec}
                              includeCopyOption
                              onChange={(value) => {
                                setVideoCodec(value);
                                clearActivePreset();
                              }}
                            />
                          )}
                          {!isGifOutput && (
                            <OutputTextField
                              classPrefix="converter"
                              id="convert-output-video-bitrate"
                              label={t("common.videoBitrate")}
                              placeholder={t("common.auto")}
                              value={videoBitrate}
                              onChange={(value) => {
                                setVideoBitrate(
                                  sanitizeBitrateInput(value, 100000),
                                );
                                clearActivePreset();
                              }}
                            />
                          )}
                          <OutputSelectField
                            classPrefix="converter"
                            label={t("common.fps")}
                            options={["", "60", "30", "24"].map((fps) => ({
                              value: fps,
                              label: fps || t("common.auto"),
                            }))}
                            value={videoFps}
                            onChange={(value) => {
                              setVideoFps(value);
                              clearActivePreset();
                            }}
                          />
                          {!isGifOutput && (
                            <OutputCodecField
                              classPrefix="converter"
                              label={t("common.audioCodec")}
                              codecs={selectedFormatMeta?.audio_codecs || []}
                              value={videoAudioCodec}
                              includeCopyOption
                              onChange={(value) => {
                                setVideoAudioCodec(value);
                                clearActivePreset();
                              }}
                            />
                          )}
                          {!isGifOutput && (
                            <OutputTextField
                              classPrefix="converter"
                              id="convert-output-video-audio-bitrate"
                              label={t("common.audioBitrate")}
                              placeholder={t("common.auto")}
                              value={videoAudioBitrate}
                              onChange={(value) => {
                                setVideoAudioBitrate(
                                  sanitizeBitrateInput(value, 1000),
                                );
                                clearActivePreset();
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* AUDIO Specs */}
                      {targetCategory === "audio" && (
                        <div
                          className="converter-specs-section"
                          data-section="audio"
                        >
                          <EstimatedSizeRow
                            classPrefix="converter"
                            id="convert-output-audio-size"
                            value={estimatedSize}
                          />
                          <OutputCodecField
                            classPrefix="converter"
                            label={t("common.audioCodec")}
                            codecs={selectedFormatMeta?.audio_codecs || []}
                            value={audioCodec}
                            onChange={(value) => {
                              setAudioCodec(value);
                              clearActivePreset();
                            }}
                          />
                          <OutputTextField
                            classPrefix="converter"
                            id="convert-output-audio-bitrate"
                            label={t("common.audioBitrate")}
                            placeholder={t("common.auto")}
                            value={audioBitrate}
                            onChange={(value) => {
                              setAudioBitrate(
                                sanitizeBitrateInput(value, 1000),
                              );
                              clearActivePreset();
                            }}
                          />
                        </div>
                      )}

                      {/* IMAGE Specs */}
                      {targetCategory === "image" && (
                        <div
                          className="converter-specs-section"
                          data-section="image"
                        >
                          <EstimatedSizeRow
                            classPrefix="converter"
                            id="convert-output-image-size"
                            value={estimatedSize}
                          />
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">
                              {t("converter.options.resolution")}
                            </span>
                            <div className="converter-specs-control converter-resolution-inputs">
                              <input
                                id="convert-output-image-width"
                                className="custom-input"
                                type="number"
                                placeholder={t(
                                  "converter.options.widthPlaceholder",
                                )}
                                value={imageWidth}
                                onChange={(e) => {
                                  if (e.target.value === "") {
                                    setImageWidth("");
                                    clearActivePreset();
                                    return;
                                  }
                                  let val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 5000) {
                                    val = 5000;
                                  }
                                  setImageWidth(val);
                                  clearActivePreset();
                                }}
                                onBlur={() => {
                                  if (imageWidth !== "") {
                                    let val =
                                      typeof imageWidth === "number"
                                        ? imageWidth
                                        : parseInt(String(imageWidth), 10);
                                    if (!isNaN(val)) {
                                      if (val < 1) val = 1;
                                      if (val > 5000) val = 5000;
                                      setImageWidth(val);
                                    }
                                  }
                                }}
                                autoComplete="off"
                              />
                              <span className="converter-resolution-sep">
                                x
                              </span>
                              <input
                                id="convert-output-image-height"
                                className="custom-input"
                                type="number"
                                placeholder={t(
                                  "converter.options.heightPlaceholder",
                                )}
                                value={imageHeight}
                                onChange={(e) => {
                                  if (e.target.value === "") {
                                    setImageHeight("");
                                    clearActivePreset();
                                    return;
                                  }
                                  let val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 5000) {
                                    val = 5000;
                                  }
                                  setImageHeight(val);
                                  clearActivePreset();
                                }}
                                onBlur={() => {
                                  if (imageHeight !== "") {
                                    let val =
                                      typeof imageHeight === "number"
                                        ? imageHeight
                                        : parseInt(String(imageHeight), 10);
                                    if (!isNaN(val)) {
                                      if (val < 1) val = 1;
                                      if (val > 5000) val = 5000;
                                      setImageHeight(val);
                                    }
                                  }
                                }}
                                autoComplete="off"
                              />
                            </div>
                          </label>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">
                              {t("converter.options.quality")}
                            </span>
                            <div className="converter-specs-control converter-percent-input">
                              <input
                                id="convert-output-image-quality-range"
                                className="converter-quality-range"
                                type="range"
                                min="1"
                                max="100"
                                value={imageQuality || 100}
                                step="1"
                                onChange={(e) => {
                                  setImageQuality(Number(e.target.value));
                                  clearActivePreset();
                                }}
                              />
                              <input
                                id="convert-output-image-quality"
                                className="custom-input"
                                type="number"
                                value={imageQuality}
                                onChange={(e) => {
                                  if (e.target.value === "") {
                                    setImageQuality("");
                                    clearActivePreset();
                                    return;
                                  }
                                  let val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 100) {
                                    val = 100;
                                  }
                                  setImageQuality(val);
                                  clearActivePreset();
                                }}
                                onBlur={() => {
                                  let val =
                                    typeof imageQuality === "number"
                                      ? imageQuality
                                      : parseInt(String(imageQuality), 10);
                                  if (isNaN(val)) val = 100;
                                  if (val < 1) val = 1;
                                  if (val > 100) val = 100;
                                  setImageQuality(val);
                                }}
                                autoComplete="off"
                              />
                              <span className="converter-percent-suffix">
                                %
                              </span>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* OTHER Specs */}
                      {targetCategory === "other" && (
                        <div
                          className="converter-specs-section"
                          data-section="other"
                        >
                          <EstimatedSizeRow
                            classPrefix="converter"
                            id="convert-output-other-size"
                            value={estimatedSize}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-footer converter-action-footer fade-in">
                <button
                  id="convert-action-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={(e) => handleStartConvert(true, e)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <use href={ICON_ASSETS["convert"]} />
                  </svg>
                  <span>{t("converter.actions.convert")}</span>
                </button>
                <button
                  id="convert-queue-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={(e) => handleStartConvert(false, e)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <use href={ICON_ASSETS["add-to-queue"]} />
                  </svg>
                  <span>{t("common.addToQueue")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drag & Drop overlay */}
      <div
        id="convert-drop-overlay"
        className={`convert-drop-overlay ${showDropOverlay ? "visible" : ""}`}
        aria-hidden={!showDropOverlay}
      >
        <div className="convert-drop-content">
          <div className="convert-drop-icon" aria-hidden="true">
            <svg viewBox="0 0 512 512">
              <use href={ICON_ASSETS["download-circle"]} />
            </svg>
          </div>
          <div className="convert-drop-text">{t("converter.drop.text")}</div>
        </div>
      </div>
    </div>
  );
};

export default Converter;
