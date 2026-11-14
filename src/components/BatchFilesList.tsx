import { ICON_ASSETS } from "../utils/icons";
import React from "react";
import { formatBytes } from "../utils/format";
import type { MediaFileMetadata } from "../types/media";
import styles from "./BatchFilesList.module.css";

interface BatchFilesListProps {
  files: MediaFileMetadata[];
  removeTitle: string;
  onRemove: (index: number) => void;
}

export const BatchFilesList: React.FC<BatchFilesListProps> = ({ files, removeTitle, onRemove }) => (
  <div className={styles.list}>
    {files.map((file, index) => (
      <div key={file.path || index} className={styles.item}>
        <span className={styles.name} title={file.path}>
          {file.name || file.path.split(/[\\/]/).pop() || ""}
        </span>
        <span className={styles.size}>{formatBytes(file.size_bytes)}</span>
        <button
          type="button"
          className={styles.removeButton}
          title={removeTitle}
          aria-label={`${removeTitle}: ${file.name || file.path}`}
          onClick={() => onRemove(index)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["remove-file"]} /></svg>
        </button>
      </div>
    ))}
  </div>
);