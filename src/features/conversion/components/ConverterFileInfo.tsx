import React from "react";
import { useTranslation } from "../../../services/i18n";
import { formatBytes, formatDuration } from "../../../utils/format";
import { CATEGORY_ICONS, ICON_ASSETS } from "../../../utils/icons";
import type { MediaFileMetadata } from "../../../types/media";
import styles from "./ConverterFileInfo.module.css";

interface ConverterFileInfoProps {
  metadata: MediaFileMetadata;
  currentName: string;
  nameDraft: string;
  isEditingName: boolean;
  category: string;
  fallbackName: string;
  folderPath: string;
  onNameDraftChange: (value: string) => void;
  onFinishNameEdit: () => void;
  onBeginNameEdit: () => void;
}

export const ConverterFileInfo: React.FC<ConverterFileInfoProps> = ({
  metadata,
  currentName,
  nameDraft,
  isEditingName,
  category,
  fallbackName,
  folderPath,
  onNameDraftChange,
  onFinishNameEdit,
  onBeginNameEdit,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`fade-in ${styles.card} ${!metadata.duration_seconds ? styles.noDuration : ""} ${isEditingName ? styles.isEditing : ""}`}>
      <div className={styles.nameRow}>
        {!isEditingName ? (
          <>
            <span className={styles.nameText}>
              {currentName || metadata.name || fallbackName || t("common.output.placeholder")}
            </span>
            <button type="button" className={styles.renameButton} onClick={onBeginNameEdit} title={t("common.output.editTitle")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS.edit} /></svg>
            </button>
          </>
        ) : (
          <input
            className={styles.nameInput}
            type="text"
            value={nameDraft}
            onChange={(event) => onNameDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onFinishNameEdit();
            }}
            onBlur={onFinishNameEdit}
            autoFocus
          />
        )}
      </div>
      <div className={styles.categoryRow}>
        <span className={styles.categoryIcon} dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[category] || "" }} />
        <span className="converter-category-label">
          {metadata.extension
            ? `${t(`common.meta.category.${category}`, category.toUpperCase())} (${metadata.extension})`
            : t(`common.meta.category.${category}`, category.toUpperCase())}
        </span>
      </div>
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{t("common.meta.locationLabel")}</span>
        <span className={`${styles.metaValue} ${styles.locationValue}`} title={folderPath}>
          {folderPath || "-"}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{t("common.meta.sizeLabel")}</span>
          <span className={styles.metaValue}>{formatBytes(metadata.size_bytes)}</span>
        </div>
        {metadata.duration_seconds && (
          <div className={`${styles.metaItem} ${styles.duration}`}>
            <span className={styles.metaLabel}>{t("common.meta.durationLabel")}</span>
            <span className={styles.metaValue}>{metadata.duration_string || formatDuration(metadata.duration_seconds)}</span>
          </div>
        )}
      </div>
    </div>
  );
};