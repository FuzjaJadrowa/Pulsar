import { describe, expect, it } from "vitest";
import {
  detectPathSeparator,
  extractFileName,
  extractFolderPath,
  joinPath,
} from "./path";

describe("cross-platform path utilities", () => {
  it("extracts folder paths preserving POSIX and Windows separators", () => {
    expect(extractFolderPath("/home/user/videos/clip.mp4")).toBe(
      "/home/user/videos",
    );
    expect(extractFolderPath("/clip.mp4")).toBe("/");
    expect(extractFolderPath("C:\\Media\\clip.mp4")).toBe("C:\\Media");
    expect(extractFolderPath("C:\\clip.mp4")).toBe("C:\\");
    expect(extractFolderPath("C:/Media/clip.mp4")).toBe("C:/Media");
    expect(extractFolderPath("C:/clip.mp4")).toBe("C:/");
    expect(extractFolderPath("\\\\server\\share\\clip.mp4")).toBe(
      "\\\\server\\share",
    );
    expect(extractFolderPath("clip.mp4")).toBe("");
    expect(extractFolderPath("   ")).toBe("");
  });

  it("extracts file names across POSIX and Windows paths", () => {
    expect(extractFileName("/home/user/videos/clip.mp4")).toBe("clip.mp4");
    expect(extractFileName("/clip.mp4")).toBe("clip.mp4");
    expect(extractFileName("C:\\Media\\clip.mp4")).toBe("clip.mp4");
    expect(extractFileName("clip.mp4")).toBe("clip.mp4");
    expect(extractFileName("")).toBe("");
  });

  it("joins paths using the separator of the base directory", () => {
    expect(joinPath("/home/user", "clip.mp4")).toBe("/home/user/clip.mp4");
    expect(joinPath("/", "clip.mp4")).toBe("/clip.mp4");
    expect(joinPath("C:\\Media", "clip.mp4")).toBe("C:\\Media\\clip.mp4");
    expect(joinPath("C:\\", "clip.mp4")).toBe("C:\\clip.mp4");
    expect(joinPath("", "clip.mp4")).toBe("clip.mp4");
    expect(detectPathSeparator("/home/user")).toBe("/");
    expect(detectPathSeparator("C:\\Media")).toBe("\\");
  });
});
