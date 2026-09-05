import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from "react";
import { useConfig } from "./config";

export interface UiPageState {
  currentPage: string;
  downloaderDashboardVisible: boolean;
  downloaderSearchMode: boolean;
  downloaderMode: "video" | "audio";
  downloaderAudioOnlySource: boolean;
  converterDashboardVisible: boolean;
  compressorDashboardVisible: boolean;
  isPresetModalOpen: boolean;
}

const defaultUiState: UiPageState = {
  currentPage: "home",
  downloaderDashboardVisible: false,
  downloaderSearchMode: false,
  downloaderMode: "video",
  downloaderAudioOnlySource: false,
  converterDashboardVisible: false,
  compressorDashboardVisible: false,
  isPresetModalOpen: false,
};

interface UiStateContextType {
  uiState: UiPageState;
  setUiState: React.Dispatch<React.SetStateAction<UiPageState>>;
  updateUiState: (partial: Partial<UiPageState>) => void;
}

const UiStateContext = createContext<UiStateContextType>({
  uiState: defaultUiState,
  setUiState: () => {},
  updateUiState: () => {},
});

export const UiStateProvider = ({ children }: { children: ReactNode }) => {
  const [uiState, setUiState] = useState<UiPageState>(defaultUiState);
  const { config } = useConfig();

  const updateUiState = useCallback((partial: Partial<UiPageState>) => {
    setUiState((prev) => {
      let changed = false;
      for (const key of Object.keys(partial) as (keyof UiPageState)[]) {
        if (prev[key] !== partial[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      return { ...prev, ...partial };
    });
  }, []);

  useEffect(() => {
    const body = document.body;
    if (!body) return;

    const {
      currentPage,
      downloaderDashboardVisible,
      downloaderSearchMode,
      downloaderMode,
      downloaderAudioOnlySource,
      converterDashboardVisible,
      compressorDashboardVisible,
      isPresetModalOpen,
    } = uiState;

    const isWavePage = ["home", "downloader", "converter", "compressor"].includes(currentPage);

    body.classList.toggle("page-home", currentPage === "home");
    body.classList.toggle("page-downloader", currentPage === "downloader");
    body.classList.toggle("page-settings", currentPage === "settings");
    body.classList.toggle("page-converter", currentPage === "converter");
    body.classList.toggle("page-compressor", currentPage === "compressor");
    body.classList.toggle("wave-page", isWavePage);

    body.classList.toggle("converter-active", currentPage === "converter" && converterDashboardVisible);
    body.classList.toggle("compressor-active", currentPage === "compressor" && compressorDashboardVisible);

    if (currentPage === "downloader") {
      body.classList.toggle("search-mode", downloaderSearchMode);
      body.classList.toggle("audio-only-source", downloaderAudioOnlySource);
      body.classList.toggle("mode-video", downloaderDashboardVisible && downloaderMode === "video");
      body.classList.toggle("mode-audio", downloaderDashboardVisible && downloaderMode === "audio");
    } else {
      body.classList.remove("search-mode", "audio-only-source", "mode-video", "mode-audio");
    }

    body.classList.toggle("advanced-mode", !!config?.advanced_mode);
    body.classList.toggle("preset-modal-open", isPresetModalOpen);

    let isZen = false;
    if (currentPage === "home") {
      isZen = true;
    } else if (currentPage === "downloader") {
      isZen = !downloaderSearchMode && !downloaderDashboardVisible;
    } else if (currentPage === "converter") {
      isZen = !converterDashboardVisible;
    } else if (currentPage === "compressor") {
      isZen = !compressorDashboardVisible;
    }
    body.classList.toggle("zen-mode", isZen);
  }, [uiState, config?.advanced_mode]);

  return (
    <UiStateContext.Provider value={{ uiState, setUiState, updateUiState }}>
      {children}
    </UiStateContext.Provider>
  );
};

export const useUiState = () => useContext(UiStateContext);