import React, { useEffect } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { loadConfig } from "./services/config";
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
        }}
      />
    </UiStateProvider>
  );
};

export default App;