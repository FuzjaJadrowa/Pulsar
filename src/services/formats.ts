export interface FormatEntry {
  id: string;
  type: "video" | "audio" | "image" | "archive" | "font";
  video_codecs?: string[];
  audio_codecs?: string[];
}

export interface FormatCatalog {
  dformats: FormatEntry[];
  cformats: FormatEntry[];
}

const FORMAT_TYPES = new Set<FormatEntry["type"]>(["video", "audio", "image", "archive", "font"]);

function normalizeEntries(value: unknown): FormatEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || !entry.id.trim() || !FORMAT_TYPES.has(entry.type as FormatEntry["type"])) {
      return [];
    }
    return [{
      id: entry.id.trim(),
      type: entry.type as FormatEntry["type"],
      ...(Array.isArray(entry.video_codecs)
        ? { video_codecs: entry.video_codecs.filter((codec): codec is string => typeof codec === "string") }
        : {}),
      ...(Array.isArray(entry.audio_codecs)
        ? { audio_codecs: entry.audio_codecs.filter((codec): codec is string => typeof codec === "string") }
        : {}),
    }];
  });
}

export function normalizeFormatCatalog(data: unknown): FormatCatalog {
  const catalog = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return {
    dformats: normalizeEntries(catalog.dformats),
    cformats: normalizeEntries(catalog.cformats),
  };
}

let cachedCatalog: FormatCatalog | null = null;
let catalogPromise: Promise<FormatCatalog> | null = null;

export async function loadFormatCatalog(): Promise<FormatCatalog> {
  if (cachedCatalog) return cachedCatalog;
  if (!catalogPromise) {
    catalogPromise = fetch("./assets/format.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Format catalog request failed (${response.status})`);
        return response.json();
      })
      .then((data: unknown) => {
        cachedCatalog = normalizeFormatCatalog(data);
        return cachedCatalog;
      })
      .catch((err) => {
        console.error("Failed to load format catalog:", err);
        catalogPromise = null;
        return { dformats: [], cformats: [] };
      });
  }
  return catalogPromise;
}

export function getFormatEntrySync(formatId: string | null | undefined, isConverter = false): FormatEntry | null {
  if (!cachedCatalog || !formatId) return null;
  const clean = formatId.trim().toLowerCase();
  if (!clean) return null;

  const list = isConverter ? cachedCatalog.cformats : cachedCatalog.dformats;
  return list.find((item) => item.id.toLowerCase() === clean) || null;
}