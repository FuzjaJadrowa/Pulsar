import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const appWindow = getCurrentWindow();

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    console.error(`Tauri Invoke Error [cmd=${cmd}]:`, error);
    throw error;
  }
}

export async function listen<T>(event: string, callback: EventCallback<T>): Promise<UnlistenFn> {
  return tauriListen<T>(event, callback);
}

export function minimizeWindow(): Promise<void> {
  return appWindow.minimize();
}

export function maximizeWindow(): Promise<void> {
  return appWindow.toggleMaximize();
}

export function closeWindow(): Promise<void> {
  return appWindow.close();
}