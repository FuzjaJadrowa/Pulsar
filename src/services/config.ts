import { useState, useEffect } from "react";
import { invoke } from "./tauri";
import { initI18n } from "./i18n";

export interface PulsarConfig {
  theme: string;
  language: string;
  system_notifications: boolean;
  advanced_mode: boolean;
  idle_animation: boolean;
  update_app: boolean;
  update_app_cooldown_minutes: number;
  update_ytdlp: boolean;
  update_ffmpeg: boolean;
  ffmpeg_hwaccel: string;
  cookies_browser: string;
  maximum_concurrent_processes: number;
  maximum_search_results: number;
  title_template: string;
  close_behavior: string;
}

export const DEFAULT_CONFIG: PulsarConfig = {
  theme: "System",
  language: "en",
  system_notifications: true,
  advanced_mode: false,
  idle_animation: true,
  update_app: true,
  update_app_cooldown_minutes: 30,
  update_ytdlp: true,
  update_ffmpeg: true,
  ffmpeg_hwaccel: "none",
  cookies_browser: "none",
  maximum_concurrent_processes: 3,
  maximum_search_results: 10,
  title_template: "%(title)s [%(id)s]",
  close_behavior: "hide",
};

let globalConfig: PulsarConfig = { ...DEFAULT_CONFIG };
const listeners = new Set<(cfg: PulsarConfig) => void>();

function notifyListeners() {
  listeners.forEach((l) => l(globalConfig));
}

const themeMedia = window.matchMedia("(prefers-color-scheme: light)");

export function resolveTheme(themeSetting: string): "light" | "dark" {
  const normalized = String(themeSetting || "System").toLowerCase();
  if (normalized === "light") return "light";
  if (normalized === "dark") return "dark";
  if (normalized === "system") {
    return themeMedia.matches ? "light" : "dark";
  }
  return "dark";
}

export function applyTheme(themeSetting: string, animate = true) {
  const resolved = resolveTheme(themeSetting);
  const body = document.body;
  if (!body) return;

  if (animate) {
    body.classList.add("theme-transition");
    setTimeout(() => {
      body.classList.remove("theme-transition");
    }, 420);
    // Let React cleanup handle timers if needed, or inline is fine
  } else {
    body.classList.remove("theme-transition");
  }

  body.classList.toggle("theme-light", resolved === "light");
  body.classList.toggle("theme-dark", resolved === "dark");
  body.dataset.theme = resolved;
}

export function setIdleAnimationClass(enabled: boolean) {
  const body = document.body;
  if (!body) return;
  body.classList.toggle("idle-anim-enabled", enabled);
}

let idleWavesEnterTimer: any = null;
export function triggerIdleWavesEnter() {
  const body = document.body;
  if (!body) return;
  if (!body.classList.contains("zen-mode")) return;
  if (!body.classList.contains("idle-anim-enabled")) return;
  if (body.classList.contains("search-mode")) return;

  if (idleWavesEnterTimer) clearTimeout(idleWavesEnterTimer);
  body.classList.remove("idle-waves-enter");
  void body.offsetWidth;
  body.classList.add("idle-waves-enter");
  idleWavesEnterTimer = setTimeout(() => {
    document.body?.classList.remove("idle-waves-enter");
    idleWavesEnterTimer = null;
  }, 360);
}

// Watch system theme change if config theme is "System"
themeMedia.addEventListener("change", () => {
  if (globalConfig.theme.toLowerCase() === "system") {
    applyTheme("System", true);
  }
});

export async function loadConfig(): Promise<PulsarConfig> {
  try {
    const config = await invoke<PulsarConfig>("get_config");
    if (config) {
      globalConfig = { ...DEFAULT_CONFIG, ...config };
      applyTheme(globalConfig.theme, false);
      setIdleAnimationClass(globalConfig.idle_animation);
      await initI18n(globalConfig.language);
      notifyListeners();
    }
  } catch (error) {
    console.error("Failed to load config from Tauri:", error);
  }
  return globalConfig;
}

export async function saveConfig(newConfig: Partial<PulsarConfig>): Promise<PulsarConfig> {
  const updated = { ...globalConfig, ...newConfig };
  globalConfig = updated;

  applyTheme(updated.theme, true);
  setIdleAnimationClass(updated.idle_animation);
  if (newConfig.language) {
    await initI18n(updated.language);
  }

  try {
    await invoke("save_config", { newConfig: updated });
    // Notify window components or other managers
    window.dispatchEvent(new CustomEvent("pulsar-config-updated", { detail: updated }));
  } catch (error) {
    console.error("Failed to save config to Tauri:", error);
  }

  notifyListeners();
  return globalConfig;
}

export function getCurrentConfig(): PulsarConfig {
  return globalConfig;
}

export function useConfig() {
  const [config, setConfig] = useState<PulsarConfig>(globalConfig);

  useEffect(() => {
    const handler = (cfg: PulsarConfig) => setConfig({ ...cfg });
    listeners.add(handler);
    // Initial sync
    setConfig({ ...globalConfig });
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    config,
    updateConfig: async (updates: Partial<PulsarConfig>) => {
      return await saveConfig(updates);
    },
    reloadConfig: async () => {
      return await loadConfig();
    },
  };
}