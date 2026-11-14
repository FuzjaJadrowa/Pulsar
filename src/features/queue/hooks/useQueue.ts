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

export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>(getQueueItems());

  useEffect(() => {
    void ensureHydrated();
    return subscribeToQueue(setItems);
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
    activeItemIds: getActiveQueueItemIds(),
  };
}