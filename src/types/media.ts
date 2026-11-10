export interface MediaFileMetadata {
  path: string;
  name?: string;
  category?: string;
  extension?: string;
  format?: string;
  size_bytes?: number;
  duration_seconds?: number;
  duration_string?: string;
  width?: number;
  height?: number;
}

export function isMediaFileMetadata(value: unknown): value is MediaFileMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Record<string, unknown>;
  return typeof metadata.path === "string" && metadata.path.trim().length > 0;
}