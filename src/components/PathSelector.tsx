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
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494" transform="translate(1.407 1.407)scale(2.81)" />
          </svg>
        </button>
      )}
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