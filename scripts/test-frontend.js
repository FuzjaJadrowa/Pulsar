import test from "node:test";
import assert from "node:assert/strict";

import { formatBytes, formatDuration, eta, detectSourceFromUrl } from "../src/utils/format.js";

test("formatBytes tests", () => {
  assert.equal(formatBytes(null), "--");
  assert.equal(formatBytes(undefined), "--");
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatBytes(1048576), "1.00 MB");
  assert.equal(formatBytes(1073741824), "1.00 GB");
});

test("formatDuration tests", () => {
  assert.equal(formatDuration(null), "--:--:--");
  assert.equal(formatDuration(0), "00:00:00");
  assert.equal(formatDuration(65), "00:01:05");
  assert.equal(formatDuration(3665), "01:01:05");
});

test("eta tests", () => {
  assert.equal(eta(0), "--");
  assert.equal(eta(45), "00:45");
  assert.equal(eta(3665), "1:01:05");
});

test("detectSourceFromUrl tests", () => {
  assert.equal(detectSourceFromUrl("https://www.youtube.com/watch?v=123"), "youtube");
  assert.equal(detectSourceFromUrl("https://music.youtube.com/watch?v=123"), "ytmusic");
  assert.equal(detectSourceFromUrl("https://soundcloud.com/artist/track"), "soundcloud");
  assert.equal(detectSourceFromUrl("https://open.spotify.com/track/123"), "spotify");
  assert.equal(detectSourceFromUrl("invalid-url"), null);
});