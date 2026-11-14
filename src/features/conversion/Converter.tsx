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
import styles from "./Converter.module.css";
import { ConverterFileInfo } from "./components/ConverterFileInfo";

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
    setMetadata
  } = useTauriMetadata<MediaFileMetadata>({
    pickerCommand: "fetch_metadata_converter",
    onSuccess: (data) => {
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
      const validMeta = results.filter((m): m is MediaFileMetadata => Boolean(m && m.path && m.category));
      if (validMeta.length === 0) {
        showNotification(t("common.error"), t("common.errors.invalidFileOrLink"), "error");
        return;
      }

      // Category Consistency Check
      const categories = new Set(validMeta.map(m => String(m.category || "").toLowerCase()));
      if (categories.size > 1) {
        showNotification(t("common.info"), t("converter.bulk.mixedCategoryError"), "info");
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
    pageClass: "page-converter",
    onFileDrop: (paths) => {
      handleFilesSelected(paths);
    }
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

  const converterPresets = presets.filter(p => p.preset_type === "converter" && !p.hidden);

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
    metadata
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
      console.error("Pick converter files failed:", e);
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
    setNameDraft("");
    setSelectedFormat(null);
    setSavePath("");
    clearActivePreset();
  };

  const runEstimate = async () => {
    if (!selectedFormat || !metadata) {
      setEstimatedSize(null);
      return;
    }

    const formatMeta = formatData.find((format) => format.id.toLowerCase() === selectedFormat.toLowerCase());
    const targetCategory = formatMeta?.type || (metadata.category === "video" ? selectedMode : metadata.category);

    const payload = {
      source_size_bytes: Number.isFinite(Number(metadata.size_bytes)) ? Number(metadata.size_bytes) : null,
      source_duration_seconds: Number.isFinite(Number(metadata.duration_seconds)) ? Number(metadata.duration_seconds) : null,
      source_width: Number.isFinite(Number(metadata.width)) ? Number(metadata.width) : null,
      source_height: Number.isFinite(Number(metadata.height)) ? Number(metadata.height) : null,
      source_category: String(metadata.category || "").toLowerCase(),
      category: targetCategory,
      format: String(selectedFormat).trim(),
      video_quality: targetCategory === "video" ? videoQuality : "",
      video_codec: targetCategory === "video" ? videoCodec : "",
      video_bitrate: targetCategory === "video" ? videoBitrate : "",
      video_fps: targetCategory === "video" ? videoFps : "",
      audio_codec: targetCategory === "audio" ? audioCodec : (videoAudioCodec || ""),
      audio_bitrate: targetCategory === "audio" ? audioBitrate : (videoAudioBitrate || ""),
      image_width: targetCategory === "image" ? (parseInt(String(imageWidth)) || null) : null,
      image_height: targetCategory === "image" ? (parseInt(String(imageHeight)) || null) : null,
      image_quality: targetCategory === "image" ? (parseInt(String(imageQuality)) || null) : null
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

        const formatMeta = formatData.find((format) => format.id.toLowerCase() === fmt);
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

  const getDefaultOutputName = () => metadata?.name || extractFileName(metadata?.path || "") || "";
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
    let raw = String(value || "").trim().toLowerCase();
    while (raw.startsWith(".")) raw = raw.slice(1);
    return raw;
  };

  const detectPathSeparator = (value: string) => {
    return String(value || "").includes("\\") ? "\\" : "/";
  };

  const joinPath = (base: string, name: string) => {
    if (!base) return name;
    const sep = detectPathSeparator(base);
    if (base.endsWith("/") || base.endsWith("\\")) {
      return `${base}${name}`;
    }
    return `${base}${sep}${name}`;
  };

  const extractFolderPath = (rawPath: string) => {
    if (typeof rawPath !== "string") return "";
    const trimmed = rawPath.trim();
    if (!trimmed) return "";
    const lastSlash = trimmed.lastIndexOf("/");
    const lastBackslash = trimmed.lastIndexOf("\\");
    const lastSep = Math.max(lastSlash, lastBackslash);
    if (lastSep <= 0) return trimmed;
    return trimmed.slice(0, lastSep);
  };

  const extractFileName = (rawPath: string) => {
    if (typeof rawPath !== "string") return "";
    const trimmed = rawPath.trim();
    if (!trimmed) return "";
    const lastSlash = trimmed.lastIndexOf("/");
    const lastBackslash = trimmed.lastIndexOf("\\");
    const lastSep = Math.max(lastSlash, lastBackslash);
    if (lastSep < 0) return trimmed;
    return trimmed.slice(lastSep + 1);
  };

  const buildConvertPayload = () => {
    if (!selectedFormat || !metadata) return null;

    const formatMeta = formatData.find((format) => format.id.toLowerCase() === selectedFormat.toLowerCase());
    const targetCategory = formatMeta?.type || (metadata.category === "video" ? selectedMode : metadata.category);
    if (!targetCategory) return null;

    const outputFormat = normalizeOutputFormat(selectedFormat);
    if (!outputFormat) return null;

    const outputDir = savePath.trim() || config.default_save_path.trim() || extractFolderPath(metadata.path);
    const rawName = sanitizeOutputName(currentName || metadata.name || "output");

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
      image_width: targetCategory === "image" ? (parseInt(String(imageWidth)) || null) : null,
      image_height: targetCategory === "image" ? (parseInt(String(imageHeight)) || null) : null,
      image_quality: targetCategory === "image" ? (parseInt(String(imageQuality)) || null) : null,
      video_quality: targetCategory === "video" ? videoQuality : "",
      video_codec: targetCategory === "video" ? videoCodec : "",
      video_bitrate: targetCategory === "video" ? videoBitrate : "",
      video_fps: targetCategory === "video" ? videoFps : "",
      audio_codec: targetCategory === "audio" ? audioCodec : (videoAudioCodec || ""),
      audio_bitrate: targetCategory === "audio" ? audioBitrate : (videoAudioBitrate || ""),
      source_duration_seconds: Number.isFinite(Number(metadata.duration_seconds)) ? Number(metadata.duration_seconds) : null,
      source_size_bytes: Number.isFinite(Number(metadata.size_bytes)) ? Number(metadata.size_bytes) : null,
      source_format: String(metadata.extension || ""),
      path: outputPath
    };
  };

  const handleStartConvert = async (autoStart: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selectedFormat || !metadata) return;

    if (loadedFiles.length > 1) {
      // Bulk conversion
      const formatMeta = formatData.find((format) => format.id.toLowerCase() === selectedFormat.toLowerCase());
      const outputFormat = normalizeOutputFormat(selectedFormat);
      if (!outputFormat) {
        showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
        return;
      }

      const payloads = loadedFiles.map(file => {
        const targetCategory = formatMeta?.type || (file.category === "video" ? selectedMode : file.category);
    const outputDir = savePath.trim() || config.default_save_path.trim() || extractFolderPath(file.path);
        const rawName = sanitizeOutputName(file.name || extractFileName(file.path) || "output");

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
          image_width: targetCategory === "image" ? (parseInt(String(imageWidth)) || null) : null,
          image_height: targetCategory === "image" ? (parseInt(String(imageHeight)) || null) : null,
          image_quality: targetCategory === "image" ? (parseInt(String(imageQuality)) || null) : null,
          video_quality: targetCategory === "video" ? videoQuality : "",
          video_codec: targetCategory === "video" ? videoCodec : "",
          video_bitrate: targetCategory === "video" ? videoBitrate : "",
          video_fps: targetCategory === "video" ? videoFps : "",
          audio_codec: targetCategory === "audio" ? audioCodec : (videoAudioCodec || ""),
          audio_bitrate: targetCategory === "audio" ? audioBitrate : (videoAudioBitrate || ""),
          source_duration_seconds: Number.isFinite(Number(file.duration_seconds)) ? Number(file.duration_seconds) : null,
          source_size_bytes: Number.isFinite(Number(file.size_bytes)) ? Number(file.size_bytes) : null,
          source_format: String(file.extension || "")
        };
      });

      const firstCategory = formatMeta?.type || (loadedFiles[0].category === "video" ? selectedMode : loadedFiles[0].category);
      const batchPayload = {
        is_batch: true,
        category: firstCategory,
        items: payloads
      };

      const meta = {
        title: `${t(`common.meta.category.${initialCategory}`, initialCategory.toUpperCase())} (${loadedFiles.length})`,
        thumbnail: "",
        path: savePath.trim() || config.default_save_path.trim() || extractFolderPath(loadedFiles[0].path),
        source: autoStart ? "convert" : "queue"
      };

      const sourceRect = e.currentTarget.getBoundingClientRect();
      try {
        await enqueue("convert", batchPayload, meta, { autoStart, startReason: autoStart ? "convert" : undefined });
        if (sourceRect) {
          animateQueueOrb(sourceRect);
        }
        setTimeout(() => {
          resetView();
        }, 40);
      } catch (err) {
        console.error("Bulk convert enqueue error:", err);
        showNotification(t("common.error"), t("common.errors.startPrefix", { error: String(err) }), "error");
      }
      return;
    }

    const payload = buildConvertPayload();
    if (!payload) {
      showNotification(t("common.error"), t("common.errors.unsupportedFormat"), "error");
      return;
    }

    const meta = {
      title: currentName || metadata.name || t("common.unknownTitle"),
      thumbnail: "",
      path: payload.path || "",
      source: autoStart ? "convert" : "queue"
    };

    const sourceRect = e.currentTarget.getBoundingClientRect();
    try {
      await enqueue("convert", payload, meta, { autoStart, startReason: autoStart ? "convert" : undefined });
      if (sourceRect) {
        animateQueueOrb(sourceRect);
      }
      setTimeout(() => {
        resetView();
      }, 40);
    } catch (err) {
      console.error("Convert enqueue error:", err);
      showNotification(t("common.error"), t("common.errors.startPrefix",  { error: String(err) }), "error");
    }
  };

  const initialCategory = metadata ? String(metadata.category || "").toLowerCase() : "";
  const isVideoSource = initialCategory === "video";
  const showModeToggle = isVideoSource;

  // Selected format metadata
  const selectedFormatMeta = selectedFormat ? formatData.find(f => f.id.toLowerCase() === selectedFormat.toLowerCase()) : null;
  const targetCategory = selectedFormatMeta?.type || (isVideoSource ? selectedMode : initialCategory);

  const formatsToRender = formatData.filter(f => {
    if (isVideoSource) {
      return f.type === selectedMode;
    }
    return f.type === initialCategory;
  });

  const isValid = !!(selectedFormat && (savePath.trim().length > 0 || metadata));

  return (
    <div className={`${styles.scope} page-root converter-page`}>
      <div className="page-scroll app-scroll">
        <div id="convert-search-section" className={`search-section ${!isDashboardVisible ? "centered converter-zen" : "sticky"}`}>
          <div className="search-box-row converter-bar" id="converter-bar">
            <input
              type="text"
              id="convert-path-input"
              ref={pathInputRef}
              placeholder={t("converter.path.placeholder")}
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
              id="convert-browse-btn"
              className="bar-icon"
              title={t("common.browse")}
              role="button"
              tabIndex={0}
              onClick={openPicker}
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
              id="convert-confirm-btn"
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
            <div
              className="drop-hint convert-drop-hint"
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
              <div className="preset-section fade-in" id="convert-preset-section">
                <span className="option-label">{t("downloader.options.presets")}</span>
                <PresetGrid id="convert-preset-grid" presets={converterPresets} activeId={activePresetId} onSelect={handlePresetClick} />
              </div>
            )}

            {/* Format Conversion grid */}
            <div className="converter-options-panel fade-in">
              <div className="converter-options-block">
                <span className="option-label converter-options-title">{t("converter.options.convertTo")}</span>
                {showModeToggle && (
                  <div id="convert-media-toggle" className="converter-media-toggle" role="group">
                    <button
                      type="button"
                      className={`converter-toggle-option ${selectedMode === "video" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedMode("video");
                        setSelectedFormat(null);
                        clearActivePreset();
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["video"]} /></svg>
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["audio"]} /></svg>
                      <span>{t("common.mode.audio")}</span>
                    </button>
                  </div>
                )}
                <div id="convert-format-grid" className="converter-format-grid content-transition">
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
              <div id="convert-details-panel" className={`converter-details-panel ${selectedFormat ? "" : "hidden"}`}>
                <div id="convert-specs-panel" className="converter-specs-card fade-in">
                  <div className="converter-specs-grid">
                    <div className="converter-specs-column" data-side="output">
                      <span className="option-label converter-options-title">{t("common.options.title")}</span>

                      {/* Custom save path */}
                      <PathSelector
                        className="converter-path-selector fade-in"
                        id="convert-save-path-input"
                        placeholder={t("common.noSavePathSelected")}
                        value={savePath}
                        onChange={(selected) => {
                          setSavePath(selected);
                          clearActivePreset();
                        }}
                        pickerCommand="pick_download_directory"
                        title={t("common.browse")}
                        useLastPathTitle={t("common.useLastPath")}
                        buttonClassName="converter-small-btn"
                      />

                      {/* VIDEO Specs */}
                      {targetCategory === "video" && (
                        <div className="converter-specs-section" data-section="video">
                          <div className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.options.estimatedSize")}</span>
                            <span id="convert-output-video-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.videoQuality")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("common.auto") },
                                  { value: "2160p", label: "2160p" },
                                  { value: "1440p", label: "1440p" },
                                  { value: "1080p", label: "1080p" },
                                  { value: "720p", label: "720p" },
                                  { value: "480p", label: "480p" },
                                  { value: "360p", label: "360p" },
                                  { value: "240p", label: "240p" },
                                  { value: "144p", label: "144p" },
                                ]}
                                value={videoQuality}
                                onChange={(val) => {
                                  setVideoQuality(val);
                                  clearActivePreset();
                                }}
                                width="100%"
                              />
                            </div>
                          </label>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.videoCodec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("common.auto") },
                                  { value: "copy", label: "Copy (Pass-through)" },
                                  ...(selectedFormatMeta?.video_codecs || []).map((vc: string) => ({ value: vc, label: vc }))
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
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.videoBitrate")}</span>
                            <div className="converter-specs-control">
                              <input
                                id="convert-output-video-bitrate"
                                className="custom-input"
                                type="text"
                                placeholder={t("common.auto")}
                                value={videoBitrate}
                                onChange={(e) => {
                                  setVideoBitrate(e.target.value);
                                  clearActivePreset();
                                }}
                                autoComplete="off"
                              />
                            </div>
                          </label>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.fps")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("common.auto") },
                                  { value: "60", label: "60" },
                                  { value: "30", label: "30" },
                                  { value: "24", label: "24" },
                                ]}
                                value={videoFps}
                                onChange={(val) => {
                                  setVideoFps(val);
                                  clearActivePreset();
                                }}
                                width="100%"
                              />
                            </div>
                          </label>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.audioCodec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("common.auto") },
                                  { value: "copy", label: "Copy (Pass-through)" },
                                  ...(selectedFormatMeta?.audio_codecs || []).map((ac: string) => ({ value: ac, label: ac }))
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
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.audioBitrate")}</span>
                            <div className="converter-specs-control">
                              <input
                                id="convert-output-video-audio-bitrate"
                                className="custom-input"
                                type="text"
                                placeholder="Auto"
                                value={videoAudioBitrate}
                                onChange={(e) => {
                                  setVideoAudioBitrate(e.target.value);
                                  clearActivePreset();
                                }}
                                autoComplete="off"
                              />
                            </div>
                          </label>
                        </div>
                      )}

                      {/* AUDIO Specs */}
                      {targetCategory === "audio" && (
                        <div className="converter-specs-section" data-section="audio">
                          <div className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.options.estimatedSize")}</span>
                            <span id="convert-output-audio-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.audioCodec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("common.auto") },
                                  ...(selectedFormatMeta?.audio_codecs || []).map((ac: string) => ({ value: ac, label: ac }))
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
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.audioBitrate")}</span>
                            <div className="converter-specs-control">
                              <input
                                id="convert-output-audio-bitrate"
                                className="custom-input"
                                type="text"
                                placeholder="Auto"
                                value={audioBitrate}
                                onChange={(e) => {
                                  setAudioBitrate(e.target.value);
                                  clearActivePreset();
                                }}
                                autoComplete="off"
                              />
                            </div>
                          </label>
                        </div>
                      )}

                      {/* IMAGE Specs */}
                      {targetCategory === "image" && (
                        <div className="converter-specs-section" data-section="image">
                          <div className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.options.estimatedSize")}</span>
                            <span id="convert-output-image-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("converter.options.resolution")}</span>
                            <div className="converter-specs-control converter-resolution-inputs">
                              <input
                                id="convert-output-image-width"
                                className="custom-input"
                                type="number"
                                placeholder={t("converter.options.widthPlaceholder")}
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
                                    let val = typeof imageWidth === "number" ? imageWidth : parseInt(String(imageWidth), 10);
                                    if (!isNaN(val)) {
                                      if (val < 1) val = 1;
                                      if (val > 5000) val = 5000;
                                      setImageWidth(val);
                                    }
                                  }
                                }}
                                autoComplete="off"
                              />
                              <span className="converter-resolution-sep">x</span>
                              <input
                                id="convert-output-image-height"
                                className="custom-input"
                                type="number"
                                placeholder={t("converter.options.heightPlaceholder")}
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
                                    let val = typeof imageHeight === "number" ? imageHeight : parseInt(String(imageHeight), 10);
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
                            <span className="converter-specs-label">{t("converter.options.quality")}</span>
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
                                  let val = typeof imageQuality === "number" ? imageQuality : parseInt(String(imageQuality), 10);
                                  if (isNaN(val)) val = 100;
                                  if (val < 1) val = 1;
                                  if (val > 100) val = 100;
                                  setImageQuality(val);
                                }}
                                autoComplete="off"
                              />
                              <span className="converter-percent-suffix">%</span>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* OTHER Specs */}
                      {targetCategory === "other" && (
                        <div className="converter-specs-section" data-section="other">
                          <div className="converter-specs-row">
                            <span className="converter-specs-label">{t("common.options.estimatedSize")}</span>
                            <span id="convert-output-other-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
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
                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["convert"]} /></svg>
                  <span>{t("converter.actions.convert")}</span>
                </button>
                <button
                  id="convert-queue-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={(e) => handleStartConvert(false, e)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["add-to-queue"]} /></svg>
                  <span>{t("common.addToQueue")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drag & Drop overlay */}
      <div id="convert-drop-overlay" className={`convert-drop-overlay ${showDropOverlay ? "visible" : ""}`} aria-hidden={!showDropOverlay}>
        <div className="convert-drop-content">
          <div className="convert-drop-icon" aria-hidden="true">
            <svg viewBox="0 0 512 512"><use href={ICON_ASSETS["download-circle"]} /></svg>
          </div>
          <div className="convert-drop-text">{t("converter.drop.text")}</div>
        </div>
      </div>

    </div>
  );
};

export default Converter;