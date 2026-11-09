export function extractFolderPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "";
  return normalized.slice(0, index).replace(/\//g, "\\");
}

export function extractFileName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? trimmed : normalized.slice(index + 1);
}

export function parseSizeInput(value: string): number | null {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]*)$/i);
  if (!match?.[2]) return null;

  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  const aliases: Record<string, string> = {
    bytes: "b", k: "kb", m: "mb", g: "gb", t: "tb",
  };
  const unit = aliases[match[2]] || match[2];
  const multipliers: Record<string, number> = {
    b: 1, kb: 1024, kib: 1024, mb: 1024 ** 2, mib: 1024 ** 2,
    gb: 1024 ** 3, gib: 1024 ** 3, tb: 1024 ** 4, tib: 1024 ** 4,
  };
  const bytes = amount * (multipliers[unit] || 0);
  return bytes > 0 && Number.isSafeInteger(Math.round(bytes)) ? Math.round(bytes) : null;
}

export function normalizeFormatKey(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+/, "");
}
