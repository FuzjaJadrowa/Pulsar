import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration, eta, detectSourceFromUrl } from "./format";

describe("formatBytes", () => {
  it("returns '--' for invalid or null inputs", () => {
    expect(formatBytes(null)).toBe("--");
    expect(formatBytes(undefined)).toBe("--");
    expect(formatBytes(NaN)).toBe("--");
  });

  it("formats bytes under 1024", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats kilobytes and megabytes correctly", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });
});

describe("formatDuration", () => {
  it("returns '--:--:--' for invalid inputs", () => {
    expect(formatDuration(null)).toBe("--:--:--");
    expect(formatDuration(undefined)).toBe("--:--:--");
  });

  it("formats 0 seconds correctly", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formats minutes and hours", () => {
    expect(formatDuration(65)).toBe("00:01:05");
    expect(formatDuration(3665)).toBe("01:01:05");
  });
});

describe("eta", () => {
  it("returns '--' for zero or invalid inputs", () => {
    expect(eta(0)).toBe("--");
    expect(eta(null)).toBe("--");
  });

  it("formats seconds and hours ETA correctly", () => {
    expect(eta(45)).toBe("00:45");
    expect(eta(3665)).toBe("1:01:05");
  });
});

describe("detectSourceFromUrl", () => {
  it("detects YouTube URLs", () => {
    expect(detectSourceFromUrl("https://www.youtube.com/watch?v=abc1234")).toBe("youtube");
    expect(detectSourceFromUrl("https://youtu.be/abc1234")).toBe("youtube");
  });

  it("detects YouTube Music URLs", () => {
    expect(detectSourceFromUrl("https://music.youtube.com/watch?v=abc1234")).toBe("ytmusic");
  });

  it("detects SoundCloud URLs", () => {
    expect(detectSourceFromUrl("https://soundcloud.com/artist/track")).toBe("soundcloud");
  });

  it("detects Spotify URLs", () => {
    expect(detectSourceFromUrl("https://open.spotify.com/track/123")).toBe("spotify");
  });

  it("returns null for unknown URLs", () => {
    expect(detectSourceFromUrl("https://example.com")).toBe(null);
    expect(detectSourceFromUrl("invalid")).toBe(null);
  });
});
