import React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../../services/i18n";
import { formatDuration } from "../../../utils/format";
import { ICON_ASSETS, SOURCE_ICONS, SourceIcon } from "../../../utils/icons";
import type { DownloaderMetadata } from "../types";
import styles from "./MetadataInfo.module.css";

interface MetadataInfoProps {
  metadata: DownloaderMetadata;
  duration: number;
  currentSource: string | null;
  isEditingFilename: boolean;
  customFilename: string;
  filenameDraft: string;
  onFilenameDraftChange: (value: string) => void;
  onFinishFilenameEdit: () => void;
  onBeginFilenameEdit: () => void;
}

export const MetadataInfo: React.FC<MetadataInfoProps> = ({
  metadata,
  duration,
  currentSource,
  isEditingFilename,
  customFilename,
  filenameDraft,
  onFilenameDraftChange,
  onFinishFilenameEdit,
  onBeginFilenameEdit,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`${styles.info} fade-in`}>
      <div className={styles.titleRow}>
        {isEditingFilename ? (
          <input
            id="custom-filename-input"
            className={styles.titleInput}
            type="text"
            value={filenameDraft}
            onChange={(event) => onFilenameDraftChange(event.target.value)}
            onBlur={onFinishFilenameEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") onFinishFilenameEdit();
            }}
            autoFocus
          />
        ) : (
          <h2 id="meta-title" className={styles.title}>{customFilename.trim() || metadata.title || t("common.unknownTitle")}</h2>
        )}
        <button
          type="button"
          className={styles.renameButton}
          onClick={onBeginFilenameEdit}
          title={t("common.output.editTitle")}
          aria-label={t("common.output.editTitle")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS.edit} /></svg>
        </button>
      </div>
      <p className={styles.details}>
        <span
          id="meta-author"
          className={`${styles.author} ${metadata.uploader_url ? styles.authorLink : ""}`}
          role={metadata.uploader_url ? "button" : undefined}
          tabIndex={metadata.uploader_url ? 0 : -1}
          onClick={() => {
            if (metadata.uploader_url) {
              openUrl(metadata.uploader_url).catch((error) => {
                console.error("Failed to open uploader channel:", error);
              });
            }
          }}
        >
          {currentSource && currentSource in SOURCE_ICONS && (
            <span className={styles.sourceIcon}>
              <SourceIcon source={currentSource} />
            </span>
          )}
          <span className="meta-author-name">
            {metadata.channel || metadata.uploader || t("common.unknownChannel")}
          </span>
        </span>
        <span className={styles.separator}>-</span>
        <span id="meta-duration">{metadata.duration_string || formatDuration(duration)}</span>
      </p>
    </div>
  );
};