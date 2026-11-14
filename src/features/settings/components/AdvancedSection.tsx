import React from "react";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { SettingsSection } from "../SettingsSection";

export const AdvancedSection: React.FC = () => {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();

  return (
    <SettingsSection title={t("settings.advanced")}>
      <div className="form-row">
        <span>{t("settings.runtimeLogs")}</span>
        <ToggleSwitch checked={!!config.runtime_logs} onChange={(checked) => updateConfig({ runtime_logs: checked })} />
      </div>
      <div className="settings-note">{t("settings.runtimeLogsNote")}</div>
      <div className="form-row">
        <span>{t("settings.advancedMode")}</span>
        <ToggleSwitch checked={!!config.advanced_mode} onChange={(checked) => updateConfig({ advanced_mode: checked })} />
      </div>
      <div className="settings-note">{t("settings.advancedModeNote")}</div>
    </SettingsSection>
  );
};