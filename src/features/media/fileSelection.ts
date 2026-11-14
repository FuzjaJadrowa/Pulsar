import type { Dispatch, RefObject, SetStateAction } from "react";
import { fetchSingleFileMetadata } from "../../hooks/useTauriMetadata";
import { invoke } from "../../services/tauri";
import { showNotification } from "../../services/notifications";
import type { MediaFileMetadata } from "../../types/media";

interface FileSelectionOptions {
  filePath: string;
  loadedFiles: MediaFileMetadata[];
  inputRef: RefObject<HTMLInputElement | null>;
  pageName: string;
  errorTitle: string;
  infoTitle: string;
  invalidFilesMessage: string;
  mixedCategoryMessage: string;
  setFilePath: (path: string) => void;
  setLoadedFiles: Dispatch<SetStateAction<MediaFileMetadata[]>>;
  setMetadata: Dispatch<SetStateAction<MediaFileMetadata | null>>;
  fetchMetadata: (path: string) => void;
  onMetadataLoaded: (metadata: MediaFileMetadata) => void;
  resetView: () => void;
  isSupportedMetadata?: (metadata: MediaFileMetadata) => boolean;
}

export const createFileSelectionHandlers = ({
  filePath,
  loadedFiles,
  inputRef,
  pageName,
  errorTitle,
  infoTitle,
  invalidFilesMessage,
  mixedCategoryMessage,
  setFilePath,
  setLoadedFiles,
  setMetadata,
  fetchMetadata,
  onMetadataLoaded,
  resetView,
  isSupportedMetadata = () => true,
}: FileSelectionOptions) => {
  const triggerShakeInput = () => {
    if (!inputRef.current) return;
    inputRef.current.classList.remove("shake-feedback");
    void inputRef.current.offsetWidth;
    inputRef.current.classList.add("shake-feedback");
  };

  const handleFilesSelected = async (inputPaths: string | string[]) => {
    const rawPaths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
    const cleanPaths = rawPaths.map((path) => String(path || "").trim()).filter(Boolean);
    if (cleanPaths.length === 0) return;

    if (cleanPaths.length === 1) {
      setLoadedFiles([]);
      setFilePath(cleanPaths[0]);
      fetchMetadata(cleanPaths[0]);
      return;
    }

    try {
      const results = await Promise.all(cleanPaths.map(fetchSingleFileMetadata));
      const validFiles = results.filter((metadata): metadata is MediaFileMetadata =>
        Boolean(metadata?.path && metadata.category && isSupportedMetadata(metadata))
      );

      if (validFiles.length === 0) {
        showNotification(errorTitle, invalidFilesMessage, "error");
        return;
      }

      const categories = new Set(validFiles.map((metadata) => String(metadata.category || "").toLowerCase()));
      if (categories.size > 1) {
        showNotification(infoTitle, mixedCategoryMessage, "info");
        return;
      }

      setLoadedFiles(validFiles);
      setFilePath(validFiles.map((metadata) => metadata.path).join("; "));
      onMetadataLoaded(validFiles[0]);
    } catch (error) {
      console.error(`Bulk ${pageName} metadata failed:`, error);
      showNotification(errorTitle, String(error), "error");
    }
  };

  const handleConfirmPath = () => {
    const raw = filePath.trim();
    if (!raw) {
      triggerShakeInput();
      return;
    }
    handleFilesSelected(raw.split(";").map((path) => path.trim()).filter(Boolean));
  };

  const openPicker = async () => {
    try {
      const selected = await invoke<string[]>("pick_convert_files");
      if (!selected?.length) return;

      const cleanPaths = selected.map((path) => String(path || "").trim()).filter(Boolean);
      if (cleanPaths.length === 0) return;

      resetView();
      setFilePath(cleanPaths.join("; "));
      inputRef.current?.focus();
    } catch (error) {
      console.error(`Pick ${pageName} files failed:`, error);
    }
  };

  const removeFileFromBatch = (indexToRemove: number) => {
    const updated = loadedFiles.filter((_, index) => index !== indexToRemove);
    if (updated.length === 0) {
      resetView();
    } else if (updated.length === 1) {
      setLoadedFiles([]);
      onMetadataLoaded(updated[0]);
      setFilePath(updated[0].path);
    } else {
      setLoadedFiles(updated);
      setMetadata(updated[0]);
      setFilePath(updated.map((metadata) => metadata.path).join("; "));
    }
  };

  return { handleFilesSelected, handleConfirmPath, openPicker, removeFileFromBatch };
};