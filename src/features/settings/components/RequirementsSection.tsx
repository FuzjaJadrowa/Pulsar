import React, { useEffect, useState } from "react";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { ICON_ASSETS } from "../../../utils/icons";
import { SettingsSection } from "../SettingsSection";
import styles from "./RequirementsSection.module.css";

interface RequirementsSectionProps {
  isFlatpak: boolean;
  isCheckingUpdate: boolean;
  pulsarVersion: string;
  bridgeVersion: string;
  ffmpegVersion: string;
  onCheckUpdate: (component: string) => void;
}

export const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  isFlatpak,
  isCheckingUpdate,
  pulsarVersion,
  bridgeVersion,
  ffmpegVersion,
  onCheckUpdate,
}) => {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const [localCooldown, setLocalCooldown] = useState("");

  useEffect(() => {
    setLocalCooldown(String(config.update_app_cooldown_minutes ?? 30));
  }, [config.update_app_cooldown_minutes]);

  const normalizeCooldown = () => {
    let value = parseInt(localCooldown, 10);
    if (isNaN(value)) value = 30;
    value = Math.min(500, Math.max(10, value));
    setLocalCooldown(String(value));
    updateConfig({ update_app_cooldown_minutes: value });
  };

  return (
    <SettingsSection title={t("settings.requirements")}>
      <div className="form-row">
        <span>{t("settings.autoUpdateApp")}</span>
        <div className={styles.updateActions}>
          <button className={styles.updateCheckButton} type="button" onClick={() => onCheckUpdate("pulsar")} disabled={isFlatpak || isCheckingUpdate} aria-label="Check Pulsar update">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS.retry} /></svg>
          </button>
          <ToggleSwitch checked={isFlatpak ? false : !!config.update_app} disabled={isFlatpak || isCheckingUpdate} onChange={(checked) => updateConfig({ update_app: checked })} />
        </div>
      </div>
      <div className="settings-note">{t("settings.currentVersion", { version: pulsarVersion })}</div>

      <div className="form-row">
        <span>{t("settings.autoUpdateBridge")}</span>
        <div className={styles.updateActions}>
          <button className={styles.updateCheckButton} type="button" onClick={() => onCheckUpdate("pulsar-bridge")} disabled={isFlatpak || isCheckingUpdate} aria-label="Check Bridge update">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS.retry} /></svg>
          </button>
          <ToggleSwitch checked={isFlatpak ? true : !!config.update_ytdlp} disabled={isFlatpak} onChange={(checked) => updateConfig({ update_ytdlp: checked })} />
        </div>
      </div>
      <div className="settings-note">{t("settings.currentVersion", { version: bridgeVersion })}</div>

      <div className="form-row">
        <span>{t("settings.autoUpdateFfmpeg")}</span>
        <div className={styles.updateActions}>
          <button className={styles.updateCheckButton} type="button" onClick={() => onCheckUpdate("ffmpeg")} disabled={isFlatpak || isCheckingUpdate} aria-label="Check FFmpeg update">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS.retry} /></svg>
          </button>
          <ToggleSwitch checked={isFlatpak ? false : !!config.update_ffmpeg} disabled={isFlatpak || isCheckingUpdate} onChange={(checked) => updateConfig({ update_ffmpeg: checked })} />
        </div>
      </div>
      <div className="settings-note">{t("settings.currentVersion", { version: ffmpegVersion })}</div>

      <div className="form-row">
        <span>{t("settings.ffmpegHwAccel")}</span>
        <ToggleSwitch checked={config.ffmpeg_hwaccel === "auto"} onChange={(checked) => updateConfig({ ffmpeg_hwaccel: checked ? "auto" : "none" })} />
      </div>

      <div className="form-row">
        <span>{t("settings.updateCooldown")}</span>
        <input
          className="custom-input"
          type="number"
          value={localCooldown}
          disabled={isFlatpak}
          onChange={(event) => {
            let value = event.target.value;
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 500) value = "500";
            setLocalCooldown(value);
          }}
          onBlur={normalizeCooldown}
          style={{ width: "120px" }}
        />
      </div>
    </SettingsSection>
  );
};