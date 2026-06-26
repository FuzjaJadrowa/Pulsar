import React from "react";
import { useNotifications, dismissNotification } from "../services/notifications";

export const NotificationContainer: React.FC = () => {
  const { toasts } = useNotifications();

  return (
    <div id="notification-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`notification-toast type-${toast.type} ${toast.isHiding ? "hiding" : ""}`}
        >
          <div className="notif-header">
            <span className="notif-title">{toast.title}</span>
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
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="notif-message">{toast.message}</div>
        </div>
      ))}
    </div>
  );
};