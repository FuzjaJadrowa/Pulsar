import React from "react";
import { Preset } from "../services/presets";
import { t } from "../services/i18n";
import { sanitizeSvg } from "../utils/security";
import { DEFAULT_ICON } from "../utils/icons";

interface PresetGridProps {
  id: string;
  presets: Preset[];
  activeId: string | null;
  onSelect: (preset: Preset) => void;
}

export const PresetGrid: React.FC<PresetGridProps> = ({ id, presets, activeId, onSelect }) => (
  <div className="preset-grid" id={id}>
    {presets.map((preset) => (
      <button
        key={preset.id}
        type="button"
        className={`preset-card ${activeId === preset.id ? "active" : ""}`}
        onClick={() => onSelect(preset)}
      >
        <div
          className="preset-card-icon"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(preset.icon_data_url || DEFAULT_ICON) }}
        />
        <div className="preset-card-info">
          <div className="preset-card-title">
            {preset.title || t("settings.presetsManager.untitled")}
          </div>
          <div className="preset-card-summary">
            {preset.summary
              ? preset.summary.length > 50 ? `${preset.summary.slice(0, 49)}…` : preset.summary
              : t("settings.presetsManager.noSummary")}
          </div>
        </div>
      </button>
    ))}
  </div>
);