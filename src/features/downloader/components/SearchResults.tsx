import React from "react";
import { useTranslation } from "../../../services/i18n";
import { formatDuration } from "../../../utils/format";
import { ICON_ASSETS } from "../../../utils/icons";
import type { DownloaderSearchResult } from "../types";
import styles from "./SearchResults.module.css";

interface SearchResultsProps {
  entries: DownloaderSearchResult[];
  isVisible: boolean;
  isExiting: boolean;
  isAnalyzing: boolean;
  pendingMetadataUrl: string | null;
  resolveResultUrl: (entry: DownloaderSearchResult) => string;
  onSelect: (entry: DownloaderSearchResult) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  entries,
  isVisible,
  isExiting,
  isAnalyzing,
  pendingMetadataUrl,
  resolveResultUrl,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <div id="search-results-section" className={`${styles.section} ${isVisible ? "" : styles.hidden} ${isExiting ? styles.exiting : ""}`}>
      <div className={`${styles.header} fade-in`} style={{ animationDelay: "0.1s" }}>
        <h3 id="search-results-title" className={styles.headerTitle}>{t("downloader.search.resultsTitle")}</h3>
        <span id="search-results-count" className={styles.count}>
          {entries.length > 0 ? t("downloader.search.resultsCount", { count: entries.length }) : ""}
        </span>
      </div>

      <div id="search-results-grid" className={styles.grid}>
        {entries.length === 0 ? (
          <div className={styles.empty}>{t("downloader.search.empty")}</div>
        ) : (
          entries.map((entry, index) => {
            const isItemLoading = isAnalyzing && pendingMetadataUrl === resolveResultUrl(entry);
            return (
              <div
                key={entry.url || entry.id}
                className={`${styles.card} fade-in`}
                style={{
                  "--thumb-url": `url('${entry.thumbnail || ""}')`,
                  animationDelay: `${0.12 + index * 0.05}s`,
                } as React.CSSProperties}
              >
                <button
                  type="button"
                  className={`${styles.action} ${isItemLoading ? styles.loading : ""}`}
                  aria-label="Select"
                  disabled={isAnalyzing}
                  onClick={() => onSelect(entry)}
                >
                  <span className={styles.actionIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["download-progress"]} /></svg>
                  </span>
                  <span className={styles.actionSpinner}>
                    <span className={styles.spinner}></span>
                  </span>
                </button>
                <div className={styles.content}>
                  <div className={styles.title}>
                    {entry.title || t("common.unknownTitle")}
                  </div>
                  <div className={styles.meta}>
                    {`${entry.uploader || entry.channel || t("common.unknownChannel")} • ${entry.duration_string || formatDuration(entry.duration)}`}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};