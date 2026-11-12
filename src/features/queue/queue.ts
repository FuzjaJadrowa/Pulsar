import { useState, useEffect } from "react";
import { invoke, listen } from "../../services/tauri";
import { showNotification } from "../../services/notifications";
import { t } from "../../services/i18n";
import { getCurrentConfig } from "../../services/config";
import { applyQueueEventToItem, restoreQueueItems } from "./model";
import type { QueueBridgeEvent } from "./events";

export interface QueueItem {
  id: string;
  itemType: "download" | "convert" | "compress";
  title: string;
  thumbnail: string;
  status: "pending" | "downloading" | "failed" | "completed";
  progress: number;
  eta: string;
  stage: string;
  listProgress: string | null;
  addedAt: number;
  payload: QueueItemPayload;
  path: string;
  taskId: string | null;
  skippedByStop: boolean;
  startReason: string | null;
  pendingStartReason: string | null;
  source: string;
  cancelRequested?: boolean;
}

export interface QueueItemPayload extends Record<string, unknown> {
  url?: string;
  path?: string;
  output_path?: string;
  filepath?: string;
  output_dir?: string;
  save_path?: string;
  category?: string;
  mode?: string;
  output_format?: string;
  video_format?: string;
  audio_format?: string;
  video_quality?: string;
  audio_quality?: string;
  source_size_bytes?: number | string;
  download_subs?: boolean;
  download_chat?: boolean;
  embed_subs?: boolean;
}

interface QueueState {
  items: QueueItem[];
  activeItemIds: string[];
  priorityQueue: string[];
  startAllActive: boolean;
  startAllSuccess: boolean;
  startAllStarted: number;
  clearAfterCurrent: boolean;
  hydrated: boolean;
  maxConcurrent: number;
  orbInFlight: boolean;
}

const state: QueueState = {
  items: [],
  activeItemIds: [],
  priorityQueue: [],
  startAllActive: false,
  startAllSuccess: true,
  startAllStarted: 0,
  clearAfterCurrent: false,
  hydrated: false,
  maxConcurrent: 3,
  orbInFlight: false,
};

const listeners = new Set<(items: QueueItem[]) => void>();
const pendingRemovalIds = new Set<string>();

function notifyListeners() {
  listeners.forEach((l) => l([...state.items]));
  window.dispatchEvent(new CustomEvent("pulsar-queue-updated", { detail: { count: state.items.length } }));
}

function playSuccessSound() {
  const audio = new Audio("assets/success.mp3");
  audio.play().catch((err) => {
    console.log("Audio playback failed or disabled:", err);
  });
}

function sendSystemNotification(title: string, body: string, type: string) {
  const cfg = getCurrentConfig();
  if (cfg.system_notifications) {
    invoke("send_system_notification", { title, body, kind: type }).catch((err) => {
      console.error("System notification failed:", err);
    });
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const payload = {
      items: state.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        title: item.title,
        thumbnail: item.thumbnail,
        status: item.status,
        progress: item.progress,
        eta: item.eta,
        addedAt: item.addedAt,
        payload: item.payload,
        path: item.path,
        skippedByStop: item.skippedByStop,
        pendingStartReason: item.pendingStartReason,
        source: item.source,
      })),
      priorityQueue: state.priorityQueue,
    };
    try {
      await invoke("save_queue_state", { queueState: payload });
    } catch (e) {
      console.error("Queue persist failed:", e);
    }
  }, 120);
}

let hydratePromise: Promise<void> | null = null;
async function hydrate(): Promise<void> {
  try {
    const data = await invoke<Record<string, unknown>>("get_queue_state");
    const cfg = getCurrentConfig();
    state.maxConcurrent = cfg.maximum_concurrent_processes || 3;

    state.items = restoreQueueItems(data?.items, t("common.unknownTitle"));

    state.activeItemIds = [];
    const savedPriorityQueue = data.priorityQueue ?? data.priority_queue;
    state.priorityQueue = Array.isArray(savedPriorityQueue)
      ? savedPriorityQueue.map(String).filter((id) => state.items.some((item) => item.id === id))
      : [];
    state.startAllActive = false;
    state.startAllSuccess = true;
    state.startAllStarted = 0;
    state.clearAfterCurrent = false;
    
    notifyListeners();
  } catch (e) {
    console.error("Queue hydrate failed:", e);
  }
  state.hydrated = true;
}

export async function ensureHydrated() {
  if (state.hydrated) return;
  if (!hydratePromise) {
    hydratePromise = hydrate().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

function getNextItemId(): string {
  let id = Date.now();
  while (state.items.some((i) => i.id === String(id))) {
    id += 1;
  }
  return String(id);
}

export async function startItem(item: QueueItem, reason: string) {
  if (item.status === "downloading") return;
  const runId = `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  item.status = "downloading";
  item.progress = 0;
  item.eta = "--";
  item.taskId = runId;
  item.cancelRequested = false;
  item.startReason = reason;
  item.pendingStartReason = null;
  item.skippedByStop = false;
  
  if (!state.activeItemIds.includes(item.id)) {
    state.activeItemIds.push(item.id);
  }
  
  notifyListeners();
  persistSoon();

  try {
    let tId: string | null = null;
    const cleanPayload: Record<string, unknown> = { ...item.payload, client_task_id: runId };

    if (item.itemType === "convert") {
      if (cleanPayload.is_batch && Array.isArray(cleanPayload.items)) {
        tId = await invoke<string>("start_batch_convert", { options: cleanPayload });
      } else {
        tId = await invoke<string>("start_convert", { options: cleanPayload });
      }
    } else if (item.itemType === "compress") {
      if (cleanPayload.is_batch && Array.isArray(cleanPayload.items)) {
        tId = await invoke<string>("start_batch_compress", { options: cleanPayload });
      } else {
        tId = await invoke<string>("start_compress", { options: cleanPayload });
      }
    } else {
      tId = await invoke<string>("start_download", { options: cleanPayload });
    }

    const current = state.items.find((i) => i.id === item.id);
    if (!current || current.status !== "downloading" || current.taskId !== runId) {
      if (tId) await invoke("cancel_download", { taskId: String(tId) });
      return;
    }

    item.taskId = String(tId);
    persistSoon();
    // A stop can be requested while the start command is still being handled.
    // Send it again after start resolves so the cancel cannot overtake startup.
    if (item.cancelRequested && tId) {
      await invoke("cancel_download", { taskId: String(tId) }).catch((error) => {
        console.error("Cancel task failed:", error);
        if (item.status === "downloading" && item.taskId === String(tId)) {
          item.cancelRequested = false;
          notifyListeners();
        }
      });
    }
  } catch (e) {
    console.error("Start failed:", e);
    const current = state.items.find((candidate) => candidate.id === item.id);
    if (current?.status === "downloading" && current.taskId === runId) {
      current.taskId = null;
      current.cancelRequested = false;
      markFailed(current, "START_FAILED");
    }
  }
}

export function startItemOrQueue(item: QueueItem, reason: string) {
  const cfg = getCurrentConfig();
  state.maxConcurrent = cfg.maximum_concurrent_processes || 3;

  if (item.status === "downloading") return;
  if (state.activeItemIds.length >= state.maxConcurrent) {
    if (!state.priorityQueue.includes(item.id)) {
      state.priorityQueue.push(item.id);
    }
    item.pendingStartReason = reason;
    item.skippedByStop = false;
    notifyListeners();
    persistSoon();
    return;
  }
  state.priorityQueue = state.priorityQueue.filter((id) => id !== item.id);
  startItem(item, reason);
}

export function maybeStartNext() {
  if (state.clearAfterCurrent) {
    if (state.activeItemIds.length === 0) {
      clearQueue();
      state.clearAfterCurrent = false;
      persistSoon();
    }
    return;
  }

  const cfg = getCurrentConfig();
  state.maxConcurrent = cfg.maximum_concurrent_processes || 3;
  let slots = state.maxConcurrent - state.activeItemIds.length;
  if (slots <= 0) return;

  while (slots > 0) {
    const prio = state.priorityQueue.find((id) => state.items.some((i) => i.id === id && i.status === "pending"));
    if (!prio) break;
    state.priorityQueue = state.priorityQueue.filter((id) => id !== prio);
    const item = state.items.find((i) => i.id === prio);
    if (item) {
      startItem(item, item.pendingStartReason || "download");
      slots -= 1;
    } else {
      break;
    }
  }

  if (state.startAllActive) {
    while (slots > 0) {
      const next = state.items.find((i) => i.status === "pending" && !i.skippedByStop);
      if (!next) break;
      state.startAllStarted += 1;
      startItem(next, "start-all");
      slots -= 1;
    }
    const hasPending = state.items.some((i) => i.status === "pending" && !i.skippedByStop);
    if (!hasPending && state.activeItemIds.length === 0) {
      state.startAllActive = false;
      if (state.startAllSuccess && state.startAllStarted > 0) {
        showNotification(
          t("common.success"),
          t("queue.notifications.queueCompleted"),
          "success"
        );
        playSuccessSound();
        sendSystemNotification(
          t("queue.notifications.systemTitle"),
          t("queue.notifications.queueCompletedSystem"),
          "success"
        );
      }
      state.startAllSuccess = true;
      state.startAllStarted = 0;
      persistSoon();
    }
  }
  notifyListeners();
}

export function markCompleted(item: QueueItem) {
  item.status = "completed";
  item.progress = 100;
  item.eta = "00:00";
  item.taskId = null;
  item.cancelRequested = false;
  state.activeItemIds = state.activeItemIds.filter((id) => id !== item.id);

  if (["download", "queue-manual", "convert", "compress"].includes(item.startReason || "")) {
    if (item.itemType === "download") {
      showNotification(
        t("common.success"),
        t("queue.notifications.downloadCompleted"),
        "success"
      );
      playSuccessSound();
      sendSystemNotification(
        t("queue.notifications.systemTitle"),
        t("queue.notifications.downloadCompletedSystem"),
        "success"
      );
    } else if (item.itemType === "convert") {
      showNotification(
        t("common.success"),
        t("queue.notifications.convertCompleted"),
        "success"
      );
      playSuccessSound();
      sendSystemNotification(
        t("queue.notifications.systemTitle"),
        t("queue.notifications.convertCompletedSystem"),
        "success"
      );
    } else if (item.itemType === "compress") {
      showNotification(
        t("common.success"),
        t("queue.notifications.compressCompleted"),
        "success"
      );
      playSuccessSound();
      sendSystemNotification(
        t("queue.notifications.systemTitle"),
        t("queue.notifications.compressCompletedSystem"),
        "success"
      );
    }
  }

  notifyListeners();
  persistSoon();
  maybeStartNext();
}

export function markFailed(item: QueueItem, code: string) {
  const cancelLike = String(code || "").toLowerCase().includes("cancel");
  if (cancelLike) {
    item.status = "pending";
    item.progress = 0;
    item.eta = "--";
    item.taskId = null;
    item.skippedByStop = true;
    item.startReason = null;
    state.activeItemIds = state.activeItemIds.filter((id) => id !== item.id);
    
    notifyListeners();
    persistSoon();
    maybeStartNext();
    return;
  }

  item.status = "failed";
  item.taskId = null;
  item.cancelRequested = false;
  state.activeItemIds = state.activeItemIds.filter((id) => id !== item.id);

  if (state.startAllActive && item.startReason === "start-all") {
    state.startAllSuccess = false;
  }

  const suffix = code ? t("queue.notifications.errorSuffix", { code }) : "";
  const failedKey = item.itemType === "convert"
    ? "convertFailed"
    : item.itemType === "compress"
    ? "compressFailed"
    : "downloadFailed";
  const failedSysKey = item.itemType === "convert"
    ? "convertFailedSystem"
    : item.itemType === "compress"
    ? "compressFailedSystem"
    : "downloadFailedSystem";

  showNotification(
    t("common.error"),
    t(`queue.notifications.${failedKey}`, { suffix }),
    "error"
  );
  sendSystemNotification(
    t("queue.notifications.systemTitle"),
    t(`queue.notifications.${failedSysKey}`, { suffix }),
    "error"
  );

  notifyListeners();
  persistSoon();
  maybeStartNext();
}

export async function cancelItem(id: string) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  if (item.status === "downloading") {
    if (item.cancelRequested) return;
    const tId = item.taskId;
    if (!tId) return;
    item.cancelRequested = true;
    notifyListeners();
    persistSoon();
    try {
      await invoke("cancel_download", { taskId: tId });
    } catch (e) {
      console.error("Cancel task failed:", e);
      if (item.status === "downloading" && item.taskId === tId) {
        item.cancelRequested = false;
        if (pendingRemovalIds.delete(id)) {
          const element = document.querySelector(`.queue-item[data-id="${id}"]`) as HTMLElement | null;
          if (element) {
            element.classList.remove("removing");
            element.style.height = "";
          }
        }
        notifyListeners();
        persistSoon();
      }
    }
  } else {
    state.priorityQueue = state.priorityQueue.filter((pqId) => pqId !== id);
    item.status = "pending";
    item.progress = 0;
    item.eta = "--";
  }

  notifyListeners();
  persistSoon();
  maybeStartNext();
}

export function startItemById(id: string, reason = "queue-manual", reset = false) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  if (reset) {
    item.progress = 0;
    item.eta = "--";
    item.status = "pending";
  }
  startItemOrQueue(item, reason);
}

export function removeItem(id: string) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  const performStateRemoval = () => {
    state.items = state.items.filter((i) => i.id !== id);
    state.priorityQueue = state.priorityQueue.filter((pqId) => pqId !== id);
    notifyListeners();
    persistSoon();
  };

  const el = document.querySelector(`.queue-item[data-id="${id}"]`) as HTMLElement;
  if (el) {
    el.style.height = `${el.offsetHeight}px`;
    // Force reflow
    void el.offsetHeight;
    el.classList.add("removing");
    el.style.height = "0px";

  }

  if (item.status === "downloading") {
    pendingRemovalIds.add(id);
    void cancelItem(id);
    return;
  }

  setTimeout(performStateRemoval, el ? 320 : 0);
}

export function clearQueue() {
  const activeCount = state.activeItemIds.length;
  if (activeCount > 0) {
    state.items = state.items.filter((i) => i.status === "downloading");
    state.priorityQueue = [];
    state.startAllActive = false;
    state.clearAfterCurrent = true;
  } else {
    state.items = [];
    state.priorityQueue = [];
    state.activeItemIds = [];
    state.startAllActive = false;
    state.clearAfterCurrent = false;
  }
  notifyListeners();
  persistSoon();
}

export function startAll() {
  state.startAllActive = true;
  state.startAllSuccess = true;
  state.startAllStarted = 0;
  state.items.forEach((i) => {
    if (i.status === "pending") i.skippedByStop = false;
  });
  maybeStartNext();
  persistSoon();
}

export function stopAll() {
  state.startAllActive = false;
  state.priorityQueue = [];
  
  const toCancel = [...state.activeItemIds];
  toCancel.forEach((aid) => {
    const item = state.items.find((i) => i.id === aid);
    if (item) {
      item.skippedByStop = true;
      cancelItem(aid);
    }
  });

  state.items.forEach((i) => {
    if (i.status === "pending") i.skippedByStop = true;
  });

  if (toCancel.length > 0) {
    showNotification(
      t("common.info"),
      t("queue.notifications.downloadStopped"),
      "info"
    );
  }
  notifyListeners();
  persistSoon();
}

export async function openInFileManager(path: string) {
  const targetPath = String(path || "").trim();
  if (!targetPath) {
    console.warn("openInFileManager called with empty path");
    return;
  }
  try {
    await invoke("open_in_file_manager", { path: targetPath });
  } catch (error) {
    console.error("Failed to open file manager:", error);
  }
}

export async function enqueue(
  itemType: "download" | "convert" | "compress",
  payload: Record<string, unknown>,
  meta: { title?: string; thumbnail?: string; path?: string; source?: string },
  opts: { autoStart?: boolean; startReason?: string } = {}
) {
  await ensureHydrated();

  const id = getNextItemId();
  const newItem: QueueItem = {
    id,
    itemType,
    title: meta?.title ? String(meta.title) : t("common.unknownTitle"),
    thumbnail: meta?.thumbnail ? String(meta.thumbnail) : "",
    status: "pending",
    progress: 0,
    eta: "--",
    stage: "",
    listProgress: null,
    addedAt: Date.now(),
    payload: { ...payload },
    path: meta?.path || [payload.path, payload.output_dir, payload.save_path].find((value): value is string => typeof value === "string") || "",
    taskId: null,
    skippedByStop: false,
    startReason: null,
    pendingStartReason: null,
    source: meta?.source || "queue",
  };

  state.items = [...state.items, newItem];
  notifyListeners();
  persistSoon();

  if (opts.autoStart) {
    startItemOrQueue(newItem, opts.startReason || "download");
  } else if (state.startAllActive) {
    maybeStartNext();
  }
  return id;
}

export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>(state.items);

  useEffect(() => {
    ensureHydrated();
    const handler = (updated: QueueItem[]) => setItems(updated);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    items,
    enqueue,
    startItem: startItemById,
    cancelItem,
    removeItem,
    clearQueue,
    startAll,
    stopAll,
    openInFileManager,
    activeItemIds: state.activeItemIds,
  };
}

listen<QueueBridgeEvent>("download-event", (event) => {
  const payload = event.payload;
  if (!payload || payload.type === "metadata" || !payload.id) return;
  const item = state.items.find((i) => i.status === "downloading" && i.taskId === String(payload.id));
  if (!item) return;

  window.queueConsole?.log(item.id, payload);

  const changes = applyQueueEventToItem(item, payload);
  if (changes.progressUpdated) {
    notifyListeners();
    persistSoon();
  }

  if (changes.cancelled) {
    state.activeItemIds = state.activeItemIds.filter((aid) => aid !== item.id);
    item.cancelRequested = false;
    if (pendingRemovalIds.delete(item.id)) {
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      state.priorityQueue = state.priorityQueue.filter((queueId) => queueId !== item.id);
    }
    notifyListeners();
    persistSoon();
    maybeStartNext();
    return;
  }

  if (changes.finished) {
    if (changes.success) {
      markCompleted(item);
    } else {
      markFailed(item, changes.error || "UNKNOWN");
    }
    if (pendingRemovalIds.delete(item.id)) {
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      state.priorityQueue = state.priorityQueue.filter((queueId) => queueId !== item.id);
      notifyListeners();
      persistSoon();
    }
  }
});

listen("tray-clear-queue", () => {
  clearQueue();
});
export function refreshConfig() {
  const cfg = getCurrentConfig();
  state.maxConcurrent = cfg.maximum_concurrent_processes || 3;
}

export function animateQueueOrb(source: HTMLElement | DOMRect | { left: number; top: number; width?: number; height?: number } | null) {
  let startX = window.innerWidth / 2;
  let startY = window.innerHeight / 2;

  if (source) {
    if ("getBoundingClientRect" in source && typeof source.getBoundingClientRect === "function") {
      const rect = source.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0 || rect.left > 0 || rect.top > 0) {
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      }
    } else if ("left" in source && "top" in source) {
      startX = source.left + (source.width || 0) / 2;
      startY = source.top + (source.height || 0) / 2;
    }
  }

  setTimeout(() => {
    const btn = document.getElementById("btn-queue");
    if (!btn) return;

    if (btn.offsetWidth === 0 && btn.offsetHeight === 0) {
      btn.style.display = "flex";
    }

    const t = btn.getBoundingClientRect();
    const endX = t.left + t.width / 2;
    const endY = t.top + t.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;

    const orb = document.createElement("div");
    orb.className = "queue-orb";
    orb.style.left = `${startX}px`;
    orb.style.top = `${startY}px`;
    document.body.appendChild(orb);

    const a = orb.animate([
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0.95 },
      { transform: `translate(-50%, -50%) translate(${dx * 0.48}px, ${dy * 0.48 - 30}px) scale(1.2)`, opacity: 1 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0.9 }
    ], { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });

    a.onfinish = () => {
      orb.remove();
      btn.classList.add("queue-pulse");

      setTimeout(() => {
        btn.classList.remove("queue-pulse");
      }, 700);
    };
  }, 10);
}