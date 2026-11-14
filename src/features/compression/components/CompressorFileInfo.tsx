import React from "react";
import { useTranslation } from "../../../services/i18n";
import { formatBytes, formatDuration } from "../../../utils/format";
import { CATEGORY_ICONS, ICON_ASSETS, PRESET_DEFAULT_ICON } from "../../../utils/icons";
import type { MediaFileMetadata } from "../../../types/media";
import styles from "./CompressorFileInfo.module.css";

interface CompressorFileInfoProps {
  metadata: MediaFileMetadata;
  currentName: string;
  nameDraft: string;
  isEditingName: boolean;
  category: string;
  hasDuration: boolean;
  fallbackName: string;
  folderPath: string;
  onNameDraftChange: (value: string) => void;
  onFinishNameEdit: () => void;
  onBeginNameEdit: () => void;
  onCancelNameEdit: () => void;
}

export const CompressorFileInfo: React.FC<CompressorFileInfoProps> = ({
  metadata,
  currentName,
  nameDraft,
  isEditingName,
  category,
  hasDuration,
  fallbackName,
  folderPath,
  onNameDraftChange,
  onFinishNameEdit,
  onBeginNameEdit,
  onCancelNameEdit,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`fade-in ${styles.card} ${!hasDuration ? styles.noDuration : ""} ${isEditingName ? styles.isEditing : ""}`}>
      <div className={styles.nameRow}>
        {isEditingName ? (
          <input
            id="compress-file-name-input"
            className={styles.nameInput}
            type="text"
            placeholder={t("common.output.placeholder")}
            value={nameDraft}
            onChange={(event) => onNameDraftChange(event.target.value)}
            onBlur={onFinishNameEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") onFinishNameEdit();
              else if (event.key === "Escape") onCancelNameEdit();
            }}
            autoFocus
            autoComplete="off"
          />
        ) : (
          <span
            id="compress-file-name"
            className={styles.nameText}
            data-i18n-lock={currentName ? "true" : undefined}
            onDoubleClick={onBeginNameEdit}
          >
            {currentName || metadata.name || fallbackName || t("common.output.placeholder")}
          </span>
        )}
        <button
          type="button"
          id="compress-rename-btn"
          className={styles.renameButton}
          title={t("common.output.editTitle")}
          onClick={() => isEditingName ? onFinishNameEdit() : onBeginNameEdit()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS.edit} /></svg>
        </button>
      </div>
      <div className={styles.categoryRow}>
        <span
          id="compress-category-icon"
          className={styles.categoryIcon}
          dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[category] || PRESET_DEFAULT_ICON }}
        />
        <span id="compress-category-label" className="compressor-category-label">
          {metadata.extension
            ? `${t(`common.meta.category.${category}`, category ? category.toUpperCase() : "FILE")} (${metadata.extension})`
            : t(`common.meta.category.${category}`, category ? category.toUpperCase() : "FILE")}
        </span>
      </div>
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{t("common.meta.locationLabel")}</span>
          <span id="compress-file-location" className={`${styles.metaValue} ${styles.locationValue}`} title={folderPath}>
            {folderPath || "-"}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{t("common.meta.sizeLabel")}</span>
          <span id="compress-file-size" className={styles.metaValue}>{formatBytes(metadata.size_bytes)}</span>
        </div>
        {hasDuration && (
          <div className={`${styles.metaItem} ${styles.duration}`}>
            <span className={styles.metaLabel}>{t("common.meta.durationLabel")}</span>
            <span id="compress-file-duration" className={styles.metaValue}>
              {metadata.duration_string || formatDuration(metadata.duration_seconds)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};