import type { Preset } from "../../services/presets";

export interface DownloaderFormat {
  format_id?: string;
  format_note?: string;
  width?: number | null;
  height?: number | null;
  note?: string;
  resolution?: string;
  vcodec?: string | null;
  acodec?: string | null;
  fps?: number | null;
}

export interface DownloaderMetadata {
  webpage_url?: string;
  duration?: number | string;
  duration_string?: string;
  _type?: string;
  formats?: DownloaderFormat[];
  subtitles_langs?: string[];
  auto_captions_langs?: string[];
  title?: string;
  channel?: string;
  thumbnail?: string;
  uploader?: string;
  uploader_url?: string;
}

export interface DownloaderSearchResult {
  id?: string;
  url?: string;
  title?: string;
  thumbnail?: string;
  duration?: number | string;
  [field: string]: unknown;
}

export interface SubtitleOption {
  code: string;
  languageName: string;
  countryName: string;
  flag: string;
}

export interface DownloaderEvent {
  id?: string;
  type?: string;
  success?: boolean;
  error?: string;
  data?: DownloaderSearchResult[];
}

export interface DownloadPayload extends Record<string, unknown> {
  url: string;
  path: string;
  custom_filename?: string;
  mode: "video" | "audio";
  video_format: string | null;
  video_quality: string | null;
  audio_format: string | null;
  audio_quality: string | null;
  video_codec?: string;
  audio_codec?: string;
  video_bitrate?: string;
  audio_bitrate?: string;
  video_fps?: string;
  audio_sample_rate?: string;
  is_time_range_active: boolean;
  start_time: string;
  end_time: string;
  skip_sponsors: boolean;
  embed_tags: boolean;
  embed_thumbnail: boolean;
  mute_audio: boolean;
  download_subs: boolean;
  download_chat: boolean;
  subs_code: string;
  embed_subs: boolean;
  meta_sub_langs: string[];
  meta_auto_langs: string[];
  custom_args?: string[];
}

export type DownloaderPreset = Preset;