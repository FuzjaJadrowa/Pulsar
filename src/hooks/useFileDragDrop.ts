import { useState, useEffect } from "react";
import { listen } from "../services/tauri";

interface UseFileDragDropOptions {
  pageClass: string; // "page-converter" | "page-compressor" etc.
  onFileDrop: (path: string) => void;
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

    const handleDrop = (event: any) => {
      if (!active) return;
      setShowDropOverlay(false);
      if (!document.body?.classList.contains(pageClass)) return;

      const paths = event.payload?.paths || event.payload;
      const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === "string" ? paths : null);
      if (rawPath) {
        onFileDrop(rawPath);
      }
    };

    const unsubPromises = [
      listen<any>("tauri://drag-enter", handleEnter),
      listen<any>("tauri://drag-leave", handleLeave),
      listen<any>("tauri://drag-drop", handleDrop),
      listen<any>("tauri://file-drop-hover", handleEnter),
      listen<any>("tauri://file-drop-cancelled", handleLeave),
      listen<any>("tauri://file-drop", handleDrop),
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