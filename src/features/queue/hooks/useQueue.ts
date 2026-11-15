import { useEffect, useState } from "react";
import {
  cancelItem,
  clearQueue,
  enqueue,
  ensureHydrated,
  getActiveQueueItemIds,
  getQueueItems,
  openInFileManager,
  removeItem,
  startAll,
  startItemById,
  stopAll,
  subscribeToQueue,
  type QueueItem,
} from "../queue";

export function useQueue(enabled = true) {
  const [items, setItems] = useState<QueueItem[]>(getQueueItems());

  useEffect(() => {
    void ensureHydrated();
    if (!enabled) return;
    setItems(getQueueItems());
    return subscribeToQueue(setItems);
  }, [enabled]);

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
    activeItemIds: getActiveQueueItemIds(),
  };
}

export function useQueueCount() {
  const [count, setCount] = useState(() => getQueueItems().length);

  useEffect(() => {
    const handleQueueUpdated = (event: Event) => {
      const nextCount = Number((event as CustomEvent<{ count?: number }>).detail?.count);
      if (Number.isFinite(nextCount)) {
        setCount((current) => current === nextCount ? current : nextCount);
      }
    };

    window.addEventListener("pulsar-queue-updated", handleQueueUpdated);
    void ensureHydrated();
    return () => window.removeEventListener("pulsar-queue-updated", handleQueueUpdated);
  }, []);

  return count;
}