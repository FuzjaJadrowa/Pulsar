import { useState, useEffect } from "react";
import { listen } from "../services/tauri";
import type { Event } from "@tauri-apps/api/event";

interface DragDropPayload {
  paths?: string[] | string;
}

interface UseFileDragDropOptions {
  pageClass: string; // "page-converter" | "page-compressor" etc.
  onFileDrop: (paths: string | string[]) => void;
}

export function useFileDragDrop({ pageClass, onFileDrop }: UseFileDragDropOptions) {
  const [showDropOverlay, setShowDropOverlay] = useState(false);

  useEffect(() => {
    let active = true;

    const handleEnter = () => {
      if (!active) return;
      if (document.body?.classList.contains(pageClass)) {
        setShowDropOverlay(true);
      }
    };

    const handleLeave = () => {
      if (!active) return;
      setShowDropOverlay(false);
    };

    const handleDrop = (event: Event<DragDropPayload>) => {
      if (!active) return;
      setShowDropOverlay(false);
      if (!document.body?.classList.contains(pageClass)) return;

      const paths = event.payload?.paths || event.payload;
      if (Array.isArray(paths) && paths.length > 0) {
        onFileDrop(paths.length === 1 ? paths[0] : paths);
      } else if (typeof paths === "string" && paths.trim()) {
        onFileDrop(paths.trim());
      }
    };

    const unsubPromises = [
      listen("tauri://drag-enter", handleEnter),
      listen("tauri://drag-leave", handleLeave),
      listen("tauri://drag-drop", handleDrop),
      listen("tauri://file-drop-hover", handleEnter),
      listen("tauri://file-drop-cancelled", handleLeave),
      listen("tauri://file-drop", handleDrop),
    ];

    return () => {
      active = false;
      unsubPromises.forEach((promise) => {
        promise.then((unsub) => unsub());
      });
    };
  }, [pageClass, onFileDrop]);

  return {
    showDropOverlay,
    setShowDropOverlay
  };
}