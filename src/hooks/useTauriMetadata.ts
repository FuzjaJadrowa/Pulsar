import { useState, useEffect, useRef } from "react";
import { invoke, listen } from "../services/tauri";
import { t } from "../services/i18n";
import { resolveMetadataEvent, type MetadataBridgeEvent } from "./metadataEvents";
import { isMediaFileMetadata, type MediaFileMetadata } from "../types/media";

interface UseTauriMetadataOptions<T> {
  pickerCommand: "fetch_metadata_downloader" | "fetch_metadata_converter";
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
}

export function useTauriMetadata<T = Record<string, unknown>>({ pickerCommand, onSuccess, onError }: UseTauriMetadataOptions<T>) {
  const [metadata, setMetadata] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const generateTaskId = () => {
    return `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  };

  useEffect(() => {
    let active = true;
    const finishRequest = () => {
      isLoadingRef.current = false;
      setIsLoading(false);
      currentTaskIdRef.current = null;
    };

    const unsubPromise = listen<MetadataBridgeEvent>("download-event", (event) => {
      if (!active) return;
      const payload = event.payload;
      if (!payload || !payload.type) return;

      const outcome = resolveMetadataEvent(payload, currentTaskIdRef.current);
      if (outcome.kind === "error") {
        finishRequest();
        const message = outcome.message || t("common.errors.invalidFileOrLink");
        onErrorRef.current?.(message);
      } else if (outcome.kind === "success") {
        finishRequest();
        setMetadata(outcome.data as T);
        onSuccessRef.current?.(outcome.data as T);
      }
    });

    unsubPromise.catch((error) => {
      if (!active) return;
      finishRequest();
      onErrorRef.current?.(`Unable to listen for metadata events: ${String(error)}`);
    });

    return () => {
      active = false;
      unsubPromise.then((unsub) => unsub());
    };
  }, []);

  const fetchMetadata = async (targetPathOrUrl: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setMetadata(null);
    const taskId = generateTaskId();
    currentTaskIdRef.current = taskId;

    try {
      const args = pickerCommand === "fetch_metadata_downloader" 
        ? { url: targetPathOrUrl, clientTaskId: taskId }
        : { path: targetPathOrUrl, clientTaskId: taskId };
        
      await invoke<string>(pickerCommand, args);
    } catch (error) {
      if (currentTaskIdRef.current !== taskId) return;
      isLoadingRef.current = false;
      setIsLoading(false);
      currentTaskIdRef.current = null;
      if (onErrorRef.current) onErrorRef.current(String(error));
    }
  };

  const reset = () => {
    isLoadingRef.current = false;
    setMetadata(null);
    setIsLoading(false);
    currentTaskIdRef.current = null;
  };

  return {
    metadata,
    isLoading,
    fetchMetadata,
    reset,
    setMetadata
  };
}

export function fetchSingleFileMetadata(filePath: string): Promise<MediaFileMetadata | null> {
  return new Promise((resolve) => {
    const taskId = `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    let unsub: (() => void) | null = null;
    let resolved = false;

    const cleanup = () => {
      if (unsub) {
        unsub();
        unsub = null;
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 15000);

    listen<MetadataBridgeEvent>("download-event", (event) => {
      const payload = event.payload;
      if (!payload) return;
      const outcome = resolveMetadataEvent(payload, taskId);

      if (outcome.kind === "error") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
      } else if (outcome.kind === "success") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          if (isMediaFileMetadata(outcome.data)) {
            resolve(outcome.data);
          } else {
            resolve(null);
          }
        }
      }
    }).then((u) => {
      unsub = u;
      if (resolved) {
        cleanup();
        return;
      }
      invoke<string>("fetch_metadata_converter", { path: filePath, clientTaskId: taskId }).catch((err) => {
        console.error("fetch_metadata_converter error:", err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
      });
    }).catch((err) => {
      console.error("listen error:", err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}