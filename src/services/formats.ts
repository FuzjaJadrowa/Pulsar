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

let cachedCatalog: FormatCatalog | null = null;
let catalogPromise: Promise<FormatCatalog> | null = null;

loadFormatCatalog();

export async function loadFormatCatalog(): Promise<FormatCatalog> {
  if (cachedCatalog) return cachedCatalog;
  if (!catalogPromise) {
    catalogPromise = fetch("./assets/format.json")
      .then((res) => res.json())
      .then((data: FormatCatalog) => {
        cachedCatalog = {
          dformats: Array.isArray(data?.dformats) ? data.dformats : [],
          cformats: Array.isArray(data?.cformats) ? data.cformats : [],
        };
        return cachedCatalog;
      })
      .catch((err) => {
        console.error("Failed to load format catalog:", err);
        const empty = { dformats: [], cformats: [] };
        cachedCatalog = empty;
        return empty;
      });
  }
  return catalogPromise;
}

export function getFormatEntrySync(formatId: string | null | undefined, isConverter = false): FormatEntry | null {
  if (!cachedCatalog || !formatId) return null;
  const clean = formatId.trim().toLowerCase();
  if (!clean) return null;

  const list = isConverter ? cachedCatalog.cformats : cachedCatalog.dformats;
  const found = list.find((item) => item.id.toLowerCase() === clean);
  if (found) return found;

  const alt = (isConverter ? cachedCatalog.dformats : cachedCatalog.cformats).find(
    (item) => item.id.toLowerCase() === clean
  );
  return alt || null;
}