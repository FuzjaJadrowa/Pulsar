import React, { useEffect, useState } from "react";
import { CustomSelect } from "../../../components/CustomSelect";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { SettingsSection } from "../SettingsSection";
import { TitleConstructorSection } from "./TitleConstructorSection";

export const DownloadSettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const [localProcesses, setLocalProcesses] = useState("");
  const [localSearchResults, setLocalSearchResults] = useState("");

  useEffect(() => {
    setLocalProcesses(String(config.maximum_concurrent_processes ?? 3));
    setLocalSearchResults(String(config.maximum_search_results ?? 10));
  }, [config.maximum_concurrent_processes, config.maximum_search_results]);

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
    <SettingsSection title={t("settings.downloadSettings")}>
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

        <div className="title-constructor">
          <div className="title-constructor-title">{t("settings.preferDownloadingWithFfmpeg")}</div>
          <div className="form-row">
            <span>{t("settings.whileConvertingMedia")}</span>
            <ToggleSwitch checked={config.prefer_ffmpeg_while_converting} onChange={(checked) => updateConfig({ prefer_ffmpeg_while_converting: checked })} />
          </div>
          <div className="settings-note">{t("settings.whileConvertingMediaNote")}</div>
          <div className="form-row">
            <span>{t("settings.whileDownloadingMedia")}</span>
            <ToggleSwitch checked={config.prefer_ffmpeg_while_downloading} onChange={(checked) => updateConfig({ prefer_ffmpeg_while_downloading: checked })} />
          </div>
          <div className="settings-note">{t("settings.whileDownloadingMediaNote")}</div>
        </div>

        <TitleConstructorSection />
    </SettingsSection>
  );
};