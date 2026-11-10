import { describe, expect, it } from "vitest";
import { resolveMetadataEvent } from "./metadataEvents";

describe("metadata request flow", () => {
  it("ignores stale events and keeps the active request pending until its metadata arrives", () => {
    const taskId = "current-task";
    expect(resolveMetadataEvent({ id: "old-task", type: "metadata", success: true, data: { title: "Old" } }, taskId))
      .toEqual({ kind: "ignore" });
    expect(resolveMetadataEvent({ id: taskId, type: "progress" }, taskId)).toEqual({ kind: "pending" });
    expect(resolveMetadataEvent({ id: taskId, type: "metadata", success: true, data: { title: "Clip" } }, taskId))
      .toEqual({ kind: "success", data: { title: "Clip" } });
  });

  it("finishes the active request with bridge errors or the fallback for invalid metadata", () => {
    expect(resolveMetadataEvent({ id: "current-task", type: "finished", success: false, error: "unsupported media" }, "current-task"))
      .toEqual({ kind: "error", message: "unsupported media" });
    expect(resolveMetadataEvent({ id: "current-task", type: "metadata", success: false }, "current-task"))
      .toEqual({ kind: "error", message: null });
  });
});