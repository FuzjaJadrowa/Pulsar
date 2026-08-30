import React, { useEffect } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { loadConfig } from "./services/config";
import "./styles/index.css";

import { UiStateProvider } from "./services/uiState";

export const App: React.FC = () => {
  useEffect(() => {
    loadConfig();

    const handleContextMenu = (e: MouseEvent) => {
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
      <Splash />
    </UiStateProvider>
  );
};

export default App;