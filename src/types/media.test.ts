import { describe, expect, it } from "vitest";
import { isMediaFileMetadata } from "./media";

describe("isMediaFileMetadata", () => {
  it("requires a non-empty file path before accepting metadata", () => {
    expect(isMediaFileMetadata({ path: "C:/media/video.mp4", category: "video" })).toBe(true);
    expect(isMediaFileMetadata({ path: "  " })).toBe(false);
    expect(isMediaFileMetadata({ category: "video" })).toBe(false);
    expect(isMediaFileMetadata(null)).toBe(false);
  });
});