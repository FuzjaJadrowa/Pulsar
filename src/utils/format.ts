// Utility functions for formatting and URL parsing

export function formatBytes(bytes: number | string | undefined | null): string {
  if (bytes === null || bytes === undefined) return "--";
  const value = Number(bytes);
  if (!Number.isFinite(value)) return "--";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let idx = -1;
  let size = value;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[idx]}`;
}

export function formatDuration(seconds: number | string | undefined | null): string {
  if (seconds === null || seconds === undefined) return "--:--:--";
  const total = Number(seconds);
  if (!Number.isFinite(total)) return "--:--:--";
  const safe = Math.max(0, Math.floor(total));
  const hrs = Math.floor(safe / 3600).toString().padStart(2, "0");
  const mins = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const secs = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

export function eta(seconds: number | string | undefined | null): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!Number.isFinite(total) || total === 0) return "--";
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function detectSourceFromUrl(rawUrl: string): "youtube" | "ytmusic" | "soundcloud" | "spotify" | null {
  const input = String(rawUrl || "").trim().toLowerCase();
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (host === "music.youtube.com" || host.endsWith(".music.youtube.com")) return "ytmusic";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    if (host === "soundcloud.com" || host.endsWith(".soundcloud.com") || host === "soundcloud.app.goo.gl") return "soundcloud";
    if (host === "spotify.com" || host.endsWith(".spotify.com")) return "spotify";
    return null;
  } catch {
    return null;
  }
}