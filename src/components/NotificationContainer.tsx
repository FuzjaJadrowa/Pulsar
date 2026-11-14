import { ICON_ASSETS } from "../utils/icons";
import React, { useState } from "react";
import { useNotifications, dismissNotification, Toast } from "../services/notifications";
import styles from "./NotificationContainer.module.css";

const NotificationItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = toast.message;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`notification-toast type-${toast.type} ${toast.isHiding ? "hiding" : ""}`}
    >
      <div className="notif-content">
        <div className="notif-header">
          <span className="notif-title">{toast.title}</span>
        </div>
        <div className="notif-message">{toast.message}</div>
      </div>
      <div className="notif-actions">
        <button
          className="notif-close"
          onClick={() => dismissNotification(toast.id)}
          aria-label="Close notification"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          ><use href={ICON_ASSETS["window-close"]} /></svg>
        </button>
        <button
          className="notif-copy"
          onClick={handleCopy}
          aria-label="Copy notification text"
          title={copied ? "Copied!" : "Copy"}
        >
          {copied ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            ><use href={ICON_ASSETS["check"]} /></svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            ><use href={ICON_ASSETS["copy"]} /></svg>
          )}
        </button>
      </div>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const { toasts } = useNotifications();

  return (
    <div id="notification-container" className={styles.scope}>
      {toasts.map((toast) => (
        <NotificationItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};