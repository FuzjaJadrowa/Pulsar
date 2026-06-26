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
  geo_bypass: boolean;
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
const listeners = new Set<(presets: Preset[]) => void>();

function notifyListeners() {
  listeners.forEach((l) => l([...cachedPresets]));
}

export async function listPresets(): Promise<Preset[]> {
  try {
    const list = await invoke<Preset[]>("list_presets");
    if (Array.isArray(list)) {
      cachedPresets = list;
      notifyListeners();
    }
  } catch (error) {
    console.error("Failed to list presets:", error);
  }
  return cachedPresets;
}

export async function savePreset(preset: Preset): Promise<string> {
  const result = await invoke<string>("save_preset", { preset });
  await listPresets();
  return result;
}

export async function loadPreset(id: string): Promise<Preset> {
  return await invoke<Preset>("load_preset", { id });
}

export async function deletePreset(id: string): Promise<void> {
  await invoke("delete_preset", { id });
  await listPresets();
}

export async function exportPreset(id: string): Promise<void> {
  await invoke("export_preset", { id });
}

export async function importPreset(): Promise<void> {
  await invoke("import_preset");
  await listPresets();
}

export async function setPresetHidden(id: string, hidden: boolean): Promise<void> {
  await invoke("set_preset_hidden", { id, hidden });
  await listPresets();
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