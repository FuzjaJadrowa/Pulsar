import type { Preset, PresetCompressorOptions } from "../../services/presets";

export interface PresetFormValues {
  mode: "create" | "edit";
  presetId?: string | null;
  title: string;
  summary: string;
  iconDataUrl: string;
  presetType: Preset["preset_type"];
  format: string;
  compressMode: "percent" | "size" | "quality";
  compressPercent: number | "";
  compressSize: string;
  compressCrf: string;
  savePath: string;
  downloadSubs: boolean;
  embedSubs: boolean;
  subsCode: string;
  embedMetadata: boolean;
  embedThumbnail: boolean;
  skipSponsors: boolean;
  muteAudio: boolean;
  videoQuality: string;
  videoCodec: string;
  videoBitrate: string;
  videoFps: string;
  audioSampleRate: string;
  audioCodec: string;
  audioBitrate: string;
}

export function buildPresetPayload(values: PresetFormValues): Preset {
  const path = values.savePath.trim() || undefined;
  const payload: Preset = {
    id: values.mode === "edit" ? values.presetId || undefined : undefined,
    title: values.title.trim(),
    summary: values.summary.trim(),
    icon_data_url: values.iconDataUrl,
    preset_type: values.presetType,
    hidden: false,
  };

  if (values.presetType === "downloader") {
    payload.downloader = {
      mode: "video",
      format: values.format.trim().toLowerCase(),
      path,
      video_quality: values.videoQuality || undefined,
      download_subtitles: values.downloadSubs,
      embed_subtitles: values.downloadSubs && values.embedSubs,
      subtitles_code: values.downloadSubs && values.subsCode.trim() ? values.subsCode.trim() : undefined,
      embed_metadata: values.embedMetadata,
      embed_thumbnail: values.embedThumbnail,
      skip_sponsors: values.skipSponsors,
      mute_audio: values.muteAudio,
      video_codec: values.videoCodec || undefined,
      audio_codec: values.audioCodec || undefined,
      video_bitrate: values.videoBitrate || undefined,
      audio_bitrate: values.audioBitrate || undefined,
      video_fps: values.videoFps || undefined,
      audio_sample_rate: values.audioSampleRate || undefined,
    };
  } else if (values.presetType === "converter") {
    payload.converter = {
      format: values.format.trim().toLowerCase(),
      path,
      video_quality: values.videoQuality || undefined,
      video_codec: values.videoCodec || undefined,
      video_bitrate: values.videoBitrate || undefined,
      video_fps: values.videoFps || undefined,
      audio_codec: values.audioCodec || undefined,
      audio_bitrate: values.audioBitrate || undefined,
      audio_sample_rate: values.audioSampleRate || undefined,
    };
  } else {
    const compressor: PresetCompressorOptions = {
      mode: values.compressMode,
      target_percent: values.compressMode === "percent"
        ? (typeof values.compressPercent === "number" ? values.compressPercent : undefined)
        : undefined,
      target_size: values.compressMode === "size" ? values.compressSize : undefined,
      crf: values.compressMode === "quality" ? parseInt(values.compressCrf) || undefined : undefined,
    };
    payload.compressor = compressor;
  }

  return payload;
}

export function isPresetFormValid(
  values: Pick<PresetFormValues, "title" | "presetType" | "format" | "compressMode" | "compressPercent" | "compressSize" | "compressCrf">,
  isFormatValid: boolean,
): boolean {
  if (!values.title.trim()) return false;
  if (values.presetType !== "compressor" && (!values.format.trim() || !isFormatValid)) return false;

  if (values.presetType !== "compressor") return true;
  if (values.compressMode === "percent") {
    return typeof values.compressPercent === "number" && values.compressPercent >= 1 && values.compressPercent <= 100;
  }
  if (values.compressMode === "size") return values.compressSize.trim().length > 0;
  return Boolean(values.compressCrf);
}