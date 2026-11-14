import React from "react";
import { useTranslation } from "../../../services/i18n";
import { invoke } from "../../../services/tauri";
import { SettingsSection } from "../SettingsSection";

export const SupportSection: React.FC = () => {
  const { t } = useTranslation();
  const handleSupportClick = () => {
    invoke("open_in_file_manager", { path: "https://ko-fi.com/fuzjajadrowa" }).catch(() => {
      window.open("https://ko-fi.com/fuzjajadrowa", "_blank");
    });
  };

  return (
    <SettingsSection title={t("settings.support")}>
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
    </SettingsSection>
  );
};