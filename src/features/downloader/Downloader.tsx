import { ICON_ASSETS } from "../../utils/icons";
import React, { useState, useEffect, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../services/i18n";
import { invoke, listen } from "../../services/tauri";
import { useConfig } from "../../services/config";
import { usePresets } from "../../services/presets";
import { enqueue, animateQueueOrb } from "../queue/queue";
import { useUiState } from "../../services/uiState";
import { showNotification } from "../../services/notifications";
import { detectSourceFromUrl, formatDuration } from "../../utils/format";
import { SOURCE_ICONS, SourceIcon } from "../../utils/icons";
import { PathSelector } from "../../components/PathSelector";
import { CustomSelect } from "../../components/CustomSelect";
import { PresetGrid } from "../../components/PresetGrid";
import { useTauriMetadata } from "../../hooks/useTauriMetadata";
import { sanitizeBitrateInput } from "../../utils/bitrate";
import type { DownloadPayload, DownloaderEvent, DownloaderFormat, DownloaderMetadata, DownloaderPreset, DownloaderSearchResult, SubtitleOption } from "./types";

const videoQualities = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];
const videoFormats = ["MP4", "MKV", "WEBM", "MOV", "FLV", "AVI", "GIF"];
const audioFormats = ["MP3", "M4A", "AAC", "OPUS", "WAV", "FLAC", "AIFF", "OGG"];
const audioQualities = ["320kbps", "256kbps", "192kbps", "128kbps", "96kbps"];

const hasCodec = (codec?: string | null) => !!codec?.trim() && codec.trim().toLowerCase() !== "none";

const codecMatches = (requested: string, source?: string | null) => {
  const wanted = requested.trim().toLowerCase();
  const found = (source || "").trim().toLowerCase();
  if (!wanted || !found || found === "none") return false;
  const prefixes: Record<string, string[]> = {
    h264: ["h264", "avc1", "avc3"], h265: ["h265", "hevc", "hev1", "hvc1"], hevc: ["h265", "hevc", "hev1", "hvc1"],
    av1: ["av1", "av01"], vp9: ["vp9", "vp09"], vp8: ["vp8", "vp08"], aac: ["aac", "mp4a"], opus: ["opus"],
    vorbis: ["vorbis"], mp3: ["mp3"], flac: ["flac"], alac: ["alac"],
  };
  return (prefixes[wanted] || [wanted]).some((prefix) => found.startsWith(prefix));
};

const metadataHasOnlyAudioSources = (formats: DownloaderFormat[] = []) => {
  const codecFormats = formats.filter((format) => hasCodec(format.vcodec) || hasCodec(format.acodec));
  return codecFormats.length > 0 && codecFormats.every((format) => hasCodec(format.acodec) && !hasCodec(format.vcodec));
};

import { getFormatEntrySync, loadFormatCatalog } from "../../services/formats";

interface DownloaderProps {
  active?: boolean;
}

export const Downloader: React.FC<DownloaderProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { presets, loadPreset } = usePresets();

  useEffect(() => {
    loadFormatCatalog().catch(() => {});
  }, []);

  const [url, setUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<DownloaderSearchResult[]>([]);
  const [searchExiting, setSearchExiting] = useState(false);
  const [provider, setProvider] = useState<"ytsearch" | "ytmsearch" | "scsearch">("ytsearch");
  const [pendingMetadataUrl, setPendingMetadataUrl] = useState<string | null>(null);

  const {
    metadata,
    isLoading: isAnalyzing,
    fetchMetadata: triggerFetchMetadata,
    reset: resetMetadataState,
    setMetadata
  } = useTauriMetadata<DownloaderMetadata>({
    pickerCommand: "fetch_metadata_downloader",
    onSuccess: (data) => {
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error"), err, "error");
    }
  });

  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [videoCodec, setVideoCodec] = useState<string>("");
  const [audioCodec, setAudioCodec] = useState<string>("");
  const [videoBitrate, setVideoBitrate] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");
  const [videoFps, setVideoFps] = useState("");
  const [audioSampleRate, setAudioSampleRate] = useState("");

  const currentFormatEntry = selectedFormat ? getFormatEntrySync(selectedFormat, false) : null;

  const downloaderVideoCodecOptions = [
    { value: "", label: t("presetCreator.select.auto") },
    ...(currentFormatEntry?.video_codecs || []).map((vc) => ({
      value: vc.toLowerCase(),
      label: vc,
    })),
  ];

  const downloaderAudioCodecOptions = [
    { value: "", label: t("presetCreator.select.auto") },
    ...(currentFormatEntry?.audio_codecs || []).map((ac) => ({
      value: ac.toLowerCase(),
      label: ac,
    })),
  ];

  const displayedVideoCodec = videoCodec;
  const displayedAudioCodec = audioCodec;

  useEffect(() => {
    if (videoCodec && !downloaderVideoCodecOptions.some((opt) => opt.value === videoCodec)) {
      setVideoCodec("");
    }
    if (audioCodec && !downloaderAudioCodecOptions.some((opt) => opt.value === audioCodec)) {
      setAudioCodec("");
    }
  }, [selectedFormat, videoCodec, audioCodec]);
  const [savePath, setSavePath] = useState("");
  const [customFilename, setCustomFilename] = useState("");
  const [filenameDraft, setFilenameDraft] = useState("");
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const filenameEditOriginalRef = useRef("");

  const [rangeStart, setRangeStart] = useState<number>(0);
  const [rangeEnd, setRangeEnd] = useState<number>(100);
  const [timeStart, setTimeStart] = useState<string>("00:00:00");
  const [timeEnd, setTimeEnd] = useState<string>("00:00:00");

  const [thumbnailAction, setThumbnailAction] = useState<"none" | "download" | "embed">("none");
  const [skipSponsors, setSkipSponsors] = useState(false);
  const [embedMetadata, setEmbedMetadata] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);
  const [customArgs, setCustomArgs] = useState("");

  const [subtitlesAvailable, setSubtitlesAvailable] = useState(true);
  const [downloadSubs, setDownloadSubs] = useState(false);
  const [downloadChat, setDownloadChat] = useState(false);
  const [embedSubs, setEmbedSubs] = useState(false);
  const [subsLang, setSubsLang] = useState("");
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOption[]>([]);
  const [metaSubLangs, setMetaSubLangs] = useState<string[]>([]);
  const [metaAutoLangs, setMetaAutoLangs] = useState<string[]>([]);
  const [showLangSuggestions, setShowLangSuggestions] = useState(false);
  const [langSuggestions, setLangSuggestions] = useState<SubtitleOption[]>([]);

  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [isAudioOnlySource, setIsAudioOnlySource] = useState(false);
  const [isPlaylist, setIsPlaylist] = useState(false);

  const currentSearchIdRef = useRef<string | null>(null);
  const searchRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const downloaderPresets = presets.filter(p => p.preset_type === "downloader" && !p.hidden);

  useEffect(() => {
    if (selectedFormat && selectedFormat.toLowerCase() === "gif") {
      setMuteAudio(true);
    }
  }, [selectedFormat]);

  const isGifFormat = mode === "video" && selectedFormat?.toLowerCase() === "gif";
  const showAudioCodec = mode !== "video" || (!muteAudio && !isGifFormat);

  const { updateUiState } = useUiState();

  useEffect(() => {
    if (!active) return;
    updateUiState({
      downloaderDashboardVisible: isDashboardVisible,
      downloaderSearchMode: isSearchMode,
      downloaderMode: mode,
      downloaderAudioOnlySource: isAudioOnlySource,
    });
  }, [active, isDashboardVisible, isSearchMode, mode, isAudioOnlySource, updateUiState]);

  useEffect(() => {
    let isMounted = true;
    const unsubPromise = listen<DownloaderEvent>("download-event", (event) => {
      if (!isMounted) return;
      const payload = event.payload;
      if (!payload || !payload.type) return;

      if (payload.type === "search_results" && payload.id === currentSearchIdRef.current) {
        setIsSearching(false);
        setIsDashboardVisible(false);
        resetMetadataState();
        setIsSearchMode(true);

        if (searchRevealTimerRef.current) {
          clearTimeout(searchRevealTimerRef.current);
        }
        searchRevealTimerRef.current = setTimeout(() => {
          setSearchResults(payload.data || []);
          searchRevealTimerRef.current = null;
        }, 120);
      }

      if (payload.type === "finished" && payload.id === currentSearchIdRef.current && payload.success === false) {
        setIsSearching(false);
        showNotification(t("common.error"), payload.error || t("downloader.errors.searchFailed"), "error");
        setSearchResults([]);
        setIsSearchMode(true);
      }
    });

    return () => {
      isMounted = false;
      unsubPromise.then((unsub) => unsub());
      if (searchRevealTimerRef.current) {
        clearTimeout(searchRevealTimerRef.current);
      }
    };
  }, [provider]);

  useEffect(() => {
    const q = subsLang.trim().toLowerCase();
    if (!q) {
      setLangSuggestions(subtitleOptions);
      return;
    }
    const matches = subtitleOptions.filter(entry =>
      entry.code.toLowerCase().includes(q) ||
      entry.languageName.toLowerCase().includes(q) ||
      entry.countryName.toLowerCase().includes(q)
    );
    setLangSuggestions(matches);
  }, [subsLang, subtitleOptions]);



  const looksLikeUrl = (value: string) => {
    return /^https?:\/\//i.test(value.trim());
  };

  const isAudioOnlySourceUrl = (rawUrl: string) => {
    const source = detectSourceFromUrl(rawUrl);
    return source !== null && source !== "youtube" && source !== "soundcloud";
  };

  const applySourceConstraints = (rawUrl: string) => {
    const audioOnly = isAudioOnlySourceUrl(rawUrl);
    setIsAudioOnlySource(audioOnly);
    if (audioOnly && mode === "video") {
      setMode("audio");
    }
  };

  const triggerShakeInput = () => {
    if (urlInputRef.current) {
      urlInputRef.current.classList.remove("shake-feedback");
      void urlInputRef.current.offsetWidth;
      urlInputRef.current.classList.add("shake-feedback");
    }
  };

  const handleFetch = async () => {
    const raw = url.trim();
    if (!raw) {
      triggerShakeInput();
      return;
    }

    if (looksLikeUrl(raw)) {
      setIsSearchMode(false);
      setIsDashboardVisible(false);
      setSearchResults([]);
      setSearchExiting(false);
      resetMetadataState();
      setPendingMetadataUrl(raw);
      applySourceConstraints(raw);
      triggerFetchMetadata(raw);
    } else {
      if (isSearching) return;
      if (searchRevealTimerRef.current) {
        clearTimeout(searchRevealTimerRef.current);
        searchRevealTimerRef.current = null;
      }
      setIsSearching(true);
      setIsSearchMode(false);
      setIsDashboardVisible(false);
      setSearchResults([]);
      const maxResults = config?.maximum_search_results ?? 10;
      const prefix = `${provider}${maxResults}`;
      try {
        const taskId = await invoke<string>("search", { query: raw, prefix });
        currentSearchIdRef.current = taskId;
      } catch (error) {
        console.error("Search invocation failed:", error);
        setIsSearching(false);
        currentSearchIdRef.current = null;
        showNotification(t("common.error"), t("downloader.errors.searchFailed"), "error");
      }
    }
  };

  const generateSubtitleOptions = (data: DownloaderMetadata): SubtitleOption[] => {
    const all = [...(data.subtitles_langs || []), ...(data.auto_captions_langs || [])];
    const unique = [...new Set(all.map((c) => String(c).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return unique.map((code: string) => {
      const cleanCode = code.trim();
      const normalizedCode = cleanCode.replace("_", "-");
      const parts = normalizedCode.split("-");
      const language = parts[0].toLowerCase();
      const region = (parts.find((p) => p.length === 2 && /^[a-zA-Z]{2}$/.test(p)) || "").toUpperCase();

      let languageName = language;
      let countryName = region;

      try {
        const langDisplay = new Intl.DisplayNames([config?.language || "en"], { type: "language" });
        const langResolved = langDisplay.of(language);
        if (langResolved) languageName = langResolved;
      } catch (_) {}

      if (region) {
        try {
          const regionDisplay = new Intl.DisplayNames([config?.language || "en"], { type: "region" });
          const regionResolved = regionDisplay.of(region);
          if (regionResolved) countryName = regionResolved;
        } catch (_) {}
      }

      const flag = region
        ? String.fromCodePoint(...region.split("").map((c) => 127397 + c.charCodeAt(0)))
        : "GLB";

      return {
        code: cleanCode,
        languageName,
        countryName: countryName || t("downloader.languages.global"),
        flag
      };
    });
  };

  const parseVideoQuality = (formats: DownloaderFormat[] = []) => {
    const found = new Map<string, number>();
    formats.forEach((format) => {
      if (format.vcodec?.trim().toLowerCase() === "none") return;

      const note = String(format.format_note || format.note || "");
      const resolution = String(format.resolution || "");
      const resolutionMatch = resolution.match(/\d+x(\d{2,5})/i);
      const noteMatch = note.match(/(\d{2,5})p/i);
      const formatIdMatch = String(format.format_id || "").match(/(?:^|[^\d])(\d{2,5})p(?:\d+)?(?:$|[^\d])/i);
      const height = Number(
        format.height || resolutionMatch?.[1] || noteMatch?.[1] || formatIdMatch?.[1] || 0,
      );
      const quality = videoQualities.find((entry) => Number.parseInt(entry, 10) <= height);
      if (!quality) return;

      const fps = Number(format.fps);
      const knownFps = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 0;
      found.set(quality, Math.max(found.get(quality) || 0, knownFps));
    });

    if (!found.size) return ["Best"];
    const highest = videoQualities.find((quality) => found.has(quality));
    if (!highest) return ["Best"];
    const ordered = videoQualities.slice(videoQualities.indexOf(highest)).filter((quality) =>
      Number.parseInt(quality, 10) <= Number.parseInt(highest, 10),
    );
    return ordered.map((quality) => {
      const maxFps = found.get(quality) || 0;
      return maxFps > 30 ? `${quality}${maxFps}` : quality;
    });
  };

  const handleMetadataLoaded = (data: DownloaderMetadata) => {
    setMetadata(data);
    setCustomFilename("");
    setIsEditingFilename(false);
    if (data?.webpage_url && /^https?:\/\//i.test(data.webpage_url)) {
      setUrl(data.webpage_url);
    }
    const dur = Number(data.duration) || 0;
    setDuration(dur);

    const playlist = !!(
      data._type === "playlist" ||
      data.webpage_url?.includes("list=") ||
      url.includes("list=")
    );
    setIsPlaylist(playlist);

    const parsedVideoQualities = parseVideoQuality(data.formats || []);
    setVideoQualityOptions(parsedVideoQualities);

    const subOpts = generateSubtitleOptions(data);
    setSubtitleOptions(subOpts);
    const sLangs = data.subtitles_langs?.map((language) => language.trim()).filter(Boolean) || [];
    const aLangs = data.auto_captions_langs?.map((language) => language.trim()).filter(Boolean) || [];
    setMetaSubLangs(sLangs);
    setMetaAutoLangs(aLangs);

    const hasSubtitles = sLangs.length > 0 || aLangs.length > 0;
    setSubtitlesAvailable(hasSubtitles);
    if (!hasSubtitles) {
      setDownloadSubs(false);
      setDownloadChat(false);
      setEmbedSubs(false);
    }

    const durString = formatDuration(dur);
    setTimeStart("00:00:00");
    setTimeEnd(durString);
    setRangeStart(0);
    setRangeEnd(100);

    const sourceUrl = data.webpage_url || pendingMetadataUrl || url;
    const audioOnlySource = isAudioOnlySourceUrl(sourceUrl) || metadataHasOnlyAudioSources(data.formats);
    setIsAudioOnlySource(audioOnlySource);
    const defaultMode = audioOnlySource ? "audio" : "video";
    setMode(defaultMode);
    setSelectedFormat(null);
    setSelectedQuality(null);

    if (isSearchMode) {
      setSearchExiting(true);
      setTimeout(() => {
        setIsSearchMode(false);
        setSearchExiting(false);
        setIsDashboardVisible(true);
      }, 350);
    } else {
      setTimeout(() => {
        setIsDashboardVisible(true);
      }, 150);
    }
  };

  const [videoQualityOptions, setVideoQualityOptions] = useState<string[]>(["Best"]);

  const resetToZen = (nextUrl = "") => {
    setUrl(nextUrl);
    setIsDashboardVisible(false);
    setIsSearchMode(false);
    setSearchExiting(false);
    setSearchResults([]);
    resetMetadataState();
    setPendingMetadataUrl(null);
    setDuration(0);
    setSelectedFormat(null);
    setSelectedQuality(null);
    setVideoCodec("");
    setAudioCodec("");
    setVideoBitrate("");
    setAudioBitrate("");
    setVideoFps("");
    setAudioSampleRate("");
    setSubtitleOptions([]);
    setMetaSubLangs([]);
    setMetaAutoLangs([]);
    setDownloadSubs(false);
    setDownloadChat(false);
    setEmbedSubs(false);
    setSubsLang("");
    setMuteAudio(false);
    setCustomArgs("");
    setCustomFilename("");
    setIsEditingFilename(false);
    setThumbnailAction("none");
    clearActivePreset();
    applySourceConstraints("");
  };

  const updateUrlFromInput = (nextUrl: string) => {
    if (isDashboardVisible && nextUrl.trim() !== url.trim()) {
      resetToZen(nextUrl);
      return;
    }
    setUrl(nextUrl);
  };

  const clearActivePreset = () => {
    setActivePresetId(null);
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await invoke<string>("read_clipboard_text");
      if (clipboardText) {
        updateUrlFromInput(clipboardText.trim());
      }
    } catch (e) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
          updateUrlFromInput(clipboardText.trim());
        }
      } catch (err) {
        console.error("Failed to read from clipboard:", err);
      }
    }
  };

  const handlePresetClick = async (presetSummary: DownloaderPreset) => {
    if (!presetSummary.id) return;
    if (activePresetId === presetSummary.id) {
      clearActivePreset();
      return;
    }
    try {
      const preset = await loadPreset(presetSummary.id);
      if (preset && preset.downloader) {
        const d = preset.downloader;
        setVideoBitrate(d.video_bitrate || "");
        setAudioBitrate(d.audio_bitrate || "");
        setVideoFps(d.video_fps || "");
        setAudioSampleRate(d.audio_sample_rate || "");

        if (d.path) {
          setSavePath(d.path);
        }

        const newMode = d.mode === "audio" ? "audio" : "video";
        setMode(newMode);

        setSelectedFormat(d.format ? d.format.toUpperCase() : null);
        setSelectedQuality((newMode === "video" ? d.video_quality : d.audio_quality) || null);
        setVideoCodec(d.video_codec || "");
        setAudioCodec(d.audio_codec || "");

        setSkipSponsors(!!d.skip_sponsors);
        setEmbedMetadata(!!d.embed_metadata);
        setMuteAudio(!!d.mute_audio);
        setDownloadSubs(!!d.download_subtitles);
        setEmbedSubs(!!d.embed_subtitles);
        if (d.subtitles_code) {
          setSubsLang(d.subtitles_code);
        }
        setThumbnailAction(d.embed_thumbnail ? "embed" : "none");
        setActivePresetId(presetSummary.id || null);
      }
    } catch (error) {
      console.error("Failed to load preset:", error);
    }
  };

  const handleRangeStartChange = (val: number) => {
    if (val > rangeEnd) {
      setRangeStart(rangeEnd);
      if (duration > 0) setTimeStart(formatDuration(duration * (rangeEnd / 100)));
    } else {
      setRangeStart(val);
      if (duration > 0) setTimeStart(formatDuration(duration * (val / 100)));
    }
    clearActivePreset();
  };

  const handleRangeEndChange = (val: number) => {
    if (val < rangeStart) {
      setRangeEnd(rangeStart);
      if (duration > 0) setTimeEnd(formatDuration(duration * (rangeStart / 100)));
    } else {
      setRangeEnd(val);
      if (duration > 0) setTimeEnd(formatDuration(duration * (val / 100)));
    }
    clearActivePreset();
  };

  const parseTimeToSeconds = (str: string) => {
    const parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const handleTimeStartChange = (val: string) => {
    setTimeStart(val);
    if (duration > 0) {
      const seconds = parseTimeToSeconds(val);
      let pct = (seconds / duration) * 100;
      pct = Math.max(0, Math.min(100, pct));
      if (pct > rangeEnd) {
        setRangeStart(rangeEnd);
      } else {
        setRangeStart(pct);
      }
    }
    clearActivePreset();
  };

  const handleTimeEndChange = (val: string) => {
    setTimeEnd(val);
    if (duration > 0) {
      const seconds = parseTimeToSeconds(val);
      let pct = (seconds / duration) * 100;
      pct = Math.max(0, Math.min(100, pct));
      if (pct < rangeStart) {
        setRangeEnd(rangeStart);
      } else {
        setRangeEnd(pct);
      }
    }
    clearActivePreset();
  };

  const handleSelectSearchResult = async (entry: DownloaderSearchResult) => {
    const targetUrl = resolveResultUrl(entry);
    if (!targetUrl) return;
    setUrl(targetUrl);
    setPendingMetadataUrl(targetUrl);
    triggerFetchMetadata(targetUrl);
  };

  const resolveResultUrl = (entry: DownloaderSearchResult) => {
    const raw = String(entry?.url || "").trim();
    if (raw) {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith("www.")) return `https://${raw}`;
      if (/^[\w-]{11}$/.test(raw)) return `https://www.youtube.com/watch?v=${raw}`;
      return raw;
    }
    const id = String(entry?.id || "").trim();
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    return "";
  };

  const parseCustomArgsString = (str: string) => {
    const raw = str.trim();
    if (!raw) return [];
    const args: string[] = [];
    let current = "";
    let quote: string | null = null;
    let escape = false;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (escape) {
        current += ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (quote) {
        if (ch === quote) {
          quote = null;
        } else {
          current += ch;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (/\s/.test(ch)) {
        if (current.length) {
          args.push(current);
          current = "";
        }
        continue;
      }
      current += ch;
    }
    if (current.length) args.push(current);
    return args;
  };

  const buildDownloadPayload = () => {
    const isTimeRangeActive = !isPlaylist && (rangeStart > 0 || rangeEnd < 100);
    const parsedArgs = config?.advanced_mode ? parseCustomArgsString(customArgs) : [];
    const targetUrl = (metadata?.webpage_url || pendingMetadataUrl || url).trim();
    const qualityHeight = mode === "video" ? Number.parseInt(selectedQuality || "", 10) : undefined;
    const estimatedFormats = (metadata?.formats || []).filter((format) =>
      !qualityHeight || !format.height || format.height <= qualityHeight
    );
    const largestKnownSize = (formats: DownloaderFormat[]) => Math.max(0, ...formats.map((format) => Number(format.filesize || format.filesize_approx || 0)));
    const estimatedBytes = mode === "audio"
      ? largestKnownSize(estimatedFormats.filter((format) => hasCodec(format.acodec) && !hasCodec(format.vcodec)))
      : largestKnownSize(estimatedFormats.filter((format) => hasCodec(format.vcodec)))
        + largestKnownSize(estimatedFormats.filter((format) => hasCodec(format.acodec) && !hasCodec(format.vcodec)));
    const bestVideoSource = [...estimatedFormats].filter((format) => hasCodec(format.vcodec)).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    const bestAudioSource = [...estimatedFormats].filter((format) => hasCodec(format.acodec)).sort((a, b) => Number(b.filesize || b.filesize_approx || 0) - Number(a.filesize || a.filesize_approx || 0))[0];
    const preferredVideoCodec = videoCodec || (config.default_video_codec.toLowerCase() === "auto" ? "" : config.default_video_codec);
    const preferredAudioCodec = audioCodec || (config.default_audio_codec.toLowerCase() === "auto" ? "" : config.default_audio_codec);
    const videoCodecAlreadyAvailable = !!preferredVideoCodec && codecMatches(preferredVideoCodec, bestVideoSource?.vcodec);
    const audioCodecAlreadyAvailable = !!preferredAudioCodec && codecMatches(preferredAudioCodec, bestAudioSource?.acodec);
    const otherTranscodeOptions = !!videoBitrate || !!audioBitrate || !!videoFps || !!audioSampleRate;
    const payload: DownloadPayload = {
      url: targetUrl,
      path: savePath.trim() || config.default_save_path.trim(),
      ...(customFilename.trim() ? { custom_filename: customFilename.trim() } : {}),
      mode: mode,
      video_format: mode === "video" ? selectedFormat : null,
      video_quality: mode === "video" ? selectedQuality : null,
      audio_format: mode === "audio" ? selectedFormat : null,
      audio_quality: mode === "audio" ? selectedQuality : null,
      video_codec: mode === "video" && (!videoCodecAlreadyAvailable || otherTranscodeOptions) ? (preferredVideoCodec || undefined) : undefined,
      audio_codec: !audioCodecAlreadyAvailable || otherTranscodeOptions ? (preferredAudioCodec || undefined) : undefined,
      display_video_codec: preferredVideoCodec || bestVideoSource?.vcodec || undefined,
      display_audio_codec: preferredAudioCodec || bestAudioSource?.acodec || undefined,
      video_bitrate: videoBitrate || undefined,
      audio_bitrate: audioBitrate || undefined,
      video_fps: videoFps || undefined,
      audio_sample_rate: audioSampleRate || undefined,
      estimated_size_bytes: estimatedBytes || undefined,
      prefer_ffmpeg_while_converting: config.prefer_ffmpeg_while_converting,
      prefer_ffmpeg_while_downloading: config.prefer_ffmpeg_while_downloading,
      is_time_range_active: isTimeRangeActive,
      start_time: timeStart,
      end_time: timeEnd,
      skip_sponsors: skipSponsors,
      embed_tags: embedMetadata,
      embed_thumbnail: thumbnailAction === "embed",
      mute_audio: mode === "video" ? (isGifFormat || muteAudio) : false,
      download_subs: downloadSubs,
      download_chat: downloadChat,
      subs_code: subsLang.trim(),
      embed_subs: embedSubs,
      meta_sub_langs: metaSubLangs || [],
      meta_auto_langs: metaAutoLangs || []
    };

    if (payload.mute_audio) {
      payload.audio_codec = undefined;
    }

    if (parsedArgs.length) {
      payload.custom_args = parsedArgs;
    }

    return payload;
  };

  const currentMetaSnapshot = () => {
    return {
      title: metadata?.title || t("common.unknownTitle"),
      thumbnail: metadata?.thumbnail || "",
      path: savePath.trim() || config.default_save_path.trim()
    };
  };

  const beginFilenameEdit = () => {
    const currentValue = customFilename.trim() || metadata?.title || "";
    filenameEditOriginalRef.current = currentValue.trim();
    setFilenameDraft(currentValue);
    setIsEditingFilename(true);
  };

  const finishFilenameEdit = () => {
    const nextValue = filenameDraft.trim();
    if (!nextValue || nextValue !== filenameEditOriginalRef.current) {
      setCustomFilename(nextValue);
    }
    setIsEditingFilename(false);
  };

  const triggerAnimationOrb = (sourceRect: DOMRect | null) => {
    if (sourceRect) {
      animateQueueOrb(sourceRect);
    }
  };

  const handleDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isValid) return;
    const sourceRect = e.currentTarget.getBoundingClientRect();
    const payload = buildDownloadPayload();
    const meta = currentMetaSnapshot();

    try {
      await enqueue("download", payload, { ...meta, source: "download" }, { autoStart: true, startReason: "download" });
      triggerAnimationOrb(sourceRect);
      resetToZen();
    } catch (error) {
      console.error("Download fail:", error);
      showNotification(t("common.error"), String(error), "error");
    }
  };

  const handleAddToQueue = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isValid) return;
    const sourceRect = e.currentTarget.getBoundingClientRect();
    const payload = buildDownloadPayload();
    const meta = currentMetaSnapshot();

    try {
      await enqueue("download", payload, { ...meta, source: "queue" }, { autoStart: false });
      triggerAnimationOrb(sourceRect);
      resetToZen();
    } catch (error) {
      console.error("Queue add fail:", error);
      showNotification(t("common.error"), String(error), "error");
    }
  };

  const saveThumbnail = async () => {
    const thumbUrl = metadata?.thumbnail;
    if (!thumbUrl) return;
    try {
      await invoke("save_thumbnail_to_disk", { url: thumbUrl });
    } catch (e) {
      console.error("Failed to save thumbnail:", e);
      showNotification(t("common.error"), t("downloader.thumbnail.saveFailed"), "error");
    }
  };

  const isValid = !!(selectedFormat && selectedQuality && (savePath.trim().length > 0 || config.default_save_path.trim().length > 0));

  const formatsToRender = mode === "video" ? videoFormats : audioFormats;
  const qualitiesToRender = mode === "video" ? videoQualityOptions : audioQualities;

  const currentSource = detectSourceFromUrl(metadata?.webpage_url || url);

  return (
    <div className="page-root downloader-page">
      <div className="page-scroll app-scroll">

        {/* Search Section */}
        <div id="search-section" className={`search-section ${!isDashboardVisible && !isSearchMode ? "centered" : "sticky"} ${!isDashboardVisible && !isSearchMode && !isSearching && url.trim().length > 0 && !looksLikeUrl(url) ? "has-provider-panel" : ""}`}>
          <div className="search-box-row">
            <input
              type="text"
              id="url-input"
              ref={urlInputRef}
              placeholder={t("downloader.search.urlPlaceholder")}
              value={url}
              onChange={(e) => {
                const nextUrl = e.target.value;
                if (!nextUrl.trim()) {
                  resetToZen();
                } else {
                  updateUrlFromInput(nextUrl);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFetch();
                  if (urlInputRef.current) urlInputRef.current.blur();
                }
              }}
              autoComplete="off"
            />
            <span
              id="paste-icon"
              className="paste-icon bar-icon"
              title={t("downloader.search.pasteTitle")}
              role="button"
              tabIndex={0}
              onClick={handlePaste}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["search"]} /></svg>
            </span>
            <button
              id="fetch-btn"
              className={`bar-action ${(isAnalyzing || isSearching) ? "loading" : ""}`}
              onClick={handleFetch}
              disabled={isAnalyzing || isSearching}
            >
              {(isAnalyzing || isSearching) ? (
                <svg className="btn-spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["loading-spinner"]} /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["clear-selection"]} /></svg>
              )}
            </button>
          </div>

          {/* Search Provider selection */}
          <div
            id="search-provider-panel"
            className={`search-provider-panel ${!isDashboardVisible && !isSearchMode && !isSearching && url.trim().length > 0 && !looksLikeUrl(url) ? "visible" : ""}`}
            aria-hidden={!(!isDashboardVisible && !isSearchMode && !isSearching && url.trim().length > 0 && !looksLikeUrl(url))}
          >
            <span className="provider-label">{t("downloader.search.providerLabel")}</span>
            <div className="provider-buttons">
              <button
                type="button"
                className={`provider-btn ${provider === "ytsearch" ? "active" : ""}`}
                onClick={() => setProvider("ytsearch")}
              >
                <SourceIcon source="youtube" className="provider-icon youtube-icon" />
                <span>YouTube</span>
              </button>
              <button
                type="button"
                className={`provider-btn ${provider === "ytmsearch" ? "active" : ""}`}
                onClick={() => setProvider("ytmsearch")}
              >
                <SourceIcon source="ytmusic" className="provider-icon ytmusic-icon" />
                <span>YouTube Music</span>
              </button>
              <button
                type="button"
                className={`provider-btn ${provider === "scsearch" ? "active" : ""}`}
                onClick={() => setProvider("scsearch")}
              >
                <SourceIcon source="soundcloud" className="provider-icon soundcloud-icon" />
                <span>SoundCloud</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Section */}
        <div id="dashboard-section" className={`dashboard-section ${isDashboardVisible ? "" : "hidden"}`}>
          {metadata && (
            <>
              {/* Metadata Title/Uploader */}
              <div className="meta-info fade-in">
                <div className="meta-title-row">
                  {isEditingFilename ? (
                    <input
                      id="custom-filename-input"
                      className="meta-title-input"
                      type="text"
                      value={filenameDraft}
                      onChange={(event) => setFilenameDraft(event.target.value)}
                      onBlur={finishFilenameEdit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishFilenameEdit();
                      }}
                      autoFocus
                    />
                  ) : (
                    <h2 id="meta-title">{customFilename.trim() || metadata.title || t("common.unknownTitle")}</h2>
                  )}
                  <button
                    type="button"
                    className="downloader-rename-btn"
                    onClick={beginFilenameEdit}
                    title={t("common.output.editTitle")}
                    aria-label={t("common.output.editTitle")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><use href={ICON_ASSETS["edit"]} /></svg>
                  </button>
                </div>
                <p className="meta-line">
                  <span
                    id="meta-author"
                    className={`meta-author ${metadata.uploader_url ? "meta-author-link" : ""}`}
                    role={metadata.uploader_url ? "button" : undefined}
                    tabIndex={metadata.uploader_url ? 0 : -1}
                    onClick={() => {
                      if (metadata.uploader_url) {
                        openUrl(metadata.uploader_url).catch((error) => {
                          console.error("Failed to open uploader channel:", error);
                        });
                      }
                    }}
                  >
                    {currentSource && currentSource in SOURCE_ICONS && (
                      <span className={`meta-source-icon ${currentSource}-icon`}>
                        <SourceIcon source={currentSource} />
                      </span>
                    )}
                    <span className="meta-author-name">
                      {metadata.channel || metadata.uploader || t("common.unknownChannel")}
                    </span>
                  </span>
                  <span className="meta-separator">-</span>
                  <span id="meta-duration">
                    {metadata.duration_string || formatDuration(duration)}
                  </span>
                </p>
              </div>

              {/* Presets List */}
              {downloaderPresets.length > 0 && (
                <div className="preset-section fade-in" id="preset-section">
                  <span className="option-label">{t("downloader.options.presets")}</span>
                  <PresetGrid id="preset-grid" presets={downloaderPresets} activeId={activePresetId} onSelect={handlePresetClick} />
                </div>
              )}

              {/* Save Path input */}
              <PathSelector
                className="path-selector fade-in"
                id="path-input"
                placeholder={t("common.noSavePathSelected")}
                value={savePath}
                onChange={(selected) => {
                  setSavePath(selected);
                  clearActivePreset();
                }}
                pickerCommand="pick_download_directory"
                title={t("common.browse")}
                useLastPathTitle={t("common.useLastPath")}
              />

              {/* Mode Switcher */}
              <div className="mode-switcher fade-in">
                <div
                  className={`switch-option ${mode === "video" ? "active" : ""} ${isAudioOnlySource ? "hidden" : ""}`}
                  onClick={() => {
                    if (!isAudioOnlySource) {
                      setMode("video");
                      setSelectedFormat(null);
                      setSelectedQuality(null);
                      clearActivePreset();
                    }
                  }}
                  id="mode-video"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["video"]} /></svg>
                  <span>{t("common.mode.video")}</span>
                </div>
                <div
                  className={`switch-option ${mode === "audio" ? "active" : ""}`}
                  onClick={() => {
                    setMode("audio");
                    setSelectedFormat(null);
                    setSelectedQuality(null);
                    clearActivePreset();
                  }}
                  id="mode-audio"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["audio"]} /></svg>
                  <span>{t("common.mode.audio")}</span>
                </div>
              </div>

              {/* Formats & Qualities Grid */}
              <div id="options-wrapper" className="content-transition">
                <div className="options-grid fade-in">
                  <div className="grid-column">
                    <label>{t("downloader.options.format")}</label>
                    <div className="tiles-container" id="format-list">
                      {formatsToRender.map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          className={`tile ${selectedFormat === fmt ? "active" : ""}`}
                          onClick={() => {
                            setSelectedFormat(fmt);
                            clearActivePreset();
                          }}
                        >
                          <span>{fmt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid-column">
                    <label>{t("downloader.options.quality")}</label>
                    <div className="tiles-container" id="quality-list">
                      {qualitiesToRender.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className={`tile ${selectedQuality === q ? "active" : ""}`}
                          onClick={() => {
                            setSelectedQuality(q);
                            clearActivePreset();
                          }}
                        >
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Slicing */}
              {!isPlaylist && (
                <div className="timeline-section fade-in">
                  <div className="time-inputs">
                    <input
                      type="text"
                      className="time-box"
                      id="time-start"
                      value={timeStart}
                      onChange={(e) => handleTimeStartChange(e.target.value)}
                      onBlur={() => {
                        const secs = parseTimeToSeconds(timeStart);
                        setTimeStart(formatDuration(secs));
                      }}
                    />
                    <div className="slider-track-container">
                      <div className="track-bg"></div>
                      <div
                        className="track-fill"
                        id="range-fill"
                        style={{
                          left: `${rangeStart}%`,
                          right: `${100 - rangeEnd}%`
                        }}
                      ></div>
                      <input
                        type="range"
                        id="range-start"
                        min="0"
                        max="100"
                        value={rangeStart}
                        onChange={(e) => handleRangeStartChange(Number(e.target.value))}
                      />
                      <input
                        type="range"
                        id="range-end"
                        min="0"
                        max="100"
                        value={rangeEnd}
                        onChange={(e) => handleRangeEndChange(Number(e.target.value))}
                      />
                    </div>
                    <input
                      type="text"
                      className="time-box"
                      id="time-end"
                      value={timeEnd}
                      onChange={(e) => handleTimeEndChange(e.target.value)}
                      onBlur={() => {
                        const secs = parseTimeToSeconds(timeEnd);
                        setTimeEnd(formatDuration(secs));
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Options group (Thumbnail, subtitles, sponsors, metadata, advanced) */}
              <div className="extras-section fade-in">
                {/* Thumbnail Action */}
                <div className="thumb-container">
                  <span className="option-label">{t("downloader.options.thumbnail")}</span>
                  <div className="thumb-preview">
                    {metadata.thumbnail ? (
                      <img src={metadata.thumbnail} alt=""/>
                    ) : (
                      <span className="placeholder">{t("downloader.thumbnail.noPreview")}</span>
                    )}
                  </div>
                  <div className="thumb-actions">
                    <button
                      className={`icon-btn-small ${thumbnailAction === "none" ? "active" : ""}`}
                      onClick={() => {
                        setThumbnailAction("none");
                        clearActivePreset();
                      }}
                      title={t("downloader.thumbnail.none")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["thumbnail-none"]} /></svg>
                    </button>
                    <button
                      className="icon-btn-small"
                      onClick={saveThumbnail}
                      title={t("downloader.thumbnail.saveToFile")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["download-arrow"]} /></svg>
                    </button>
                    <button
                      className={`icon-btn-small ${thumbnailAction === "embed" ? "active" : ""}`}
                      onClick={() => {
                        setThumbnailAction("embed");
                        clearActivePreset();
                      }}
                      title={t("downloader.thumbnail.embedInVideo")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["image"]} /></svg>
                    </button>
                  </div>
                </div>

                {/* Other settings */}
                <div className="option-group">
                  <span className="option-label">{t("downloader.options.other")}</span>
                  <div className="form-row">
                    <input
                      type="checkbox"
                      id="skip-sponsors-toggle"
                      className="toggle-switch"
                      checked={skipSponsors}
                      onChange={(e) => {
                        setSkipSponsors(e.target.checked);
                        clearActivePreset();
                      }}
                    />
                    <span className="toggle-text">{t("downloader.options.skipSponsors")}</span>
                  </div>
                  <div className="form-row">
                    <input
                      type="checkbox"
                      id="metadata-toggle"
                      className="toggle-switch"
                      checked={embedMetadata}
                      onChange={(e) => {
                        setEmbedMetadata(e.target.checked);
                        clearActivePreset();
                      }}
                    />
                    <span className="toggle-text">{t("downloader.options.embedMetadata")}</span>
                  </div>
                  {mode === "video" && (
                    <div className="form-row video-only">
                      <input
                        type="checkbox"
                        id="mute-audio-toggle"
                        className="toggle-switch"
                      checked={isGifFormat || muteAudio}
                      disabled={isGifFormat}
                        onChange={(e) => {
                          setMuteAudio(isGifFormat || e.target.checked);
                          clearActivePreset();
                        }}
                      />
                      <span className="toggle-text">{t("downloader.options.muteAudio")}</span>
                    </div>
                  )}
                  {!!config?.advanced_mode && (
                    <div className="form-row advanced-only">
                      <span className="toggle-text">{t("downloader.options.customArgs")}</span>
                      <input
                        type="text"
                        id="custom-args-input"
                        className="custom-args-input"
                        placeholder={t("downloader.options.customArgsPlaceholder")}
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  )}
                </div>

                {/* Subtitles settings */}
                <div className={`option-group subtitles-group ${!subtitlesAvailable ? "hidden" : ""}`} style={{ alignItems: "flex-start" }}>
                  <span className="option-label">{t("downloader.options.subtitles")}</span>
                  <div className="form-row subtitles-row">
                    <span className="toggle-text">{t("downloader.options.downloadSubtitles")}</span>
                    <input
                      type="checkbox"
                      id="subs-toggle"
                      className="toggle-switch"
                      checked={downloadSubs}
                      disabled={!subtitlesAvailable}
                      onChange={(e) => {
                        setDownloadSubs(e.target.checked);
                        clearActivePreset();
                      }}
                    />
                  </div>

                  {/* Live Chat Download */}
                  {subtitleOptions.some((s) => s.code.toLowerCase() === "live_chat") && (
                    <div className={`form-row live-chat-row ${downloadSubs ? "" : "hidden"}`} id="live-chat-row">
                      <span className="toggle-text">{t("downloader.options.downloadLiveChat")}</span>
                      <input
                        type="checkbox"
                        id="chat-toggle"
                        className="toggle-switch"
                        checked={downloadChat}
                        onChange={(e) => setDownloadChat(e.target.checked)}
                      />
                    </div>
                  )}

                  {/* Embed Subtitles */}
                  <div className={`form-row embed-subs-row ${downloadSubs ? "visible" : ""}`} id="embed-subs-row">
                    <span className="toggle-text">{t("downloader.options.embedSubtitles")}</span>
                    <input
                      type="checkbox"
                      id="embed-subs-toggle"
                      className="toggle-switch"
                      checked={embedSubs}
                      onChange={(e) => {
                        setEmbedSubs(e.target.checked);
                        clearActivePreset();
                      }}
                    />
                  </div>

                  {/* Language field */}
                  <div id="lang-wrapper" className={`lang-input-wrapper ${downloadSubs ? "visible" : ""}`}>
                    <input
                      type="text"
                      className="lang-input"
                      placeholder={t("downloader.options.codeOptional")}
                      value={subsLang}
                      onChange={(e) => setSubsLang(e.target.value)}
                      onFocus={() => setShowLangSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowLangSuggestions(false), 200)}
                      id="subs-lang"
                      autoComplete="off"
                    />

                    {/* Suggestions list */}
                    {showLangSuggestions && langSuggestions.length > 0 && (
                      <div className="lang-suggestions visible" id="subs-lang-suggestions">
                        {langSuggestions.slice(0, 8).map((entry) => (
                          <div
                            key={entry.code}
                            className="lang-suggestion-item"
                            onClick={() => {
                              setSubsLang(entry.code);
                              setShowLangSuggestions(false);
                            }}
                          >
                            {`${entry.countryName} - ${entry.languageName} - ${entry.code}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Codecs settings */}
                <div className="option-group codecs-group" style={{ alignItems: "flex-end" }}>
                  <span className="option-label">{t("downloader.options.codecs")}</span>
                  {mode === "video" && (
                    <div className="form-row">
                      <span className="toggle-text">{t("common.videoCodec")}</span>
                      <CustomSelect
                        options={downloaderVideoCodecOptions}
                        value={displayedVideoCodec}
                        onChange={(val) => {
                          setVideoCodec(val);
                          clearActivePreset();
                        }}
                        width="115px"
                      />
                    </div>
                  )}
                  <div
                    className={`form-row audio-codec-row ${showAudioCodec ? "visible" : ""}`}
                    aria-hidden={!showAudioCodec}
                  >
                    <span className="toggle-text">{t("common.audioCodec")}</span>
                    <CustomSelect
                      options={downloaderAudioCodecOptions}
                      value={displayedAudioCodec}
                      disabled={!showAudioCodec}
                      onChange={(val) => {
                        setAudioCodec(val);
                        clearActivePreset();
                      }}
                      width="115px"
                    />
                  </div>
                </div>
              </div>

              <section key={`${metadata?.webpage_url || "properties"}-${isDashboardVisible}`} className="downloader-properties fade-in">
                <h3>{t("downloader.options.properties")}</h3>
                {mode === "video" && <label className="downloader-property-field">
                  <span>{t("downloader.options.videoBitrate")}</span>
                  <input className="custom-input" type="text" inputMode="numeric" value={videoBitrate} onChange={(e) => { setVideoBitrate(sanitizeBitrateInput(e.target.value, 100000)); clearActivePreset(); }} placeholder={t("presetCreator.placeholders.bitrate")} />
                </label>}
                {mode === "video" && <label className="downloader-property-field">
                  <span>{t("downloader.options.fps")}</span>
                  <CustomSelect options={[{ value: "", label: t("presetCreator.select.auto") }, { value: "60", label: "60" }, { value: "30", label: "30" }, { value: "24", label: "24" }]} value={videoFps} onChange={(value) => { setVideoFps(value); clearActivePreset(); }} />
                </label>}
                {showAudioCodec && <label className="downloader-property-field">
                  <span>{t("downloader.options.sampleRate")}</span>
                  <CustomSelect options={[{ value: "", label: t("presetCreator.select.auto") }, { value: "32000", label: "32000" }, { value: "44100", label: "44100" }, { value: "48000", label: "48000" }, { value: "96000", label: "96000" }]} value={audioSampleRate} onChange={(value) => { setAudioSampleRate(value); clearActivePreset(); }} />
                </label>}
                {showAudioCodec && <label className="downloader-property-field">
                  <span>{t("downloader.options.audioBitrate")}</span>
                  <input className="custom-input" type="text" inputMode="numeric" value={audioBitrate} onChange={(e) => { setAudioBitrate(sanitizeBitrateInput(e.target.value, 1000)); clearActivePreset(); }} placeholder={t("presetCreator.placeholders.bitrate")} />
                </label>}
              </section>

              {/* Action Footer */}
              <div className="action-footer fade-in">
                <button
                  id="download-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={handleDownload}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["download-arrow"]} /></svg>
                  <span>{t("downloader.actions.download")}</span>
                </button>
                <button
                  id="queue-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={handleAddToQueue}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><use href={ICON_ASSETS["add-to-queue"]} /></svg>
                  <span>{t("common.addToQueue")}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search Results Section */}
        <div id="search-results-section" className={`search-results-section ${isSearchMode ? "" : "hidden"} ${searchExiting ? "exiting" : ""}`}>
          <div className="search-results-header fade-in" style={{ animationDelay: "0.1s" }}>
            <h3 id="search-results-title">{t("downloader.search.resultsTitle")}</h3>
            <span id="search-results-count">
              {searchResults.length > 0 ? t("downloader.search.resultsCount",  { count: searchResults.length }) : ""}
            </span>
          </div>

          <div id="search-results-grid" className="search-results-grid">
            {searchResults.length === 0 ? (
              <div className="search-results-empty">{t("downloader.search.empty")}</div>
            ) : (
              searchResults.map((entry, idx) => {
                const isItemLoading = isAnalyzing && pendingMetadataUrl === resolveResultUrl(entry);
                return (
                  <div
                    key={entry.url || entry.id}
                    className="search-result-card fade-in"
                    style={{
                      "--thumb-url": `url('${entry.thumbnail || ""}')`,
                      animationDelay: `${0.12 + idx * 0.05}s`
                    } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className={`search-result-action ${isItemLoading ? "loading" : ""}`}
                      aria-label="Select"
                      disabled={isAnalyzing}
                      onClick={() => handleSelectSearchResult(entry)}
                    >
                      <span className="action-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><use href={ICON_ASSETS["download-progress"]} /></svg>
                      </span>
                      <span className="action-spinner">
                        <span className="search-action-spinner"></span>
                      </span>
                    </button>
                    <div className="search-result-content">
                      <div className="search-result-title">
                        {entry.title || t("common.unknownTitle")}
                      </div>
                      <div className="search-result-meta">
                        {`${entry.uploader || entry.channel || t("common.unknownChannel")} • ${entry.duration_string || formatDuration(entry.duration)}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Downloader;