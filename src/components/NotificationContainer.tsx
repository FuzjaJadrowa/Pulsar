import React, { useState } from "react";
import { useNotifications, dismissNotification, Toast } from "../services/notifications";

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
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
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
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
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
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const { toasts } = useNotifications();

  return (
    <div id="notification-container">
      {toasts.map((toast) => (
        <NotificationItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};