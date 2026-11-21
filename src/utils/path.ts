export function detectPathSeparator(value: string): "/" | "\\" {
  return value.includes("\\") ? "\\" : "/";
}

export function extractFolderPath(rawPath: string): string {
  if (typeof rawPath !== "string") return "";
  const trimmed = rawPath.trim();
  if (!trimmed) return "";

  const sep = detectPathSeparator(trimmed);
  const normalized = trimmed.replace(/\\/g, "/");
  const lastSep = normalized.lastIndexOf("/");
  if (lastSep < 0) return "";
  if (lastSep === 0) return "/";
  if (lastSep === 2 && /^[a-zA-Z]:/.test(normalized)) {
    return `${normalized.slice(0, 2)}${sep}`;
  }

  const folder = normalized.slice(0, lastSep);
  return sep === "\\" ? folder.replace(/\//g, "\\") : folder;
}

export function extractFileName(rawPath: string): string {
  if (typeof rawPath !== "string") return "";
  const trimmed = rawPath.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\\/g, "/");
  const lastSep = normalized.lastIndexOf("/");
  return lastSep < 0 ? trimmed : normalized.slice(lastSep + 1);
}

export function joinPath(base: string, name: string): string {
  if (!base) return name;
  if (!name) return base;
  const sep = detectPathSeparator(base);
  if (base.endsWith("/") || base.endsWith("\\")) {
    return `${base}${name}`;
  }
  return `${base}${sep}${name}`;
}
