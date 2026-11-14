import React, { useEffect, useState } from "react";
import { ICON_ASSETS } from "../utils/icons";
import { useTranslation } from "../services/i18n";
import { appWindow, minimizeWindow, maximizeWindow, closeWindow } from "../services/tauri";

interface TitleBarProps {
  currentPage: string;
  queueVisible: boolean;
  isQueueBtnVisible: boolean;
  onNavigate: (pageName: string) => void;
  onToggleQueue: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentPage,
  queueVisible,
  isQueueBtnVisible,
  onNavigate,
  onToggleQueue,
}) => {
  const { t } = useTranslation();
  const [windowMaximized, setWindowMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const refreshMaximized = () => {
      void appWindow.isMaximized().then((value) => {
        if (active) setWindowMaximized(value);
      });
    };

    refreshMaximized();
    void appWindow.onResized(refreshMaximized).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return (
    <div id="titlebar" data-tauri-drag-region>
      <button
        className={`logo-btn ${currentPage === "home" ? "active" : ""}`}
        onClick={() => onNavigate("home")}
        aria-label="Home"
      >
        <img
          src={ICON_ASSETS["pulsar-logo"]}
          className="logo"
          alt="Pulsar Logo"
          draggable="false"
        />
      </button>

      <button
        className={`nav-btn ${currentPage === "downloader" ? "active" : ""}`}
        onClick={() => onNavigate("downloader")}
        id="nav-downloader"
        title={t("index.nav.download")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <use href={ICON_ASSETS["download-arrow"]} />
        </svg>
      </button>

      <button
        className={`nav-btn nav-gap ${currentPage === "converter" ? "active" : ""}`}
        onClick={() => onNavigate("converter")}
        id="nav-converter"
        title={t("index.nav.convert")}
      >
        <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
          <use href={ICON_ASSETS["convert"]} />
        </svg>
      </button>

      <button
        className={`nav-btn nav-gap ${currentPage === "compressor" ? "active" : ""}`}
        onClick={() => onNavigate("compressor")}
        id="nav-compressor"
        title={t("index.nav.compress")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <use href={ICON_ASSETS["compress"]} />
        </svg>
      </button>

      <div style={{ flexGrow: 1 }} data-tauri-drag-region />

      <button
        className={`nav-btn ${currentPage === "settings" ? "active" : ""}`}
        onClick={() => onNavigate("settings")}
        id="nav-settings"
        title={t("index.nav.settings")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <use href={ICON_ASSETS["gear"]} />
        </svg>
      </button>

      <button
        className={`nav-btn ${queueVisible ? "active" : ""}`}
        onClick={onToggleQueue}
        id="btn-queue"
        title={t("index.nav.queue")}
        style={{ display: isQueueBtnVisible ? "flex" : "none" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <use href={ICON_ASSETS["queue-navigation"]} />
        </svg>
      </button>

      <div className="window-controls">
        <button className="control-btn" onClick={minimizeWindow} aria-label="Minimize">
          <svg width="16" height="16" viewBox="0 0 24 24"><use href={ICON_ASSETS["window-minimize"]} /></svg>
        </button>
        <button className="control-btn" onClick={maximizeWindow} aria-label={windowMaximized ? "Restore" : "Maximize"}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <use href={windowMaximized ? ICON_ASSETS["copy"] : ICON_ASSETS["window-maximize"]} />
          </svg>
        </button>
        <button className="control-btn close" onClick={closeWindow} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24"><use href={ICON_ASSETS["window-close"]} /></svg>
        </button>
      </div>
    </div>
  );
};