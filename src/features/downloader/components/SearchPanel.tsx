import React, { type RefObject } from "react";
import { useTranslation } from "../../../services/i18n";
import { ICON_ASSETS, SourceIcon } from "../../../utils/icons";
import styles from "./SearchPanel.module.css";

type SearchProvider = "ytsearch" | "ytmsearch" | "scsearch";

interface SearchPanelProps {
  url: string;
  isDashboardVisible: boolean;
  isSearchMode: boolean;
  isSearching: boolean;
  isAnalyzing: boolean;
  isSearchQuery: boolean;
  provider: SearchProvider;
  inputRef: RefObject<HTMLInputElement | null>;
  onUrlChange: (value: string) => void;
  onPaste: () => void;
  onSubmit: () => void;
  onProviderChange: (provider: SearchProvider) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  url,
  isDashboardVisible,
  isSearchMode,
  isSearching,
  isAnalyzing,
  isSearchQuery,
  provider,
  inputRef,
  onUrlChange,
  onPaste,
  onSubmit,
  onProviderChange,
}) => {
  const { t } = useTranslation();
  const showProviderPanel = !isDashboardVisible && !isSearchMode && !isSearching && url.trim().length > 0 && isSearchQuery;

  return (
    <div id="search-section" className={`search-section ${!isDashboardVisible && !isSearchMode ? "centered" : "sticky"} ${showProviderPanel ? "has-provider-panel" : ""}`}>
      <div className="search-box-row">
        <input
          type="text"
          id="url-input"
          ref={inputRef}
          placeholder={t("downloader.search.urlPlaceholder")}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
              inputRef.current?.blur();
            }
          }}
          autoComplete="off"
        />
        <span
          id="paste-icon"
          className="paste-icon bar-icon"
          title={t("downloader.search.pasteTitle")}
          role="button"
          tabIndex={0}
          onClick={onPaste}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS.search} /></svg>
        </span>
        <button
          id="fetch-btn"
          className={`bar-action ${isAnalyzing || isSearching ? "loading" : ""}`}
          onClick={onSubmit}
          disabled={isAnalyzing || isSearching}
        >
          {isAnalyzing || isSearching ? (
            <svg className="btn-spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["loading-spinner"]} /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["clear-selection"]} /></svg>
          )}
        </button>
      </div>

      <div
        id="search-provider-panel"
        className={`${styles.providerPanel} ${showProviderPanel ? styles.visible : ""}`}
        aria-hidden={!showProviderPanel}
      >
        <span className={styles.providerLabel}>{t("downloader.search.providerLabel")}</span>
        <div className={styles.providerButtons}>
          <button type="button" className={`${styles.providerButton} ${provider === "ytsearch" ? styles.active : ""}`} onClick={() => onProviderChange("ytsearch")}>
            <SourceIcon source="youtube" className="provider-icon youtube-icon" />
            <span>YouTube</span>
          </button>
          <button type="button" className={`${styles.providerButton} ${provider === "ytmsearch" ? styles.active : ""}`} onClick={() => onProviderChange("ytmsearch")}>
            <SourceIcon source="ytmusic" className="provider-icon ytmusic-icon" />
            <span>YouTube Music</span>
          </button>
          <button type="button" className={`${styles.providerButton} ${provider === "scsearch" ? styles.active : ""}`} onClick={() => onProviderChange("scsearch")}>
            <SourceIcon source="soundcloud" className="provider-icon soundcloud-icon" />
            <span>SoundCloud</span>
          </button>
        </div>
      </div>
    </div>
  );
};