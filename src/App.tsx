import React, { useState } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { loadConfig } from "./services/config";
import "./styles/index.css";

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinished = async (_prewarmBridge: boolean) => {
    await loadConfig();
    setShowSplash(false);
  };

  return (
    <>
      <AppShell />
      {showSplash && <Splash onFinished={handleSplashFinished} />}
    </>
  );
};

export default App;