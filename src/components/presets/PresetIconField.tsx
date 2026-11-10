import React, { useRef } from "react";
import { useTranslation } from "../../services/i18n";
import { PresetIconPreview } from "../PresetIconPreview";

interface PresetIconFieldProps {
  value: string;
  title: string;
  fallback: string;
  onChange: (value: string) => void;
}

export const PresetIconField: React.FC<PresetIconFieldProps> = ({ value, title, fallback, onChange }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processImageFile = (file: File) => {
    const isImage = file.type.startsWith("image/") || /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(file.name);
    if (!isImage) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") onChange(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files[0] ?? event.dataTransfer.items[0]?.getAsFile();
    if (file) processImageFile(file);
  };

  return (
    <div className="preset-field preset-field-icon">
      <span>{t("presetCreator.fields.icon")}</span>
      <div
        className="preset-icon-drop"
        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onDrop={handleDrop}
      >
        <div className="preset-icon-preview">
          <PresetIconPreview src={value} alt={title || "preset"} fallback={fallback} />
        </div>
        <div className="preset-icon-meta">
          <div className="preset-icon-title">{t("presetCreator.icon.title")}</div>
          <div className="preset-icon-hint">{t("presetCreator.icon.hint")}</div>
          <button type="button" className="anim-btn preset-icon-browse" onClick={() => fileInputRef.current?.click()}>
            {t("common.browse")}
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="preset-icon-file"
          type="file"
          accept="image/*,.svg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) processImageFile(file);
          }}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
};