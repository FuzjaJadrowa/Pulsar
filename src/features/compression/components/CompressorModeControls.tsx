import React from "react";
import { useTranslation } from "../../../services/i18n";
import { CustomSelect } from "../../../components/ui/CustomSelect";
import { ICON_ASSETS } from "../../../utils/icons";

type CompressionMode = "percent" | "size" | "quality";
type PercentValue = number | "";

interface CompressorModeControlsProps {
  selectedMode: CompressionMode;
  percentValue: PercentValue;
  sizeInputValue: string;
  crfValue: string;
  setSelectedMode: (mode: CompressionMode) => void;
  setPercentValue: (value: PercentValue) => void;
  setSizeInputValue: (value: string) => void;
  setCrfValue: (value: string) => void;
  clearActivePreset: () => void;
}

export const CompressorModeControls: React.FC<CompressorModeControlsProps> = ({
  selectedMode,
  percentValue,
  sizeInputValue,
  crfValue,
  setSelectedMode,
  setPercentValue,
  setSizeInputValue,
  setCrfValue,
  clearActivePreset,
}) => {
  const { t } = useTranslation();
  const pctVal = typeof percentValue === "number" ? percentValue : 60;
  const percentFillRatio = (pctVal - 1) / 99;
  const getCrfLabel = (i: number) => {
    if (i === 0) return t("compressor.crf.bestQuality");
    if (i === 26) return t("compressor.crf.balance");
    if (i === 51) return t("compressor.crf.bestCompression");
    return String(i);
  };

  return (
    <div className="compressor-controls-panel fade-in">
      <span className="option-label compressor-options-title">
        {t("compressor.options.compressBy")}
      </span>
      <div
        id="compress-mode-toggle"
        className="compressor-mode-toggle mode-switcher"
        role="group"
        aria-label="Compression mode"
      >
        <button
          type="button"
          className={`switch-option ${selectedMode === "percent" ? "active" : ""}`}
          onClick={() => {
            setSelectedMode("percent");
            clearActivePreset();
          }}
          aria-pressed={selectedMode === "percent" ? "true" : "false"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <use href={ICON_ASSETS["compression-percent"]} />
          </svg>
          <span>{t("compressor.mode.percent")}</span>
        </button>
        <button
          type="button"
          className={`switch-option ${selectedMode === "size" ? "active" : ""}`}
          onClick={() => {
            setSelectedMode("size");
            clearActivePreset();
          }}
          aria-pressed={selectedMode === "size" ? "true" : "false"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <use href={ICON_ASSETS["compression-size"]} />
          </svg>
          <span>{t("compressor.mode.size")}</span>
        </button>
        <button
          type="button"
          className={`switch-option ${selectedMode === "quality" ? "active" : ""}`}
          onClick={() => {
            setSelectedMode("quality");
            clearActivePreset();
          }}
          aria-pressed={selectedMode === "quality" ? "true" : "false"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <use href={ICON_ASSETS["compression-quality"]} />
          </svg>
          <span>{t("compressor.mode.quality")}</span>
        </button>
      </div>

      <div className="compressor-mode-panels">
        {/* PERCENT PANEL */}
        <div
          className={`compressor-mode-panel ${selectedMode === "percent" ? "" : "hidden"}`}
          data-mode="percent"
        >
          <div className="compressor-percent-control">
            <div className="compressor-slider-track">
              <div className="track-bg"></div>
              <div
                className="track-fill"
                id="compress-percent-fill"
                style={{ width: `${percentFillRatio * 100}%` }}
              ></div>
              <input
                type="range"
                id="compress-percent-range"
                min="1"
                max="100"
                value={percentValue}
                onChange={(e) => {
                  setPercentValue(Number(e.target.value));
                  clearActivePreset();
                }}
                step="1"
                aria-label="Percent"
              />
            </div>
            <input
              id="compress-percent-input"
              className="custom-input compressor-percent-input"
              type="number"
              value={percentValue}
              onChange={(e) => {
                if (e.target.value === "") {
                  setPercentValue("");
                  clearActivePreset();
                  return;
                }
                let val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 100) {
                  val = 100;
                }
                setPercentValue(val);
                clearActivePreset();
              }}
              onBlur={() => {
                let val =
                  typeof percentValue === "number"
                    ? percentValue
                    : parseInt(String(percentValue), 10);
                if (isNaN(val)) val = 60;
                if (val < 1) val = 1;
                if (val > 100) val = 100;
                setPercentValue(val);
              }}
              autoComplete="off"
            />
            <span className="compressor-percent-suffix">%</span>
          </div>
        </div>

        {/* SIZE PANEL */}
        <div
          className={`compressor-mode-panel ${selectedMode === "size" ? "" : "hidden"}`}
          data-mode="size"
        >
          <div className="compressor-size-control">
            <input
              id="compress-size-input"
              className="custom-input"
              type="text"
              placeholder={t("compressor.size.placeholder")}
              value={sizeInputValue}
              onChange={(e) => {
                setSizeInputValue(e.target.value);
                clearActivePreset();
              }}
              autoComplete="off"
            />
          </div>
        </div>

        {/* QUALITY PANEL */}
        <div
          className={`compressor-mode-panel ${selectedMode === "quality" ? "" : "hidden"}`}
          data-mode="quality"
        >
          <div className="compressor-quality-control">
            <span className="compressor-crf-label">CRF</span>
            <CustomSelect
              options={Array.from({ length: 52 }, (_, i) => ({
                value: String(i),
                label: getCrfLabel(i),
              }))}
              value={crfValue}
              onChange={(val) => {
                setCrfValue(val);
                clearActivePreset();
              }}
              width="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
