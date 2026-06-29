import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { invoke } from "../services/tauri";
import { Preset } from "../services/presets";
import { CustomSelect } from "./CustomSelect";
import { showNotification } from "../services/notifications";

interface PresetCreatorModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  presetId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_ICON = `data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="fill:%234c6fff"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>`;

export const PresetCreatorModal: React.FC<PresetCreatorModalProps> = ({
  isOpen,
  mode,
  presetId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();

  // Form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [iconDataUrl, setIconDataUrl] = useState(DEFAULT_ICON);
  const [presetType, setPresetType] = useState<"downloader" | "converter" | "compressor">("downloader");
  const [format, setFormat] = useState("");
  const [compressMode, setCompressMode] = useState<"percent" | "size" | "quality">("percent");
  const [compressPercent, setCompressPercent] = useState<number>(60);
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

  const [audioSample, setAudioSample] = useState("");
  const [audioCodec, setAudioCodec] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");

  // UI state
  const [formatSuggestions, setFormatSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Format definitions loaded from format.json
  const [formatData, setFormatData] = useState<{ downloader: any[]; converter: any[] }>({
    downloader: [],
    converter: [],
  });

  // Load formatting configurations
  useEffect(() => {
    fetch("./assets/format.json")
      .then((res) => res.json())
      .then((data) => {
        setFormatData({
          downloader: Array.isArray(data?.dformats) ? data.dformats : [],
          converter: Array.isArray(data?.cformats) ? data.cformats : [],
        });
      })
      .catch((err) => console.error("Failed to load formats meta:", err));
  }, []);

  // Hydrate preset when in edit mode
  useEffect(() => {
    if (isOpen && mode === "edit" && presetId) {
      invoke<Preset>("load_preset", { id: presetId })
        .then((preset) => {
          if (preset) {
            setTitle(preset.title || "");
            setSummary(preset.summary || "");
            setIconDataUrl(preset.icon_data_url || preset.icon || DEFAULT_ICON);
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
              setAudioSample(d.audio_sample_rate || "");
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
              setAudioSample(c.audio_sample_rate || "");
              setAudioCodec(c.audio_codec || "");
              setAudioBitrate(c.audio_bitrate || "");
            } else if (preset.preset_type === "compressor" && preset.compressor) {
              const c = preset.compressor;
              setCompressMode(c.mode as any || "percent");
              setCompressPercent(c.target_percent ?? 60);
              setCompressSize(c.target_size || "");
              setCompressCrf(c.crf ? String(c.crf) : "23");
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load preset details:", err);
          showNotification(t("common.error", "Error"), "Failed to load preset.", "error");
        });
    } else if (isOpen && mode === "create") {
      // Clear forms
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
      setAudioSample("");
      setAudioCodec("");
      setAudioBitrate("");
    }
  }, [isOpen, mode, presetId]);

  // Handle format auto-suggestions
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

  // Handle image conversion to Base64
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showNotification(t("common.error", "Error"), "File is not an image.", "error");
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
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      processImageFile(e.dataTransfer.files[0]);
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

  // Browse save directory path using Tauri picking
  const handleBrowsePath = async () => {
    try {
      const selected = await invoke<string>("pick_download_directory");
      if (selected) {
        setSavePath(selected);
      }
    } catch (err) {
      console.error("Failed to pick download folder:", err);
    }
  };

  // Submit preset payload
  const handleSave = async () => {
    if (!title.trim()) {
      showNotification(t("common.error", "Error"), "Preset title is required.", "error");
      return;
    }

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
        audio_sample_rate: audioSample || undefined,
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
        audio_sample_rate: audioSample || undefined,
      };
    } else if (presetType === "compressor") {
      payload.compressor = {
        mode: compressMode,
        target_percent: compressMode === "percent" ? compressPercent : undefined,
        target_size: compressMode === "size" ? compressSize : undefined,
        crf: compressMode === "quality" ? parseInt(compressCrf) || undefined : undefined,
      };
    }

    try {
      await invoke("save_preset", { preset: payload });
      showNotification(t("common.success", "Success"), "Preset saved successfully.", "success");
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save preset failed:", err);
      showNotification(t("common.error", "Error"), "Failed to save preset.", "error");
    }
  };

  // Determine formats details based on choice
  const selectedFormatLower = format.toLowerCase().trim();
  const formatMap = presetType === "converter" ? formatData.converter : formatData.downloader;
  const currentFormatMeta = formatMap.find((item) => String(item.id).toLowerCase() === selectedFormatLower);
  
  const showVideoSettings = presetType !== "compressor" && (!currentFormatMeta || currentFormatMeta.type === "video");
  const showAudioSettings = presetType !== "compressor" && (!currentFormatMeta || currentFormatMeta.type === "audio" || (currentFormatMeta.type === "video" && !muteAudio));

  const crfOptions = Array.from({ length: 52 }, (_, i) => ({ value: String(i), label: String(i) }));

  const [renderModal, setRenderModal] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("preset-modal-open", isOpen);
    if (isOpen) {
      setRenderModal(true);
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setRenderModal(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!renderModal) return null;

  return (
    <div className={`preset-modal-overlay ${isVisible ? "visible" : ""}`} id="preset-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="preset-modal" role="dialog" aria-modal="true">
        <div className="preset-modal-header">
          <div className="preset-modal-title">
            {mode === "edit" ? t("presetCreator.title.edit", "Edit Preset") : t("presetCreator.title.new", "Create Preset")}
          </div>
          <button className="preset-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="preset-modal-body">
          {/* Preset details */}
          <div className="preset-section">
            <div className="preset-section-title">{t("presetCreator.sections.basic", "Preset Details")}</div>
            <div className="preset-form-grid">
              <label className="preset-field">
                <span>{t("presetCreator.fields.title", "Title")}</span>
                <input
                  className="custom-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("presetCreator.placeholders.title", "Preset title")}
                />
              </label>
              <label className="preset-field">
                <span>{t("presetCreator.fields.summary", "Summary")}</span>
                <input
                  className="custom-input"
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={50}
                  placeholder={t("presetCreator.placeholders.summary", "Short description")}
                />
              </label>
            </div>

            <div className="preset-detail-row">
              {/* Icon Drop Area */}
              <div className="preset-field preset-field-icon">
                <span>{t("presetCreator.fields.icon", "Icon")}</span>
                <div
                  className="preset-icon-drop"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div
                    className="preset-icon-preview"
                    style={{
                      backgroundImage: iconDataUrl.startsWith("<svg") ? "none" : `url('${iconDataUrl}')`,
                    }}
                  >
                    {iconDataUrl.startsWith("<svg") && (
                      <div dangerouslySetInnerHTML={{ __html: iconDataUrl }} style={{ width: "100%", height: "100%" }} />
                    )}
                  </div>
                  <div className="preset-icon-meta">
                    <div className="preset-icon-title">{t("presetCreator.icon.title", "Drop icon here")}</div>
                    <div className="preset-icon-hint">{t("presetCreator.icon.hint", "1:1 ratio, PNG/JPG/SVG")}</div>
                    <button type="button" className="anim-btn preset-icon-browse" onClick={handleBrowseIcon}>
                      {t("presetCreator.icon.browse", "Browse")}
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

              {/* Type Switcher */}
              <div className="preset-field preset-field-type">
                <span>{t("presetCreator.sections.type", "Preset Type")}</span>
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
                    <span>{t("presetCreator.types.downloader", "Downloader")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "converter" ? "active" : ""}`}
                    onClick={() => { setPresetType("converter"); setFormat(""); }}
                  >
                    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" width="16" height="16">
                      <path d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494" transform="translate(1.407 1.407)scale(2.81)" />
                    </svg>
                    <span>{t("presetCreator.types.converter", "Converter")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "compressor" ? "active" : ""}`}
                    onClick={() => setPresetType("compressor")}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
                      <path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z" />
                    </svg>
                    <span>{t("presetCreator.types.compressor", "Compressor")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          {presetType !== "compressor" && (
            <div className="preset-section preset-format-section">
              <div className="preset-section-title">{t("presetCreator.sections.format", "Format")}</div>
              <div className="preset-format-input" style={{ position: "relative" }}>
                <input
                  className="custom-input"
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t("presetCreator.placeholders.format", "Type format")}
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
                        {item.toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compression options (only for compressor) */}
          {presetType === "compressor" && (
            <div className="preset-section preset-compressor-section">
              <div className="preset-section-title">{t("presetCreator.sections.compression", "Compression")}</div>
              <div className="preset-compressor-toggle" role="group">
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "percent" ? "active" : ""}`}
                  onClick={() => setCompressMode("percent")}
                >
                  <span>{t("compressor.mode.percent", "PERCENT")}</span>
                </button>
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "size" ? "active" : ""}`}
                  onClick={() => setCompressMode("size")}
                >
                  <span>{t("compressor.mode.size", "SIZE")}</span>
                </button>
                <button
                  type="button"
                  className={`preset-compressor-option ${compressMode === "quality" ? "active" : ""}`}
                  onClick={() => setCompressMode("quality")}
                >
                  <span>{t("compressor.mode.quality", "QUALITY")}</span>
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
                        min="1"
                        max="100"
                        value={compressPercent}
                        onChange={(e) => setCompressPercent(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 60)))}
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
                        placeholder={t("compressor.size.placeholder", "Target size (e.g. 50MB)")}
                      />
                    </div>
                  </div>
                )}

                {compressMode === "quality" && (
                  <div className="preset-compressor-panel">
                    <div className="preset-compressor-quality">
                      <span className="preset-compressor-crf-label">{t("presetCreator.fields.crf", "CRF")}</span>
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

          {/* Misc Section */}
          <div className="preset-advanced expanded">
            <div className="preset-section">
              <div className="preset-section-title">{t("presetCreator.sections.misc", "Misc")}</div>
              <div className="preset-form-grid">
                <div className="preset-field preset-path-field">
                  <span>{t("presetCreator.fields.path", "Save path")}</span>
                  <div className="preset-inline" style={{ display: "flex", gap: "8px" }}>
                    <input
                      style={{ flex: 1 }}
                      className="custom-input"
                      type="text"
                      value={savePath}
                      onChange={(e) => setSavePath(e.target.value)}
                      placeholder={t("presetCreator.placeholders.path", "Optional")}
                    />
                    <button type="button" className="anim-btn preset-browse-btn" onClick={handleBrowsePath}>
                      {t("presetCreator.actions.browse", "Browse")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="preset-toggle-grid">
                {presetType === "downloader" && (
                  <div className="preset-toggle-line preset-toggle-line-subs">
                    <div className="preset-toggle-item">
                      <span>{t("presetCreator.toggles.downloadSubtitles", "Download subtitles")}</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={downloadSubs}
                          onChange={(e) => setDownloadSubs(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    {downloadSubs && (
                      <>
                        <div className="preset-toggle-item preset-subs-extra">
                          <span>{t("presetCreator.toggles.embedSubtitles", "Embed subtitles")}</span>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={embedSubs}
                              onChange={(e) => setEmbedSubs(e.target.checked)}
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                        <div className="preset-toggle-item preset-toggle-code preset-subs-extra">
                          <span>{t("presetCreator.toggles.subtitlesCode", "Code (optional)")}</span>
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
                  </div>
                )}

                <div className="preset-toggle-line">
                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.embedMetadata", "Embed metadata")}</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={embedMetadata}
                        onChange={(e) => setEmbedMetadata(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.embedThumbnail", "Embed thumbnail")}</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={embedThumbnail}
                        onChange={(e) => setEmbedThumbnail(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="preset-toggle-item">
                    <span>{t("presetCreator.toggles.geoBypass", "Geo bypass")}</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={geoBypass}
                        onChange={(e) => setGeoBypass(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  {presetType === "downloader" && selectedFormatLower !== "gif" && (
                    <div className="preset-toggle-item">
                      <span>{t("presetCreator.toggles.muteAudio", "Mute audio")}</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={muteAudio}
                          onChange={(e) => setMuteAudio(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video & Audio Sections */}
            {presetType !== "compressor" && (
              <div className="preset-section preset-media-section">
                <div className="preset-section-title">{t("presetCreator.sections.videoAudio", "Video & Audio")}</div>

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
                        <span>{t("presetCreator.fields.videoQuality", "Video quality")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto", "Auto") },
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
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoCodec", "Video codec")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto", "Auto") },
                          ]}
                          value={videoCodec}
                          onChange={setVideoCodec}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoBitrate", "Video bitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={videoBitrate}
                          onChange={(e) => setVideoBitrate(e.target.value)}
                          placeholder={t("presetCreator.placeholders.bitrate", "Auto")}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.videoFps", "FPS")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto", "Auto") },
                            { value: "60", label: "60" },
                            { value: "30", label: "30" },
                            { value: "24", label: "24" },
                          ]}
                          value={videoFps}
                          onChange={setVideoFps}
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
                        <span>{t("presetCreator.fields.audioSampleRate", "Audio sample rate")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto", "Auto") },
                            { value: "32000", label: "32000" },
                            { value: "44100", label: "44100" },
                            { value: "48000", label: "48000" },
                            { value: "96000", label: "96000" },
                          ]}
                          value={audioSample}
                          onChange={setAudioSample}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.audioCodec", "Audio codec")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("presetCreator.select.auto", "Auto") },
                          ]}
                          value={audioCodec}
                          onChange={setAudioCodec}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("presetCreator.fields.audioBitrate", "Audio bitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={audioBitrate}
                          onChange={(e) => setAudioBitrate(e.target.value)}
                          placeholder={t("presetCreator.placeholders.bitrate", "Auto")}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="preset-modal-footer">
          <button className="anim-btn preset-save-btn" onClick={handleSave}>
            {t("presetCreator.actions.save", "Save Preset")}
          </button>
        </div>
      </div>
    </div>
  );
};
export default PresetCreatorModal;