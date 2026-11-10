export interface MetadataBridgeEvent {
  id?: string;
  type?: string;
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export type MetadataEventOutcome =
  | { kind: "ignore" }
  | { kind: "pending" }
  | { kind: "success"; data: Record<string, unknown> }
  | { kind: "error"; message: string | null };

export function resolveMetadataEvent(event: MetadataBridgeEvent, taskId: string | null): MetadataEventOutcome {
  if (!taskId || event.id !== taskId) return { kind: "ignore" };

  if (event.type === "finished" && event.success === false) {
    return { kind: "error", message: event.error || "Metadata fetch failed." };
  }
  if (event.type !== "metadata") return { kind: "pending" };
  if (event.success && event.data) return { kind: "success", data: event.data };
  return { kind: "error", message: null };
}