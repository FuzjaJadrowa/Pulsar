import type { QueueItem } from "./queue";

export function restoreQueueItems(rawItems: unknown, unknownTitle: string): QueueItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((value: unknown) => {
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const interrupted = raw.status === "downloading";
    const itemType = raw.itemType ?? raw.item_type;
    const status = raw.status;
    const progress = Number(raw.progress);

    return {
      id: String(raw.id || Math.random().toString(36).substring(2, 9)),
      itemType: typeof itemType === "string" && ["download", "convert", "compress"].includes(itemType)
        ? itemType as QueueItem["itemType"]
        : "download",
      title: String(raw.title || unknownTitle),
      thumbnail: String(raw.thumbnail || ""),
      status: interrupted ? "pending" : ["pending", "failed", "completed"].includes(String(status))
        ? status as QueueItem["status"]
        : "pending",
      progress: interrupted || !Number.isFinite(progress) ? 0 : Math.min(Math.max(progress, 0), 100),
      eta: String(raw.eta || "--"),
      listProgress: null,
      addedAt: Number(raw.addedAt ?? raw.added_at) || Date.now(),
      payload: raw.payload && typeof raw.payload === "object" ? raw.payload as Record<string, any> : {},
      path: String(raw.path || ""),
      taskId: null,
      skippedByStop: Boolean(raw.skippedByStop ?? raw.skipped_by_stop),
      startReason: null,
      pendingStartReason: raw.pendingStartReason || raw.pending_start_reason || null,
      source: String(raw.source || "queue"),
    } as QueueItem;
  });
}
