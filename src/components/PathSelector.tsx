import { ICON_ASSETS } from "../utils/icons";
import React from "react";
import { invoke } from "../services/tauri";

interface PathSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  pickerCommand?: string;
  title?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  disabled?: boolean;
  useLastPathTitle?: string;
}

export const PathSelector: React.FC<PathSelectorProps> = ({
  value,
  onChange,
  placeholder = "",
  pickerCommand = "pick_download_directory",
  title = "Browse",
  id,
  className = "path-selector",
  inputClassName = "",
  buttonClassName = "small-btn",
  disabled = false,
  useLastPathTitle,
}) => {
  const handleChange = (nextValue: string) => {
    onChange(nextValue);
    if (nextValue.trim()) {
      try { localStorage.setItem("pulsar.lastSavePath", nextValue.trim()); } catch { /* Storage may be unavailable. */ }
    }
  };

  const handleBrowse = async () => {
    if (disabled) return;
    try {
      const selected = await invoke<string>(pickerCommand);
      if (selected) {
        handleChange(selected);
      }
    } catch (e) {
      console.error(`Tauri browse path invocation (${pickerCommand}) failed:`, e);
    }
  };

  return (
    <div className={className}>
      <input
        type="text"
        id={id}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {useLastPathTitle && (
        <button
          type="button"
          className={buttonClassName}
          title={useLastPathTitle}
          aria-label={useLastPathTitle}
          onClick={() => {
            try {
              const lastPath = localStorage.getItem("pulsar.lastSavePath");
              if (lastPath) onChange(lastPath);
            } catch { /* Storage may be unavailable. */ }
          }}
          disabled={disabled}
        >
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["convert"]} /></svg>
        </button>
      )}
      <button
        type="button"
        className={buttonClassName}
        title={title}
        onClick={handleBrowse}
        disabled={disabled}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["folder-browse"]} /></svg>
      </button>
    </div>
  );
};