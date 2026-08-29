import { useState, useEffect } from "react";
import { invoke, listen } from "./tauri";
import { showNotification } from "./notifications";
import { t } from "./i18n";
import { getCurrentConfig } from "./config";

export interface QueueItem {
  id: string;
  itemType: "download" | "convert" | "compress";
  title: string;
  thumbnail: string;
  status: "pending" | "downloading" | "failed" | "completed";
  progress: number;
  eta: string;
  listProgress: string | null;
  addedAt: number;
  payload: Record<string, any>;
  path: string;
  taskId: string | null;
  skippedByStop: boolean;
  startReason: string | null;
  pendingStartReason: string | null;
  source: string;
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

function notifyListeners() {
  listeners.forEach((l) => l([...state.items]));
  // Trigger config/buttons updates if needed
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

function parseProgressValue(p: any, _payload: any): number {
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const clean = p.replace("%", "").trim();
    const parsed = parseFloat(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// Persist state back to Tauri
let saveTimer: any = null;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const payload = {
      items: state.items.map((i) => ({
        id: i.id,
        item_type: i.itemType,
        title: i.title,
        thumbnail: i.thumbnail,
        status: i.status,
        progress: i.progress,
        eta: i.eta,
        added_at: i.addedAt,
        payload: i.payload,
        path: i.path,
        task_id: i.taskId,
        skipped_by_stop: !!i.skippedByStop,
        start_reason: i.startReason,
        pending_start_reason: i.pendingStartReason,
        source: i.source,
      })),
      current_item_id: state.activeItemIds.length ? state.activeItemIds[0] : null,
      active_item_ids: [...state.activeItemIds],
      priority_queue: [...state.priorityQueue],
      start_all_active: state.startAllActive,
      start_all_success: state.startAllSuccess,
      start_all_started: state.startAllStarted,
      clear_after_current: state.clearAfterCurrent,
      current_page: 1,
    };
    try {
      await invoke("save_queue_state", { queueState: payload });
    } catch (e) {
      console.error("Queue persist failed:", e);
    }
  }, 120);
}

// Hydrate state from Tauri
let hydratePromise: Promise<void> | null = null;
async function hydrate(): Promise<void> {
  try {
    const data = await invoke<any>("get_queue_state");
    const cfg = getCurrentConfig();
    state.maxConcurrent = cfg.maximum_concurrent_processes || 3;

    state.items = Array.isArray(data?.items)
      ? data.items.map((raw: any) => ({
          id: String(raw.id || Math.random().toString(36).substring(2, 9)),
          itemType: (raw.item_type || raw.itemType || raw.type || "download") as any,
          title: String(raw.title || t("common.unknownTitle")),
          thumbnail: String(raw.thumbnail || ""),
          status: raw.status === "downloading" ? "pending" : (raw.status || "pending"),
          progress: raw.status === "downloading" ? 0 : (Number(raw.progress) || 0),
          eta: String(raw.eta || "--"),
          listProgress: null,
          addedAt: Number(raw.added_at || raw.addedAt) || Date.now(),
          payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {},
          path: String(raw.path || ""),
          taskId: null,
          skippedByStop: Boolean(raw.skipped_by_stop || raw.skippedByStop),
          startReason: null,
          pendingStartReason: raw.pending_start_reason || raw.pendingStartReason || null,
          source: String(raw.source || "queue"),
        }))
      : [];

    state.activeItemIds = [];
    state.priorityQueue = Array.isArray(data?.priority_queue || data?.priorityQueue)
      ? (data.priority_queue || data.priorityQueue).filter((id: string) => state.items.some((i) => i.id === id))
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

// Queue Processing Engines
export async function startItem(item: QueueItem, reason: string) {
  if (item.status === "downloading") return;
  item.status = "downloading";
  item.progress = 0;
  item.eta = "--";
  item.taskId = item.id;
  item.startReason = reason;
  item.pendingStartReason = null;
  item.skippedByStop = false;
  
  if (!state.activeItemIds.includes(item.id)) {
    state.activeItemIds.push(item.id);
  }
  
  notifyListeners();
  persistSoon();

  try {
    let tId: any = null;
    const cleanPayload = { ...item.payload, client_task_id: String(item.id) };

    if (item.itemType === "convert") {
      tId = await invoke("start_convert", { options: cleanPayload });
    } else if (item.itemType === "compress") {
      tId = await invoke("start_compress", { options: cleanPayload });
    } else {
      tId = await invoke("start_download", { options: cleanPayload });
    }

    // Check if item has been cancelled in the meantime
    const current = state.items.find((i) => i.id === item.id);
    if (!current || current.status !== "downloading") {
      if (tId) await invoke("cancel_download", { taskId: String(tId) });
      return;
    }

    item.taskId = String(tId);
    persistSoon();
  } catch (e) {
    console.error("Start failed:", e);
    item.taskId = null;
    markFailed(item, "START_FAILED");
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
    const tId = item.taskId;
    item.status = "pending";
    item.progress = 0;
    item.eta = "--";
    item.taskId = null;
    state.activeItemIds = state.activeItemIds.filter((aid) => aid !== id);
    
    if (tId) {
      try {
        await invoke("cancel_download", { taskId: tId });
      } catch (e) {
        console.error("Cancel task failed:", e);
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

    setTimeout(() => {
      if (item.status === "downloading") {
        cancelItem(id).then(performStateRemoval);
      } else {
        performStateRemoval();
      }
    }, 320);
  } else {
    if (item.status === "downloading") {
      cancelItem(id).then(performStateRemoval);
    } else {
      performStateRemoval();
    }
  }
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
  try {
    await invoke("open_in_file_manager", { path });
  } catch (error) {
    console.error("Failed to open file manager:", error);
  }
}

export async function enqueue(
  itemType: "download" | "convert" | "compress",
  payload: Record<string, any>,
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
    listProgress: null,
    addedAt: Date.now(),
    payload: { ...payload },
    path: meta?.path || "",
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

// React hooks wrapper
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

// Listeners for backend events
listen("download-event", (event: any) => {
  const payload = event.payload;
  if (!payload || payload.type === "metadata" || !payload.id) return;
  const item = state.items.find((i) => i.id === String(payload.id));
  if (!item) return;

  // Sync log output with console if needed (via window)
  const win = window as any;
  if (win.queueConsole && typeof win.queueConsole.log === "function") {
    win.queueConsole.log(item.id, payload);
  }

  if (
    payload.type === "progress" ||
    payload.type === "progress_ffmpeg" ||
    typeof payload.percent !== "undefined" ||
    typeof payload.progress !== "undefined"
  ) {
    let p = payload.percent;
    if (typeof p === "undefined") p = payload.progress;
    if (typeof p === "undefined") p = payload.percentage;
    const n = parseProgressValue(p, payload);
    if (Number.isFinite(n)) {
      item.progress = Math.min(Math.max(n, 0), 100);
    }

    if (typeof payload.eta_seconds !== "undefined") {
      const total = Math.max(0, Math.floor(Number(payload.eta_seconds) || 0));
      const h = Math.floor(total / 3600);
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
      const s = String(total % 60).padStart(2, "0");
      item.eta = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    } else if (typeof payload.eta !== "undefined") {
      item.eta = String(payload.eta);
    }

    const index = Number(payload.item_index);
    const count = Number(payload.item_count);
    if (Number.isFinite(index) && Number.isFinite(count)) {
      item.listProgress = `${Math.max(1, Math.floor(index))}/${Math.max(1, Math.floor(count))}`;
    }

    notifyListeners();
    persistSoon();
  }

  if (payload.type === "cancelled") {
    item.status = "pending";
    item.progress = 0;
    item.eta = "--";
    item.taskId = null;
    item.skippedByStop = true;
    item.startReason = null;
    state.activeItemIds = state.activeItemIds.filter((aid) => aid !== item.id);
    
    notifyListeners();
    persistSoon();
    maybeStartNext();
    return;
  }

  const finished = payload.type === "finished" || payload.status === "finished" || payload.event === "finished";
  const success = payload.success === true || payload.status === "success" || payload.event === "success";
  const failure = payload.success === false || payload.status === "error" || payload.event === "error";

  if (finished || success || failure) {
    if (success) {
      markCompleted(item);
    } else {
      markFailed(item, payload.error || payload.code || payload.reason || "UNKNOWN");
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
      const rect = source as any;
      startX = rect.left + (rect.width || 0) / 2;
      startY = rect.top + (rect.height || 0) / 2;
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

const win = window as any;
win.queueManager = {
  enqueue,
  refreshConfig,
  clearQueue,
  startAll,
  stopAll,
  startItem: startItemById,
  cancelItem,
  removeItem,
  animateQueueOrb,
};
win.refreshConfig = refreshConfig;