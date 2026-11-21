import { useState, useEffect } from "react";
import { invoke } from "./tauri";

export interface PresetDownloaderOptions {
  mode: string;
  format: string;
  path?: string;
  video_quality?: string;
  audio_quality?: string;
  download_subtitles: boolean;
  embed_subtitles: boolean;
  subtitles_code?: string;
  embed_metadata: boolean;
  embed_thumbnail: boolean;
  skip_sponsors: boolean;
  mute_audio: boolean;
  video_codec?: string;
  audio_codec?: string;
  video_bitrate?: string;
  audio_bitrate?: string;
  video_fps?: string;
  audio_sample_rate?: string;
}

export interface PresetConverterOptions {
  format: string;
  path?: string;
  video_quality?: string;
  video_codec?: string;
  video_bitrate?: string;
  video_fps?: string;
  audio_codec?: string;
  audio_bitrate?: string;
  audio_sample_rate?: string;
}

export interface PresetCompressorOptions {
  mode: string;
  target_percent?: number;
  target_size?: string;
  crf?: number;
}

export interface Preset {
  id?: string;
  title: string;
  summary: string;
  preset_type: "downloader" | "converter" | "compressor";
  hidden: boolean;
  icon_data_url: string;
  icon?: string; // fallback mapping if needed
  downloader?: PresetDownloaderOptions;
  converter?: PresetConverterOptions;
  compressor?: PresetCompressorOptions;
}

let cachedPresets: Preset[] = [];
let listPresetsPromise: Promise<Preset[]> | null = null;
let listPresetsRequestId = 0;
const listeners = new Set<(presets: Preset[]) => void>();

function notifyListeners() {
  listeners.forEach((l) => l([...cachedPresets]));
}

export function getPresetFromCache(id: string): Preset | undefined {
  return cachedPresets.find((p) => p.id === id);
}

export function listPresets(forceRefresh = false): Promise<Preset[]> {
  if (forceRefresh || !listPresetsPromise) {
    const requestId = ++listPresetsRequestId;
    const request = invoke<Preset[]>("list_presets")
      .then((list) => {
        if (requestId === listPresetsRequestId && Array.isArray(list)) {
          cachedPresets = list;
          notifyListeners();
        }
        return cachedPresets;
      })
      .catch((error) => {
        console.error("Failed to list presets:", error);
        return cachedPresets;
      })
      .finally(() => {
        if (listPresetsPromise === request) listPresetsPromise = null;
      });
    listPresetsPromise = request;
  }

  return listPresetsPromise!;
}

export async function savePreset(preset: Preset): Promise<string> {
  const result = await invoke<string>("save_preset", { preset });
  await listPresets(true);
  return result;
}

export async function loadPreset(id: string): Promise<Preset> {
  return await invoke<Preset>("load_preset", { id });
}

export async function deletePreset(id: string): Promise<void> {
  cachedPresets = cachedPresets.filter((p) => p.id !== id);
  notifyListeners();
  try {
    await invoke("delete_preset", { id });
  } catch (error) {
    console.error("Failed to delete preset:", error);
  }
  await listPresets(true);
}

export async function exportPreset(id: string): Promise<void> {
  await invoke("export_preset", { id });
}

export async function importPreset(): Promise<void> {
  await invoke("import_preset");
  await listPresets(true);
}

export async function setPresetHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  cachedPresets = cachedPresets.map((p) =>
    p.id === id ? { ...p, hidden } : p,
  );
  notifyListeners();
  try {
    await invoke("set_preset_hidden", { id, hidden });
  } catch (error) {
    console.error("Failed to set preset hidden:", error);
  }
  await listPresets(true);
}

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>(cachedPresets);

  useEffect(() => {
    const handler = (updated: Preset[]) => setPresets(updated);
    listeners.add(handler);
    listPresets(); // Initial fetch
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    presets,
    refreshPresets: listPresets,
    deletePreset,
    exportPreset,
    importPreset,
    setPresetHidden,
    loadPreset,
    savePreset,
  };
}
