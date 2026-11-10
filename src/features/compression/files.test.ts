import { describe, expect, it } from "vitest";
import { extractFileName, extractFolderPath, normalizeFormatKey, parseSizeInput } from "./files";

describe("compression file inputs", () => {
  it("parses user size units and rejects ambiguous or overflowing values", () => {
    expect(parseSizeInput("1,5 MiB")).toBe(1_572_864);
    expect(parseSizeInput("20 KB")).toBe(20_480);
    expect(parseSizeInput("20")).toBeNull();
    expect(parseSizeInput("999999999999999999999999 TB")).toBeNull();
  });

  it("handles Windows paths and normalized extensions consistently", () => {
    expect(extractFolderPath("C:\\Media\\clip.mp4")).toBe("C:\\Media");
    expect(extractFileName("C:\\Media\\clip.mp4")).toBe("clip.mp4");
    expect(normalizeFormatKey("...MP4")).toBe("mp4");
  });
});