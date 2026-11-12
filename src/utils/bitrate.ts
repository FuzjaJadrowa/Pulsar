export function sanitizeBitrateInput(value: string, maxKbps: number): string {
  const digits = value.replace(/\D/g, "").slice(0, String(maxKbps).length);
  if (!digits) return "";
  return String(Math.min(Number(digits), maxKbps));
}