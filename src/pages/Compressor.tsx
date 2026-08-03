import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { invoke, listen } from "../services/tauri";
import { useConfig } from "../services/config";
import { usePresets } from "../services/presets";
import { enqueue } from "../services/queue";
import { showNotification } from "../services/notifications";
import { formatBytes, formatDuration } from "../utils/format";
import { sanitizeSvg } from "../utils/security";
import { PathSelector } from "../components/PathSelector";

const CATEGORY_ICONS: Record<string, string> = {
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M7 2v20M17 2v20M2 12h20"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m1 16 5.36-5.36c.49-.49 1.27-.49 1.76 0h0l4.11 4.11m.02 0 3.49-3.49c.49-.49 1.27-.49 1.76 0h0l3.49 3.49m-8.74 0 2.81 2.81"/><path d="M15 1H7c-2.11 0-3.15 0-3.95.41-.7.36-1.27.94-1.64 1.64C1 3.85 1 4.9 1 7v8c0 2.1 0 3.15.41 3.95.36.7.94 1.27 1.64 1.64C3.85 21 4.9 21 7 21h8c2.1 0 3.15 0 3.95-.41.7-.36 1.27-.94 1.64-1.64.41-.8.41-1.85.41-3.95V7m0 .01c0-2.11 0-3.15-.41-3.95-.36-.7-.94-1.27-1.64-1.64-.8-.41-1.85-.41-3.95-.41"/></svg>`
};

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:currentColor"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>`;

const SUPPORTED_CATEGORIES = new Set(["video", "audio", "image"]);
const SUPPORTED_IMAGE_FORMATS = new Set([
  "bmp", "gif", "jfif", "jpg", "jpeg", "png", "tga", "tif", "tiff", "webp"
]);

const extractFolderPath = (value: string) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "";
  return normalized.slice(0, idx).replace(/\//g, "\\");
};

const extractFileName = (value: string) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return trimmed;
  return normalized.slice(idx + 1);
};

const parseSizeInput = (value: string) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]*)$/i);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  if (!match[2]) return null;
  let unit = match[2].toLowerCase();
  if (unit === "bytes") unit = "b";
  if (unit === "k") unit = "kb";
  if (unit === "m") unit = "mb";
  if (unit === "g") unit = "gb";
  if (unit === "t") unit = "tb";
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
    tib: 1024 ** 4
  };
  const mult = multipliers[unit];
  if (!mult) return null;
  const bytes = amount * mult;
  return Number.isFinite(bytes) ? Math.round(bytes) : null;
};

const normalizeFormatKey = (value: string) => {
  if (!value) return "";
  let raw = String(value || "").trim().toLowerCase();
  while (raw.startsWith(".")) {
    raw = raw.slice(1);
  }
  return raw;
};

interface CompressorProps {
  active?: boolean;
}

export const Compressor: React.FC<CompressorProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { presets, loadPreset } = usePresets();

  const [filePath, setFilePath] = useState("");
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [showDropOverlay, setShowDropOverlay] = useState(false);

  const [metadata, setMetadata] = useState<any>(null);
  const [currentName, setCurrentName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [savePath, setSavePath] = useState("");

  const [selectedMode, setSelectedMode] = useState<"percent" | "size" | "quality">("percent");
  const [percentValue, setPercentValue] = useState<number>(60);
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
  const [formatData, setFormatData] = useState<any[]>([]);

  // Depth transitions for mode panels
  const [panelTransitionClass, setPanelTransitionClass] = useState("depth-enter");

  // Refs
  const currentMetadataTaskIdRef = useRef<string | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);

  const compressorPresets = presets.filter(p => p.preset_type === "compressor" && !p.hidden);

  useEffect(() => {
    // Sync panel enters
    setPanelTransitionClass("depth-enter");
    const timer = setTimeout(() => {
      setPanelTransitionClass("");
    }, 220);
    return () => clearTimeout(timer);
  }, [selectedMode]);

  useEffect(() => {
    if (!active) return;

    // Apply body classes
    const body = document.body;
    if (!body) return;

    body.classList.toggle("compressor-active", isDashboardVisible);
    body.classList.toggle("advanced-mode", !!config?.advanced_mode);
    body.classList.toggle("zen-mode", !isDashboardVisible);

    return () => {
      body.classList.remove("compressor-active", "zen-mode");
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

    // Expose window.compressorUi
    (window as any).compressorUi = {
      syncState: () => {}
    };

    let active = true;

    const unsubPromises = [
      listen<any>("download-event", (event) => {
        if (!active) return;
        const payload = event.payload;
        if (!payload || !payload.type) return;
        if (payload.type === "bridge_command") return;

        if (payload.id === currentMetadataTaskIdRef.current) {
          setIsConfirmLoading(false);
          currentMetadataTaskIdRef.current = null;

          if (payload.type === "finished" && payload.success === false) {
            showNotification(t("common.error", "Error"), payload.error || t("compressor.errors.invalidFile", "Invalid file."), "error");
          } else if (payload.type === "metadata") {
            if (payload.success && payload.data) {
              const category = String(payload.data.category || "").toLowerCase();
              if (!SUPPORTED_CATEGORIES.has(category)) {
                showNotification(t("common.error", "Error"), t("compressor.errors.unsupportedFormat", "Unsupported format."), "error");
                resetView();
                return;
              }
              if (category === "image") {
                const ext = normalizeFormatKey(payload.data.extension || payload.data.format || "");
                if (!SUPPORTED_IMAGE_FORMATS.has(ext)) {
                  showNotification(t("common.error", "Error"), t("compressor.errors.unsupportedFormat", "Unsupported format."), "error");
                  resetView();
                  return;
                }
              }
              handleMetadataLoaded(payload.data);
            } else {
              showNotification(t("common.error", "Error"), t("compressor.errors.invalidFile", "Invalid file."), "error");
            }
          }
        }
      }),

      listen<any>("tauri://drag-enter", () => {
        if (!active) return;
        if (document.body?.classList.contains("page-compressor")) {
          setShowDropOverlay(true);
        }
      }),

      listen<any>("tauri://drag-leave", () => {
        if (!active) return;
        setShowDropOverlay(false);
      }),

      listen<any>("tauri://drag-drop", (event) => {
        if (!active) return;
        setShowDropOverlay(false);
        if (!document.body?.classList.contains("page-compressor")) return;
        const paths = event.payload?.paths;
        const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === "string" ? paths : null);
        if (rawPath) {
          setFilePath(rawPath);
          triggerConfirmPath(rawPath);
        }
      }),

      listen<any>("tauri://file-drop-hover", () => {
        if (!active) return;
        if (document.body?.classList.contains("page-compressor")) {
          setShowDropOverlay(true);
        }
      }),

      listen<any>("tauri://file-drop-cancelled", () => {
        if (!active) return;
        setShowDropOverlay(false);
      }),

      listen<any>("tauri://file-drop", (event) => {
        if (!active) return;
        setShowDropOverlay(false);
        if (!document.body?.classList.contains("page-compressor")) return;
        const paths = event.payload?.paths || event.payload;
        const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === "string" ? paths : null);
        if (rawPath) {
          setFilePath(rawPath);
          triggerConfirmPath(rawPath);
        }
      })
    ];

    return () => {
      active = false;
      unsubPromises.forEach((promise) => {
        promise.then((unsub) => unsub());
      });
      delete (window as any).compressorUi;
    };
  }, []);

  useEffect(() => {
    if (!metadata || !Number.isFinite(Number(metadata.size_bytes))) {
      setEstimatedSize(null);
      return;
    }

    const baseSize = Number(metadata.size_bytes);

    if (selectedMode === "percent") {
      const estimated = Math.round(baseSize * (percentValue / 100));
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

  const generateTaskId = () => {
    return `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  };

  const handleMetadataLoaded = (data: any) => {
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

  const triggerConfirmPath = async (targetPath: string) => {
    if (isConfirmLoading) return;
    setIsConfirmLoading(true);
    const generatedId = generateTaskId();
    try {
      const taskId = await invoke<string>("fetch_metadata_converter", {
        path: targetPath,
        clientTaskId: generatedId
      });
      currentMetadataTaskIdRef.current = taskId;
    } catch (error) {
      setIsConfirmLoading(false);
      currentMetadataTaskIdRef.current = null;
      console.error("Fetch metadata error:", error);
    }
  };

  const handleConfirmPath = () => {
    const raw = filePath.trim();
    if (!raw) {
      triggerShakeInput();
      return;
    }
    triggerConfirmPath(raw);
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
      console.error("Pick compressor file failed:", e);
    }
  };



  const clearActivePreset = () => {
    setActivePresetId(null);
  };

  const resetView = () => {
    setFilePath("");
    setIsConfirmLoading(false);
    setIsDashboardVisible(false);
    setMetadata(null);
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

  const handlePresetClick = async (pr: any) => {
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

    const outputDir = savePath.trim() || extractFolderPath(metadata.path);
    const rawName = currentName.trim() || metadata.name || "output";
    const defaultName = metadata.name || "";
    const currentNormalized = currentName.trim();
    const inputFormat = normalizeFormatKey(metadata.extension || metadata.format || "");

    let baseName = rawName;
    if (inputFormat) {
      const suffix = `.${inputFormat}`;
      if (baseName.toLowerCase().endsWith(suffix)) {
        baseName = baseName.slice(0, -suffix.length);
      }
    }
    if (!baseName) baseName = "output";

    const isDefaultName = !currentNormalized || currentNormalized.toLowerCase() === defaultName.toLowerCase();
    if (isDefaultName) {
      baseName = `${baseName}-processed`;
    }

    let outputName = baseName;
    const joinPath = (dir: string, file: string) => {
      const sep = dir.includes("/") ? "/" : "\\";
      return dir.endsWith(sep) ? `${dir}${file}` : `${dir}${sep}${file}`;
    };

    let outputPath = inputFormat ? joinPath(outputDir, `${outputName}.${inputFormat}`) : joinPath(outputDir, outputName);
    if (outputPath && metadata.path && outputPath.toLowerCase() === metadata.path.toLowerCase()) {
      outputName = `${baseName}-processed`;
      outputPath = inputFormat
        ? joinPath(outputDir, `${outputName}.${inputFormat}`)
        : joinPath(outputDir, outputName);
    }

    const targetPercent = selectedMode === "percent" ? percentValue : null;
    const targetSize = selectedMode === "size" ? parseSizeInput(sizeInputValue) : null;
    if (selectedMode === "size" && !Number.isFinite(targetSize)) {
      return null;
    }

    const crfNum = selectedMode === "quality" ? Number(crfValue) : null;

    return {
      input_path: metadata.path,
      output_dir: outputDir,
      output_name: outputName,
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
    const payload = buildCompressPayload();
    if (!payload) {
      showNotification(t("common.error", "Error"), t("compressor.errors.unsupportedFormat", "Unsupported format."), "error");
      return;
    }

    const meta = {
      title: currentName || metadata.name || t("common.unknownTitle", "Unknown title"),
      thumbnail: "",
      source: autoStart ? "compress" : "queue"
    };

    try {
      await enqueue("compress", payload, meta, { autoStart, startReason: autoStart ? "compress" : undefined });
      const win = window as any;
      if (win.queueManager && win.queueManager.animateQueueOrb) {
        win.queueManager.animateQueueOrb(e.currentTarget);
      }
      setTimeout(() => {
        resetView();
      }, 40);
    } catch (err) {
      console.error("Compress enqueue error:", err);
      showNotification(t("common.error", "Error"), t("compressor.errors.startPrefix", "Error: {error}", { error: String(err) }), "error");
    }
  };

  const getCrfLabel = (i: number) => {
    if (i === 0) return t("compressor.crf.bestQuality", "0 - Best quality");
    if (i === 26) return t("compressor.crf.balance", "26 - Balance");
    if (i === 51) return t("compressor.crf.bestCompression", "51 - Best compression");
    return String(i);
  };

  const initialCategory = metadata ? String(metadata.category || "").toLowerCase() : "";
  const extKey = metadata ? normalizeFormatKey(metadata.extension || "") : "";
  const extFormatMeta = formatData.find((f: any) => f.id.toLowerCase() === extKey);

  const videoCodecsOptions = extFormatMeta?.video_codecs || [];
  const audioCodecsOptions = extFormatMeta?.audio_codecs || [];

  const hasDuration = initialCategory === "video" || initialCategory === "audio";
  const targetCategory = metadata ? resolveSpecsCategory(metadata.category) : "other";

  const percentFillRatio = (percentValue - 1) / (100 - 1);

  const isValid = !!(metadata && (selectedMode !== "size" || Number.isFinite(parseSizeInput(sizeInputValue))));

  return (
    <div className="page-root compressor-page">
      <div className="page-scroll app-scroll">

        {/* Picker / Input Bar */}
        <div id="compress-search-section" className={`search-section ${!isDashboardVisible ? "centered compressor-zen" : "sticky"}`}>
          <div className="search-box-row compressor-bar" id="compressor-bar">
            <input
              type="text"
              id="compress-path-input"
              ref={pathInputRef}
              placeholder={t("compressor.path.placeholder", "Select file to compress...")}
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
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
              title={t("compressor.actions.browse", "Browse")}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
            <button
              id="compress-confirm-btn"
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
            <div className="drop-hint compress-drop-hint" onClick={openPicker}>
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512">
                  <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" style={{ fillRule: "evenodd" }} fill="currentColor" />
                </svg>
              </span>
              <span className="drop-hint-text">{t("compressor.dropHint", "or just drop a file")}</span>
              <span className="drop-hint-icon" aria-hidden="true">
                <svg viewBox="0 0 512 512">
                  <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" style={{ fillRule: "evenodd" }} fill="currentColor" />
                </svg>
              </span>
            </div>
          )}
        </div>

        {/* Dashboard area */}
        {isDashboardVisible && metadata && (
          <div id="compress-dashboard" className="compressor-dashboard">
            <div className={`compressor-info-card fade-in ${!hasDuration ? "no-duration" : ""} ${isEditingName ? "name-editing" : ""}`}>
              <div className="compressor-name-row">
                {isEditingName ? (
                  <input
                    id="compress-file-name-input"
                    className="compressor-name-input"
                    type="text"
                    placeholder={t("compressor.output.placeholder", "File name")}
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingName(false);
                      } else if (e.key === "Escape") {
                        setCurrentName(metadata.name || extractFileName(metadata.path || ""));
                        setIsEditingName(false);
                      }
                    }}
                    autoFocus
                    autoComplete="off"
                  />
                ) : (
                  <span
                    id="compress-file-name"
                    className="compressor-name-text"
                    data-i18n-lock={currentName ? "true" : undefined}
                    onDoubleClick={() => setIsEditingName(true)}
                  >
                    {currentName || t("compressor.output.placeholder", "File name")}
                  </span>
                )}
                <button
                  type="button"
                  id="compress-rename-btn"
                  className="compressor-rename-btn"
                  title={t("compressor.output.editTitle", "Edit file name")}
                  onClick={() => setIsEditingName(!isEditingName)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>
              <div className="compressor-category-row">
                <span
                  id="compress-category-icon"
                  className="compressor-category-icon"
                  dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[initialCategory] || DEFAULT_ICON }}
                />
                <span id="compress-category-label" className="compressor-category-label">
                  {metadata.extension
                    ? `${t(`compressor.meta.category.${initialCategory}`, initialCategory ? initialCategory.toUpperCase() : "FILE")} (${metadata.extension})`
                    : t(`compressor.meta.category.${initialCategory}`, initialCategory ? initialCategory.toUpperCase() : "FILE")}
                </span>
              </div>
              <div className="compressor-meta-row">
                <div className="compressor-meta-item compressor-meta-location">
                  <span className="compressor-meta-label">{t("compressor.meta.locationLabel", "Location")}</span>
                  <span
                    id="compress-file-location"
                    className="compressor-meta-value compressor-meta-location-value"
                    title={extractFolderPath(metadata.path)}
                  >
                    {extractFolderPath(metadata.path) || "-"}
                  </span>
                </div>
                <div className="compressor-meta-item">
                  <span className="compressor-meta-label">{t("compressor.meta.sizeLabel", "Size")}</span>
                  <span id="compress-file-size" className="compressor-meta-value">
                    {formatBytes(metadata.size_bytes)}
                  </span>
                </div>
                {hasDuration && (
                  <div className="compressor-meta-item compressor-meta-duration">
                    <span className="compressor-meta-label">{t("compressor.meta.durationLabel", "Duration")}</span>
                    <span id="compress-file-duration" className="compressor-meta-value">
                      {metadata.duration_string || formatDuration(metadata.duration_seconds)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Presets Grid */}
            {compressorPresets.length > 0 && (
              <div id="compress-preset-section" className="preset-section fade-in">
                <span className="option-label">{t("downloader.options.presets", "PRESETS")}</span>
                <div className="preset-grid" id="compress-preset-grid">
                  {compressorPresets.map((pr) => (
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

            {/* Controls Panel */}
            <div className="compressor-controls-panel fade-in">
              <span className="option-label compressor-options-title">{t("compressor.options.compressBy", "COMPRESS BY")}</span>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M19 5 5 19" />
                    <circle cx="7" cy="7" r="3" />
                    <circle cx="17" cy="17" r="3" />
                  </svg>
                  <span>{t("compressor.mode.percent", "PERCENT")}</span>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <ellipse cx="12" cy="6" rx="9" ry="3" />
                    <path d="M3 6v6c0 1.66 4.03 3 9 3s9-1.34 9-3V6" />
                    <path d="M3 12v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
                  </svg>
                  <span>{t("compressor.mode.size", "SIZE")}</span>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m12 3.76 2.74 5.55 6.19.41-4.47 4.35 1.06 6.18L12 17.7l-5.52 2.55 1.07-6.18-4.48-4.35 6.19-.41z" />
                  </svg>
                  <span>{t("compressor.mode.quality", "QUALITY")}</span>
                </button>
              </div>

              <div className="compressor-mode-panels">
                {/* PERCENT PANEL */}
                <div className={`compressor-mode-panel ${selectedMode === "percent" ? "" : "hidden"} ${panelTransitionClass}`} data-mode="percent">
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
                      min="1"
                      max="100"
                      value={percentValue}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(100, Number(e.target.value)));
                        setPercentValue(val);
                        clearActivePreset();
                      }}
                      autoComplete="off"
                    />
                    <span className="compressor-percent-suffix">%</span>
                  </div>
                </div>

                {/* SIZE PANEL */}
                <div className={`compressor-mode-panel ${selectedMode === "size" ? "" : "hidden"} ${panelTransitionClass}`} data-mode="size">
                  <div className="compressor-size-control">
                    <input
                      id="compress-size-input"
                      className="custom-input"
                      type="text"
                      placeholder={t("compressor.size.placeholder", "Target size")}
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
                <div className={`compressor-mode-panel ${selectedMode === "quality" ? "" : "hidden"} ${panelTransitionClass}`} data-mode="quality">
                  <div className="compressor-quality-control">
                    <span className="compressor-crf-label">CRF</span>
                    <select
                      id="compress-crf-select"
                      className="custom-select"
                      value={crfValue}
                      onChange={(e) => {
                        setCrfValue(e.target.value);
                        clearActivePreset();
                      }}
                    >
                      {Array.from({ length: 52 }, (_, i) => (
                        <option key={i} value={String(i)}>
                          {getCrfLabel(i)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Options Panel */}
            <div className="compressor-options-panel fade-in">
              <span className="option-label compressor-options-title">{t("compressor.options.title", "OPTIONS")}</span>

              {/* Destination Save Path */}
              <PathSelector
                className="compressor-path-selector fade-in"
                id="compress-save-path-input"
                placeholder={t("compressor.options.pathPlaceholder", "Save path...")}
                value={savePath}
                onChange={(selected) => {
                  setSavePath(selected);
                  clearActivePreset();
                }}
                pickerCommand="pick_download_directory"
                title={t("compressor.actions.browse", "Browse")}
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
                          <span className="compressor-specs-label">{t("compressor.options.estimatedSize", "Estimated size")}</span>
                          <span id="compress-estimated-video-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.videoCodec", "Video codec")}</span>
                          <div className="compressor-specs-control">
                            <select
                              id="compress-video-codec"
                              className="custom-select"
                              value={videoCodec}
                              onChange={(e) => {
                                setVideoCodec(e.target.value);
                                clearActivePreset();
                              }}
                            >
                              <option value="">{t("presetCreator.select.auto", "Auto")}</option>
                              {videoCodecsOptions.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.audioCodec", "Audio codec")}</span>
                          <div className="compressor-specs-control">
                            <select
                              id="compress-video-audio-codec"
                              className="custom-select"
                              value={videoAudioCodec}
                              onChange={(e) => {
                                setVideoAudioCodec(e.target.value);
                                clearActivePreset();
                              }}
                            >
                              <option value="">{t("presetCreator.select.auto", "Auto")}</option>
                              {audioCodecsOptions.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* AUDIO SPECS */}
                    {targetCategory === "audio" && (
                      <div className="compressor-specs-section" data-section="audio">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.estimatedSize", "Estimated size")}</span>
                          <span id="compress-estimated-audio-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                        <label className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.audioCodec", "Audio codec")}</span>
                          <div className="compressor-specs-control">
                            <select
                              id="compress-audio-codec"
                              className="custom-select"
                              value={audioCodec}
                              onChange={(e) => {
                                setAudioCodec(e.target.value);
                                clearActivePreset();
                              }}
                            >
                              <option value="">{t("presetCreator.select.auto", "Auto")}</option>
                              {audioCodecsOptions.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* IMAGE SPECS */}
                    {targetCategory === "image" && (
                      <div className="compressor-specs-section" data-section="image">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.estimatedSize", "Estimated size")}</span>
                          <span id="compress-estimated-image-size" className="compressor-specs-value">{estimatedSize || "-"}</span>
                        </div>
                      </div>
                    )}

                    {/* OTHER SPECS */}
                    {targetCategory === "other" && (
                      <div className="compressor-specs-section" data-section="other">
                        <div className="compressor-specs-row">
                          <span className="compressor-specs-label">{t("compressor.options.estimatedSize", "Estimated size")}</span>
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z" />
                </svg>
                <span>{t("compressor.actions.compress", "COMPRESS")}</span>
              </button>
              <button
                id="compress-queue-btn"
                className={`big-action-btn ${isValid ? "ready" : ""}`}
                onClick={(e) => handleStartCompress(false, e)}
                disabled={!isValid}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>{t("compressor.actions.addToQueue", "ADD TO QUEUE")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drag & drop overlay */}
      <div id="compress-drop-overlay" className={`compress-drop-overlay ${showDropOverlay ? "visible" : ""}`} aria-hidden={!showDropOverlay}>
        <div className="compress-drop-content">
          <div className="compress-drop-icon" aria-hidden="true">
            <svg viewBox="0 0 512 512">
              <path d="M256 0c70.43 0 134.43 28.79 180.82 75.18S512 185.57 512 256s-28.79 134.43-75.18 180.82S326.43 512 256 512s-134.43-28.79-180.82-75.18S0 326.42 0 256 28.79 121.57 75.18 75.18 185.58 0 256 0m-90.15 260.79c-6.91-.29-11.82-2.6-14.65-6.9-7.7-11.53 2.81-22.93 10.09-30.95 20.68-22.68 71.32-77.2 81.53-89.21 7.73-8.54 18.74-8.54 26.46 0 10.54 12.31 63.74 69.32 83.39 91.38 6.82 7.68 15.25 18.15 8.15 28.78-2.9 4.31-7.75 6.61-14.66 6.9H304.2V364.5c0 11.07-9.08 20.17-20.16 20.17h-56.03c-11.08 0-20.16-9.08-20.16-20.17V260.79h-41.97ZM256 24.6c127.27 0 231.4 104.13 231.4 231.4S383.28 487.4 256 487.4 24.6 383.27 24.6 256 128.73 24.6 256 24.6" style={{ fillRule: "evenodd" }} fill="currentColor" />
            </svg>
          </div>
          <div className="compress-drop-text">{t("compressor.drop.text", "Drop file to compress")}</div>
        </div>
      </div>
    </div>
  );
};

export default Compressor;