import React, { useState, useEffect } from "react";
import { useTranslation, getLanguages } from "../../services/i18n";
import { useConfig, getCurrentConfig, saveConfig, DEFAULT_CONFIG } from "../../services/config";
import { usePresets } from "../../services/presets";
import { CustomSelect } from "../../components/CustomSelect";
import { PresetCreatorModal } from "./components/PresetCreatorModal";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { invoke } from "../../services/tauri";
import { showNotification } from "../../services/notifications";
import { PathSelector } from "../../components/PathSelector";
import styles from "./Settings.module.css";
import { SettingsSection } from "./SettingsSection";
import { AppearanceSection } from "./components/AppearanceSection";
import { CodecSettingsSection } from "./components/CodecSettingsSection";
import { AdvancedSection } from "./components/AdvancedSection";
import { SupportSection } from "./components/SupportSection";
import { PresetsManagerSection } from "./components/PresetsManagerSection";
import { RequirementsSection } from "./components/RequirementsSection";
import { DownloadSettingsSection } from "./components/DownloadSettingsSection";

export const Settings: React.FC = () => {
  const { t, changeLanguage } = useTranslation();
  const { config, updateConfig } = useConfig();



  useEffect(() => {
    return () => {
      const current = getCurrentConfig();
      if (!current.title_template || !current.title_template.trim()) {
        saveConfig({ title_template: DEFAULT_CONFIG.title_template });
      }
    };
  }, []);

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
  const [isFlatpak, setIsFlatpak] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    invoke<string>("get_distribution_channel")
      .then((channel) => {
        if (channel === "flatpak") {
          setIsFlatpak(true);
        }
      })
      .catch(() => {});

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

  const handleUpdateCheck = async (component: string) => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      await invoke("run_requirement_check", { component });
      const reqVersions = await invoke<Record<string, string>>("get_requirements_versions");
      setPulsarVersion(reqVersions["pulsar"] || "3.0.1");
      setBridgeVersion(reqVersions["pulsar-bridge"] || "N/A");
      setFfmpegVersion(reqVersions["ffmpeg"] || "N/A");
    } catch (err) {
      console.error(`Check update failed for ${component}:`, err);
      showNotification(t("common.error"), String(err), "error");
    } finally {
      setIsCheckingUpdate(false);
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

// ======================
// ADD NRW LANGUAGE HERE!
// ======================
  const languages = getLanguages();
// ======================


  return (
    <div className={`${styles.scope} page-root page-scroll settings-page`}>
      <div className="settings-page-header">
        <span className="settings-page-title">{t("settings.title")}</span>
      </div>

      {/* General Settings */}
      <SettingsSection title={t("settings.general")}>

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
          <span>{t("settings.defaultSavePath")}</span>
          <PathSelector
            className="path-selector settings-default-path-selector"
            value={config.default_save_path}
            onChange={(path) => updateConfig({ default_save_path: path })}
            placeholder={t("common.noSavePathSelected")}
            pickerCommand="pick_download_directory"
            title={t("common.browse")}
          />
        </div>

        <div className="form-row">
          <span>{t("settings.systemNotifications")}</span>
          <ToggleSwitch
            checked={!!config.system_notifications}
            onChange={(checked) => updateConfig({ system_notifications: checked })}
          />
        </div>

      </SettingsSection>

      <AppearanceSection />

      <CodecSettingsSection />

      <RequirementsSection
        isFlatpak={isFlatpak}
        isCheckingUpdate={isCheckingUpdate}
        pulsarVersion={pulsarVersion}
        bridgeVersion={bridgeVersion}
        ffmpegVersion={ffmpegVersion}
        onCheckUpdate={handleUpdateCheck}
      />
      <DownloadSettingsSection />

      <PresetsManagerSection
        presets={presets}
        onCreate={handleOpenPresetCreate}
        onImport={handleImportPreset}
        onEdit={handleOpenPresetEdit}
        onExport={handleExportPreset}
        onDelete={handleDeletePreset}
        onSetHidden={setPresetHidden}
      />
      <AdvancedSection />
      <SupportSection />

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