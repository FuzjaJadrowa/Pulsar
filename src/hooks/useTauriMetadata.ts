import { useState, useEffect, useRef } from "react";
import { invoke, listen } from "../services/tauri";
import { t } from "../services/i18n";

interface UseTauriMetadataOptions {
  pickerCommand: "fetch_metadata_downloader" | "fetch_metadata_converter";
  onSuccess?: (data: any) => void;
  onError?: (err: string) => void;
}

export function useTauriMetadata({ pickerCommand, onSuccess, onError }: UseTauriMetadataOptions) {
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    const unsubPromise = listen<any>("download-event", (event) => {
      if (!active) return;
      const payload = event.payload;
      if (!payload || !payload.type) return;

      if (payload.id === currentTaskIdRef.current) {
        if (payload.type === "finished" && payload.success === false) {
          setIsLoading(false);
          currentTaskIdRef.current = null;
          if (onErrorRef.current) onErrorRef.current(payload.error || "Metadata fetch failed.");
        } else if (payload.type === "metadata") {
          setIsLoading(false);
          currentTaskIdRef.current = null;
          if (payload.success && payload.data) {
            setMetadata(payload.data);
            if (onSuccessRef.current) onSuccessRef.current(payload.data);
          } else {
            if (onErrorRef.current) onErrorRef.current(t("common.errors.invalidFileOrLink"));
          }
        }
      }
    });

    return () => {
      active = false;
      unsubPromise.then((unsub) => unsub());
    };
  }, []);

  const fetchMetadata = async (targetPathOrUrl: string) => {
    if (isLoading) return;
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
      setIsLoading(false);
      currentTaskIdRef.current = null;
      if (onErrorRef.current) onErrorRef.current(String(error));
    }
  };

  const reset = () => {
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

export function fetchSingleFileMetadata(filePath: string): Promise<any> {
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

    listen<any>("download-event", (event) => {
      const payload = event.payload;
      if (!payload || payload.id !== taskId) return;

      if (payload.type === "finished" && payload.success === false) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
      } else if (payload.type === "metadata") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          if (payload.success && payload.data) {
            resolve(payload.data);
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