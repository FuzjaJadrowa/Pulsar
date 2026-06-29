import React, { useEffect } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { loadConfig } from "./services/config";
import "./styles/index.css";

export const App: React.FC = () => {
  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <>
      <AppShell />
      <Splash />
    </>
  );
};

export default App;