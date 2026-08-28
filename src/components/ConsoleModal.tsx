import React, { useEffect, useRef, useState } from "react";
import { useConsoleLogs, useConsoleModal } from "../services/console";
import { useTranslation } from "../services/i18n";

export const ConsoleModal: React.FC = () => {
  const { t } = useTranslation();
  const { openId, closeConsole } = useConsoleModal();
  const lines = useConsoleLogs(openId);
  const bodyRef = useRef<HTMLPreElement | null>(null);

  const [activeId, setActiveId] = useState<string | null>(openId);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (openId) {
      setActiveId(openId);
      setIsClosing(false);
    } else if (activeId) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setActiveId(null);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [openId, activeId]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, activeId]);

  if (!activeId) return null;

  return (
    <div
      className={`queue-console-overlay ${isClosing ? "closing" : "open"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeConsole();
      }}
    >
      <div className="queue-console-modal">
        <div className="queue-console-header">
          <div className="queue-console-title">
            {t("queue.console.title",  { id: activeId })}
          </div>
          <button
            className="queue-console-close"
            onClick={closeConsole}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <pre ref={bodyRef} className="queue-console-body">
          {lines.length > 0
            ? lines.join("\n")
            : t("queue.console.empty")}
        </pre>
      </div>
    </div>
  );
};