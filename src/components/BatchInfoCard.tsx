import React from "react";
import type { MediaFileMetadata } from "../types/media";
import { BatchFilesList } from "./BatchFilesList";
import styles from "./BatchInfoCard.module.css";

interface BatchInfoCardProps {
  categoryIcon: string;
  categoryLabel: string;
  files: MediaFileMetadata[];
  removeTitle: string;
  onRemove: (index: number) => void;
}

export const BatchInfoCard: React.FC<BatchInfoCardProps> = ({
  categoryIcon,
  categoryLabel,
  files,
  removeTitle,
  onRemove,
}) => (
  <div className={`${styles.card} fade-in`}>
    <div className={styles.headerRow}>
      <div className={styles.headerTitle}>
        <span className={styles.categoryIcon} dangerouslySetInnerHTML={{ __html: categoryIcon }} />
        <span>{categoryLabel}</span>
      </div>
    </div>
    <BatchFilesList files={files} removeTitle={removeTitle} onRemove={onRemove} />
  </div>
);