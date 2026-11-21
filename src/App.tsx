import React, { useEffect } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { getCurrentConfig, loadConfig } from "./services/config";
import "./styles/index.css";

import { UiStateProvider } from "./services/uiState";

import { invoke } from "./services/tauri";

export const App: React.FC = () => {
  useEffect(() => {
    loadConfig();

    const handleContextMenu = (e: MouseEvent) => {
      if (import.meta.env.DEV) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return (
    <UiStateProvider>
      <AppShell />
      <Splash
        onFinished={(prewarm) => {
          if (prewarm) {
            invoke("init_bridge").catch((err) => {
              console.error("Failed to prewarm pulsar bridge:", err);
            });
          }
          const hwaccel = getCurrentConfig().ffmpeg_hwaccel;
          if (hwaccel && hwaccel !== "none" && hwaccel !== "false") {
            invoke("refresh_acceleration_info")
              .then(() => loadConfig())
              .catch((err) => {
                console.error(
                  "Failed to refresh hardware acceleration info:",
                  err,
                );
              });
          }
        }}
      />
    </UiStateProvider>
  );
};

export default App;
