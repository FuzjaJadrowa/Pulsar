import React, { useState, useEffect } from "react";
import { useTranslation } from "../services/i18n";
import { useConfig } from "../services/config";
import { usePresets } from "../services/presets";
import { CustomSelect } from "../components/CustomSelect";
import { PresetCreatorModal } from "../components/PresetCreatorModal";
import { showNotification } from "../services/notifications";
import { invoke } from "../services/tauri";

const GEAR_ICON = (
  <svg viewBox="0 0 24 24" style={{ width: "100%", height: "100%", display: "block", fill: "currentColor" }}>
    <path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4" />
  </svg>
);

const TAG_ICON_SVG = (
  <span className="title-tag-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path className="tag-outline" d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12.41V2h10.41l8.18 8.18a2 2 0 0 1 0 2.83z" />
      <circle className="tag-dot" cx="7.5" cy="7.5" r="1.5" />
    </svg>
  </span>
);

const PILL_ICON_SVG = (
  <span className="title-pill-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path className="tag-outline" d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12.41V2h10.41l8.18 8.18a2 2 0 0 1 0 2.83z" />
      <circle className="tag-dot" cx="7.5" cy="7.5" r="1.5" />
    </svg>
  </span>
);

export const Settings: React.FC = () => {
  const { t, changeLanguage } = useTranslation();
  const { config, updateConfig } = useConfig();
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
        const pVer = await invoke<string>("get_pulsar_version").catch(() => "3.0.1");
        const bVer = await invoke<string>("get_bridge_version").catch(() => "N/A");
        const fVer = await invoke<string>("get_ffmpeg_version").catch(() => "N/A");
        
        setPulsarVersion(pVer);
        setBridgeVersion(bVer);
        setFfmpegVersion(fVer);
      } catch (err) {
        console.error("Failed to load versions:", err);
      }
    };
    fetchVersions();
  }, []);

  const handleUpdateCheck = (component: string) => {
    const win = window as any;
    if (typeof win.runRequirementCheck === "function") {
      win.runRequirementCheck(component);
    } else {
      invoke("run_requirement_check", { component }).catch((err) => {
        console.error(`Check update failed for ${component}:`, err);
      });
    }
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
      showNotification(t("common.success", "Success"), "Preset exported successfully.", "success");
    } catch (err) {
      console.error("Export preset failed:", err);
      showNotification(t("common.error", "Error"), "Failed to export preset.", "error");
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await deletePreset(id);
      showNotification(t("common.success", "Success"), "Preset deleted.", "success");
    } catch (err) {
      console.error("Delete preset failed:", err);
      showNotification(t("common.error", "Error"), "Failed to delete preset.", "error");
    }
  };

  const handleImportPreset = async () => {
    try {
      await importPreset();
      showNotification(t("common.success", "Success"), "Preset imported successfully.", "success");
    } catch (err) {
      console.error("Import preset failed:", err);
      showNotification(t("common.error", "Error"), "Failed to import preset.", "error");
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

  const handleRemoveTag = (token: string) => {
    const newVal = (config.title_template || "").split(token).join("");
    updateConfig({ title_template: newVal });
  };

  const renderTemplatePills = () => {
    const template = config.title_template || "";
    if (!template.trim()) return null;

    const tokenMap: Record<string, string> = {
      "%(title)s": t("settings.titleConstructorTags.title", "Title"),
      "%(id)s": t("settings.titleConstructorTags.id", "Video ID"),
      "%(resolution)s": t("settings.titleConstructorTags.resolution", "Resolution"),
      "%(duration_string)s": t("settings.titleConstructorTags.durationString", "Duration"),
      "%(fps)s": t("settings.titleConstructorTags.fps", "FPS"),
      "%(upload_date)s": t("settings.titleConstructorTags.uploadDate", "Upload Date"),
      "%(view_count)s": t("settings.titleConstructorTags.viewCount", "View Count"),
      "%(like_count)s": t("settings.titleConstructorTags.likeCount", "Like Count"),
      "%(dislike_count)s": t("settings.titleConstructorTags.dislikeCount", "Dislike Count"),
      "%(uploader)s": t("settings.titleConstructorTags.uploader", "Uploader"),
      "%(playlist)s": t("settings.titleConstructorTags.playlist", "Playlist Name"),
      "%(playlist_index)s": t("settings.titleConstructorTags.playlistIndex", "Playlist Index"),
      "%(video_autonumber)s": t("settings.titleConstructorTags.videoAutonumber", "Queue Number"),
      "%(track)s": t("settings.titleConstructorTags.track", "Track"),
      "%(artist)s": t("settings.titleConstructorTags.artist", "Artist"),
      "%(album)s": t("settings.titleConstructorTags.album", "Album"),
      "%(release_year)s": t("settings.titleConstructorTags.releaseYear", "Release Year")
    };

    const tokenRegex = /%\([a-zA-Z0-9_]+\)s/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(template)) !== null) {
      const token = match[0];
      if (match.index > lastIndex) {
        elements.push(<span key={`text-${lastIndex}`}>{template.slice(lastIndex, match.index)}</span>);
      }
      if (tokenMap[token]) {
        elements.push(
          <span
            key={`pill-${match.index}`}
            className="title-pill pill-in"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveTag(token);
            }}
            title="Click to remove tag"
          >
            {PILL_ICON_SVG}
            <span className="title-pill-label">{tokenMap[token]}</span>
          </span>
        );
      } else {
        elements.push(<span key={`raw-${match.index}`}>{token}</span>);
      }
      lastIndex = match.index + token.length;
    }
    if (lastIndex < template.length) {
      elements.push(<span key={`text-${lastIndex}`}>{template.slice(lastIndex)}</span>);
    }
    return elements;
  };

  const languages = [
    { value: "en", label: "English" },
    { value: "pl", label: "Polski" },
  ];

  const themes = [
    { value: "System", label: t("settings.themeOptions.system", "System") },
    { value: "Dark", label: t("settings.themeOptions.dark", "Dark") },
    { value: "Light", label: t("settings.themeOptions.light", "Light") },
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

  return (
    <div className="page-root page-scroll settings-page">
      <div className="settings-page-header">
        <span className="settings-page-title">{t("settings.title", "Settings")}</span>
      </div>

      {/* General Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.general", "General")}</div>

        <div className="form-row">
          <span>{t("settings.language", "Language")}</span>
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
          <div className="settings-inline-label">{t("settings.closeBehavior", "When I close Pulsar:")}</div>
          <div className="radio-group">
            <label className="custom-radio">
              <input
                type="radio"
                name="close_behavior"
                value="hide"
                checked={config.close_behavior === "hide"}
                onChange={() => updateConfig({ close_behavior: "hide" })}
              />
              <span>{t("settings.closeBehaviorOptions.hide", "Hide")}</span>
            </label>
            <label className="custom-radio">
              <input
                type="radio"
                name="close_behavior"
                value="exit"
                checked={config.close_behavior === "exit"}
                onChange={() => updateConfig({ close_behavior: "exit" })}
              />
              <span>{t("settings.closeBehaviorOptions.exit", "Exit")}</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <span>{t("settings.systemNotifications", "System notifications")}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.system_notifications}
              onChange={(e) => updateConfig({ system_notifications: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="form-row">
          <span>{t("settings.advancedMode", "Advanced mode")}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.advanced_mode}
              onChange={(e) => updateConfig({ advanced_mode: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>
        <div className="settings-note">
          {t("settings.advancedModeNote", "Shows advanced options and console access.")}
        </div>
      </section>

      {/* Appearance Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.appearance", "Appearance")}</div>

        <div className="form-row">
          <span>{t("settings.theme", "Theme")}</span>
          <CustomSelect
            options={themes}
            value={config.theme}
            onChange={(val) => updateConfig({ theme: val })}
            width="150px"
          />
        </div>

        <div className="form-row">
          <span>{t("settings.idleAnimation", "Idle animation")}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.idle_animation}
              onChange={(e) => updateConfig({ idle_animation: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>
      </section>

      {/* Requirements Settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.requirements", "Requirements")}</div>

        <div className="form-row">
          <span>{t("settings.autoUpdateApp", "Auto-update Pulsar")}</span>
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
            <label className="switch">
              <input
                type="checkbox"
                checked={config.update_app}
                onChange={(e) => updateConfig({ update_app: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion", "Current version: {version}", { version: pulsarVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.autoUpdateBridge", "Auto-update Bridge")}</span>
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
            <label className="switch">
              <input
                type="checkbox"
                checked={config.update_ytdlp}
                onChange={(e) => updateConfig({ update_ytdlp: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion", "Current version: {version}", { version: bridgeVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.autoUpdateFfmpeg", "Auto-update FFmpeg")}</span>
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
            <label className="switch">
              <input
                type="checkbox"
                checked={config.update_ffmpeg}
                onChange={(e) => updateConfig({ update_ffmpeg: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        <div className="settings-note">
          {t("settings.currentVersion", "Current version: {version}", { version: ffmpegVersion })}
        </div>

        <div className="form-row">
          <span>{t("settings.ffmpegHwAccel", "FFmpeg hardware acceleration")}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.ffmpeg_hwaccel === "auto"}
              onChange={(e) => updateConfig({ ffmpeg_hwaccel: e.target.checked ? "auto" : "none" })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="form-row">
          <span>{t("settings.updateCooldown", "Update check cooldown (minutes)")}</span>
          <input
            className="custom-input"
            type="number"
            min="10"
            max="500"
            value={config.update_app_cooldown_minutes}
            onChange={(e) => updateConfig({ update_app_cooldown_minutes: parseInt(e.target.value, 10) || 30 })}
            style={{ width: "120px" }}
          />
        </div>
      </section>

      {/* Download settings */}
      <section className="settings-section-card">
        <div className="settings-section-title">{t("settings.downloadSettings", "Download settings")}</div>

        <div className="form-row">
          <span>{t("settings.cookiesFromBrowser", "Cookies from browser")}</span>
          <CustomSelect
            options={browsers}
            value={config.cookies_browser}
            onChange={(val) => updateConfig({ cookies_browser: val })}
            width="150px"
          />
        </div>
        <div className="settings-note">
          {t("settings.cookiesFromBrowserNote", "Allows using your browser cookies to download restricted videos.")}
        </div>

        <div className="form-row">
          <span>{t("settings.maximumConcurrentProcesses", "Maximum concurrent processes")}</span>
          <input
            className="custom-input"
            type="number"
            min="1"
            max="10"
            value={config.maximum_concurrent_processes}
            onChange={(e) => updateConfig({ maximum_concurrent_processes: parseInt(e.target.value, 10) || 3 })}
            style={{ width: "120px" }}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.maximumSearchResults", "Maximum search results")}</span>
          <input
            className="custom-input"
            type="number"
            min="1"
            max="50"
            value={config.maximum_search_results}
            onChange={(e) => updateConfig({ maximum_search_results: parseInt(e.target.value, 10) || 10 })}
            style={{ width: "120px" }}
          />
        </div>

        {/* Title Constructor */}
        <div className="title-constructor">
          <div className="title-constructor-title">{t("settings.titleConstructor", "Title Constructor")}</div>
          <div className="title-constructor-input-row">
            <div
              className="title-template-input"
              data-empty={!(config.title_template || "").trim()}
              data-placeholder="%(title)s [%(id)s]"
            >
              {renderTemplatePills()}
            </div>
          </div>
          <div className="title-constructor-note">
            {t("settings.titleConstructorNote", "Not every tag is available for all media.")}
          </div>

          <div id="title-canvas" className="title-canvas">
            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.video", "Video")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(title)s", t("settings.titleConstructorTags.title", "Title")],
                  ["%(id)s", t("settings.titleConstructorTags.id", "Video ID")],
                  ["%(resolution)s", t("settings.titleConstructorTags.resolution", "Resolution")],
                  ["%(duration_string)s", t("settings.titleConstructorTags.durationString", "Duration")],
                  ["%(fps)s", t("settings.titleConstructorTags.fps", "FPS")],
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
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.statsDates", "Stats & Dates")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(upload_date)s", t("settings.titleConstructorTags.uploadDate", "Upload Date")],
                  ["%(view_count)s", t("settings.titleConstructorTags.viewCount", "View Count")],
                  ["%(like_count)s", t("settings.titleConstructorTags.likeCount", "Like Count")],
                  ["%(uploader)s", t("settings.titleConstructorTags.uploader", "Uploader")],
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
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.playlist", "Playlist")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(playlist)s", t("settings.titleConstructorTags.playlist", "Playlist Name")],
                  ["%(playlist_index)s", t("settings.titleConstructorTags.playlistIndex", "Playlist Index")],
                  ["%(video_autonumber)s", t("settings.titleConstructorTags.videoAutonumber", "Queue Number")],
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
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.music", "Music")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(track)s", t("settings.titleConstructorTags.track", "Track")],
                  ["%(artist)s", t("settings.titleConstructorTags.artist", "Artist")],
                  ["%(album)s", t("settings.titleConstructorTags.album", "Album")],
                  ["%(release_year)s", t("settings.titleConstructorTags.releaseYear", "Release Year")],
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
        <div className="settings-section-title">{t("settings.presetsManager.title", "Presets Manager")}</div>

        <div className="presets-manager-toolbar">
          <div className="presets-manager-actions">
            <button className="anim-btn preset-action-btn preset-add-btn" onClick={handleOpenPresetCreate}>
              {t("settings.presetsManager.actions.add", "New preset")}
            </button>
            <button className="anim-btn preset-action-btn preset-secondary-btn" onClick={handleImportPreset}>
              {t("settings.presetsManager.actions.import", "Import")}
            </button>
          </div>
          <div className="presets-manager-meta">
            {t("settings.presetsManager.count", "{count} presets", { count: presets.length })}
          </div>
        </div>

        {presets.length === 0 ? (
          <div className="presets-manager-empty">
            {t("settings.presetsManager.empty", "No presets yet.")}
          </div>
        ) : (
          <div className="presets-manager-list">
            {presets.map((preset) => {
              const presetType = String(preset.preset_type || "downloader").toLowerCase();
              let typeLabel = "Downloader";
              if (presetType === "converter") typeLabel = "Converter";
              if (presetType === "compressor") typeLabel = "Compressor";

              return (
                <div key={preset.id} className={`preset-item ${preset.hidden ? "is-hidden" : ""}`}>
                  <div className="preset-item-icon">
                    {preset.icon ? (
                      preset.icon.startsWith("<svg") ? (
                        <div dangerouslySetInnerHTML={{ __html: preset.icon }} style={{ width: "100%", height: "100%" }} />
                      ) : (
                        <img src={preset.icon} alt={preset.title} />
                      )
                    ) : (
                      GEAR_ICON
                    )}
                  </div>

                  <div className="preset-item-info">
                    <div className="preset-item-title">
                      {preset.title || t("settings.presetsManager.untitled", "Untitled")}
                      <span className="preset-badge">
                        {t(`settings.presetsManager.types.${presetType}`, typeLabel)}
                      </span>
                    </div>
                    <div className="preset-item-summary">
                      {preset.summary || t("settings.presetsManager.noSummary", "No summary")}
                    </div>
                  </div>

                  <div className="preset-item-actions">
                    <div className="preset-item-action-row">
                      <button className="preset-item-btn" onClick={() => handleOpenPresetEdit(preset.id || "")}>
                        {t("settings.presetsManager.actions.edit", "Edit")}
                      </button>
                      <button className="preset-item-btn" onClick={() => handleExportPreset(preset.id || "")}>
                        {t("settings.presetsManager.actions.export", "Export")}
                      </button>
                      <button className="preset-item-btn danger" onClick={() => handleDeletePreset(preset.id || "")}>
                        {t("settings.presetsManager.actions.delete", "Delete")}
                      </button>
                    </div>

                    <div className="preset-item-toggle">
                      <span>{t("settings.presetsManager.actions.hide", "Hidden")}</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={!!preset.hidden}
                          onChange={(e) => setPresetHidden(preset.id || "", e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
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
        <div className="settings-section-title">{t("settings.support", "Support")}</div>
        <div className="form-row">
          <span>{t("settings.supportText", "Show your support!")}</span>
          <button
            className="anim-btn"
            onClick={handleSupportClick}
            style={{ background: "#E91E63", color: "white", padding: "10px 20px" }}
          >
            <span>{t("settings.supportButton", "Support Project")}</span>
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