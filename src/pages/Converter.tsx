import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { invoke } from "../services/tauri";
import { useConfig } from "../services/config";
import { usePresets } from "../services/presets";
import { enqueue } from "../services/queue";
import { showNotification } from "../services/notifications";
import { formatBytes, formatDuration } from "../utils/format";
import { sanitizeSvg } from "../utils/security";
import { PathSelector } from "../components/PathSelector";
import { useTauriMetadata } from "../hooks/useTauriMetadata";
import { useFileDragDrop } from "../hooks/useFileDragDrop";
import { CustomSelect } from "../components/CustomSelect";

import { DEFAULT_ICON, CATEGORY_ICONS } from "../utils/icons";

interface ConverterProps {
  active?: boolean;
}

let cachedConverterState: any = null;

export const Converter: React.FC<ConverterProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { presets } = usePresets();

  const [filePath, setFilePath] = useState(() => cachedConverterState?.filePath ?? "");
  const [isDashboardVisible, setIsDashboardVisible] = useState(() => cachedConverterState?.isDashboardVisible ?? false);

  const {
    metadata,
    isLoading: isConfirmLoading,
    fetchMetadata: triggerFetchMetadata,
    reset: resetMetadataState,
    setMetadata
  } = useTauriMetadata({
    pickerCommand: "fetch_metadata_converter",
    onSuccess: (data) => {
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error", "Error"), err, "error");
    }
  });

  const { showDropOverlay } = useFileDragDrop({
    pageClass: "page-converter",
    onFileDrop: (path) => {
      setFilePath(path);
      triggerFetchMetadata(path);
    }
  });

  const [currentName, setCurrentName] = useState(() => cachedConverterState?.currentName ?? "");
  const [isEditingName, setIsEditingName] = useState(() => cachedConverterState?.isEditingName ?? false);
  const [selectedMode, setSelectedMode] = useState<"video" | "audio">((() => cachedConverterState?.selectedMode ?? "video"));
  const [selectedFormat, setSelectedFormat] = useState<string | null>(() => cachedConverterState?.selectedFormat ?? null);
  const [savePath, setSavePath] = useState(() => cachedConverterState?.savePath ?? "");

  const [videoQuality, setVideoQuality] = useState(() => cachedConverterState?.videoQuality ?? "");
  const [videoCodec, setVideoCodec] = useState(() => cachedConverterState?.videoCodec ?? "");
  const [videoBitrate, setVideoBitrate] = useState(() => cachedConverterState?.videoBitrate ?? "");
  const [videoFps, setVideoFps] = useState(() => cachedConverterState?.videoFps ?? "");
  const [videoAudioCodec, setVideoAudioCodec] = useState(() => cachedConverterState?.videoAudioCodec ?? "");
  const [videoAudioBitrate, setVideoAudioBitrate] = useState(() => cachedConverterState?.videoAudioBitrate ?? "");

  const [audioCodec, setAudioCodec] = useState(() => cachedConverterState?.audioCodec ?? "");
  const [audioBitrate, setAudioBitrate] = useState(() => cachedConverterState?.audioBitrate ?? "");

  const [imageWidth, setImageWidth] = useState<number | "">(() => cachedConverterState?.imageWidth ?? "");
  const [imageHeight, setImageHeight] = useState<number | "">(() => cachedConverterState?.imageHeight ?? "");
  const [imageQuality, setImageQuality] = useState<number | "">(() => cachedConverterState?.imageQuality ?? 100);

  const [estimatedSize, setEstimatedSize] = useState<string | null>(() => cachedConverterState?.estimatedSize ?? null);

  const [activePresetId, setActivePresetId] = useState<string | null>(() => cachedConverterState?.activePresetId ?? null);

  const [formatData, setFormatData] = useState<any[]>(() => cachedConverterState?.formatData ?? []);


  const pathInputRef = useRef<HTMLInputElement | null>(null);

  const converterPresets = presets.filter(p => p.preset_type === "converter" && !p.hidden);

  useEffect(() => {
    if (cachedConverterState && cachedConverterState.metadata) {
      setMetadata(cachedConverterState.metadata);
    }
  }, []);

  useEffect(() => {
    cachedConverterState = {
      filePath,
      isDashboardVisible,
      currentName,
      isEditingName,
      selectedMode,
      selectedFormat,
      savePath,
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
      estimatedSize,
      activePresetId,
      formatData,
      metadata,
    };
  });

  useEffect(() => {
    if (!active) return;

    const body = document.body;
    if (!body) return;

    body.classList.toggle("converter-active", isDashboardVisible);
    body.classList.toggle("advanced-mode", !!config?.advanced_mode);
    body.classList.toggle("zen-mode", !isDashboardVisible);

    return () => {
      body.classList.remove("converter-active", "zen-mode");
    };
  }, [active, isDashboardVisible, config?.advanced_mode]);

  useEffect(() => {
    // Load formats definition
    fetch("./assets/format.json")
      .then((res) => res.json())
      .then((data) => {
        setFormatData(Array.isArray(data?.cformats) ? data.cformats : []);
      })
      .catch((err) => console.error("Failed to load cformats:", err));

    (window as any).converterUi = {
      syncState: () => {}
    };

    return () => {
      delete (window as any).converterUi;
    };
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

  const handleMetadataLoaded = (data: any) => {
    setMetadata(data);
    setCurrentName(data.name || "");
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
    triggerFetchMetadata(raw);
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
      const selected = await invoke<string>("pick_convert_file");
      if (selected) {
        setFilePath(selected);
      }
    } catch (e) {
      console.error("Pick converter file failed:", e);
    }
  };



  const clearActivePreset = () => {
    setActivePresetId(null);
  };

  const resetView = () => {
    setFilePath("");
    setIsDashboardVisible(false);
    resetMetadataState();
    setCurrentName("");
    setSelectedFormat(null);
    setSavePath("");
    clearActivePreset();
  };



  const runEstimate = async () => {
    if (!selectedFormat || !metadata) {
      setEstimatedSize(null);
      return;
    }

    const formatMeta = formatData.find((f: any) => f.id.toLowerCase() === selectedFormat.toLowerCase());
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

  const handlePresetClick = async (presetSummary: any) => {
    if (activePresetId === presetSummary.id) {
      clearActivePreset();
      return;
    }
    try {
      const preset = await invoke<any>("load_preset", { id: presetSummary.id });
      if (preset && preset.converter) {
        const c = preset.converter;
        if (c.path) {
          setSavePath(c.path);
        }

        const fmt = c.format ? c.format.toLowerCase() : "";
        setSelectedFormat(fmt);

        const formatMeta = formatData.find((f: any) => f.id.toLowerCase() === fmt);
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

  const buildConvertPayload = () => {
    if (!selectedFormat || !metadata) return null;

    const formatMeta = formatData.find((f: any) => f.id.toLowerCase() === selectedFormat.toLowerCase());
    const targetCategory = formatMeta?.type || (metadata.category === "video" ? selectedMode : metadata.category);
    if (!targetCategory) return null;

    const outputFormat = normalizeOutputFormat(selectedFormat);
    if (!outputFormat) return null;

    const outputDir = savePath.trim() || extractFolderPath(metadata.path);
    const rawName = sanitizeOutputName(currentName || metadata.name || "output");
    const defaultName = sanitizeOutputName(metadata.name || "");
    const currentNormalized = sanitizeOutputName(currentName || "");

    let baseName = rawName;
    const lowerName = rawName.toLowerCase();
    const suffix = `.${outputFormat}`;
    if (lowerName.endsWith(suffix)) {
      baseName = rawName.slice(0, -suffix.length);
    }
    if (!baseName) baseName = "output";

    const inputFormat = normalizeOutputFormat(metadata.extension || "");
    const isDefaultName = !currentNormalized || currentNormalized.toLowerCase() === defaultName.toLowerCase();
    if (isDefaultName && inputFormat && inputFormat === outputFormat) {
      baseName = `${baseName}-processed`;
    }

    const outputPath = joinPath(outputDir, `${baseName}.${outputFormat}`);

    return {
      input_path: metadata.path,
      output_dir: outputDir,
      output_name: baseName,
      output_format: outputFormat,
      category: targetCategory,
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
    const payload = buildConvertPayload();
    if (!payload) {
      showNotification(t("common.error", "Error"), t("converter.errors.unsupportedFormat", "Unsupported format."), "error");
      return;
    }

    const meta = {
      title: currentName || metadata.name || t("common.unknownTitle", "Unknown title"),
      thumbnail: "",
      source: autoStart ? "convert" : "queue"
    };

    try {
      await enqueue("convert", payload, meta, { autoStart, startReason: autoStart ? "convert" : undefined });
      const win = window as any;
      if (win.queueManager && win.queueManager.animateQueueOrb) {
        win.queueManager.animateQueueOrb(e.currentTarget);
      }
      setTimeout(() => {
        resetView();
      }, 40);
    } catch (err) {
      console.error("Convert enqueue error:", err);
      showNotification(t("common.error", "Error"), t("converter.errors.startPrefix", "Error: {error}", { error: String(err) }), "error");
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
    <div className="page-root converter-page">
      <div className="page-scroll app-scroll">

        {/* Picker / Input Bar */}
        <div id="convert-search-section" className={`search-section ${!isDashboardVisible ? "centered converter-zen" : "sticky"}`}>
          <div className="search-box-row converter-bar" id="converter-bar">
            <input
              type="text"
              id="convert-path-input"
              ref={pathInputRef}
              placeholder={t("converter.path.placeholder", "Select a file to convert...")}
              value={filePath}
              onChange={(e) => {
                setFilePath(e.target.value);
                if (e.target.value.trim() === "") {
                  resetView();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmPath();
                  if (pathInputRef.current) pathInputRef.current.blur();
                }
              }}
              autoComplete="off"
            />
            <span
              id="convert-browse-btn"
              className="bar-icon"
              title={t("converter.actions.browse", "Browse")}
              role="button"
              tabIndex={0}
              onClick={openPicker}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
            <button
              id="convert-confirm-btn"
              className={`bar-action ${isConfirmLoading ? "loading" : ""}`}
              onClick={handleConfirmPath}
              disabled={isConfirmLoading}
            >
              {isConfirmLoading ? (
                <svg className="btn-spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M12 3a9 9 0 0 1 9 9" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              )}
            </button>
          </div>
          {!isDashboardVisible && (
            <div className="drop-hint convert-drop-hint">
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512">
                  <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" fillRule="evenodd" fill="currentColor"/>
                </svg>
              </span>
              <span className="drop-hint-text">{t("converter.dropHint", "or just drop a file")}</span>
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512">
                  <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" fillRule="evenodd" fill="currentColor"/>
                </svg>
              </span>
            </div>
          )}
        </div>

        {/* Converter Dashboard */}
        {isDashboardVisible && metadata && (
          <div id="convert-dashboard" className="converter-dashboard">
            {/* File info card */}
            <div className={`converter-info-card fade-in ${!metadata.duration_seconds ? "no-duration" : ""} ${isEditingName ? "name-editing" : ""}`}>
              <div className="converter-name-row">
                {!isEditingName ? (
                  <>
                    <span className="converter-name-text">
                      {currentName || t("converter.output.placeholder", "Output name")}
                    </span>
                    <button
                      type="button"
                      className="converter-rename-btn"
                      onClick={() => setIsEditingName(true)}
                      title={t("converter.output.editTitle", "Edit name")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      className="converter-name-input"
                      type="text"
                      value={currentName}
                      onChange={(e) => setCurrentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setIsEditingName(false);
                        }
                      }}
                      onBlur={() => setIsEditingName(false)}
                      autoFocus
                    />
                  </>
                )}
              </div>
              <div className="converter-category-row">
                <span
                  className="converter-category-icon"
                  dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[initialCategory] || "" }}
                />
                <span className="converter-category-label">
                  {metadata.extension ? `${t(`converter.meta.category.${initialCategory}`, initialCategory.toUpperCase())} (${metadata.extension})` : t(`converter.meta.category.${initialCategory}`, initialCategory.toUpperCase())}
                </span>
              </div>
              <div className="converter-meta-row">
                <div className="converter-meta-item converter-meta-location">
                  <span className="converter-meta-label">{t("converter.meta.locationLabel", "Location")}</span>
                  <span className="converter-meta-value converter-meta-location-value" title={extractFolderPath(metadata.path)}>
                    {extractFolderPath(metadata.path) || "-"}
                  </span>
                </div>
                <div className="converter-meta-item">
                  <span className="converter-meta-label">{t("converter.meta.sizeLabel", "Size")}</span>
                  <span className="converter-meta-value">{formatBytes(metadata.size_bytes)}</span>
                </div>
                {metadata.duration_seconds && (
                  <div className="converter-meta-item converter-meta-duration">
                    <span className="converter-meta-label">{t("converter.meta.durationLabel", "Duration")}</span>
                    <span className="converter-meta-value">{metadata.duration_string || formatDuration(metadata.duration_seconds)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Presets List */}
            {converterPresets.length > 0 && (
              <div className="preset-section fade-in" id="convert-preset-section">
                <span className="option-label">{t("downloader.options.presets", "PRESETS")}</span>
                <div className="preset-grid" id="convert-preset-grid">
                  {converterPresets.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      className={`preset-card ${activePresetId === pr.id ? "active" : ""}`}
                      onClick={() => handlePresetClick(pr)}
                    >
                      <div
                        className="preset-card-icon"
                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(pr.icon_data_url || pr.icon || DEFAULT_ICON) }}
                      />
                      <div className="preset-card-info">
                        <div className="preset-card-title">
                          {pr.title || t("settings.presetsManager.untitled", "Untitled")}
                        </div>
                        <div className="preset-card-summary">
                          {pr.summary ? (pr.summary.length > 50 ? `${pr.summary.slice(0, 49)}…` : pr.summary) : t("settings.presetsManager.noSummary", "No summary")}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Format Conversion grid */}
            <div className="converter-options-panel fade-in">
              <div className="converter-options-block">
                <span className="option-label converter-options-title">{t("converter.options.convertTo", "CONVERT TO")}</span>
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                        <path d="M7 2v20M17 2v20M2 12h20" />
                      </svg>
                      <span>{t("converter.mode.video", "VIDEO")}</span>
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                      <span>{t("converter.mode.audio", "AUDIO")}</span>
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
                      <span className="option-label converter-options-title">{t("converter.options.title", "OPTIONS")}</span>

                      {/* Custom save path */}
                      <PathSelector
                        className="converter-path-selector fade-in"
                        id="convert-save-path-input"
                        placeholder={t("converter.path.pathPlaceholder", "Save path...")}
                        value={savePath}
                        onChange={(selected) => {
                          setSavePath(selected);
                          clearActivePreset();
                        }}
                        pickerCommand="pick_download_directory"
                        title={t("converter.actions.browse", "Browse")}
                        buttonClassName="converter-small-btn"
                      />

                      {/* VIDEO Specs */}
                      {targetCategory === "video" && (
                        <div className="converter-specs-section" data-section="video">
                          <div className="converter-specs-row">
                            <span className="converter-specs-label">{t("converter.options.estimatedSize", "Estimated size")}</span>
                            <span id="convert-output-video-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("converter.options.videoQuality", "Video quality")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                            <span className="converter-specs-label">{t("converter.options.videoCodec", "Video codec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                            <span className="converter-specs-label">{t("converter.options.videoBitrate", "Video bitrate")}</span>
                            <div className="converter-specs-control">
                              <input
                                id="convert-output-video-bitrate"
                                className="custom-input"
                                type="text"
                                placeholder={t("presetCreator.placeholders.bitrate", "Auto")}
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
                            <span className="converter-specs-label">{t("converter.options.fps", "FPS")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                            <span className="converter-specs-label">{t("converter.options.audioCodec", "Audio codec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                            <span className="converter-specs-label">{t("converter.options.audioBitrate", "Audio bitrate")}</span>
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
                            <span className="converter-specs-label">{t("converter.options.estimatedSize", "Estimated size")}</span>
                            <span id="convert-output-audio-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("converter.options.audioCodec", "Audio codec")}</span>
                            <div className="converter-specs-control">
                              <CustomSelect
                                options={[
                                  { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                            <span className="converter-specs-label">{t("converter.options.audioBitrate", "Audio bitrate")}</span>
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
                            <span className="converter-specs-label">{t("converter.options.estimatedSize", "Estimated size")}</span>
                            <span id="convert-output-image-size" className="converter-specs-value">{estimatedSize || "-"}</span>
                          </div>
                          <label className="converter-specs-row">
                            <span className="converter-specs-label">{t("converter.options.resolution", "Resolution")}</span>
                            <div className="converter-specs-control converter-resolution-inputs">
                              <input
                                id="convert-output-image-width"
                                className="custom-input"
                                type="number"
                                placeholder={t("converter.options.widthPlaceholder", "Width")}
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
                                placeholder={t("converter.options.heightPlaceholder", "Height")}
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
                            <span className="converter-specs-label">{t("converter.options.quality", "Quality")}</span>
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
                            <span className="converter-specs-label">{t("converter.options.estimatedSize", "Estimated size")}</span>
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
                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                    <path d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494" transform="translate(1.407 1.407)scale(2.81)"/>
                  </svg>
                  <span>{t("converter.actions.convert", "CONVERT")}</span>
                </button>
                <button
                  id="convert-queue-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={(e) => handleStartConvert(false, e)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>{t("converter.actions.addToQueue", "ADD TO QUEUE")}</span>
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
            <svg viewBox="0 0 512 512">
              <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" style={{ fillRule: "evenodd" }} fill="currentColor" />
            </svg>
          </div>
          <div className="convert-drop-text">{t("converter.drop.text", "Drop file to convert")}</div>
        </div>
      </div>

    </div>
  );
};

export default Converter;