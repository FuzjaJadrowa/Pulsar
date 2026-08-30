import { useState, useEffect } from "react";

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "error";
  isPermanent: boolean;
  isHiding?: boolean;
}

type ToastListener = (toasts: Toast[]) => void;

let toastsList: Toast[] = [];
const listeners = new Set<ToastListener>();

function notifyListeners() {
  listeners.forEach((l) => l([...toastsList]));
}

export function showNotification(
  title: string,
  message: string,
  type: "info" | "success" | "error" = "info",
  isPermanent = false
) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: Toast = { id, title, message, type, isPermanent };
  toastsList = [...toastsList, toast];
  notifyListeners();

  if (!isPermanent) {
    setTimeout(() => {
      dismissNotification(id);
    }, 4000);
  }
  return id;
}

export function dismissNotification(id: string) {
  toastsList = toastsList.map((t) => (t.id === id ? { ...t, isHiding: true } : t));
  notifyListeners();

  // Wait for exit animation to complete before removing from list
  setTimeout(() => {
    toastsList = toastsList.filter((t) => t.id !== id);
    notifyListeners();
  }, 350);
}

export function useNotifications() {
  const [toasts, setToasts] = useState<Toast[]>(toastsList);

  useEffect(() => {
    const handler = (updatedToasts: Toast[]) => setToasts(updatedToasts);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return { toasts, dismissNotification };
}
