import { describe, expect, it } from "vitest";
import { applyQueueEventToItem, parseProgressValue, restoreQueueItems } from "./model";
import type { QueueItem } from "./queue";

function createQueueItem(): QueueItem {
  return {
    id: "task-1",
    itemType: "convert",
    title: "clip.mp4",
    thumbnail: "",
    status: "downloading",
    progress: 0,
    eta: "--",
    listProgress: null,
    addedAt: 1,
    payload: {},
    path: "",
    taskId: "bridge-task-1",
    skippedByStop: false,
    startReason: "convert",
    pendingStartReason: null,
    source: "queue",
  };
}

describe("restoreQueueItems", () => {
  it("requeues interrupted work instead of restoring a stuck active task", () => {
    const [item] = restoreQueueItems(
      [{ id: "task-1", item_type: "convert", status: "downloading", progress: 67 }],
      "Unknown",
    );

    expect(item).toMatchObject({
      id: "task-1",
      itemType: "convert",
      status: "pending",
      progress: 0,
      taskId: null,
    });
  });

  it("normalizes legacy fields and rejects unknown item types", () => {
    const [item] = restoreQueueItems(
      [{ id: "legacy", itemType: "other", added_at: 123, skipped_by_stop: true }],
      "Unknown",
    );

    expect(item).toMatchObject({
      itemType: "download",
      addedAt: 123,
      skippedByStop: true,
      title: "Unknown",
    });
  });

  it("treats a malformed persisted value as an empty queue", () => {
    expect(restoreQueueItems(null, "Unknown")).toEqual([]);
  });

  it("sanitizes invalid persisted status and out-of-range progress", () => {
    const [item] = restoreQueueItems([{ status: "running-unknown", progress: 140 }], "Unknown");
    expect(item.status).toBe("pending");
    expect(item.progress).toBe(100);
  });
});

describe("parseProgressValue", () => {
  it("accepts percent payloads and rejects malformed numeric strings", () => {
    expect(parseProgressValue(" 42.5% ")).toBe(42.5);
    expect(parseProgressValue(Number.POSITIVE_INFINITY)).toBe(0);
    expect(parseProgressValue("42oops")).toBe(0);
  });
});

describe("queue event flow", () => {
  it("applies progress, output path, ETA, and batch position to the matching item", () => {
    const item = createQueueItem();
    const changes = applyQueueEventToItem(item, {
      id: "bridge-task-1",
      type: "progress_ffmpeg",
      progress: "42.5%",
      filepath: " C:\\Media\\output.mp4 ",
      eta_seconds: 65,
      item_index: 2,
      item_count: 5,
    });

    expect(changes.progressUpdated).toBe(true);
    expect(item).toMatchObject({
      progress: 42.5,
      path: "C:\\Media\\output.mp4",
      eta: "01:05",
      listProgress: "2/5",
    });
  });

  it("resets cancellation and reports later terminal outcomes for the queue listener", () => {
    const item = createQueueItem();
    item.progress = 63;
    item.eta = "00:20";

    expect(applyQueueEventToItem(item, { id: "bridge-task-1", type: "cancelled" }).cancelled).toBe(true);
    expect(item).toMatchObject({
      status: "pending",
      progress: 0,
      eta: "--",
      taskId: null,
      skippedByStop: true,
      startReason: null,
    });

    const failed = applyQueueEventToItem(item, { id: "bridge-task-1", type: "finished", success: false, error: "encoder failed" });
    expect(failed).toMatchObject({ finished: true, success: false, error: "encoder failed" });
    expect(item.status).toBe("pending");

    const completed = applyQueueEventToItem(item, { id: "bridge-task-1", type: "finished", success: true });
    expect(completed).toMatchObject({ finished: true, success: true });
  });

  it("ignores metadata events in the download queue", () => {
    const item = createQueueItem();
    const before = { ...item };

    expect(applyQueueEventToItem(item, { id: "bridge-task-1", type: "metadata", success: true }).progressUpdated).toBe(false);
    expect(item).toEqual(before);
  });
});