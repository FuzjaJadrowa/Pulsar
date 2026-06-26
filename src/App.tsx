import React, { useState } from "react";
import { AppShell } from "./layout/AppShell";
import { Splash } from "./layout/Splash";
import { loadConfig } from "./services/config";
import "./styles/index.css";

export const App: React.FC = () => {
  const [isBooted, setIsBooted] = useState(false);

  const handleSplashFinished = async (_prewarmBridge: boolean) => {
    await loadConfig();
    setIsBooted(true);
  };

  return (
    <>
      {isBooted ? <AppShell /> : <Splash onFinished={handleSplashFinished} />}
    </>
  );
};

export default App;