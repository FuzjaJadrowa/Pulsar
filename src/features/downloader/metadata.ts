import { detectSourceFromUrl } from "../../utils/format";
import type { DownloaderFormat, DownloaderMetadata, SubtitleOption } from "./types";

const videoQualities = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];

export const hasCodec = (codec?: string | null) => !!codec?.trim() && codec.trim().toLowerCase() !== "none";

export const codecMatches = (requested: string, source?: string | null) => {
  const wanted = requested.trim().toLowerCase();
  const found = (source || "").trim().toLowerCase();
  if (!wanted || !found || found === "none") return false;

  const prefixes: Record<string, string[]> = {
    h264: ["h264", "avc1", "avc3"], h265: ["h265", "hevc", "hev1", "hvc1"], hevc: ["h265", "hevc", "hev1", "hvc1"],
    av1: ["av1", "av01"], vp9: ["vp9", "vp09"], vp8: ["vp8", "vp08"], aac: ["aac", "mp4a"], opus: ["opus"],
    vorbis: ["vorbis"], mp3: ["mp3"], flac: ["flac"], alac: ["alac"],
  };
  return (prefixes[wanted] || [wanted]).some((prefix) => found.startsWith(prefix));
};

export const metadataHasOnlyAudioSources = (formats: DownloaderFormat[] = []) => {
  const codecFormats = formats.filter((format) => hasCodec(format.vcodec) || hasCodec(format.acodec));
  return codecFormats.length > 0 && codecFormats.every((format) => hasCodec(format.acodec) && !hasCodec(format.vcodec));
};

export const isAudioOnlySourceUrl = (url: string) => {
  const source = detectSourceFromUrl(url);
  return source !== null && source !== "youtube" && source !== "soundcloud";
};

export function createSubtitleOptions(
  metadata: DownloaderMetadata,
  locale: string,
  globalLanguageLabel: string,
): SubtitleOption[] {
  const codes = [...(metadata.subtitles_langs || []), ...(metadata.auto_captions_langs || [])];
  const uniqueCodes = [...new Set(codes.map((code) => String(code).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return uniqueCodes.map((code) => {
    const normalizedCode = code.trim().replace("_", "-");
    const parts = normalizedCode.split("-");
    const language = parts[0].toLowerCase();
    const region = (parts.find((part) => part.length === 2 && /^[a-zA-Z]{2}$/.test(part)) || "").toUpperCase();
    let languageName = language;
    let countryName = region;

    try {
      languageName = new Intl.DisplayNames([locale], { type: "language" }).of(language) || language;
    } catch {}

    if (region) {
      try {
        countryName = new Intl.DisplayNames([locale], { type: "region" }).of(region) || region;
      } catch {}
    }

    const flag = region
      ? String.fromCodePoint(...region.split("").map((character) => 127397 + character.charCodeAt(0)))
      : "GLB";

    return { code: code.trim(), languageName, countryName: countryName || globalLanguageLabel, flag };
  });
}

export function getVideoQualityOptions(formats: DownloaderFormat[] = []): string[] {
  const found = new Map<string, number>();
  formats.forEach((format) => {
    if (format.vcodec?.trim().toLowerCase() === "none") return;

    const note = String(format.format_note || format.note || "");
    const resolution = String(format.resolution || "");
    const resolutionMatch = resolution.match(/\d+x(\d{2,5})/i);
    const noteMatch = note.match(/(\d{2,5})p/i);
    const formatIdMatch = String(format.format_id || "").match(/(?:^|[^\d])(\d{2,5})p(?:\d+)?(?:$|[^\d])/i);
    const height = Number(format.height || resolutionMatch?.[1] || noteMatch?.[1] || formatIdMatch?.[1] || 0);
    const quality = videoQualities.find((entry) => Number.parseInt(entry, 10) <= height);
    if (!quality) return;

    const fps = Number(format.fps);
    const knownFps = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 0;
    found.set(quality, Math.max(found.get(quality) || 0, knownFps));
  });

  if (!found.size) return ["Best"];
  const highest = videoQualities.find((quality) => found.has(quality));
  if (!highest) return ["Best"];

  return videoQualities
    .slice(videoQualities.indexOf(highest))
    .filter((quality) => Number.parseInt(quality, 10) <= Number.parseInt(highest, 10))
    .map((quality) => {
      const maxFps = found.get(quality) || 0;
      return maxFps > 30 ? `${quality}${maxFps}` : quality;
    });
}