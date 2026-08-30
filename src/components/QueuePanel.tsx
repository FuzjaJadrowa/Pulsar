import React, { useState, useEffect } from "react";
import { useQueue, QueueItem } from "../services/queue";
import { useTranslation } from "../services/i18n";
import { formatBytes, detectSourceFromUrl } from "../utils/format";
import { useConfig } from "../services/config";
import { openConsole } from "../services/console";

import { ICONS, SOURCE_ICONS } from "../utils/icons";

export const QueuePanel: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const {
    items,
    startItem,
    cancelItem,
    removeItem,
    clearQueue,
    startAll,
    stopAll,
    openInFileManager,
  } = useQueue();

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(3);

  // Re-calculate perPage on resize
  useEffect(() => {
    const handleResize = () => {
      const h = window.innerHeight || 800;
      const w = window.innerWidth || 1000;
      if (h < 760 || w < 900) setPerPage(2);
      else if (h < 900 || w < 1100) setPerPage(3);
      else setPerPage(4);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * perPage;
  const pageItems = items.slice(startIndex, startIndex + perPage);

  // Mode helpers
  const getModeInfo = (item: QueueItem) => {
    const itemType = item.itemType;
    const payloadCategory = String(
      item.payload?.category || ""
    ).toLowerCase();

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

    const source = detectSourceFromUrl(item.payload?.url);
    const sourceIcon = source ? (
      <span className={`queue-source-icon ${source}-icon`} aria-hidden="true">
        {SOURCE_ICONS[source as keyof typeof SOURCE_ICONS]}
      </span>
    ) : null;

    // Info details
    let text = "";
    if (itemType === "compress") {
      const outputFormat = String(
        item.payload?.output_format || "--"
      ).toUpperCase();
      const sourceSize = formatBytes(item.payload?.source_size_bytes);
      text = `${outputFormat} | ${sourceSize}`;
    } else if (itemType === "convert") {
      const outputFormat = String(
        item.payload?.output_format || "--"
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
      const subs =
        item.payload?.download_subs ||
        item.payload?.download_chat ||
        item.payload?.embed_subs
          ? t("queue.subtitles.on")
          : t("queue.subtitles.off");
      text = `${format} | ${quality} | SUB: ${subs}`;
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
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="queue-panel-inner">
      <div className="queue-title">{t("queue.title")}</div>

      <div className="queue-actions">
        <button
          className="queue-action queue-action-start"
          onClick={startAll}
        >
          {t("queue.actions.startAll")}
        </button>
        <button
          className="queue-action queue-action-stop"
          onClick={stopAll}
        >
          {t("queue.actions.stopAll")}
        </button>
        <button className="queue-action" onClick={clearQueue}>
          {t("queue.actions.clearQueue")}
        </button>
      </div>

      <div className="queue-items" id="queue-items">
        {pageItems.length === 0 ? (
          <div className="queue-empty">{t("queue.empty")}</div>
        ) : (
          pageItems.map((item) => {
            const { modeIcon, sourceIcon, infoMarkup } = getModeInfo(item);

            return (
              <div
                key={item.id}
                className={`queue-item status-${item.status}`}
                data-id={item.id}
              >
                <div
                  className="queue-item-bg"
                  style={{
                    backgroundImage: item.thumbnail
                      ? `url('${item.thumbnail}')`
                      : "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45))",
                  }}
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
                        onClick={() => startItem(item.id, "queue-manual")}
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
                      title={t("queue.itemActions.stop")}
                    >
                      {ICONS.stop}
                    </button>
                  )}
                  {item.status === "failed" && (
                    <>
                      <button
                        className="queue-icon-btn"
                        onClick={() => startItem(item.id, "queue-manual", true)}
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
                          openInFileManager(
                            item.path ||
                              item.payload?.path ||
                              item.payload?.output_dir ||
                              item.payload?.save_path ||
                              ""
                          )
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
                          openInFileManager(
                            item.path ||
                              item.payload?.path ||
                              item.payload?.output_dir ||
                              item.payload?.save_path ||
                              ""
                          )
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

                  {config.advanced_mode && (
                    <button
                      className="queue-icon-btn"
                      onClick={() => openConsole(item.id)}
                      title={t("queue.itemActions.console")}
                    >
                      {ICONS.console}
                    </button>
                  )}
                </div>

                {(item.status === "completed" || item.status === "failed") && (
                  <div
                    className={`queue-status-icon ${
                      item.status === "completed" ? "success" : "failed"
                    }`}
                  >
                    {item.status === "completed" ? ICONS.check : ICONS.cross}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div
        className={`queue-pagination ${items.length <= perPage ? "hidden" : ""}`}
      >
        <button
          className="queue-page-btn"
          onClick={handlePrevPage}
          disabled={activePage === 1}
          aria-label={t("queue.pagination.previous")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span id="queue-page-label">
          {t("common.pageLabel",  {
            current: activePage,
            total: totalPages,
          })}
        </span>
        <button
          className="queue-page-btn"
          onClick={handleNextPage}
          disabled={activePage === totalPages}
          aria-label={t("queue.pagination.next")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};
export default QueuePanel;