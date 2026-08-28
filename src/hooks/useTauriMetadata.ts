import { useState, useEffect, useRef } from "react";
import { invoke, listen } from "../services/tauri";

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
            if (onErrorRef.current) onErrorRef.current("Invalid file or link.");
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
    const clientTaskId = generateTaskId();
    currentTaskIdRef.current = clientTaskId;

    try {
      const args = pickerCommand === "fetch_metadata_downloader" 
        ? { url: targetPathOrUrl, clientTaskId }
        : { path: targetPathOrUrl, clientTaskId };
        
      const taskId = await invoke<string>(pickerCommand, args);
      if (taskId) {
        currentTaskIdRef.current = taskId;
      }
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