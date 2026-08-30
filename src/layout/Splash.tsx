import React, { useState, useEffect } from "react";
import { invoke, listen } from "../services/tauri";
import { useTranslation } from "../services/i18n";
import { triggerIdleWavesEnter } from "../services/config";

interface SplashProps {
  onFinished?: (prewarmBridge: boolean) => void;
}

export const Splash: React.FC<SplashProps> = ({ onFinished }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>("Starting...");
  const [progress, setProgress] = useState<string>("");
  const [canSkip, setCanSkip] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isHidden, setIsHidden] = useState<boolean>(false);

  const translateSplashStatus = (val: any): string => {
    if (val === null || typeof val === "undefined") return "";
    const raw = String(val);
    const trimmed = raw.trim();
    if (trimmed === "") return raw;

    if (trimmed === "Starting...") return t("index.splash.starting");
    if (trimmed === "Checking...") return t("index.splash.checking");
    if (trimmed === "Checking for updates...") return t("index.splash.checkingForUpdates");
    if (trimmed === "Extracting...") return t("index.splash.extracting");
    if (trimmed === "Update installed. Restarting...") return t("index.splash.updateInstalledRestarting");
    if (trimmed === "Update available (auto-update disabled)") return t("index.splash.updateAvailableAutoDisabled");

    const updateCheckFailedPrefix = "Update check failed: ";
    if (trimmed.startsWith(updateCheckFailedPrefix)) {
      const error = trimmed.slice(updateCheckFailedPrefix.length);
      return t("index.splash.updateCheckFailed",  { error });
    }

    const errorPrefix = "Error: ";
    if (trimmed.startsWith(errorPrefix)) {
      const error = trimmed.slice(errorPrefix.length);
      return t("index.splash.errorPrefix",  { error });
    }

    const checkingPrefix = "Checking ";
    if (trimmed.startsWith(checkingPrefix) && trimmed.endsWith("...")) {
      const component = trimmed.slice(checkingPrefix.length, -3);
      return t("index.splash.checkingComponent",  { component });
    }

    const downloadingPrefix = "Downloading ";
    if (trimmed.startsWith(downloadingPrefix) && trimmed.endsWith("...")) {
      const component = trimmed.slice(downloadingPrefix.length, -3);
      return t("index.splash.downloadingComponent",  { component });
    }

    const updatingToPrefix = "Updating to ";
    if (trimmed.startsWith(updatingToPrefix)) {
      const version = trimmed.slice(updatingToPrefix.length);
      return t("index.splash.updatingTo",  { version });
    }

    return raw;
  };

  const handleSkip = () => {
    invoke("cancel_splash_checks").catch((err) => {
      console.error("Failed to cancel splash checks:", err);
    });
    finish(false);
  };

  const finish = (prewarm: boolean) => {
    setIsExiting(true);
    triggerIdleWavesEnter();
    setTimeout(() => {
      setIsHidden(true);
      if (onFinished) onFinished(prewarm);
    }, 520);
  };

  useEffect(() => {
    let unlistStatus: any = null;
    let unlistProgress: any = null;
    let unlistFinished: any = null;

    const setupListeners = async () => {
      unlistStatus = await listen<{ status: string; can_skip: boolean; is_downloading: boolean }>(
        "splash-status",
        (event) => {
          setIsHidden(false);
          setIsExiting(false);
          setStatus(translateSplashStatus(event.payload.status));
          setCanSkip(event.payload.can_skip);
          if (!event.payload.is_downloading) {
            setProgress("");
          }
        }
      );

      unlistProgress = await listen<{ progress: string }>("splash-progress", (event) => {
        setIsHidden(false);
        setIsExiting(false);
        setProgress(translateSplashStatus(event.payload.progress));
      });

      unlistFinished = await listen<{ prewarm_bridge?: boolean }>("splash-finished", (event) => {
        finish(!!event.payload?.prewarm_bridge);
      });

      invoke("run_splash_checks").catch((err) => {
        console.error("Failed to invoke splash checks:", err);
        finish(false);
      });
    };

    setupListeners();

    return () => {
      if (unlistStatus) unlistStatus();
      if (unlistProgress) unlistProgress();
      if (unlistFinished) unlistFinished();
    };
  }, []);

  if (isHidden) return null;

  return (
    <div id="splash-screen" className={isExiting ? "exiting" : ""}>
      <div className="splash-content">
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>

        <h2 id="splash-status">{status}</h2>
        {progress && <p id="splash-progress">{progress}</p>}

        {canSkip && (
          <button id="splash-skip-btn" className="skip-btn" onClick={handleSkip}>
            {t("index.splash.skipUpdate")}
          </button>
        )}
      </div>
    </div>
  );
};