import { ICON_ASSETS } from "../utils/icons";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { appWindow, minimizeWindow, maximizeWindow, closeWindow } from "../services/tauri";
import { useQueue } from "../features/queue/queue";
import { DataSeaCanvas } from "./DataSeaCanvas";
import { NotificationContainer } from "../components/NotificationContainer";
import { QueuePanel } from "../components/QueuePanel";
import { Home } from "../features/home/Home";
import { Settings } from "../features/settings/Settings";
import { Downloader } from "../features/downloader/Downloader";
import { Converter } from "../features/conversion/Converter";
import { Compressor } from "../features/compression/Compressor";
import { useUiState } from "../services/uiState";
import { showNotification } from "../services/notifications";
import { listen } from "@tauri-apps/api/event";

const PAGE_INDICES: Record<string, number> = {
  home: 0,
  downloader: 1,
  converter: 2,
  compressor: 3,
  settings: 4,
};

export const AppShell: React.FC = () => {
  const { t } = useTranslation();
  const { items } = useQueue();
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [transition, setTransition] = useState<{
    outgoing: string | null;
    direction: "left" | "right" | null;
  }>({ outgoing: null, direction: null });
  const [queueVisible, setQueueVisible] = useState<boolean>(false);
  const [windowMaximized, setWindowMaximized] = useState(false);

  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const protocolMismatchShownRef = useRef(false);

  const { updateUiState } = useUiState();

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const refreshMaximized = () => {
      void appWindow.isMaximized().then((value) => { if (active) setWindowMaximized(value); });
    };
    refreshMaximized();
    void appWindow.onResized(refreshMaximized).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    return () => { active = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    updateUiState({ currentPage });
  }, [currentPage, updateUiState]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void listen<{ component: "pulsar" | "bridge" }>("bridge-protocol-mismatch", (event) => {
      if (protocolMismatchShownRef.current) return;
      protocolMismatchShownRef.current = true;
      const message = event.payload.component === "bridge"
        ? t("bridgeProtocol.updateBridge")
        : t("bridgeProtocol.updatePulsar");
      showNotification(t("common.info"), message, "info", true);
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!navigator.onLine) {
      showNotification(t("common.info"), t("connection.noInternet"), "info");
    }

    const handleOffline = () => {
      showNotification(t("common.info"), t("connection.lost"), "info");
    };

    const handleOnline = () => {
      showNotification(t("common.success"), t("connection.restored"), "success");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [t]);

  const navigateTo = (pageName: string) => {
    if (pageName === currentPage) return;
    const currentIdx = PAGE_INDICES[currentPage] ?? 0;
    const nextIdx = PAGE_INDICES[pageName] ?? 0;
    const dir = nextIdx > currentIdx ? "right" : "left";

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    setTransition({ outgoing: currentPage, direction: dir });
    setCurrentPage(pageName);

    transitionTimerRef.current = setTimeout(() => {
      setTransition({ outgoing: null, direction: null });
      transitionTimerRef.current = null;
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!queueVisible) return;
      const target = e.target as HTMLElement;
      
      const isInsideQueue = target.closest("#queue-panel");
      const isInsideQueueBtn = target.closest("#btn-queue");
      if (!isInsideQueue && !isInsideQueueBtn) {
        setQueueVisible(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [queueVisible]);

  useEffect(() => {
    if (items.length === 0 && queueVisible) {
      setQueueVisible(false);
    }
  }, [items.length, queueVisible]);

  const isQueueBtnVisible = items.length > 0;

  const ALL_PAGES = ["home", "downloader", "converter", "compressor", "settings"];

  const renderSinglePage = (pageName: string) => {
    const isActive = pageName === currentPage;
    switch (pageName) {
      case "home":
        return <Home onNavigate={navigateTo} />;
      case "downloader":
        return <Downloader active={isActive} />;
      case "converter":
        return <Converter active={isActive} />;
      case "compressor":
        return <Compressor active={isActive} />;
      case "settings":
        return <Settings />;
      default:
        return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="page-root">
      <div id="titlebar" data-tauri-drag-region>
        <button
          className={`logo-btn ${currentPage === "home" ? "active" : ""}`}
          onClick={() => navigateTo("home")}
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
          onClick={() => navigateTo("downloader")}
          id="nav-downloader"
          title={t("index.nav.download")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          ><use href={ICON_ASSETS["download-arrow"]} /></svg>
        </button>

        <button
          className={`nav-btn nav-gap ${currentPage === "converter" ? "active" : ""}`}
          onClick={() => navigateTo("converter")}
          id="nav-converter"
          title={t("index.nav.convert")}
        >
          <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["convert"]} /></svg>
        </button>

        <button
          className={`nav-btn nav-gap ${currentPage === "compressor" ? "active" : ""}`}
          onClick={() => navigateTo("compressor")}
          id="nav-compressor"
          title={t("index.nav.compress")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["compress"]} /></svg>
        </button>

        <div style={{ flexGrow: 1 }} data-tauri-drag-region />

        <button
          className={`nav-btn ${currentPage === "settings" ? "active" : ""}`}
          onClick={() => navigateTo("settings")}
          id="nav-settings"
          title={t("index.nav.settings")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          ><use href={ICON_ASSETS["gear"]} /></svg>
        </button>

        <button
          className={`nav-btn ${queueVisible ? "active" : ""}`}
          onClick={() => setQueueVisible((v) => !v)}
          id="btn-queue"
          title={t("index.nav.queue")}
          style={{ display: isQueueBtnVisible ? "flex" : "none" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          ><use href={ICON_ASSETS["queue-navigation"]} /></svg>
        </button>

        <div className="window-controls">
          <button className="control-btn" onClick={minimizeWindow} aria-label="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24"><use href={ICON_ASSETS["window-minimize"]} /></svg>
          </button>
          <button className="control-btn" onClick={maximizeWindow} aria-label={windowMaximized ? "Restore" : "Maximize"}>
            <svg width="16" height="16" viewBox="0 0 24 24"><use href={windowMaximized ? ICON_ASSETS["copy"] : ICON_ASSETS["window-maximize"]} /></svg>
          </button>
          <button className="control-btn close" onClick={closeWindow} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24"><use href={ICON_ASSETS["window-close"]} /></svg>
          </button>
        </div>
      </div>

      <div id="content-area">
        {ALL_PAGES.map((pageName) => {
          const isActive = pageName === currentPage;
          const isOutgoing = pageName === transition.outgoing;

          if (!isActive && !isOutgoing) {
            return (
              <div key={pageName} className="view-container" style={{ display: "none" }}>
                {renderSinglePage(pageName)}
              </div>
            );
          }

          let animClass = "";
          if (isActive && transition.direction) {
            animClass = transition.direction === "right" ? "slide-in-from-right" : "slide-in-from-left";
          } else if (isOutgoing && transition.direction) {
            animClass = transition.direction === "right" ? "slide-out-to-left" : "slide-out-to-right";
          }

          return (
            <div
              key={pageName}
              className={`view-container ${isActive ? "active-view" : ""} ${animClass}`}
            >
              {renderSinglePage(pageName)}
            </div>
          );
        })}
      </div>

      <DataSeaCanvas currentPage={currentPage} />

      <div
        id="queue-panel"
        className={queueVisible ? "visible" : ""}
      >
        <QueuePanel />
      </div>

      <NotificationContainer />
    </div>
  );
};
export default AppShell;