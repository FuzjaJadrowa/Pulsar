import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { useConfig, getCurrentConfig, saveConfig, DEFAULT_CONFIG } from "../services/config";
import { usePresets } from "../services/presets";
import { CustomSelect } from "../components/CustomSelect";
import { PresetCreatorModal } from "../components/PresetCreatorModal";
import { sanitizeSvg } from "../utils/security";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { invoke } from "../services/tauri";
import { DEFAULT_ICON, TAG_ICON_SVG } from "../utils/icons";

let textMeasureCanvas: HTMLCanvasElement | null = null;
function getTextWidth(text: string): number {
  if (!text) return 0;
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement("canvas");
  }
  const ctx = textMeasureCanvas.getContext("2d");
  if (!ctx) return text.length * 7;
  ctx.font = '13px "Manrope", "Montserrat", "Roboto", sans-serif';
  return ctx.measureText(text).width;
}

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

export const Settings: React.FC = () => {
  const { t, changeLanguage } = useTranslation();
  const { config, updateConfig } = useConfig();
  const [pendingFocus, setPendingFocus] = useState<{ index: number; offset: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localCooldown, setLocalCooldown] = useState<string>("");
  const [localProcesses, setLocalProcesses] = useState<string>("");
  const [localSearchResults, setLocalSearchResults] = useState<string>("");

  useEffect(() => {
    if (config) {
      setLocalCooldown(String(config.update_app_cooldown_minutes ?? 30));
      setLocalProcesses(String(config.maximum_concurrent_processes ?? 3));
      setLocalSearchResults(String(config.maximum_search_results ?? 10));
    }
  }, [config.update_app_cooldown_minutes, config.maximum_concurrent_processes, config.maximum_search_results]);

  useEffect(() => {
    return () => {
      // Revert title template to default on unmount if left empty
      const current = getCurrentConfig();
      if (!current.title_template || !current.title_template.trim()) {
        saveConfig({ title_template: DEFAULT_CONFIG.title_template });
      }
    };
  }, []);

  useEffect(() => {
    if (pendingFocus && containerRef.current) {
      const inputs = containerRef.current.querySelectorAll("input");
      const inputIdx = pendingFocus.index / 2;
      const targetInput = inputs[inputIdx] as HTMLInputElement | undefined;
      if (targetInput) {
        targetInput.focus();
        const offset = Math.min(pendingFocus.offset, targetInput.value.length);
        targetInput.setSelectionRange(offset, offset);
      }
      setPendingFocus(null);
    }
  }, [pendingFocus, config.title_template]);
  const {
    presets,
    importPreset,
    exportPreset,
    deletePreset,
    setPresetHidden,
    refreshPresets,
  } = usePresets();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  const [pulsarVersion, setPulsarVersion] = useState("-");
  const [bridgeVersion, setBridgeVersion] = useState("-");
  const [ffmpegVersion, setFfmpegVersion] = useState("-");

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const reqVersions = await invoke<Record<string, string>>("get_requirements_versions").catch(() => ({} as Record<string, string>));
        setPulsarVersion(reqVersions["pulsar"] || "3.0.1");
        setBridgeVersion(reqVersions["pulsar-bridge"] || "N/A");
        setFfmpegVersion(reqVersions["ffmpeg"] || "N/A");
      } catch (err) {
        console.error("Failed to load versions:", err);
      }
    };
    fetchVersions();
  }, []);

  const handleUpdateCheck = (component: string) => {
    invoke("run_requirement_check", { component }).catch((err) => {
      console.error(`Check update failed for ${component}:`, err);
    });
  };

  const handleOpenPresetCreate = () => {
    setModalMode("create");
    setEditingPresetId(null);
    setModalOpen(true);
  };

  const handleOpenPresetEdit = (id: string) => {
    setModalMode("edit");
    setEditingPresetId(id);
    setModalOpen(true);
  };

  const handleExportPreset = async (id: string) => {
    try {
      await exportPreset(id);
    } catch (err) {
      console.error("Export preset failed:", err);
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await deletePreset(id);
    } catch (err) {
      console.error("Delete preset failed:", err);
    }
  };

  const handleImportPreset = async () => {
    try {
      await importPreset();
    } catch (err) {
      console.error("Import preset failed:", err);
    }
  };

  const handleSupportClick = () => {
    invoke("open_in_file_manager", { path: "https://ko-fi.com/fuzjajadrowa" }).catch(() => {
      window.open("https://ko-fi.com/fuzjajadrowa", "_blank");
    });
  };

  const handleAddTag = (tag: string) => {
    const newVal = (config.title_template || "") + tag;
    updateConfig({ title_template: newVal });
  };

  const handlePartChange = (index: number, value: string, parts: string[]) => {
    const newParts = [...parts];
    newParts[index] = value;
    const combined = newParts.join("");
    updateConfig({ title_template: combined });
  };

  const handleRemovePart = (index: number, parts: string[]) => {
    const newParts = [...parts];
    newParts.splice(index, 1);
    const combined = newParts.join("");
    updateConfig({ title_template: combined });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, parts: string[]) => {
    if (e.key === "Backspace" && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      if (index > 0) {
        const newParts = [...parts];
        const pillToDelete = index - 1;
        const textBefore = newParts[index - 2] || "";
        const textCurrent = newParts[index] || "";
        
        newParts[index - 2] = textBefore + textCurrent;
        newParts.splice(pillToDelete, 2);
        
        const combined = newParts.join("");
        updateConfig({ title_template: combined });
        
        setPendingFocus({
          index: index - 2,
          offset: textBefore.length
        });
        e.preventDefault();
      }
    }
  };

  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("title-template-input") || target.classList.contains("title-template-input-container")) {
      if (containerRef.current) {
        const inputs = containerRef.current.querySelectorAll("input");
        if (inputs.length > 0) {
          (inputs[inputs.length - 1] as HTMLInputElement).focus();
        }
      }
    }
  };




  const languages = [
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "pl", label: "Polski" },
  ];

  const themes = [
    { value: "System", label: t("settings.themeOptions.system") },
    { value: "Dark", label: t("settings.themeOptions.dark") },
    { value: "Light", label: t("settings.themeOptions.light") },
  ];

  const browsers = [
    { value: "none", label: "None" },
    { value: "brave", label: "Brave" },
    { value: "chrome", label: "Chrome" },
    { value: "chromium", label: "Chromium" },
    { value: "edge", label: "Edge" },
    { value: "firefox", label: "Firefox" },
    { value: "opera", label: "Opera" },
    { value: "safari", label: "Safari" },
    { value: "vivaldi", label: "Vivaldi" },
    { value: "whale", label: "Whale" },
  ];

  const videoCodecSelectOptions = [
    { value: "auto", label: t("presetCreator.select.auto") },
    { value: "h264", label: "H264" },
    { value: "h265", label: "H265" },
    { value: "av1", label: "AV1" },
    { value: "vp9", label: "VP9" },
    { value: "vp8", label: "VP8" },
    { value: "prores", label: "ProRes" },
    { value: "mpeg4", label: "MPEG4" },
    { value: "theora", label: "Theora" },
    { value: "wmv", label: "WMV" },
  ];

  const audioCodecSelectOptions = [
    { value: "auto", label: t("presetCreator.select.auto") },
    { value: "aac", label: "AAC" },
    { value: "mp3", label: "MP3" },
    { value: "flac", label: "FLAC" },
    { value: "opus", label: "Opus" },
    { value: "vorbis", label: "Vorbis" },
    { value: "ac3", label: "AC3" },
    { value: "alac", label: "ALAC" },
    { value: "wav", label: "WAV" },
    { value: "aiff", label: "AIFF" },
    { value: "wma", label: "WMA" },
  ];

  return (
    <div className="page-root page-scroll settings-page">
      <div className="settings-page-header">
        <span className="settings-page-title">{t("settings.title")}</span>
      </div>

      {/* General Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.general")}</div>

        <div className="form-row">
          <span>{t("settings.language")}</span>
          <CustomSelect
            options={languages}
            value={config.language}
            onChange={(val) => {
              updateConfig({ language: val });
              changeLanguage(val);
            }}
            width="150px"
          />
        </div>

        <div className="settings-inline-group">
          <div className="settings-inline-label">{t("settings.closeBehavior")}</div>
          <div className="radio-group">
            <label className="custom-radio">
              <input
                type="radio"
                name="close_behavior"
                value="hide"
                checked={config.close_behavior === "hide"}
                onChange={() => updateConfig({ close_behavior: "hide" })}
              />
              <span>{t("settings.closeBehaviorOptions.hide")}</span>
            </label>
            <label className="custom-radio">
              <input
                type="radio"
                name="close_behavior"
                value="exit"
                checked={config.close_behavior === "exit"}
                onChange={() => updateConfig({ close_behavior: "exit" })}
              />
              <span>{t("settings.closeBehaviorOptions.exit")}</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <span>{t("settings.systemNotifications")}</span>
          <ToggleSwitch
            checked={!!config.system_notifications}
            onChange={(checked) => updateConfig({ system_notifications: checked })}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.advancedMode")}</span>
          <ToggleSwitch
            checked={!!config.advanced_mode}
            onChange={(checked) => updateConfig({ advanced_mode: checked })}
          />
        </div>
        <div className="settings-note">
          {t("settings.advancedModeNote")}
        </div>
      </section>

      {/* Appearance Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.appearance")}</div>

        <div className="form-row">
          <span>{t("settings.theme")}</span>
          <CustomSelect
            options={themes}
            value={config.theme}
            onChange={(val) => updateConfig({ theme: val })}
            width="150px"
          />
        </div>

        <div className="form-row">
          <span>{t("settings.idleAnimation")}</span>
          <ToggleSwitch
            checked={!!config.idle_animation}
            onChange={(checked) => updateConfig({ idle_animation: checked })}
          />
        </div>
      </section>

      {/* Codecs Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.codecs.title")}</div>

        <div className="form-row">
          <span>{t("settings.codecs.copyCodecIfPossible")}</span>
          <ToggleSwitch
            checked={!!config.copy_codec_if_possible}
            onChange={(checked) => updateConfig({ copy_codec_if_possible: checked })}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.codecs.defaultVideoCodec")}</span>
          <CustomSelect
            options={videoCodecSelectOptions}
            value={config.default_video_codec || "auto"}
            onChange={(val) => updateConfig({ default_video_codec: val })}
            width="150px"
          />
        </div>

        <div className="form-row">
          <span>{t("settings.codecs.defaultAudioCodec")}</span>
          <CustomSelect
            options={audioCodecSelectOptions}
            value={config.default_audio_codec || "auto"}
            onChange={(val) => updateConfig({ default_audio_codec: val })}
            width="150px"
          />
        </div>
      </section>

      {/* Requirements Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.requirements")}</div>

        <div className="form-row">
          <span>{t("settings.autoUpdateApp")}</span>
          <div className="update-actions">
            <button
              className="update-check-btn"
              type="button"
              onClick={() => handleUpdateCheck("pulsar")}
              aria-label="Check Pulsar update"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M1 4v6h6" />
                <path d="M3.5 15A9 9 0 1 0 4 5.7L1 10" />
              </svg>
            </button>
            <ToggleSwitch
              checked={!!config.update_app}
              onChange={(checked) => updateConfig({ update_app: checked })}
            />
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion",  { version: pulsarVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.autoUpdateBridge")}</span>
          <div className="update-actions">
            <button
              className="update-check-btn"
              type="button"
              onClick={() => handleUpdateCheck("pulsar-bridge")}
              aria-label="Check Bridge update"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M1 4v6h6" />
                <path d="M3.5 15A9 9 0 1 0 4 5.7L1 10" />
              </svg>
            </button>
            <ToggleSwitch
              checked={!!config.update_ytdlp}
              onChange={(checked) => updateConfig({ update_ytdlp: checked })}
            />
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion",  { version: bridgeVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.autoUpdateFfmpeg")}</span>
          <div className="update-actions">
            <button
              className="update-check-btn"
              type="button"
              onClick={() => handleUpdateCheck("ffmpeg")}
              aria-label="Check FFmpeg update"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M1 4v6h6" />
                <path d="M3.5 15A9 9 0 1 0 4 5.7L1 10" />
              </svg>
            </button>
            <ToggleSwitch
              checked={!!config.update_ffmpeg}
              onChange={(checked) => updateConfig({ update_ffmpeg: checked })}
            />
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion",  { version: ffmpegVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.ffmpegHwAccel")}</span>
          <ToggleSwitch
            checked={config.ffmpeg_hwaccel === "auto"}
            onChange={(checked) => updateConfig({ ffmpeg_hwaccel: checked ? "auto" : "none" })}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.updateCooldown")}</span>
          <input
            className="custom-input"
            type="number"
            value={localCooldown}
            onChange={(e) => {
              let valStr = e.target.value;
              let val = parseInt(valStr, 10);
              if (!isNaN(val) && val > 500) {
                valStr = "500";
              }
              setLocalCooldown(valStr);
            }}
            onBlur={() => {
              let val = parseInt(localCooldown, 10);
              if (isNaN(val)) val = 30;
              if (val < 10) val = 10;
              if (val > 500) val = 500;
              setLocalCooldown(String(val));
              updateConfig({ update_app_cooldown_minutes: val });
            }}
            style={{ width: "120px" }}
          />
        </div>
      </section>

      {/* Download settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.downloadSettings")}</div>

        <div className="form-row">
          <span>{t("settings.cookiesFromBrowser")}</span>
          <CustomSelect
            options={browsers}
            value={config.cookies_browser}
            onChange={(val) => updateConfig({ cookies_browser: val })}
            width="150px"
          />
        </div>
        <div className="settings-note">
          {t("settings.cookiesFromBrowserNote")}
        </div>

        <div className="form-row">
          <span>{t("settings.maximumConcurrentProcesses")}</span>
          <input
            className="custom-input"
            type="number"
            value={localProcesses}
            onChange={(e) => {
              let valStr = e.target.value;
              let val = parseInt(valStr, 10);
              if (!isNaN(val) && val > 10) {
                valStr = "10";
              }
              setLocalProcesses(valStr);
            }}
            onBlur={() => {
              let val = parseInt(localProcesses, 10);
              if (isNaN(val)) val = 3;
              if (val < 1) val = 1;
              if (val > 10) val = 10;
              setLocalProcesses(String(val));
              updateConfig({ maximum_concurrent_processes: val });
            }}
            style={{ width: "120px" }}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.maximumSearchResults")}</span>
          <input
            className="custom-input"
            type="number"
            value={localSearchResults}
            onChange={(e) => {
              let valStr = e.target.value;
              let val = parseInt(valStr, 10);
              if (!isNaN(val) && val > 50) {
                valStr = "50";
              }
              setLocalSearchResults(valStr);
            }}
            onBlur={() => {
              let val = parseInt(localSearchResults, 10);
              if (isNaN(val)) val = 10;
              if (val < 1) val = 1;
              if (val > 50) val = 50;
              setLocalSearchResults(String(val));
              updateConfig({ maximum_search_results: val });
            }}
            style={{ width: "120px" }}
          />
        </div>

        {/* Title Constructor */}
        <div className="title-constructor">
          <div className="title-constructor-title">{t("settings.titleConstructor")}</div>
          <div className="title-constructor-input-row">
            <div
              className="title-template-input"
              onClick={handleWrapperClick}
              style={{ cursor: "text" }}
            >
              <div
                ref={containerRef}
                className="title-template-input-container"
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", width: "100%" }}
              >
                {(() => {
                  const template = config.title_template || "";
                  const tokenRegex = /(%\(.*?\)(?:s|d))/g;
                  const parts = template.split(tokenRegex);

                  const getTagName = (token: string) => {
                    switch (token) {
                      case "%(title)s": return t("settings.titleConstructorTags.title");
                      case "%(id)s": return t("settings.titleConstructorTags.id");
                      case "%(resolution)s": return t("settings.titleConstructorTags.resolution");
                      case "%(duration_string)s": return t("settings.titleConstructorTags.durationString");
                      case "%(fps)s": return t("settings.titleConstructorTags.fps");
                      case "%(upload_date)s": return t("settings.titleConstructorTags.uploadDate");
                      case "%(view_count)s": return t("settings.titleConstructorTags.viewCount");
                      case "%(like_count)s": return t("settings.titleConstructorTags.likeCount");
                      case "%(uploader)s": return t("settings.titleConstructorTags.uploader");
                      case "%(playlist)s": return t("settings.titleConstructorTags.playlist");
                      case "%(playlist_index)s": return t("settings.titleConstructorTags.playlistIndex");
                      case "%(video_autonumber)s": return t("settings.titleConstructorTags.videoAutonumber");
                      case "%(track)s": return t("settings.titleConstructorTags.track");
                      case "%(artist)s": return t("settings.titleConstructorTags.artist");
                      case "%(album)s": return t("settings.titleConstructorTags.album");
                      case "%(release_year)s": return t("settings.titleConstructorTags.releaseYear");
                      default: return token;
                    }
                  };

                  return parts.map((part, index) => {
                    const isToken = index % 2 === 1;
                    if (isToken) {
                      const label = getTagName(part);
                      return (
                        <div
                          key={`${part}-${index}`}
                          className="title-pill pill-in"
                          onClick={() => handleRemovePart(index, parts)}
                          title={t("settings.titleConstructorRemoveTag")}
                        >
                          {TAG_ICON_SVG}
                          <span>{label}</span>
                        </div>
                      );
                    } else {
                      const isOnlyInput = parts.length === 1;
                      const isZeroLength = part.length === 0;
                      let inputWidthStyle: string;
                      if (isZeroLength) {
                        inputWidthStyle = isOnlyInput ? "120px" : "0px";
                      } else {
                        const measured = Math.ceil(getTextWidth(part));
                        inputWidthStyle = `${measured + 2}px`;
                      }
                      return (
                        <input
                          key={`text-${index}`}
                          type="text"
                          className="title-template-text-input"
                          value={part}
                          style={{
                            width: inputWidthStyle,
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "13px",
                            fontFamily: "inherit",
                            height: "26px",
                            lineHeight: "26px",
                            outline: "none",
                            padding: "0px",
                            margin: "0px",
                            maxWidth: "100%",
                            minWidth: isZeroLength && !isOnlyInput ? "0px" : "12px",
                            boxSizing: "border-box",
                          }}
                          placeholder={index === 0 && isOnlyInput ? "%(x)s" : ""}
                          onChange={(e) => handlePartChange(index, e.target.value, parts)}
                          onKeyDown={(e) => handleKeyDown(e, index, parts)}
                        />
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </div>
          <div className="title-constructor-note">
            {t("settings.titleConstructorNote")}
          </div>

          <div id="title-canvas" className="title-canvas">
            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.video")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(title)s", t("settings.titleConstructorTags.title")],
                  ["%(id)s", t("settings.titleConstructorTags.id")],
                  ["%(resolution)s", t("settings.titleConstructorTags.resolution")],
                  ["%(duration_string)s", t("settings.titleConstructorTags.durationString")],
                  ["%(fps)s", t("settings.titleConstructorTags.fps")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.statsDates")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(upload_date)s", t("settings.titleConstructorTags.uploadDate")],
                  ["%(view_count)s", t("settings.titleConstructorTags.viewCount")],
                  ["%(like_count)s", t("settings.titleConstructorTags.likeCount")],
                  ["%(uploader)s", t("settings.titleConstructorTags.uploader")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.playlist")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(playlist)s", t("settings.titleConstructorTags.playlist")],
                  ["%(playlist_index)s", t("settings.titleConstructorTags.playlistIndex")],
                  ["%(video_autonumber)s", t("settings.titleConstructorTags.videoAutonumber")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.music")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(track)s", t("settings.titleConstructorTags.track")],
                  ["%(artist)s", t("settings.titleConstructorTags.artist")],
                  ["%(album)s", t("settings.titleConstructorTags.album")],
                  ["%(release_year)s", t("settings.titleConstructorTags.releaseYear")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Presets Manager */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.presetsManager.title")}</div>

        <div className="presets-manager-toolbar">
          <div className="presets-manager-actions">
            <button className="anim-btn preset-action-btn preset-add-btn" onClick={handleOpenPresetCreate}>
              {t("settings.presetsManager.actions.add")}
            </button>
            <button className="anim-btn preset-action-btn preset-secondary-btn" onClick={handleImportPreset}>
              {t("settings.presetsManager.actions.import")}
            </button>
          </div>
          <div className="presets-manager-meta">
            {t("settings.presetsManager.count",  { count: presets.length })}
          </div>
        </div>

        {presets.length === 0 ? (
          <div className="presets-manager-empty">
            {t("settings.presetsManager.empty")}
          </div>
        ) : (
          <div className="presets-manager-list">
            {presets.map((preset) => {
              const presetType = String(preset.preset_type || "downloader").toLowerCase();
              let typeLabel = "Downloader";
              if (presetType === "converter") typeLabel = "Converter";
              if (presetType === "compressor") typeLabel = "Compressor";

              const iconSrc = preset.icon_data_url || preset.icon;

              return (
                <div key={preset.id} className={`preset-item ${preset.hidden ? "is-hidden" : ""}`}>
                  <div className="preset-item-icon">
                    {renderPresetIconPreview(iconSrc || DEFAULT_ICON, preset.title || "preset")}
                  </div>

                  <div className="preset-item-info">
                    <div className="preset-item-title">
                      {preset.title || t("settings.presetsManager.untitled")}
                      <span className="preset-badge">
                        {t(`settings.presetsManager.types.${presetType}`, typeLabel)}
                      </span>
                    </div>
                    <div className="preset-item-summary">
                      {preset.summary || t("settings.presetsManager.noSummary")}
                    </div>
                  </div>

                  <div className="preset-item-actions">
                    <div className="preset-item-action-row">
                      <button className="preset-item-btn" onClick={() => handleOpenPresetEdit(preset.id || "")}>
                        {t("settings.presetsManager.actions.edit")}
                      </button>
                      <button className="preset-item-btn" onClick={() => handleExportPreset(preset.id || "")}>
                        {t("settings.presetsManager.actions.export")}
                      </button>
                      <button className="preset-item-btn danger" onClick={() => handleDeletePreset(preset.id || "")}>
                        {t("settings.presetsManager.actions.delete")}
                      </button>
                    </div>

                    <div className="preset-item-toggle">
                      <span>{t("settings.presetsManager.actions.hide")}</span>
                      <ToggleSwitch
                        checked={!!preset.hidden}
                        onChange={(checked) => setPresetHidden(preset.id || "", checked)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support Section */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.support")}</div>
        <div className="form-row">
          <span>{t("settings.supportText")}</span>
          <button
            className="anim-btn"
            onClick={handleSupportClick}
            style={{ background: "#E91E63", color: "white", padding: "10px 20px" }}
          >
            <span>{t("settings.supportButton")}</span>
          </button>
        </div>
      </section>

      {/* Creator Modal */}
      <PresetCreatorModal
        isOpen={modalOpen}
        mode={modalMode}
        presetId={editingPresetId}
        onClose={() => setModalOpen(false)}
        onSaved={refreshPresets}
      />
    </div>
  );
};
export default Settings;