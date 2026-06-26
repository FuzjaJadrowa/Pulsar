import React, { useEffect, useRef } from "react";
import { useConsoleLogs, useConsoleModal } from "../services/console";
import { useTranslation } from "../services/i18n";

export const ConsoleModal: React.FC = () => {
  const { t } = useTranslation();
  const { openId, closeConsole } = useConsoleModal();
  const lines = useConsoleLogs(openId);
  const bodyRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, openId]);

  if (!openId) return null;

  return (
    <div
      className="queue-console-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeConsole();
      }}
    >
      <div className="queue-console-modal">
        <div className="queue-console-header">
          <div className="queue-console-title">
            {t("queue.console.title", `Console - ${openId}`, { id: openId })}
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
            : t("queue.console.empty", "No console output yet.")}
        </pre>
      </div>
    </div>
  );
};