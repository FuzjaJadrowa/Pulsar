import React from "react";
import { ICON_ASSETS } from "../../utils/icons";

interface MediaFilePickerBarProps {
  idPrefix: "convert" | "compress";
  pageClass: "converter-bar" | "compressor-bar";
  zenClass: "converter-zen" | "compressor-zen";
  dropHintClass: "convert-drop-hint" | "compress-drop-hint";
  placeholder: string;
  value: string;
  isLoading: boolean;
  hasMetadata: boolean;
  isDashboardVisible: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  browseTitle: string;
  clearTitle: string;
  dropHint: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onBrowse: () => void;
  onClear: () => void;
}

export const MediaFilePickerBar: React.FC<MediaFilePickerBarProps> = ({
  idPrefix,
  pageClass,
  zenClass,
  dropHintClass,
  placeholder,
  value,
  isLoading,
  hasMetadata,
  isDashboardVisible,
  inputRef,
  browseTitle,
  clearTitle,
  dropHint,
  onValueChange,
  onConfirm,
  onBrowse,
  onClear,
}) => (
  <div
    id={`${idPrefix}-search-section`}
    className={`search-section ${!isDashboardVisible ? `centered ${zenClass}` : "sticky"}`}
  >
    <div
      className={`search-box-row ${pageClass}`}
      id={`${idPrefix === "convert" ? "converter" : "compressor"}-bar`}
    >
      <input
        type="text"
        id={`${idPrefix}-path-input`}
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onConfirm();
        }}
        autoComplete="off"
      />
      <span
        id={`${idPrefix}-browse-btn`}
        className="bar-icon"
        title={browseTitle}
        role="button"
        tabIndex={0}
        onClick={onBrowse}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <use href={ICON_ASSETS["folder-browse"]} />
        </svg>
      </span>
      {hasMetadata && (
        <button
          type="button"
          className="bar-icon clear-selection-btn"
          title={clearTitle}
          aria-label={clearTitle}
          onClick={onClear}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <use href={ICON_ASSETS["window-close"]} />
          </svg>
        </button>
      )}
      <button
        id={`${idPrefix}-confirm-btn`}
        className={`bar-action ${isLoading ? "loading" : ""} ${hasMetadata ? "hidden" : ""}`}
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? (
          <svg
            className="btn-spinner-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <use href={ICON_ASSETS["loading-spinner"]} />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <use href={ICON_ASSETS["clear-selection"]} />
          </svg>
        )}
      </button>
    </div>
    {!isDashboardVisible && (
      <div
        className={`drop-hint ${dropHintClass}`}
        onClick={onBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
      >
        <span className="drop-hint-icon" aria-hidden="true">
          <svg viewBox="0 0 512 512">
            <use href={ICON_ASSETS["download-circle"]} />
          </svg>
        </span>
        <span className="drop-hint-text">{dropHint}</span>
        <span className="drop-hint-icon" aria-hidden="true">
          <svg viewBox="0 0 512 512">
            <use href={ICON_ASSETS["download-circle"]} />
          </svg>
        </span>
      </div>
    )}
  </div>
);
