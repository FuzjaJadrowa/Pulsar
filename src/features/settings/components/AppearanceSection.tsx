import React from "react";
import { CustomSelect } from "../../../components/CustomSelect";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { SettingsSection } from "../SettingsSection";

export const AppearanceSection: React.FC = () => {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const themes = [
    { value: "System", label: t("settings.themeOptions.system") },
    { value: "Dark", label: t("settings.themeOptions.dark") },
    { value: "Light", label: t("settings.themeOptions.light") },
  ];

  return (
    <SettingsSection title={t("settings.appearance")}>
      <div className="form-row">
        <span>{t("settings.theme")}</span>
        <CustomSelect
          options={themes}
          value={config.theme}
          onChange={(value) => updateConfig({ theme: value })}
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
    </SettingsSection>
  );
};