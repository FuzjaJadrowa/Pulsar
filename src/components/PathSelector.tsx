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
}) => {
  const handleBrowse = async () => {
    if (disabled) return;
    try {
      const selected = await invoke<string>(pickerCommand);
      if (selected) {
        onChange(selected);
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
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="button"
        className={buttonClassName}
        title={title}
        onClick={handleBrowse}
        disabled={disabled}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
};