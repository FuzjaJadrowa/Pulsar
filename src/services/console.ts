import { useState, useEffect } from "react";
import { getCurrentConfig } from "./config";

type LogLine = string;

const logsMap = new Map<string, LogLine[]>();
const listeners = new Map<string, Set<() => void>>();
let openConsoleId: string | null = null;
let isConsoleEnabled = false;

const globalListeners = new Set<() => void>();

function getListenersFor(taskId: string): Set<() => void> {
  if (!listeners.has(taskId)) {
    listeners.set(taskId, new Set());
  }
  return listeners.get(taskId)!;
}

function notifyListeners(taskId: string) {
  getListenersFor(taskId).forEach((l) => l());
  globalListeners.forEach((l) => l());
}

export function logToConsole(taskId: string, payload: any) {
  if (!taskId) return;
  const key = String(taskId);
  const lines = logsMap.get(key) || [];
  const timestamp = new Date().toLocaleTimeString();
  let text = "";

  if (
    payload &&
    typeof payload === "object" &&
    payload.type === "bridge_command" &&
    typeof payload.direction === "string"
  ) {
    const raw = typeof payload.raw === "string" ? payload.raw : "";
    text = raw ? `[${payload.direction}]: ${raw}` : `[${payload.direction}]`;
  } else {
    try {
      text = JSON.stringify(payload);
    } catch (_) {
      text = String(payload);
    }
  }

  lines.push(`[${timestamp}] ${text}`);
  if (lines.length > 250) {
    lines.splice(0, lines.length - 250);
  }
  logsMap.set(key, lines);
  notifyListeners(key);
}

export function removeConsoleLogs(taskId: string) {
  logsMap.delete(taskId);
  notifyListeners(taskId);
}

export function retainConsoleLogs(taskIds: string[]) {
  const keep = new Set(taskIds.map((id) => String(id)));
  for (const key of logsMap.keys()) {
    if (!keep.has(key)) {
      logsMap.delete(key);
    }
  }
  if (openConsoleId && !keep.has(openConsoleId)) {
    closeConsole();
  }
}

export function clearAllConsoleLogs() {
  logsMap.clear();
  closeConsole();
}

export function openConsole(taskId: string) {
  const config = getCurrentConfig();
  if (!config.advanced_mode && !isConsoleEnabled) return;
  openConsoleId = String(taskId);
  globalListeners.forEach((l) => l());
}

export function closeConsole() {
  openConsoleId = null;
  globalListeners.forEach((l) => l());
}

export function getOpenConsoleId(): string | null {
  return openConsoleId;
}

export function setConsoleEnabled(enabled: boolean) {
  isConsoleEnabled = enabled;
  if (!enabled) closeConsole();
}

// React hooks
export function useConsoleLogs(taskId: string | null) {
  const [lines, setLines] = useState<LogLine[]>([]);

  useEffect(() => {
    if (!taskId) {
      setLines([]);
      return;
    }
    const update = () => {
      setLines([...(logsMap.get(taskId) || [])]);
    };
    update();
    const list = getListenersFor(taskId);
    list.add(update);
    return () => {
      list.delete(update);
    };
  }, [taskId]);

  return lines;
}

export function useConsoleModal() {
  const [openId, setOpenId] = useState<string | null>(openConsoleId);

  useEffect(() => {
    const handler = () => setOpenId(openConsoleId);
    globalListeners.add(handler);
    return () => {
      globalListeners.delete(handler);
    };
  }, []);

  return {
    openId,
    closeConsole,
    openConsole,
  };
}

const win = window as any;
win.queueConsole = {
  open: openConsole,
  close: closeConsole,
  log: logToConsole,
  remove: removeConsoleLogs,
  retain: retainConsoleLogs,
  clear: clearAllConsoleLogs,
  setEnabled: setConsoleEnabled,
};