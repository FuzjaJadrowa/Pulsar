import React, { useState, useEffect } from "react";
import { useTranslation } from "../services/i18n";
import { minimizeWindow, maximizeWindow, closeWindow } from "../services/tauri";
import { useQueue } from "../services/queue";
import { DataSeaCanvas } from "./DataSeaCanvas";
import { NotificationContainer } from "../components/NotificationContainer";
import { ConsoleModal } from "../components/ConsoleModal";
import { QueuePanel } from "../components/QueuePanel";
import { Home } from "../pages/Home";
import { Settings } from "../pages/Settings";
import { Downloader } from "../pages/Downloader";
import { Converter } from "../pages/Converter";
import { Compressor } from "../pages/Compressor";

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

  useEffect(() => {
    const body = document.body;
    if (!body) return;

    const isWavePage = ["home", "downloader", "converter", "compressor"].includes(currentPage);

    body.classList.toggle("page-home", currentPage === "home");
    body.classList.toggle("page-downloader", currentPage === "downloader");
    body.classList.toggle("page-settings", currentPage === "settings");
    body.classList.toggle("page-converter", currentPage === "converter");
    body.classList.toggle("page-compressor", currentPage === "compressor");
    body.classList.toggle("wave-page", isWavePage);

    if (currentPage === "home") {
      body.classList.add("zen-mode");
      body.classList.remove("search-mode");
    } else if (currentPage === "converter") {
      const keepZen = !body.classList.contains("converter-active");
      body.classList.toggle("zen-mode", keepZen);
      body.classList.remove("search-mode");
    } else if (currentPage === "compressor") {
      body.classList.add("zen-mode");
      body.classList.remove("search-mode");
    }
  }, [currentPage]);

  const navigateTo = (pageName: string) => {
    if (pageName === currentPage) return;
    const currentIdx = PAGE_INDICES[currentPage] ?? 0;
    const nextIdx = PAGE_INDICES[pageName] ?? 0;
    const dir = nextIdx > currentIdx ? "right" : "left";

    setTransition({ outgoing: currentPage, direction: dir });
    setCurrentPage(pageName);

    setTimeout(() => {
      setTransition({ outgoing: null, direction: null });
    }, 300);
  };

  useEffect(() => {
    const win = window as any;

    win.loadPage = (pageName: string, _index: number) => {
      navigateTo(pageName);
    };

    win.toggleQueue = () => {
      setQueueVisible((prev) => !prev);
    };

    win.setQueuePanelVisible = (visible: boolean) => {
      setQueueVisible(visible);
    };

    return () => {
      delete win.loadPage;
      delete win.toggleQueue;
      delete win.setQueuePanelVisible;
    };
  }, [currentPage]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!queueVisible) return;
      const target = e.target as HTMLElement;
      
      const isInsideQueue = target.closest("#queue-panel");
      const isInsideQueueBtn = target.closest("#btn-queue");
      const isInsideConsole = target.closest(".queue-console-overlay");

      if (!isInsideQueue && !isInsideQueueBtn && !isInsideConsole) {
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

  const renderPageContent = (pageName: string) => {
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
            src="./assets/icons/logo.svg"
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
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>

        <button
          className={`nav-btn nav-gap ${currentPage === "converter" ? "active" : ""}`}
          onClick={() => navigateTo("converter")}
          id="nav-converter"
          title={t("index.nav.convert")}
        >
          <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path
              d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494"
              transform="translate(1.407 1.407)scale(2.81)"
            />
          </svg>
        </button>

        <button
          className={`nav-btn nav-gap ${currentPage === "compressor" ? "active" : ""}`}
          onClick={() => navigateTo("compressor")}
          id="nav-compressor"
          title={t("index.nav.compress")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z" />
          </svg>
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
          >
            <circle cx="12" cy="12" r="3" fill="none"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9.93 3.1V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
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
          >
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <circle cx="4" cy="6" r="1"></circle>
            <circle cx="4" cy="12" r="1"></circle>
            <circle cx="4" cy="18" r="1"></circle>
          </svg>
        </button>

        <div className="window-controls">
          <button className="control-btn" onClick={minimizeWindow} aria-label="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="control-btn" onClick={maximizeWindow} aria-label="Maximize">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
          <button className="control-btn close" onClick={closeWindow} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div id="content-area">
        {transition.outgoing && transition.direction && (
          <div className={`view-container ${transition.direction === "right" ? "slide-out-to-left" : "slide-out-to-right"}`}>
            {renderPageContent(transition.outgoing)}
          </div>
        )}
        <div className={`view-container active-view ${transition.direction ? (transition.direction === "right" ? "slide-in-from-right" : "slide-in-from-left") : ""}`}>
          {renderPageContent(currentPage)}
        </div>
      </div>

      <DataSeaCanvas currentPage={currentPage} />

      <div
        id="queue-panel"
        className={queueVisible ? "visible" : ""}
      >
        <QueuePanel />
      </div>

      <NotificationContainer />
      <ConsoleModal />
    </div>
  );
};
export default AppShell;