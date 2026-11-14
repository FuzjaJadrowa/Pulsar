import React, { useEffect, useRef, useState } from "react";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { TAG_ICON_SVG } from "../../../utils/icons";

let textMeasureCanvas: HTMLCanvasElement | null = null;

function getTextWidth(text: string): number {
  if (!text) return 0;
  if (!textMeasureCanvas) textMeasureCanvas = document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return text.length * 7;
  context.font = '13px "Manrope", "Montserrat", sans-serif';
  return context.measureText(text).width;
}

export const TitleConstructorSection: React.FC = () => {
  const { config, updateConfig } = useConfig();
  const { t } = useTranslation();
  const [pendingFocus, setPendingFocus] = useState<{ index: number; offset: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingFocus || !containerRef.current) return;
    const inputs = containerRef.current.querySelectorAll("input");
    const inputIdx = pendingFocus.index / 2;
    const targetInput = inputs[inputIdx] as HTMLInputElement | undefined;
    if (targetInput) {
      targetInput.focus();
      const offset = Math.min(pendingFocus.offset, targetInput.value.length);
      targetInput.setSelectionRange(offset, offset);
    }
    setPendingFocus(null);
  }, [pendingFocus, config.title_template]);

  const handleAddTag = (tag: string) => {
    updateConfig({ title_template: (config.title_template || "") + tag });
  };

  const handlePartChange = (index: number, value: string, parts: string[]) => {
    const newParts = [...parts];
    newParts[index] = value;
    updateConfig({ title_template: newParts.join("") });
  };

  const handleRemovePart = (index: number, parts: string[]) => {
    const newParts = [...parts];
    newParts.splice(index, 1);
    updateConfig({ title_template: newParts.join("") });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number, parts: string[]) => {
    if (event.key !== "Backspace" || event.currentTarget.selectionStart !== 0 || event.currentTarget.selectionEnd !== 0 || index <= 0) return;
    const newParts = [...parts];
    const pillToDelete = index - 1;
    const textBefore = newParts[index - 2] || "";
    const textCurrent = newParts[index] || "";
    newParts[index - 2] = textBefore + textCurrent;
    newParts.splice(pillToDelete, 2);
    updateConfig({ title_template: newParts.join("") });
    setPendingFocus({ index: index - 2, offset: textBefore.length });
    event.preventDefault();
  };

  const handleWrapperClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("title-template-input") && !target.classList.contains("title-template-input-container")) return;
    const inputs = containerRef.current?.querySelectorAll("input");
    if (inputs?.length) (inputs[inputs.length - 1] as HTMLInputElement).focus();
  };

  return (
            <div className="title-constructor">
          <div className="title-constructor-title">{t("settings.titleConstructor")}</div>
          <div className="title-constructor-input-row">
            <div
              className="title-template-input"
              onClick={handleWrapperClick}
              style={{ cursor: "text" }}
            >
              <div
                ref={containerRef}
                className="title-template-input-container"
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", width: "100%" }}
              >
                {(() => {
                  const template = config.title_template || "";
                  const tokenRegex = /(%\(.*?\)(?:s|d))/g;
                  const parts = template.split(tokenRegex);

                  const getTagName = (token: string) => {
                    switch (token) {
                      case "%(title)s": return t("settings.titleConstructorTags.title");
                      case "%(id)s": return t("settings.titleConstructorTags.id");
                      case "%(resolution)s": return t("settings.titleConstructorTags.resolution");
                      case "%(duration_string)s": return t("settings.titleConstructorTags.durationString");
                      case "%(fps)s": return t("settings.titleConstructorTags.fps");
                      case "%(upload_date)s": return t("settings.titleConstructorTags.uploadDate");
                      case "%(view_count)s": return t("settings.titleConstructorTags.viewCount");
                      case "%(like_count)s": return t("settings.titleConstructorTags.likeCount");
                      case "%(uploader)s": return t("settings.titleConstructorTags.uploader");
                      case "%(playlist)s": return t("settings.titleConstructorTags.playlist");
                      case "%(playlist_index)s": return t("settings.titleConstructorTags.playlistIndex");
                      case "%(video_autonumber)s": return t("settings.titleConstructorTags.videoAutonumber");
                      case "%(track)s": return t("settings.titleConstructorTags.track");
                      case "%(artist)s": return t("settings.titleConstructorTags.artist");
                      case "%(album)s": return t("settings.titleConstructorTags.album");
                      case "%(release_year)s": return t("settings.titleConstructorTags.releaseYear");
                      default: return token;
                    }
                  };

                  return parts.map((part, index) => {
                    const isToken = index % 2 === 1;
                    if (isToken) {
                      const label = getTagName(part);
                      return (
                        <div
                          key={`${part}-${index}`}
                          className="title-pill pill-in"
                          onClick={() => handleRemovePart(index, parts)}
                          title={t("settings.titleConstructorRemoveTag")}
                        >
                          {TAG_ICON_SVG}
                          <span>{label}</span>
                        </div>
                      );
                    } else {
                      const isOnlyInput = parts.length === 1;
                      const isZeroLength = part.length === 0;
                      let inputWidthStyle: string;
                      if (isZeroLength) {
                        inputWidthStyle = isOnlyInput ? "120px" : "0px";
                      } else {
                        const measured = Math.ceil(getTextWidth(part));
                        inputWidthStyle = `${measured + 2}px`;
                      }
                      return (
                        <input
                          key={`text-${index}`}
                          type="text"
                          className="title-template-text-input"
                          value={part}
                          style={{
                            width: inputWidthStyle,
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "13px",
                            fontFamily: "inherit",
                            height: "26px",
                            lineHeight: "26px",
                            outline: "none",
                            padding: "0px",
                            margin: "0px",
                            maxWidth: "100%",
                            minWidth: isZeroLength && !isOnlyInput ? "0px" : "12px",
                            boxSizing: "border-box",
                          }}
                          placeholder={index === 0 && isOnlyInput ? "%(x)s" : ""}
                          onChange={(e) => handlePartChange(index, e.target.value, parts)}
                          onKeyDown={(e) => handleKeyDown(e, index, parts)}
                        />
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </div>
          <div className="title-constructor-note">
            {t("settings.titleConstructorNote")}
          </div>

          <div id="title-canvas" className="title-canvas">
            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.video")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(title)s", t("settings.titleConstructorTags.title")],
                  ["%(id)s", t("settings.titleConstructorTags.id")],
                  ["%(resolution)s", t("settings.titleConstructorTags.resolution")],
                  ["%(duration_string)s", t("settings.titleConstructorTags.durationString")],
                  ["%(fps)s", t("settings.titleConstructorTags.fps")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.statsDates")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(upload_date)s", t("settings.titleConstructorTags.uploadDate")],
                  ["%(view_count)s", t("settings.titleConstructorTags.viewCount")],
                  ["%(like_count)s", t("settings.titleConstructorTags.likeCount")],
                  ["%(uploader)s", t("settings.titleConstructorTags.uploader")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.playlist")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(playlist)s", t("settings.titleConstructorTags.playlist")],
                  ["%(playlist_index)s", t("settings.titleConstructorTags.playlistIndex")],
                  ["%(video_autonumber)s", t("settings.titleConstructorTags.videoAutonumber")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-canvas-group">
              <div className="title-canvas-title">{t("settings.titleConstructorCategories.music")}</div>
              <div className="title-canvas-tags">
                {([
                  ["%(track)s", t("settings.titleConstructorTags.track")],
                  ["%(artist)s", t("settings.titleConstructorTags.artist")],
                  ["%(album)s", t("settings.titleConstructorTags.album")],
                  ["%(release_year)s", t("settings.titleConstructorTags.releaseYear")],
                ] as const).map(([token, label]) => {
                  const isUsed = (config.title_template || "").includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`title-tag ${isUsed ? "used" : ""}`}
                      disabled={isUsed}
                      onClick={() => handleAddTag(token)}
                    >
                      {TAG_ICON_SVG}
                      <span className="title-tag-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
  );
};