import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "./tauri";
import { loadFormatCatalog, normalizeFormatCatalog } from "./formats";

vi.mock("./tauri", () => ({ invoke: vi.fn() }));

describe("normalizeFormatCatalog", () => {
  it("keeps only usable format entries and sanitizes codec lists", () => {
    expect(normalizeFormatCatalog({
      cformats: [
        { id: " mp4 ", type: "video", video_codecs: ["h264", 4] },
        { id: "", type: "video" },
        { id: "bad", type: "unknown" },
      ],
    })).toEqual({
      dformats: [],
      cformats: [{ id: "mp4", type: "video", video_codecs: ["h264"] }],
    });
  });
});

describe("loadFormatCatalog", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows retry after a failed backend request and then caches the valid catalog", async () => {
    vi.mocked(invoke)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ dformats: [{ id: "mp4", type: "video" }], cformats: [] });

    await expect(loadFormatCatalog()).resolves.toEqual({ dformats: [], cformats: [] });
    await expect(loadFormatCatalog()).resolves.toEqual({
      dformats: [{ id: "mp4", type: "video" }],
      cformats: [],
    });
    await loadFormatCatalog();

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});