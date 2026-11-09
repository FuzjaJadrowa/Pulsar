import { describe, expect, it } from "vitest";
import { restoreQueueItems } from "./model";

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
