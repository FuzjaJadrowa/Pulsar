import { describe, expect, it } from "vitest";
import { detectSourceFromUrl, eta, formatBytes, formatDuration } from "./format";

describe("media value formatting", () => {
  it("keeps byte units stable at unit boundaries and for non-finite input", () => {
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1024 ** 4)).toBe("1.00 TB");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("--");
  });

  it("normalizes negative and fractional durations before rendering", () => {
    expect(formatDuration(-4)).toBe("00:00:00");
    expect(formatDuration(65.9)).toBe("00:01:05");
    expect(eta(3600)).toBe("1:00:00");
  });

  it("recognizes supported source hosts without accepting lookalike domains", () => {
    expect(detectSourceFromUrl("https://music.youtube.com/watch?v=x")).toBe("ytmusic");
    expect(detectSourceFromUrl("https://youtu.be/x")).toBe("youtube");
    expect(detectSourceFromUrl("https://youtube.com.attacker.example/watch?v=x")).toBeNull();
    expect(detectSourceFromUrl("not a url")).toBeNull();
  });
});