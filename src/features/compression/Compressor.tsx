import { ICON_ASSETS } from "../../utils/icons";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../../services/i18n";
import { useConfig } from "../../services/config";
import { invoke } from "../../services/tauri";
import { usePresets } from "../../services/presets";
import { enqueue, animateQueueOrb } from "../queue/queue";
import { useUiState } from "../../services/uiState";
import { showNotification } from "../../services/notifications";
import { formatBytes } from "../../utils/format";
import { PathSelector } from "../../components/PathSelector";
import { useTauriMetadata, fetchSingleFileMetadata } from "../../hooks/useTauriMetadata";
import { useFileDragDrop } from "../../hooks/useFileDragDrop";
import { CustomSelect } from "../../components/CustomSelect";
import { PresetGrid } from "../../components/PresetGrid";
import type { FormatEntry } from "../../services/formats";
import { loadFormatCatalog } from "../../services/formats";
import type { MediaFileMetadata } from "../../types/media";
import type { Preset } from "../../services/presets";
import { BatchInfoCard } from "../../components/BatchInfoCard";

import { PRESET_DEFAULT_ICON, CATEGORY_ICONS } from "../../utils/icons";
import { extractFileName, extractFolderPath, normalizeFormatKey, parseSizeInput } from "./files";
import styles from "./Compressor.module.css";
import { CompressorFileInfo } from "./components/CompressorFileInfo";

const SUPPORTED_CATEGORIES = new Set(["video", "audio", "image"]);
const SUPPORTED_IMAGE_FORMATS = new Set([
  "bmp", "gif", "jfif", "jpg", "jpeg", "png", "tga", "tif", "tiff", "webp"
]);

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
      const category = String(data.category || "").toLowerCase();
      if (!SUPPORTED_CATEGORIES.has(category)) {
        showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
        resetView();
        return;
      }
      if (category === "image") {
        const ext = normalizeFormatKey(data.extension || data.format || "");
        if (!SUPPORTED_IMAGE_FORMATS.has(ext)) {
          showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
          resetView();
          return;
        }
      }
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error"), err, "error");
    }
  });

  const handleFilesSelected = async (inputPaths: string | string[]) => {
    const rawPaths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
    const cleanPaths = rawPaths.map(p => String(p || "").trim()).filter(Boolean);
    if (cleanPaths.length === 0) return;

    if (cleanPaths.length === 1) {
      setLoadedFiles([]);
      setFilePath(cleanPaths[0]);
      triggerFetchMetadata(cleanPaths[0]);
      return;
    }

    // Multiple files (Bulk Mode)
    try {
      const metaPromises = cleanPaths.map(path => fetchSingleFileMetadata(path));
      const results = await Promise.all(metaPromises);
      const validMeta = results.filter((m): m is MediaFileMetadata => {
        if (!m || !m.path || !m.category) return false;
        const category = String(m.category || "").toLowerCase();
        if (!SUPPORTED_CATEGORIES.has(category)) return false;
        if (category === "image") {
          const ext = normalizeFormatKey(m.extension || m.format || "");
          if (!SUPPORTED_IMAGE_FORMATS.has(ext)) return false;
        }
        return true;
      });

      if (validMeta.length === 0) {
        showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
        return;
      }

      // Category Consistency Check
      const categories = new Set(validMeta.map(m => String(m.category || "").toLowerCase()));
      if (categories.size > 1) {
        showNotification(t("common.info"), t("compressor.bulk.mixedCategoryError"), "info");
        return;
      }

      setLoadedFiles(validMeta);
      setFilePath(validMeta.map(m => m.path).join("; "));
      handleMetadataLoaded(validMeta[0]);
    } catch (e) {
      console.error("Bulk fetch metadata failed:", e);
      showNotification(t("common.error"), String(e), "error");
    }
  };

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
    setActivePresetId(null);

    setTimeout(() => {
      setIsDashboardVisible(true);
    }, 150);
  };

  const handleConfirmPath = () => {
    const raw = filePath.trim();
    if (!raw) {
      triggerShakeInput();
      return;
    }
    const paths = raw.split(";").map(s => s.trim()).filter(Boolean);
    handleFilesSelected(paths);
  };

  const triggerShakeInput = () => {
    if (pathInputRef.current) {
      pathInputRef.current.classList.remove("shake-feedback");
      void pathInputRef.current.offsetWidth;
      pathInputRef.current.classList.add("shake-feedback");
    }
  };

  const openPicker = async () => {
    try {
      const selected = await invoke<string[]>("pick_convert_files");
      if (selected && selected.length > 0) {
        handleFilesSelected(selected);
      }
    } catch (e) {
      console.error("Pick compressor files failed:", e);
    }
  };

  const removeFileFromBatch = (indexToRemove: number) => {
    const updated = loadedFiles.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      resetView();
    } else if (updated.length === 1) {
      setLoadedFiles([]);
      handleMetadataLoaded(updated[0]);
      setFilePath(updated[0].path);
    } else {
      setLoadedFiles(updated);
      setMetadata(updated[0]);
      setFilePath(updated.map(m => m.path).join("; "));
    }
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
    clearActivePreset();
  };

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

  const getCrfLabel = (i: number) => {
    if (i === 0) return t("compressor.crf.bestQuality");
    if (i === 26) return t("compressor.crf.balance");
    if (i === 51) return t("compressor.crf.bestCompression");
    return String(i);
  };

  const initialCategory = metadata ? String(metadata.category || "").toLowerCase() : "";
  const extKey = metadata ? normalizeFormatKey(metadata.extension || metadata.format || "") : "";
  const extFormatMeta = formatData.find((format) => format.id.toLowerCase() === extKey);

  const videoCodecsOptions = extFormatMeta?.video_codecs || [];
  const audioCodecsOptions = extFormatMeta?.audio_codecs || [];

  const hasDuration = initialCategory === "video" || initialCategory === "audio";
  const targetCategory = metadata ? resolveSpecsCategory(metadata.category || "") : "other";

  const pctVal = typeof percentValue === "number" ? percentValue : 60;
  const percentFillRatio = (pctVal - 1) / (100 - 1);

  const isValid = !!(metadata && (selectedMode !== "size" || Number.isFinite(parseSizeInput(sizeInputValue))));

  return (
    <div className={`${styles.scope} page-root compressor-page`}>
      <div className="page-scroll app-scroll">

        {/* Picker / Input Bar */}
        <div id="compress-search-section" className={`search-section ${!isDashboardVisible ? "centered compressor-zen" : "sticky"}`}>
          <div className="search-box-row compressor-bar" id="compressor-bar">
            <input
              type="text"
              id="compress-path-input"
              ref={pathInputRef}
              placeholder={t("compressor.path.placeholder")}
              value={filePath}
              onChange={(e) => {
                setFilePath(e.target.value);
                if (e.target.value.trim() === "") {
                  resetView();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirmPath();
                }
              }}
              autoComplete="off"
            />
            <span
              id="compress-browse-btn"
              className="bar-icon"
              title={t("common.browse")}
              onClick={openPicker}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPicker();
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><use href={ICON_ASSETS["folder-browse"]} /></svg>
            </span>
            {filePath && (
              <button
                type="button"
                className="bar-icon clear-selection-btn"
                title={t("common.clearSelection")}
                aria-label={t("common.clearSelection")}
                onClick={resetView}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><use href={ICON_ASSETS["window-close"]} /></svg>
              </button>
            )}
            <button
              id="compress-confirm-btn"
              className={`bar-action ${isConfirmLoading ? "loading" : ""}`}
              onClick={handleConfirmPath}
              disabled={isConfirmLoading}
            >
              {isConfirmLoading ? (
                <svg className="btn-spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["loading-spinner"]} /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><use href={ICON_ASSETS["clear-selection"]} /></svg>
              )}
            </button>
          </div>
          {!isDashboardVisible && (
            <div className="drop-hint compress-drop-hint" onClick={openPicker}>
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512"><use href={ICON_ASSETS["download-circle"]} /></svg>
              </span>
              <span className="drop-hint-text">{t("common.dropHint")}</span>
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512"><use href={ICON_ASSETS["download-circle"]} /></svg>
              </span>
            </div>
          )}
        </div>

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

            {/* Controls Panel */}
            <div className="compressor-controls-panel fade-in">
              <span className="option-label compressor-options-title">{t("compressor.options.compressBy")}</span>
              <div id="compress-mode-toggle" className="compressor-mode-toggle mode-switcher" role="group" aria-label="Compression mode">
                <button
                  type="button"
                  className={`switch-option ${selectedMode === "percent" ? "active" : ""}`}
                  onClick={() => {
                    setSelectedMode("percent");
                    clearActivePreset();
                  }}
                  aria-pressed={selectedMode === "percent" ? "true" : "false"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["compression-percent"]} /></svg>
                  <span>{t("compressor.mode.percent")}</span>
                </button>
                <button
                  type="button"
                  className={`switch-option ${selectedMode === "size" ? "active" : ""}`}
                  onClick={() => {
                    setSelectedMode("size");
                    clearActivePreset();
                  }}
                  aria-pressed={selectedMode === "size" ? "true" : "false"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["compression-size"]} /></svg>
                  <span>{t("compressor.mode.size")}</span>
                </button>
                <button
                  type="button"
                  className={`switch-option ${selectedMode === "quality" ? "active" : ""}`}
                  onClick={() => {
                    setSelectedMode("quality");
                    clearActivePreset();
                  }}
                  aria-pressed={selectedMode === "quality" ? "true" : "false"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["compression-quality"]} /></svg>
                  <span>{t("compressor.mode.quality")}</span>
                </button>
              </div>

              <div className="compressor-mode-panels">
                {/* PERCENT PANEL */}
                <div className={`compressor-mode-panel ${selectedMode === "percent" ? "" : "hidden"}`} data-mode="percent">
                  <div className="compressor-percent-control">
                    <div className="compressor-slider-track">
                      <div className="track-bg"></div>
                      <div
                        className="track-fill"
                        id="compress-percent-fill"
                        style={{ width: `${percentFillRatio * 100}%` }}
                      ></div>
                      <input
                        type="range"
                        id="compress-percent-range"
                        min="1"
                        max="100"
                        value={percentValue}
                        onChange={(e) => {
                          setPercentValue(Number(e.target.value));
                          clearActivePreset();
                        }}
                        step="1"
                        aria-label="Percent"
                      />
                    </div>
                    <input
                      id="compress-percent-input"
                      className="custom-input compressor-percent-input"
                      type="number"
                      value={percentValue}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          setPercentValue("");
                          clearActivePreset();
                          return;
                        }
                        let val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 100) {
                          val = 100;
                        }
                        setPercentValue(val);
                        clearActivePreset();
                      }}
                      onBlur={() => {
                        let val = typeof percentValue === "number" ? percentValue : parseInt(String(percentValue), 10);
                        if (isNaN(val)) val = 60;
                        if (val < 1) val = 1;
                        if (val > 100) val = 100;
                        setPercentValue(val);
                      }}
                      autoComplete="off"
                    />
                    <span className="compressor-percent-suffix">%</span>
                  </div>
                </div>

                {/* SIZE PANEL */}
                <div className={`compressor-mode-panel ${selectedMode === "size" ? "" : "hidden"}`} data-mode="size">
                  <div className="compressor-size-control">
                    <input
                      id="compress-size-input"
                      className="custom-input"
                      type="text"
                      placeholder={t("compressor.size.placeholder")}
                      value={sizeInputValue}
                      onChange={(e) => {
                        setSizeInputValue(e.target.value);
                        clearActivePreset();
                      }}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* QUALITY PANEL */}
                <div className={`compressor-mode-panel ${selectedMode === "quality" ? "" : "hidden"}`} data-mode="quality">
                  <div className="compressor-quality-control">
                    <span className="compressor-crf-label">CRF</span>
                    <CustomSelect
                      options={Array.from({ length: 52 }, (_, i) => ({
                        value: String(i),
                        label: getCrfLabel(i)
                      }))}
                      value={crfValue}
                      onChange={(val) => {
                        setCrfValue(val);
                        clearActivePreset();
                      }}
                      width="100%"
                    />
                  </div>
                </div>
              </div>
            </div>

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
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.options.estimatedSize")}</span>
                          <span id="compress-estimated-video-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.videoCodec")}</span>
                          <div className="compressor-specs-control">
                            <CustomSelect
                              options={[
                                { value: "", label: t("common.auto") },
                                ...videoCodecsOptions.map((c: string) => ({ value: c, label: c }))
                              ]}
                              value={videoCodec}
                              onChange={(val) => {
                                setVideoCodec(val);
                                clearActivePreset();
                              }}
                              width="100%"
                            />
                          </div>
                        </label>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.audioCodec")}</span>
                          <div className="compressor-specs-control">
                            <CustomSelect
                              options={[
                                { value: "", label: t("common.auto") },
                                ...audioCodecsOptions.map((c: string) => ({ value: c, label: c }))
                              ]}
                              value={videoAudioCodec}
                              onChange={(val) => {
                                setVideoAudioCodec(val);
                                clearActivePreset();
                              }}
                              width="100%"
                            />
                          </div>
                        </label>
                      </div>
                    )}

                    {/* AUDIO SPECS */}
                    {targetCategory === "audio" && (
                      <div className="compressor-specs-section" data-section="audio">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.options.estimatedSize")}</span>
                          <span id="compress-estimated-audio-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.audioCodec")}</span>
                          <div className="compressor-specs-control">
                            <CustomSelect
                              options={[
                                { value: "", label: t("common.auto") },
                                ...audioCodecsOptions.map((c: string) => ({ value: c, label: c }))
                              ]}
                              value={audioCodec}
                              onChange={(val) => {
                                setAudioCodec(val);
                                clearActivePreset();
                              }}
                              width="100%"
                            />
                          </div>
                        </label>
                      </div>
                    )}

                    {/* IMAGE SPECS */}
                    {targetCategory === "image" && (
                      <div className="compressor-specs-section" data-section="image">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.options.estimatedSize")}</span>
                          <span id="compress-estimated-image-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                      </div>
                    )}

                    {/* OTHER SPECS */}
                    {targetCategory === "other" && (
                      <div className="compressor-specs-section" data-section="other">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("common.options.estimatedSize")}</span>
                          <span id="compress-estimated-other-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
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