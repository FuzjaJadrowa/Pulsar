import React from "react";
import { useQueue } from "../hooks/useQueue";
import {
  cancelItem,
  clearQueue,
  openInFileManager,
  removeItem,
  startAll,
  startItemById,
  stopAll,
  type QueueItem,
} from "../queue";
import { useTranslation } from "../../../services/i18n";
import { formatBytes, detectSourceFromUrl } from "../../../utils/format";

import { ICONS, SOURCE_ICONS, SourceIcon } from "../../../utils/icons";
import { extractFolderPath } from "../../../utils/path";
import "../Queue.css";

function getQueueItemOutputFolder(item: QueueItem): string {
  const payload = item.payload || {};
  const asPath = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  if (item.itemType === "download") {
    return (
      asPath(payload.path) ||
      asPath(payload.output_dir) ||
      asPath(payload.save_path) ||
      item.path
    );
  }

  const batchItems = Array.isArray(payload.items)
    ? (payload.items as Record<string, unknown>[])
    : [];
  const outputDirectory =
    asPath(payload.output_dir) || asPath(batchItems[0]?.output_dir);
  if (outputDirectory) return outputDirectory;
  if (payload.is_batch && item.path) return item.path;

  const outputFile =
    asPath(payload.output_path) || asPath(payload.path) || item.path;
  return extractFolderPath(outputFile) || asPath(payload.save_path);
}

function formatCodecName(value: unknown): string {
  const codec = String(value || "").trim();
  const normalized = codec.toLowerCase();
  if (!normalized) return "";
  if (/^(avc1|avc3|h264|x264)(\.|$)/.test(normalized)) return "H264";
  if (/^(hev1|hvc1|hevc|h265|x265)(\.|$)/.test(normalized)) return "H265";
  if (/^(mp4a|aac)(\.|$)/.test(normalized)) return "AAC";
  if (/^(vp09|vp9)(\.|$)/.test(normalized)) return "VP9";
  if (/^(vp08|vp8)(\.|$)/.test(normalized)) return "VP8";
  if (/^(av01|av1)(\.|$)/.test(normalized)) return "AV1";
  if (/^(opus)(\.|$)/.test(normalized)) return "Opus";
  if (/^(vorbis)(\.|$)/.test(normalized)) return "Vorbis";
  return codec.toUpperCase();
}

function getThumbnailStyle(thumb?: string): React.CSSProperties {
  const clean = String(thumb || "")
    .trim()
    .replace(/\\/g, "/");
  if (!clean) return { background: "#242730" };
  return { backgroundImage: `url("${clean.replace(/"/g, '\\"')}")` };
}

function getModeInfo(item: QueueItem) {
  const itemType = item.itemType;
  const payloadCategory = String(item.payload?.category || "").toLowerCase();

  const mode =
    itemType === "download"
      ? String(item.payload?.mode || "video").toLowerCase()
      : payloadCategory || itemType;

  let modeIcon = ICONS.download;
  if (itemType === "download") {
    modeIcon = mode === "audio" ? ICONS.audio : ICONS.video;
  } else {
    if (payloadCategory === "audio") modeIcon = ICONS.audio;
    else if (payloadCategory === "image") modeIcon = ICONS.image;
    else if (payloadCategory === "video") modeIcon = ICONS.video;
    else if (payloadCategory === "font") modeIcon = ICONS.font;
    else if (payloadCategory === "archive") modeIcon = ICONS.archive;
    else modeIcon = itemType === "convert" ? ICONS.convert : ICONS.compress;
  }

  const source = detectSourceFromUrl(item.payload?.url || "");
  const sourceIcon =
    source && source in SOURCE_ICONS ? (
      <span className={`queue-source-icon ${source}-icon`} aria-hidden="true">
        <SourceIcon source={source} />
      </span>
    ) : null;

  // Info details
  let text = "";
  if (itemType === "compress") {
    const outputFormat = String(
      item.payload?.output_format || "--",
    ).toUpperCase();
    const sourceSize = formatBytes(item.payload?.source_size_bytes);
    text = `${outputFormat} | ${sourceSize}`;
  } else if (itemType === "convert") {
    const outputFormat = String(
      item.payload?.output_format || "--",
    ).toUpperCase();
    const sourceSize = formatBytes(item.payload?.source_size_bytes);
    text = `${outputFormat} | ${sourceSize}`;
  } else {
    const dMode = String(item.payload?.mode || "video").toLowerCase();
    const format =
      dMode === "audio"
        ? String(item.payload?.audio_format || "--").toUpperCase()
        : String(item.payload?.video_format || "--").toUpperCase();
    const quality =
      dMode === "audio"
        ? String(item.payload?.audio_quality || "--")
        : String(item.payload?.video_quality || "--");
    const codec =
      dMode === "audio"
        ? formatCodecName(
            item.payload?.display_audio_codec || item.payload?.audio_codec,
          )
        : [
            item.payload?.display_video_codec || item.payload?.video_codec,
            item.payload?.display_audio_codec || item.payload?.audio_codec,
          ]
            .map(formatCodecName)
            .filter(Boolean)
            .join("/");
    const output = codec && codec !== format ? `${format} - ${codec}` : format;
    const estimatedSize = formatBytes(item.payload?.estimated_size_bytes);
    text = `${quality} | ${output} | ${estimatedSize}`;
  }

  let typeIcon = ICONS.download;
  if (itemType === "convert") typeIcon = ICONS.convert;
  else if (itemType === "compress") typeIcon = ICONS.compress;

  return {
    modeIcon,
    sourceIcon,
    infoMarkup: (
      <>
        <span className={`queue-type-icon ${itemType}-type-icon`}>
          {typeIcon}
        </span>
        <span className="queue-item-details-text">{text}</span>
      </>
    ),
  };
}

type QueueTranslator = ReturnType<typeof useTranslation>["t"];

const QueueItemRow = React.memo(
  ({ item, t }: { item: QueueItem; t: QueueTranslator }) => {
    const { modeIcon, sourceIcon, infoMarkup } = getModeInfo(item);

    return (
      <div
        className={`queue-item status-${item.status || "pending"} ${item.thumbnail ? "has-thumbnail" : "no-thumbnail"}`}
        data-id={item.id}
      >
        <div
          className="queue-item-bg"
          style={getThumbnailStyle(item.thumbnail)}
        ></div>
        <div className="queue-item-content">
          <div className="queue-item-title-row">
            <span className="queue-mode-icon">{modeIcon}</span>
            {sourceIcon}
            <div className="queue-item-title">{item.title}</div>
          </div>
          <div className="queue-item-details">{infoMarkup}</div>
          <div className="queue-item-progress-wrap">
            <div className="queue-progress-bar">
              <div
                className="queue-progress-fill"
                style={{ width: `${Math.round(item.progress)}%` }}
              ></div>
            </div>
            <div className="queue-progress-meta">
              <span>
                {item.stage ? `${t(`queue.stages.${item.stage}`)} - ` : ""}
                {Math.round(item.progress)}%
                {item.listProgress ? ` (${item.listProgress})` : ""}
              </span>
              <span>
                {t("common.eta")} {item.eta || "--"}
              </span>
            </div>
          </div>
        </div>

        <div className="queue-item-actions">
          {item.status === "pending" && (
            <>
              <button
                className="queue-icon-btn"
                onClick={() => startItemById(item.id, "queue-manual")}
                title={t("queue.itemActions.start")}
              >
                {ICONS.play}
              </button>
              <button
                className="queue-icon-btn"
                onClick={() => removeItem(item.id)}
                title={t("queue.itemActions.remove")}
              >
                {ICONS.trash}
              </button>
            </>
          )}
          {item.status === "downloading" && (
            <button
              className="queue-icon-btn"
              onClick={() => cancelItem(item.id)}
              disabled={Boolean(item.cancelRequested)}
              title={t("queue.itemActions.stop")}
            >
              {ICONS.stop}
            </button>
          )}
          {item.status === "failed" && (
            <>
              <button
                className="queue-icon-btn"
                onClick={() => startItemById(item.id, "queue-manual", true)}
                title={t("queue.itemActions.retry")}
              >
                {ICONS.retry}
              </button>
              <button
                className="queue-icon-btn"
                onClick={() => removeItem(item.id)}
                title={t("queue.itemActions.remove")}
              >
                {ICONS.trash}
              </button>
              <button
                className="queue-icon-btn"
                onClick={() =>
                  openInFileManager(getQueueItemOutputFolder(item))
                }
                title={t("queue.itemActions.openLocation")}
              >
                {ICONS.open}
              </button>
            </>
          )}
          {item.status === "completed" && (
            <>
              <button
                className="queue-icon-btn"
                onClick={() =>
                  openInFileManager(getQueueItemOutputFolder(item))
                }
                title={t("queue.itemActions.openLocation")}
              >
                {ICONS.open}
              </button>
              <button
                className="queue-icon-btn"
                onClick={() => removeItem(item.id)}
                title={t("queue.itemActions.remove")}
              >
                {ICONS.trash}
              </button>
            </>
          )}
        </div>

        {(item.status === "completed" || item.status === "failed") && (
          <div
            className={`queue-status-icon ${item.status === "completed" ? "success" : "failed"}`}
          >
            {item.status === "completed" ? ICONS.check : ICONS.cross}
          </div>
        )}
      </div>
    );
  },
);

interface QueuePanelProps {
  active?: boolean;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { items } = useQueue(active);
  const displayItems = items.slice().reverse();

  return (
    <div className="queue-panel-inner">
      <div className="queue-title">{t("queue.title")}</div>

      <div className="queue-actions">
        <button className="queue-action queue-action-start" onClick={startAll}>
          {t("queue.actions.startAll")}
        </button>
        <button className="queue-action queue-action-stop" onClick={stopAll}>
          {t("queue.actions.stopAll")}
        </button>
        <button className="queue-action" onClick={clearQueue}>
          {t("queue.actions.clearQueue")}
        </button>
      </div>

      <div className="queue-items" id="queue-items">
        {displayItems.length === 0 ? (
          <div className="queue-empty">{t("queue.empty")}</div>
        ) : (
          displayItems.map((item) =>
            item?.id ? <QueueItemRow key={item.id} item={item} t={t} /> : null,
          )
        )}
      </div>
    </div>
  );
};
export default QueuePanel;
