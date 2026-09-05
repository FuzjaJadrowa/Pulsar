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
  copy_codec_if_possible: boolean;
  default_video_codec: string;
  default_audio_codec: string;
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
  copy_codec_if_possible: false,
  default_video_codec: "auto",
  default_audio_codec: "auto",
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
    const raw = await invoke<any>("get_config");
    if (raw && typeof raw === "object") {
      const normalized: PulsarConfig = {
        theme: String(raw.theme ?? DEFAULT_CONFIG.theme),
        language: String(raw.language ?? DEFAULT_CONFIG.language),
        system_notifications: Boolean(raw.system_notifications ?? raw.systemNotifications ?? DEFAULT_CONFIG.system_notifications),
        advanced_mode: Boolean(raw.advanced_mode ?? raw.advancedMode ?? DEFAULT_CONFIG.advanced_mode),
        idle_animation: Boolean(raw.idle_animation ?? raw.idleAnimation ?? DEFAULT_CONFIG.idle_animation),
        update_app: Boolean(raw.update_app ?? raw.updateApp ?? DEFAULT_CONFIG.update_app),
        update_app_cooldown_minutes: Number(raw.update_app_cooldown_minutes ?? raw.updateAppCooldownMinutes ?? DEFAULT_CONFIG.update_app_cooldown_minutes),
        update_ytdlp: Boolean(raw.update_ytdlp ?? raw.updateYtdlp ?? DEFAULT_CONFIG.update_ytdlp),
        update_ffmpeg: Boolean(raw.update_ffmpeg ?? raw.updateFfmpeg ?? DEFAULT_CONFIG.update_ffmpeg),
        ffmpeg_hwaccel: String(raw.ffmpeg_hwaccel ?? raw.ffmpegHwaccel ?? DEFAULT_CONFIG.ffmpeg_hwaccel),
        cookies_browser: String(raw.cookies_browser ?? raw.cookiesBrowser ?? DEFAULT_CONFIG.cookies_browser),
        maximum_concurrent_processes: Number(raw.maximum_concurrent_processes ?? raw.maximumConcurrentProcesses ?? DEFAULT_CONFIG.maximum_concurrent_processes),
        maximum_search_results: Number(raw.maximum_search_results ?? raw.maximumSearchResults ?? DEFAULT_CONFIG.maximum_search_results),
        title_template: String(raw.title_template ?? raw.titleTemplate ?? DEFAULT_CONFIG.title_template),
        close_behavior: String(raw.close_behavior ?? raw.closeBehavior ?? DEFAULT_CONFIG.close_behavior),
        copy_codec_if_possible: Boolean(raw.copy_codec_if_possible ?? raw.copyCodecIfPossible ?? DEFAULT_CONFIG.copy_codec_if_possible),
        default_video_codec: String(raw.default_video_codec ?? raw.defaultVideoCodec ?? DEFAULT_CONFIG.default_video_codec),
        default_audio_codec: String(raw.default_audio_codec ?? raw.defaultAudioCodec ?? DEFAULT_CONFIG.default_audio_codec),
      };
      globalConfig = normalized;
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
  const merged = { ...globalConfig, ...newConfig };
  const updated: PulsarConfig = {
    theme: String(merged.theme ?? DEFAULT_CONFIG.theme),
    language: String(merged.language ?? DEFAULT_CONFIG.language),
    system_notifications: Boolean(merged.system_notifications ?? DEFAULT_CONFIG.system_notifications),
    advanced_mode: Boolean(merged.advanced_mode ?? DEFAULT_CONFIG.advanced_mode),
    idle_animation: Boolean(merged.idle_animation ?? DEFAULT_CONFIG.idle_animation),
    update_app: Boolean(merged.update_app ?? DEFAULT_CONFIG.update_app),
    update_app_cooldown_minutes: Number(merged.update_app_cooldown_minutes ?? DEFAULT_CONFIG.update_app_cooldown_minutes),
    update_ytdlp: Boolean(merged.update_ytdlp ?? DEFAULT_CONFIG.update_ytdlp),
    update_ffmpeg: Boolean(merged.update_ffmpeg ?? DEFAULT_CONFIG.update_ffmpeg),
    ffmpeg_hwaccel: String(merged.ffmpeg_hwaccel ?? DEFAULT_CONFIG.ffmpeg_hwaccel),
    cookies_browser: String(merged.cookies_browser ?? DEFAULT_CONFIG.cookies_browser),
    maximum_concurrent_processes: Number(merged.maximum_concurrent_processes ?? DEFAULT_CONFIG.maximum_concurrent_processes),
    maximum_search_results: Number(merged.maximum_search_results ?? DEFAULT_CONFIG.maximum_search_results),
    title_template: String(merged.title_template ?? DEFAULT_CONFIG.title_template),
    close_behavior: String(merged.close_behavior ?? DEFAULT_CONFIG.close_behavior),
    copy_codec_if_possible: Boolean(merged.copy_codec_if_possible ?? DEFAULT_CONFIG.copy_codec_if_possible),
    default_video_codec: String(merged.default_video_codec ?? DEFAULT_CONFIG.default_video_codec),
    default_audio_codec: String(merged.default_audio_codec ?? DEFAULT_CONFIG.default_audio_codec),
  };
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