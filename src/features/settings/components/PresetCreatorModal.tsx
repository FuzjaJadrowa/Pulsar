import { ICON_ASSETS } from "../../../utils/icons";
import React, { useState, useEffect } from "react";
import { useTranslation } from "../../../services/i18n";
import { invoke } from "../../../services/tauri";
import { Preset, exportPreset, getPresetFromCache } from "../../../services/presets";
import { CustomSelect } from "../../../components/CustomSelect";
import { sanitizeBitrateInput } from "../../../utils/bitrate";
import styles from "./PresetCreatorModal.module.css";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { PathSelector } from "../../../components/PathSelector";
import { useUiState } from "../../../services/uiState";
import { loadFormatCatalog, type FormatEntry } from "../../../services/formats";
import { PresetIconField } from "../../../components/PresetIconField";
import { PRESET_DEFAULT_ICON } from "../../../utils/icons";

interface PresetCreatorModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  presetId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface PresetFormatData {
  downloader: FormatEntry[];
  converter: FormatEntry[];
}

let globalFormatData: PresetFormatData = {
  downloader: [],
  converter: [],
};

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
  const [iconDataUrl, setIconDataUrl] = useState(PRESET_DEFAULT_ICON);
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
  const [skipSponsors, setSkipSponsors] = useState(false);
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
  const [formatData, setFormatData] = useState<PresetFormatData>(globalFormatData);

  const [prevOpenState, setPrevOpenState] = useState({ isOpen: false, mode: "create", presetId: null as string | null });

  const applyPresetData = (preset: Preset) => {
    setTitle(preset.title || "");
    setSummary(preset.summary || "");
    setIconDataUrl(preset.icon_data_url || PRESET_DEFAULT_ICON);
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
      setSkipSponsors(!!d.skip_sponsors);
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
      setCompressMode(c.mode === "size" || c.mode === "quality" ? c.mode : "percent");
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
      setIconDataUrl(PRESET_DEFAULT_ICON);
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
      setSkipSponsors(false);
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
    let isMounted = true;
    if (globalFormatData.downloader.length > 0) {
      setFormatData(globalFormatData);
    } else {
      loadFormatCatalog().then((catalog) => {
        if (!isMounted) return;
        const parsed = { downloader: catalog.dformats, converter: catalog.cformats };
        globalFormatData = parsed;
        setFormatData(parsed);
      });
    }
    return () => { isMounted = false; };
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
      .filter((item) => item.id.toLowerCase().includes(query))
      .map((item) => item.id.toLowerCase());
    setFormatSuggestions(matches.slice(0, 5));
  }, [format, presetType, formatData]);

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
        skip_sponsors: skipSponsors,
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
        skip_sponsors: skipSponsors,
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
    { value: "", label: t("common.auto") },
    ...(currentFormatMeta?.video_codecs || []).map((vc) => ({ value: vc, label: vc }))
  ];

  const audioCodecOptions = [
    { value: "", label: t("common.auto") },
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
    return () => {
      updateUiState({ isPresetModalOpen: false });
    };
  }, [isOpen, updateUiState]);

  useEffect(() => {
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
  }, [isOpen, activeModal]);

  if (!activeModal) return null;

  return (
    <div className={`${styles.scope} preset-modal-overlay ${isClosing ? "closing" : "open"}`} id="preset-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
              <PresetIconField value={iconDataUrl} title={title} fallback={PRESET_DEFAULT_ICON} onChange={setIconDataUrl} />

              {}
              <div className="preset-field preset-field-type">
                <span>{t("presetCreator.sections.type")}</span>
                <div className="preset-type-switcher">
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "downloader" ? "active" : ""}`}
                    onClick={() => { setPresetType("downloader"); setFormat(""); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16"><use href={ICON_ASSETS["download-arrow"]} /></svg>
                    <span>{t("settings.presetsManager.types.downloader")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "converter" ? "active" : ""}`}
                    onClick={() => { setPresetType("converter"); setFormat(""); }}
                  >
                    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" width="16" height="16"><use href={ICON_ASSETS["convert"]} /></svg>
                    <span>{t("settings.presetsManager.types.converter")}</span>
                  </button>
                  <button
                    type="button"
                    className={`preset-choice ${presetType === "compressor" ? "active" : ""}`}
                    onClick={() => setPresetType("compressor")}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16"><use href={ICON_ASSETS["compress"]} /></svg>
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" opacity="0.6"><use href={ICON_ASSETS["chevron-right"]} /></svg>
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
                      placeholder={t("common.noSavePathSelected")}
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
                        <span>{t("common.downloadSubtitles")}</span>
                        <ToggleSwitch
                          checked={downloadSubs}
                          onChange={setDownloadSubs}
                        />
                      </div>
                      {downloadSubs && (
                        <>
                          <div className="preset-toggle-item preset-subs-extra visible">
                            <span>{t("common.embedSubtitles")}</span>
                            <ToggleSwitch
                              checked={embedSubs}
                              onChange={setEmbedSubs}
                            />
                          </div>
                          <div className="preset-toggle-item preset-toggle-code preset-subs-extra visible">
                            <span>{t("common.codeOptional")}</span>
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
                    <span>{t("common.embedMetadata")}</span>
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
                    <span>{t("common.skipSponsors")}</span>
                    <ToggleSwitch
                      checked={skipSponsors}
                      onChange={setSkipSponsors}
                    />
                  </div>
                  {presetType === "downloader" && selectedFormatLower !== "gif" && (
                    <div className="preset-toggle-item">
                      <span>{t("common.muteAudio")}</span>
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><use href={ICON_ASSETS["video"]} /></svg>
                    </div>
                    <div className="preset-media-grid preset-media-grid-video">
                      <label className="preset-field">
                        <span>{t("common.videoQuality")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("common.auto") },
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
                        <span>{t("common.videoCodec")}</span>
                        <CustomSelect
                          options={videoCodecOptions}
                          value={videoCodec}
                          onChange={setVideoCodec}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("common.videoBitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={videoBitrate}
                          inputMode="numeric"
                          onChange={(e) => setVideoBitrate(sanitizeBitrateInput(e.target.value, 100000))}
                          placeholder={t("common.auto")}
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("common.fps")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("common.auto") },
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><use href={ICON_ASSETS["audio"]} /></svg>
                    </div>
                    <div className="preset-media-grid preset-media-grid-audio">
                      <label className="preset-field">
                        <span>{t("common.audioSampleRate")}</span>
                        <CustomSelect
                          options={[
                            { value: "", label: t("common.auto") },
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
                        <span>{t("common.audioCodec")}</span>
                        <CustomSelect
                          options={audioCodecOptions}
                          value={audioCodec}
                          onChange={setAudioCodec}
                          direction="up"
                        />
                      </label>
                      <label className="preset-field">
                        <span>{t("common.audioBitrate")}</span>
                        <input
                          className="custom-input"
                          type="text"
                          value={audioBitrate}
                          inputMode="numeric"
                          onChange={(e) => setAudioBitrate(sanitizeBitrateInput(e.target.value, 1000))}
                          placeholder={t("common.auto")}
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