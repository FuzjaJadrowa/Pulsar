import React from "react";
import { PresetIconPreview } from "../../../components/PresetIconPreview";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { PRESET_DEFAULT_ICON } from "../../../utils/icons";
import type { Preset } from "../../../services/presets";
import { useTranslation } from "../../../services/i18n";
import { SettingsSection } from "../SettingsSection";
import styles from "./PresetsManagerSection.module.css";

interface PresetsManagerSectionProps {
  presets: Preset[];
  onCreate: () => void;
  onImport: () => void;
  onEdit: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onSetHidden: (id: string, hidden: boolean) => void;
}

export const PresetsManagerSection: React.FC<PresetsManagerSectionProps> = ({
  presets,
  onCreate,
  onImport,
  onEdit,
  onExport,
  onDelete,
  onSetHidden,
}) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t("settings.presetsManager.title")} className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.actions}>
          <button className={`anim-btn ${styles.actionButton} ${styles.addButton}`} onClick={onCreate}>
            {t("settings.presetsManager.actions.add")}
          </button>
          <button className={`anim-btn ${styles.actionButton} ${styles.secondaryButton}`} onClick={onImport}>
            {t("settings.presetsManager.actions.import")}
          </button>
        </div>
        <div className={styles.managerMeta}>
          {t("settings.presetsManager.count", { count: presets.length })}
        </div>
      </div>

      {presets.length === 0 ? (
        <div className={styles.empty}>{t("settings.presetsManager.empty")}</div>
      ) : (
        <div className={styles.list}>
          {presets.map((preset) => {
            const presetType = String(preset.preset_type || "downloader").toLowerCase();
            const typeLabel = presetType === "converter" ? "Converter" : presetType === "compressor" ? "Compressor" : "Downloader";
            const iconSrc = preset.icon_data_url || preset.icon;

            return (
              <div key={preset.id} className={`${styles.item} ${preset.hidden ? styles.isHidden : ""}`}>
                <div className={styles.icon}>
                  <PresetIconPreview src={iconSrc || PRESET_DEFAULT_ICON} alt={preset.title || "preset"} fallback={PRESET_DEFAULT_ICON} />
                </div>
                <div className={styles.info}>
                  <div className={styles.presetTitle}>
                    {preset.title || t("settings.presetsManager.untitled")}
                    <span className={styles.badge}>{t(`settings.presetsManager.types.${presetType}`, typeLabel)}</span>
                  </div>
                  <div className={styles.summary}>{preset.summary || t("settings.presetsManager.noSummary")}</div>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.itemActionRow}>
                    <button className={styles.itemButton} onClick={() => onEdit(preset.id || "")}>
                      {t("settings.presetsManager.actions.edit")}
                    </button>
                    <button className={styles.itemButton} onClick={() => onExport(preset.id || "")}>
                      {t("settings.presetsManager.actions.export")}
                    </button>
                    <button className={`${styles.itemButton} ${styles.dangerButton}`} onClick={() => onDelete(preset.id || "")}>
                      {t("settings.presetsManager.actions.delete")}
                    </button>
                  </div>
                  <div className={styles.itemToggle}>
                    <span>{t("settings.presetsManager.actions.hide")}</span>
                    <ToggleSwitch checked={!!preset.hidden} onChange={(checked) => onSetHidden(preset.id || "", checked)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsSection>
  );
};