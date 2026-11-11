import type { QueueItem, QueueItemPayload } from "./queue";
import type { QueueBridgeEvent } from "./events";

export interface QueueEventChanges {
  progressUpdated: boolean;
  cancelled: boolean;
  finished: boolean;
  success?: boolean;
  error?: string;
}

export function parseProgressValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.replace("%", "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function applyQueueEventToItem(item: QueueItem, event: QueueBridgeEvent): QueueEventChanges {
  const changes: QueueEventChanges = { progressUpdated: false, cancelled: false, finished: false };
  if (!event.type || event.type === "metadata") return changes;

  const eventPath = event.filepath || event.path || event.output_path || event.filename;
  if (typeof eventPath === "string" && eventPath.trim()) item.path = eventPath.trim();

  if (event.type === "progress" || event.type === "progress_ffmpeg" || event.percent !== undefined || event.progress !== undefined) {
    const progressValue = event.percent !== undefined
      ? event.percent
      : event.progress !== undefined
        ? event.progress
        : event.percentage;
    item.progress = Math.min(Math.max(parseProgressValue(progressValue), 0), 100);

    if (event.eta_seconds !== undefined) {
      const total = Math.max(0, Math.floor(Number(event.eta_seconds) || 0));
      const hours = Math.floor(total / 3600);
      const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
      const seconds = String(total % 60).padStart(2, "0");
      item.eta = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
    } else if (event.eta !== undefined) {
      item.eta = String(event.eta);
    }

    const index = Number(event.item_index);
    const count = Number(event.item_count);
    if (Number.isFinite(index) && Number.isFinite(count)) {
      item.listProgress = `${Math.max(1, Math.floor(index))}/${Math.max(1, Math.floor(count))}`;
    }
    changes.progressUpdated = true;
  }

  if (event.type === "cancelled") {
    item.status = "pending";
    item.progress = 0;
    item.eta = "--";
    item.taskId = null;
    item.cancelRequested = false;
    item.skippedByStop = true;
    item.startReason = null;
    changes.cancelled = true;
  }

  if (event.type === "finished") {
    changes.finished = true;
    changes.success = Boolean(event.success);
    changes.error = event.error || "UNKNOWN";
  }

  return changes;
}

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
      payload: raw.payload && typeof raw.payload === "object" ? raw.payload as QueueItemPayload : {},
      path: String(raw.path || ""),
      taskId: null,
      skippedByStop: Boolean(raw.skippedByStop ?? raw.skipped_by_stop),
      startReason: null,
      pendingStartReason: raw.pendingStartReason || raw.pending_start_reason || null,
      source: String(raw.source || "queue"),
    } as QueueItem;
  });
}