import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFormatCatalog } from "./formats";

describe("loadFormatCatalog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("allows retry after a failed request and then caches the valid catalog", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dformats: [{ id: "mp4", type: "video" }], cformats: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadFormatCatalog()).resolves.toEqual({ dformats: [], cformats: [] });
    await expect(loadFormatCatalog()).resolves.toEqual({
      dformats: [{ id: "mp4", type: "video" }],
      cformats: [],
    });
    await loadFormatCatalog();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
