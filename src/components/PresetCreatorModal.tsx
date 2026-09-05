import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { invoke } from "../services/tauri";
import { Preset, exportPreset, getPresetFromCache } from "../services/presets";
import { CustomSelect } from "./CustomSelect";
import { sanitizeSvg } from "../utils/security";
import { ToggleSwitch } from "./ToggleSwitch";
import { PathSelector } from "./PathSelector";
import { useUiState } from "../services/uiState";

interface PresetCreatorModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  presetId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_ICON = `data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="fill:%23ffffff"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>`;

const renderPresetIconPreview = (src: string, alt: string = "preset") => {
  if (!src) src = DEFAULT_ICON;
  let svgText = "";
  if (src.startsWith("data:image/svg+xml")) {
    if (src.includes(";base64,")) {
      try {
        svgText = atob(src.split(";base64,")[1]);
      } catch (e) {
        svgText = "";
      }
    } else if (src.includes(",")) {
      svgText = decodeURIComponent(src.split(",")[1]);
    }
  } else if (src.startsWith("<svg")) {
    svgText = src;
  }

  if (svgText && svgText.includes("<svg")) {
    if (!svgText.includes('fill=')) {
      svgText = svgText.replace('<svg', '<svg fill="#ffffff"');
    } else {
      svgText = svgText.replace(/fill="currentColor"/g, 'fill="#ffffff"').replace(/fill='currentColor'/g, "fill='#ffffff'");
    }
    return (
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgText) }}
        style={{ width: "100%", height: "100%", color: "#ffffff", fill: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}
      />
    );
  }

  return <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
};

let globalFormatData: { downloader: any[]; converter: any[] } = {
  downloader: [],
  converter: [],
};

fetch("./assets/format.json")
  .then((res) => res.json())
  .then((data) => {
    if (data) {
      globalFormatData = {
        downloader: Array.isArray(data?.dformats) ? data.dformats : [],
        converter: Array.isArray(data?.cformats) ? data.cformats : [],
      };
    }
  })
  .catch((err) => console.error("Failed to load formats meta:", err));

export const PresetCreatorModal: React.FC<PresetCreatorModalProps> = ({
  isOpen,
  mode,
  presetId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [iconDataUrl, setIconDataUrl] = useState(DEFAULT_ICON);
  const [presetType, setPresetType] = useState<"downloader" | "converter" | "compressor">("downloader");
  const [format, setFormat] = useState("");
  const [compressMode, setCompressMode] = useState<"percent" | "size" | "quality">("percent");
  const [compressPercent, setCompressPercent] = useState<number | "">(60);
  const [compressSize, setCompressSize] = useState("");
  const [compressCrf, setCompressCrf] = useState("23");
  const [savePath, setSavePath] = useState("");

  const [downloadSubs, setDownloadSubs] = useState(false);
  const [embedSubs, setEmbedSubs] = useState(false);
  const [subsCode, setSubsCode] = useState("");
  const [embedMetadata, setEmbedMetadata] = useState(false);
  const [embedThumbnail, setEmbedThumbnail] = useState(false);
  const [geoBypass, setGeoBypass] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);

  const [videoQuality, setVideoQuality] = useState("");
  const [videoCodec, setVideoCodec] = useState("");
  const [videoBitrate, setVideoBitrate] = useState("");
  const [videoFps, setVideoFps] = useState("");

  const [audioSampleRate, setAudioSampleRate] = useState("");
  const [audioCodec, setAudioCodec] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");

  const [formatSuggestions, setFormatSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formatData, setFormatData] = useState<{ downloader: any[]; converter: any[] }>(globalFormatData);

  const [prevOpenState, setPrevOpenState] = useState({ isOpen: false, mode: "create", presetId: null as string | null });

  const applyPresetData = (preset: Preset) => {
    setTitle(preset.title || "");
    setSummary(preset.summary || "");
    setIconDataUrl(preset.icon_data_url || DEFAULT_ICON);
    setPresetType(preset.preset_type || "downloader");

    if (preset.preset_type === "downloader" && preset.downloader) {
      const d = preset.downloader;
      setFormat(d.format || "");
      setSavePath(d.path || "");
      setDownloadSubs(!!d.download_subtitles);
      setEmbedSubs(!!d.embed_subtitles);
      setSubsCode(d.subtitles_code || "");
      setEmbedMetadata(!!d.embed_metadata);
      setEmbedThumbnail(!!d.embed_thumbnail);
      setGeoBypass(!!d.geo_bypass);
      setMuteAudio(!!d.mute_audio);
      setVideoQuality(d.video_quality || "");
      setVideoCodec(d.video_codec || "");
      setVideoBitrate(d.video_bitrate || "");
      setVideoFps(d.video_fps || "");
      setAudioSampleRate(d.audio_sample_rate || "");
      setAudioCodec(d.audio_codec || "");
      setAudioBitrate(d.audio_bitrate || "");
    } else if (preset.preset_type === "converter" && preset.converter) {
      const c = preset.converter;
      setFormat(c.format || "");
      setSavePath(c.path || "");
      setVideoQuality(c.video_quality || "");
      setVideoCodec(c.video_codec || "");
      setVideoBitrate(c.video_bitrate || "");
      setVideoFps(c.video_fps || "");
      setAudioSampleRate(c.audio_sample_rate || "");
      setAudioCodec(c.audio_codec || "");
      setAudioBitrate(c.audio_bitrate || "");
    } else if (preset.preset_type === "compressor" && preset.compressor) {
      const c = preset.compressor;
      setCompressMode((c.mode as any) || "percent");
      setCompressPercent(c.target_percent ?? 60);
      setCompressSize(c.target_size || "");
      setCompressCrf(c.crf ? String(c.crf) : "23");
    }
  };

  if (isOpen && (!prevOpenState.isOpen || prevOpenState.mode !== mode || prevOpenState.presetId !== presetId)) {
    setPrevOpenState({ isOpen, mode, presetId: presetId || null });
    if (globalFormatData.downloader.length > 0 && formatData.downloader.length === 0) {
      setFormatData(globalFormatData);
    }
    if (mode === "edit" && presetId) {
      const cached = getPresetFromCache(presetId);
      if (cached) {
        applyPresetData(cached);
      }
    } else if (mode === "create") {
      setTitle("");
      setSummary("");
      setIconDataUrl(DEFAULT_ICON);
      setPresetType("downloader");
      setFormat("");
      setCompressMode("percent");
      setCompressPercent(60);
      setCompressSize("");
      setCompressCrf("23");
      setSavePath("");
      setDownloadSubs(false);
      setEmbedSubs(false);
      setSubsCode("");
      setEmbedMetadata(false);
      setEmbedThumbnail(false);
      setGeoBypass(false);
      setMuteAudio(false);
      setVideoQuality("");
      setVideoCodec("");
      setVideoBitrate("");
      setVideoFps("");
      setAudioSampleRate("");
      setAudioCodec("");
      setAudioBitrate("");
    }
  }

  useEffect(() => {
    if (globalFormatData.downloader.length > 0) {
      setFormatData(globalFormatData);
    } else {
      fetch("./assets/format.json")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            const parsed = {
              downloader: Array.isArray(data?.dformats) ? data.dformats : [],
              converter: Array.isArray(data?.cformats) ? data.cformats : [],
            };
            globalFormatData = parsed;
            setFormatData(parsed);
          }
        })
        .catch((err) => console.error("Failed to load formats meta:", err));
    }
  }, []);

  useEffect(() => {
    if (isOpen && mode === "edit" && presetId) {
      invoke<Preset>("load_preset", { id: presetId })
        .then((preset) => {
          if (preset) {
            applyPresetData(preset);
          }
        })
        .catch((err) => {
          console.error("Failed to load preset details:", err);
        });
    }
  }, [isOpen, mode, presetId]);

  useEffect(() => {
    if (!format.trim()) {
      setFormatSuggestions([]);
      return;
    }
    const query = format.toLowerCase();
    const formats = presetType === "converter" ? formatData.converter : formatData.downloader;
    const matches = formats
      .filter((item: any) => String(item.id || "").toLowerCase().includes(query))
      .map((item: any) => String(item.id).toLowerCase());
    setFormatSuggestions(matches.slice(0, 5));
  }, [format, presetType, formatData]);

  const processImageFile = (file: File) => {
    const isImg = file.type?.startsWith("image/") || /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(file.name);
    if (!isImg) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setIconDataUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) {
      processImageFile(e.dataTransfer.files[0]);
    } else if (e.dataTransfer.items?.length) {
      const item = e.dataTransfer.items[0];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) processImageFile(file);
      }
    }
  };

  const handleBrowseIcon = () => {
    fileInputRef.current?.click();
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processImageFile(e.target.files[0]);
    }
  };


  const selectedFormatLower = format.toLowerCase().trim();
  const formatMap = presetType === "converter" ? formatData.converter : formatData.downloader;
  const currentFormatMeta = formatMap.find((item) => String(item.id).toLowerCase() === selectedFormatLower);
  const isFormatValid = presetType === "compressor" || (selectedFormatLower.length > 0 && !!currentFormatMeta);

  const isFormValid = () => {
    if (!title.trim()) return false;
    
    if (presetType === "downloader" || presetType === "converter") {
      if (!selectedFormatLower) return false;
      if (!isFormatValid) return false;
    }
    
    if (presetType === "compressor") {
      if (!compressMode) return false;
      if (compressMode === "percent") {
        return typeof compressPercent === "number" && compressPercent >= 1 && compressPercent <= 100;
      }
      if (compressMode === "size") {
        return compressSize.trim().length > 0;
      }
      if (compressMode === "quality") {
        return !!compressCrf;
      }
    }
    
    return true;
  };

  const handleExport = async () => {
    if (!isFormValid()) return;

    const payload: Preset = {
      id: mode === "edit" ? presetId || undefined : undefined,
      title: title.trim(),
      summary: summary.trim(),
      icon_data_url: iconDataUrl,
      preset_type: presetType,
      hidden: false,
    };

    if (presetType === "downloader") {
      payload.downloader = {
        mode: "video",
        format: format.trim().toLowerCase(),
        path: savePath.trim() || undefined,
        video_quality: videoQuality || undefined,
        download_subtitles: downloadSubs,
        embed_subtitles: downloadSubs && embedSubs,
        subtitles_code: downloadSubs && subsCode.trim() ? subsCode.trim() : undefined,
        embed_metadata: embedMetadata,
        embed_thumbnail: embedThumbnail,
        geo_bypass: geoBypass,
        mute_audio: muteAudio,
        video_codec: videoCodec || undefined,
        audio_codec: audioCodec || undefined,
        video_bitrate: videoBitrate || undefined,
        audio_bitrate: audioBitrate || undefined,
        video_fps: videoFps || undefined,
        audio_sample_rate: audioSampleRate || undefined,
      };
    } else if (presetType === "converter") {
      payload.converter = {
        format: format.trim().toLowerCase(),
        path: savePath.trim() || undefined,
        video_quality: videoQuality || undefined,
        video_codec: videoCodec || undefined,
        video_bitrate: videoBitrate || undefined,
        video_fps: videoFps || undefined,
        audio_codec: audioCodec || undefined,
        audio_bitrate: audioBitrate || undefined,
        audio_sample_rate: audioSampleRate || undefined,
      };
    } else if (presetType === "compressor") {
      payload.compressor = {
        mode: compressMode,
        target_percent: compressMode === "percent" ? (typeof compressPercent === "number" ? compressPercent : undefined) : undefined,
        target_size: compressMode === "size" ? compressSize : undefined,
        crf: compressMode === "quality" ? parseInt(compressCrf) || undefined : undefined,
      };
    }

    try {
      const savedId = await invoke<string>("save_preset", { preset: payload });
      onSaved();
      await exportPreset(savedId);
      onClose();
    } catch (err) {
      console.error("Export preset failed:", err);
    }
  };

  const handleSave = async () => {
    if (!isFormValid()) return;

    const payload: Preset = {
      id: mode === "edit" ? presetId || undefined : undefined,
      title: title.trim(),
      summary: summary.trim(),
      icon_data_url: iconDataUrl,
      preset_type: presetType,
      hidden: false,
    };

    if (presetType === "downloader") {
      payload.downloader = {
        mode: "video",
        format: format.trim().toLowerCase(),
        path: savePath.trim() || undefined,
        video_quality: videoQuality || undefined,
        download_subtitles: downloadSubs,
        embed_subtitles: downloadSubs && embedSubs,
        subtitles_code: downloadSubs && subsCode.trim() ? subsCode.trim() : undefined,
        embed_metadata: embedMetadata,
        embed_thumbnail: embedThumbnail,
        geo_bypass: geoBypass,
        mute_audio: muteAudio,
        video_codec: videoCodec || undefined,
        audio_codec: audioCodec || undefined,
        video_bitrate: videoBitrate || undefined,
        audio_bitrate: audioBitrate || undefined,
        video_fps: videoFps || undefined,
        audio_sample_rate: audioSampleRate || undefined,
      };
    } else if (presetType === "converter") {
      payload.converter = {
        format: format.trim().toLowerCase(),
        path: savePath.trim() || undefined,
        video_quality: videoQuality || undefined,
        video_codec: videoCodec || undefined,
        video_bitrate: videoBitrate || undefined,
        video_fps: videoFps || undefined,
        audio_codec: audioCodec || undefined,
        audio_bitrate: audioBitrate || undefined,
        audio_sample_rate: audioSampleRate || undefined,
      };
    } else if (presetType === "compressor") {
      payload.compressor = {
        mode: compressMode,
        target_percent: compressMode === "percent" ? (typeof compressPercent === "number" ? compressPercent : undefined) : undefined,
        target_size: compressMode === "size" ? compressSize : undefined,
        crf: compressMode === "quality" ? parseInt(compressCrf) || undefined : undefined,
      };
    }

    try {
      await invoke("save_preset", { preset: payload });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save preset failed:", err);
    }
  };


  const videoCodecOptions = [
    { value: "", label: t("presetCreator.select.auto") },
    ...(currentFormatMeta?.video_codecs || []).map((vc: string) => ({ value: vc, label: vc }))
  ];

  const audioCodecOptions = [
    { value: "", label: t("presetCreator.select.auto") },
    ...(currentFormatMeta?.audio_codecs || []).map((ac: string) => ({ value: ac, label: ac }))
  ];
  
  const showVideoSettings = presetType !== "compressor" && (!currentFormatMeta || currentFormatMeta.type === "video");
  const showAudioSettings = presetType !== "compressor" && (!currentFormatMeta || currentFormatMeta.type === "audio" || (currentFormatMeta.type === "video" && !muteAudio));

  const crfOptions = Array.from({ length: 52 }, (_, i) => ({ value: String(i), label: String(i) }));

  const [activeModal, setActiveModal] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  const { updateUiState } = useUiState();

  useEffect(() => {
    updateUiState({ isPresetModalOpen: isOpen });
    if (isOpen) {
      setActiveModal(true);
      setIsClosing(false);
    } else if (activeModal) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setActiveModal(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeModal, updateUiState]);

  useEffect(() => {
    return () => {
      updateUiState({ isPresetModalOpen: false });
    };
  }, [updateUiState]);

  if (!activeModal) return null;

  return (
    <div className={`preset-modal-overlay ${isClosing ? "closing" : "open"}`} id="preset-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="preset-modal" role="dialog" aria-modal="true">
        <div className="preset-modal-header">
          <div className="preset-modal-title">
            {mode === "edit" ? t("presetCreator.title.edit") : t("presetCreator.title.new")}
          </div>
          <button className="preset-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="preset-modal-body">
          {}
          <div className="preset-section">
            <div className="preset-section-title">{t("presetCreator.sections.basic")}</div>
            <div className="preset-form-grid">
              <label className="preset-field">
                <span>{t("presetCreator.fields.title")}</span>
                <input
                  className="custom-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("presetCreator.placeholders.title")}
                />
              </label>
              <label className="preset-field">
                <span>{t("presetCreator.fields.summary")}</span>
                <input
                  className="custom-input"
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={50}
                  placeholder={t("presetCreator.placeholders.summary")}
                />
              </label>
            </div>

            <div className="preset-detail-row">
              {}
              <div className="preset-field preset-field-icon">
                <span>{t("presetCreator.fields.icon")}</span>
                <div
                  className="preset-icon-drop"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="preset-icon-preview">
                    {renderPresetIconPreview(iconDataUrl, title || "preset")}
                  </div>
                  <div className="preset-icon-meta">
                    <div className="preset-icon-title">{t("presetCreator.icon.title")}</div>
                    <div className="preset-icon-hint">{t("presetCreator.icon.hint")}</div>
                    <button type="button" className="anim-btn preset-icon-browse" onClick={handleBrowseIcon}>
                      {t("common.browse")}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    className="preset-icon-file"
                    type="file"
                    accept="image/*,.svg"
                    onChange={handleIconChange}
                    style={{ display: "none" }}
                  />
                </div>
              </div>

              {}
              <div className="preset-field preset-field-type">
                <span>{t("presetCreator.sections.type")}</span>
                <div className="preset-type-switcher">
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "downloader" ? "active" : ""}`}
                    onClick={() => { setPresetType("downloader"); setFormat(""); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>{t("settings.presetsManager.types.downloader")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "converter" ? "active" : ""}`}
                    onClick={() => { setPresetType("converter"); setFormat(""); }}
                  >
                    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" width="16" height="16">
                      <path d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494" transform="translate(1.407 1.407)scale(2.81)" />
                    </svg>
                    <span>{t("settings.presetsManager.types.converter")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "compressor" ? "active" : ""}`}
                    onClick={() => setPresetType("compressor")}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
                      <path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z" />
                    </svg>
                    <span>{t("settings.presetsManager.types.compressor")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {}
          {presetType !== "compressor" && (
            <div className="preset-section preset-format-section">
              <div className="preset-section-title">{t("presetCreator.sections.format")}</div>
              <div className="preset-format-input" style={{ position: "relative" }}>
                <input
                  className="custom-input"
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t("presetCreator.placeholders.format")}
                />
                {showSuggestions && formatSuggestions.length > 0 && (
                  <div className="preset-format-suggestions open">
                    {formatSuggestions.map((item) => (
                      <div
                        key={item}
                        className="suggestion-item"
                        onMouseDown={() => {
                          setFormat(item);
                          setShowSuggestions(false);
                        }}
                      >
                        <span>{item.toUpperCase()}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ opacity: 0.6 }}>
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {}
          {presetType === "compressor" && (
            <div className="preset-section preset-compressor-section">
              <div className="preset-section-title">{t("presetCreator.sections.compression")}</div>
              <div className="preset-compressor-toggle" role="group">
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "percent" ? "active" : ""}`}
                  onClick={() => setCompressMode("percent")}
                >
                  <span>{t("compressor.mode.percent")}</span>
                </button>
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "size" ? "active" : ""}`}
                  onClick={() => setCompressMode("size")}
                >
                  <span>{t("compressor.mode.size")}</span>
                </button>
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "quality" ? "active" : ""}`}
                  onClick={() => setCompressMode("quality")}
                >
                  <span>{t("compressor.mode.quality")}</span>
                </button>
              </div>

              <div className="preset-compressor-panels">
                {compressMode === "percent" && (
                  <div className="preset-compressor-panel">
                    <div className="preset-compressor-percent">
                      <div className="preset-compressor-track">
                        <div
                          className="preset-compressor-fill"
                          style={{ width: `${compressPercent}%` }}
                        ></div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={compressPercent}
                          onChange={(e) => setCompressPercent(parseInt(e.target.value, 10))}
                        />
                      </div>
                      <input
                        className="custom-input preset-compressor-percent-input"
                        type="number"
                        value={compressPercent}
                        onChange={(e) => {
                          if (e.target.value === "") {
                            setCompressPercent("");
                            return;
                          }
                          let val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 100) {
                            val = 100;
                          }
                          setCompressPercent(val);
                        }}
                        onBlur={() => {
                          let val = typeof compressPercent === "number" ? compressPercent : parseInt(String(compressPercent), 10);
                          if (isNaN(val)) val = 60;
                          if (val < 1) val = 1;
                          if (val > 100) val = 100;
                          setCompressPercent(val);
                        }}
                      />
                      <span className="preset-compressor-percent-suffix">%</span>
                    </div>
                  </div>
                )}

                {compressMode === "size" && (
                  <div className="preset-compressor-panel">
                    <div className="preset-compressor-size">
                      <input
                        className="custom-input"
                        type="text"
                        value={compressSize}
                        onChange={(e) => setCompressSize(e.target.value)}
                        placeholder={t("compressor.size.placeholder")}
                      />
                    </div>
                  </div>
                )}

                {compressMode === "quality" && (
                  <div className="preset-compressor-panel">
                    <div className="preset-compressor-quality">
                      <span className="preset-compressor-crf-label">{t("presetCreator.fields.crf")}</span>
                      <CustomSelect
                        options={crfOptions}
                        value={compressCrf}
                        onChange={setCompressCrf}
                        width="120px"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {}
          {isFormatValid && (
            <div className="preset-advanced expanded anim-section-in">
              <div className="preset-section">
                <div className="preset-section-title">{t("presetCreator.sections.misc")}</div>
                <div className="preset-form-grid">
                  <div className="preset-field preset-path-field">
                    <span>{t("presetCreator.fields.path")}</span>
                    <PathSelector
                      className="path-selector"
                      value={savePath}
                      onChange={setSavePath}
                      placeholder={t("presetCreator.placeholders.path")}
                      pickerCommand="pick_download_directory"
                      title={t("common.browse")}
                    />
                  </div>
                </div>

                {}
                <div className="preset-toggle-grid">
                  {presetType === "downloader" && (
                    <>
                      <div className="preset-toggle-item">
                        <span>{t("presetCreator.toggles.downloadSubtitles")}</span>
                        <ToggleSwitch
                          checked={downloadSubs}
                          onChange={setDownloadSubs}
                        />
                      </div>
                      {downloadSubs && (
                        <>
                          <div className="preset-toggle-item preset-subs-extra visible">
                            <span>{t("presetCreator.toggles.embedSubtitles")}</span>
                            <ToggleSwitch
                              checked={embedSubs}
                              onChange={setEmbedSubs}
                            />
                          </div>
                          <div className="preset-toggle-item preset-toggle-code preset-subs-extra visible">
                            <span>{t("presetCreator.toggles.subtitlesCode")}</span>
                            <input
                              className="custom-input"
                              type="text"
                              value={subsCode}
                              onChange={(e) => setSubsCode(e.target.value)}
                              placeholder="en"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.embedMetadata")}</span>
                    <ToggleSwitch
                      checked={embedMetadata}
                      onChange={setEmbedMetadata}
                    />
                  </div>
                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.embedThumbnail")}</span>
                    <ToggleSwitch
                      checked={embedThumbnail}
                      onChange={setEmbedThumbnail}
                    />
                  </div>
                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.geoBypass")}</span>
                    <ToggleSwitch
                      checked={geoBypass}
                      onChange={setGeoBypass}
                    />
                  </div>
                  {presetType === "downloader" && selectedFormatLower !== "gif" && (
                    <div className="preset-toggle-item">
                      <span>{t("presetCreator.toggles.muteAudio")}</span>
                      <ToggleSwitch
                        checked={muteAudio}
                        onChange={setMuteAudio}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

            {}
            {presetType !== "compressor" && isFormatValid && (showVideoSettings || showAudioSettings) && (
              <div className="preset-section preset-media-section anim-section-in">
                <div className="preset-section-title">{t("presetCreator.sections.videoAudio")}</div>

                {showVideoSettings && (
                  <div className="preset-subsection preset-media-row">
                    <div className="preset-media-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                        <line x1="7" y1="2" x2="7" y2="22"></line>
                        <line x1="17" y1="2" x2="17" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                      </svg>
                    </div>
                    <div className="preset-media-grid preset-media-grid-video">
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoQuality")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto") },
                            { value: "best", label: "Best" },
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
                          onChange={setVideoQuality}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoCodec")}</span>
                        <CustomSelect
                          options={videoCodecOptions}
                          value={videoCodec}
                          onChange={setVideoCodec}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoBitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={videoBitrate}
                          onChange={(e) => setVideoBitrate(e.target.value)}
                          placeholder={t("presetCreator.placeholders.bitrate")}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoFps")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto") },
                            { value: "60", label: "60" },
                            { value: "30", label: "30" },
                            { value: "24", label: "24" },
                          ]}
                          value={videoFps}
                          onChange={setVideoFps}
                          direction="up"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {showAudioSettings && (
                  <div className="preset-subsection preset-media-row">
                    <div className="preset-media-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                    </div>
                    <div className="preset-media-grid preset-media-grid-audio">
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.audioSampleRate")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto") },
                            { value: "32000", label: "32000" },
                            { value: "44100", label: "44100" },
                            { value: "48000", label: "48000" },
                            { value: "96000", label: "96000" },
                          ]}
                          value={audioSampleRate}
                          onChange={setAudioSampleRate}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.audioCodec")}</span>
                        <CustomSelect
                          options={audioCodecOptions}
                          value={audioCodec}
                          onChange={setAudioCodec}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.audioBitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={audioBitrate}
                          onChange={(e) => setAudioBitrate(e.target.value)}
                          placeholder={t("presetCreator.placeholders.bitrate")}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        <div className="preset-modal-footer">
          <button
            className="anim-btn preset-save-btn"
            onClick={handleSave}
            disabled={!isFormValid()}
          >
            {t("presetCreator.actions.save")}
          </button>
          <button
            className="anim-btn preset-export-btn"
            onClick={handleExport}
            disabled={!isFormValid()}
          >
            {t("presetCreator.actions.export")}
          </button>
        </div>
      </div>
    </div>
  );
};
export default PresetCreatorModal;