import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../services/i18n";
import { invoke, listen } from "../services/tauri";
import { useConfig } from "../services/config";
import { usePresets } from "../services/presets";
import { enqueue } from "../services/queue";
import { showNotification } from "../services/notifications";
import { formatDuration } from "../utils/format";
import { sanitizeSvg } from "../utils/security";
import { PathSelector } from "../components/PathSelector";
import { useTauriMetadata } from "../hooks/useTauriMetadata";

const videoQualities = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];
const videoFormats = ["MP4", "MKV", "WEBM", "MOV", "FLV", "AVI", "GIF"];
const audioFormats = ["MP3", "M4A", "AAC", "OPUS", "WAV", "FLAC", "AIFF", "OGG"];
const audioQualities = ["320kbps", "256kbps", "192kbps", "128kbps", "96kbps"];
import { DEFAULT_ICON } from "../utils/icons";

interface DownloaderProps {
  active?: boolean;
}

let cachedDownloaderState: any = null;

export const Downloader: React.FC<DownloaderProps> = ({ active = true }) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { presets } = usePresets();

  const [url, setUrl] = useState(() => cachedDownloaderState?.url ?? "");
  const [isSearching, setIsSearching] = useState(() => cachedDownloaderState?.isSearching ?? false);
  const [isSearchMode, setIsSearchMode] = useState(() => cachedDownloaderState?.isSearchMode ?? false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(() => cachedDownloaderState?.isDashboardVisible ?? false);
  const [searchResults, setSearchResults] = useState<any[]>(() => cachedDownloaderState?.searchResults ?? []);
  const [searchExiting, setSearchExiting] = useState(() => cachedDownloaderState?.searchExiting ?? false);
  const [provider, setProvider] = useState<"ytsearch" | "ytmsearch" | "scsearch">(() => cachedDownloaderState?.provider ?? "ytsearch");
  const [pendingMetadataUrl, setPendingMetadataUrl] = useState<string | null>(() => cachedDownloaderState?.pendingMetadataUrl ?? null);

  const {
    metadata,
    isLoading: isAnalyzing,
    fetchMetadata: triggerFetchMetadata,
    reset: resetMetadataState,
    setMetadata
  } = useTauriMetadata({
    pickerCommand: "fetch_metadata_downloader",
    onSuccess: (data) => {
      handleMetadataLoaded(data);
    },
    onError: (err) => {
      showNotification(t("common.error"), err, "error");
    }
  });

  const [duration, setDuration] = useState(() => cachedDownloaderState?.duration ?? 0);
  const [mode, setMode] = useState<"video" | "audio">(() => cachedDownloaderState?.mode ?? "video");
  const [selectedFormat, setSelectedFormat] = useState<string | null>(() => cachedDownloaderState?.selectedFormat ?? null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(() => cachedDownloaderState?.selectedQuality ?? null);
  const [savePath, setSavePath] = useState(() => cachedDownloaderState?.savePath ?? "");

  const [rangeStart, setRangeStart] = useState<number>(() => cachedDownloaderState?.rangeStart ?? 0);
  const [rangeEnd, setRangeEnd] = useState<number>(() => cachedDownloaderState?.rangeEnd ?? 100);
  const [timeStart, setTimeStart] = useState<string>(() => cachedDownloaderState?.timeStart ?? "00:00:00");
  const [timeEnd, setTimeEnd] = useState<string>(() => cachedDownloaderState?.timeEnd ?? "00:00:00");

  const [thumbnailAction, setThumbnailAction] = useState<"none" | "download" | "embed">((() => cachedDownloaderState?.thumbnailAction ?? "none"));
  const [geoBypass, setGeoBypass] = useState(() => cachedDownloaderState?.geoBypass ?? false);
  const [embedMetadata, setEmbedMetadata] = useState(() => cachedDownloaderState?.embedMetadata ?? false);
  const [muteAudio, setMuteAudio] = useState(() => cachedDownloaderState?.muteAudio ?? false);
  const [customArgs, setCustomArgs] = useState(() => cachedDownloaderState?.customArgs ?? "");

  const [subtitlesAvailable, setSubtitlesAvailable] = useState(() => cachedDownloaderState?.subtitlesAvailable ?? true);
  const [downloadSubs, setDownloadSubs] = useState(() => cachedDownloaderState?.downloadSubs ?? false);
  const [downloadChat, setDownloadChat] = useState(() => cachedDownloaderState?.downloadChat ?? false);
  const [embedSubs, setEmbedSubs] = useState(() => cachedDownloaderState?.embedSubs ?? false);
  const [subsLang, setSubsLang] = useState(() => cachedDownloaderState?.subsLang ?? "");
  const [subtitleOptions, setSubtitleOptions] = useState<any[]>(() => cachedDownloaderState?.subtitleOptions ?? []);
  const [metaSubLangs, setMetaSubLangs] = useState<string[]>(() => cachedDownloaderState?.metaSubLangs ?? []);
  const [metaAutoLangs, setMetaAutoLangs] = useState<string[]>(() => cachedDownloaderState?.metaAutoLangs ?? []);
  const [showLangSuggestions, setShowLangSuggestions] = useState(() => cachedDownloaderState?.showLangSuggestions ?? false);
  const [langSuggestions, setLangSuggestions] = useState<any[]>(() => cachedDownloaderState?.langSuggestions ?? []);

  const [activePresetId, setActivePresetId] = useState<string | null>(() => cachedDownloaderState?.activePresetId ?? null);
  const [presetOverrides, setPresetOverrides] = useState<any | null>(() => cachedDownloaderState?.presetOverrides ?? null);

  const [isAudioOnlySource, setIsAudioOnlySource] = useState(() => cachedDownloaderState?.isAudioOnlySource ?? false);
  const [isPlaylist, setIsPlaylist] = useState(() => cachedDownloaderState?.isPlaylist ?? false);

  const currentSearchIdRef = useRef<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const downloaderPresets = presets.filter(p => p.preset_type === "downloader" && !p.hidden);

  useEffect(() => {
    if (cachedDownloaderState && cachedDownloaderState.metadata) {
      setMetadata(cachedDownloaderState.metadata);
    }
  }, []);

  useEffect(() => {
    if (selectedFormat && selectedFormat.toLowerCase() === "gif") {
      setMuteAudio(true);
    }
  }, [selectedFormat]);

  useEffect(() => {
    cachedDownloaderState = {
      url,
      isSearching,
      isSearchMode,
      isDashboardVisible,
      searchResults,
      searchExiting,
      provider,
      pendingMetadataUrl,
      duration,
      mode,
      selectedFormat,
      selectedQuality,
      savePath,
      rangeStart,
      rangeEnd,
      timeStart,
      timeEnd,
      thumbnailAction,
      geoBypass,
      embedMetadata,
      muteAudio,
      customArgs,
      subtitlesAvailable,
      downloadSubs,
      downloadChat,
      embedSubs,
      subsLang,
      subtitleOptions,
      metaSubLangs,
      metaAutoLangs,
      showLangSuggestions,
      langSuggestions,
      activePresetId,
      presetOverrides,
      isAudioOnlySource,
      isPlaylist,
      metadata,
    };
  });

  useEffect(() => {
    if (!active) return;

    const body = document.body;
    if (!body) return;

    const isZen = !isSearchMode && !isDashboardVisible;

    body.classList.toggle("search-mode", isSearchMode);
    body.classList.toggle("audio-only-source", isAudioOnlySource);
    body.classList.toggle("mode-video", isDashboardVisible && mode === "video");
    body.classList.toggle("mode-audio", isDashboardVisible && mode === "audio");
    body.classList.toggle("advanced-mode", !!config?.advanced_mode);
    body.classList.toggle("zen-mode", isZen);

    return () => {
      body.classList.remove("search-mode", "audio-only-source", "mode-video", "mode-audio", "zen-mode");
    };
  }, [active, isSearchMode, isAudioOnlySource, mode, config?.advanced_mode, isDashboardVisible]);

  useEffect(() => {
    // Expose window.downloaderUi
    (window as any).downloaderUi = {
      startMetadataForUrl: async (targetUrl: string) => {
        setUrl(targetUrl);
        setPendingMetadataUrl(targetUrl);
        triggerFetchMetadata(targetUrl);
        return "";
      },
      setFetchLoading: () => {
        // Handled by hook
      },
      triggerShake: () => {
        triggerShakeInput();
      }
    };

    let active = true;
    const unsubPromise = listen<any>("download-event", (event) => {
      if (!active) return;
      const payload = event.payload;
      if (!payload || !payload.type) return;

      if (payload.type === "search_results" && payload.id === currentSearchIdRef.current) {
        setIsSearching(false);
        setSearchResults(payload.data || []);
        setIsSearchMode(true);
        setIsDashboardVisible(false);
        resetMetadataState();
      }

      if (payload.type === "finished" && payload.id === currentSearchIdRef.current && payload.success === false) {
        setIsSearching(false);
        showNotification(t("common.error"), payload.error || t("downloader.errors.searchFailed"), "error");
        setSearchResults([]);
        setIsSearchMode(true);
      }
    });

    return () => {
      active = false;
      unsubPromise.then((unsub) => unsub());
      delete (window as any).downloaderUi;
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

  const detectSourceFromUrl = (rawUrl: string) => {
    const input = String(rawUrl || "").trim().toLowerCase();
    if (!input) return null;
    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase();
      if (host === "music.youtube.com" || host.endsWith(".music.youtube.com")) return "ytmusic";
      if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
      if (host === "soundcloud.com" || host.endsWith(".soundcloud.com") || host === "soundcloud.app.goo.gl") return "soundcloud";
      if (host === "spotify.com" || host.endsWith(".spotify.com")) return "spotify";
      if (host === "music.apple.com" || host.endsWith(".music.apple.com") || host === "itunes.apple.com" || host.endsWith(".itunes.apple.com") || host === "apple.co") return "applemusic";
      if (host === "deezer.com" || host.endsWith(".deezer.com") || host === "deezer.page.link") return "deezer";
      if (host === "dzr.page.link" || host === "link.deezer.com" || host === "dzr.fm") return "deezer";
    } catch (_) {
      if (input.includes("music.youtube.com")) return "ytmusic";
      if (input.includes("youtube.com") || input.includes("youtu.be")) return "youtube";
      if (input.includes("soundcloud.com") || input.includes("soundcloud.app.goo.gl")) return "soundcloud";
      if (input.includes("spotify.com")) return "spotify";
      if (input.includes("music.apple.com") || input.includes("itunes.apple.com") || input.includes("apple.co/")) return "applemusic";
      if (input.includes("deezer.com") || input.includes("deezer.page.link") || input.includes("dzr.page.link") || input.includes("link.deezer.com") || input.includes("dzr.fm")) return "deezer";
    }
    return null;
  };

  const isAudioOnlySourceUrl = (rawUrl: string) => {
    return detectSourceFromUrl(rawUrl) !== "youtube" && detectSourceFromUrl(rawUrl) !== null;
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
      setSearchResults([]);
      applySourceConstraints(raw);
      triggerFetchMetadata(raw);
    } else {
      if (isSearching) return;
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

  const generateSubtitleOptions = (data: any) => {
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

  const parseVideoQuality = (formats: any[] = []) => {
    const found = new Set<string>();
    formats.forEach((format) => {
      const note = String(format.note || "");
      const resolution = String(format.resolution || "");

      const noteMatch = note.match(/(\d{3,4})p/i);
      if (noteMatch && videoQualities.includes(`${noteMatch[1]}p`)) {
        found.add(`${noteMatch[1]}p`);
        return;
      }

      const resolutionMatch = resolution.match(/\d+x(\d{3,4})/i);
      if (resolutionMatch && videoQualities.includes(`${resolutionMatch[1]}p`)) {
        found.add(`${resolutionMatch[1]}p`);
      }
    });

    if (!found.size) return videoQualities;
    const highest = videoQualities.find((q) => found.has(q));
    if (!highest) return videoQualities;
    return videoQualities.slice(videoQualities.indexOf(highest));
  };

  const handleMetadataLoaded = (data: any) => {
    setMetadata(data);
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
    const sLangs = Array.isArray(data.subtitles_langs) ? data.subtitles_langs.map((l: any) => String(l).trim()).filter(Boolean) : [];
    const aLangs = Array.isArray(data.auto_captions_langs) ? data.auto_captions_langs.map((l: any) => String(l).trim()).filter(Boolean) : [];
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

    const defaultMode = isAudioOnlySourceUrl(url) ? "audio" : "video";
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

  const [videoQualityOptions, setVideoQualityOptions] = useState<string[]>(videoQualities);

  const resetToZen = () => {
    setUrl("");
    setIsDashboardVisible(false);
    setIsSearchMode(false);
    setSearchResults([]);
    resetMetadataState();
    setDuration(0);
    setSelectedFormat(null);
    setSelectedQuality(null);
    setSubtitleOptions([]);
    setMetaSubLangs([]);
    setMetaAutoLangs([]);
    setDownloadSubs(false);
    setDownloadChat(false);
    setEmbedSubs(false);
    setSubsLang("");
    setMuteAudio(false);
    setCustomArgs("");
    setThumbnailAction("none");
    clearActivePreset();
    applySourceConstraints("");
  };

  const clearActivePreset = () => {
    setActivePresetId(null);
    setPresetOverrides(null);
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await invoke<string>("read_clipboard_text");
      if (clipboardText) {
        setUrl(clipboardText.trim());
      }
    } catch (e) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
          setUrl(clipboardText.trim());
        }
      } catch (err) {
        console.error("Failed to read from clipboard:", err);
      }
    }
  };

  const handlePresetClick = async (presetSummary: any) => {
    if (activePresetId === presetSummary.id) {
      clearActivePreset();
      return;
    }
    try {
      const preset = await invoke<any>("load_preset", { id: presetSummary.id });
      if (preset && preset.downloader) {
        const d = preset.downloader;
        setPresetOverrides({
          video_codec: d.video_codec || null,
          audio_codec: d.audio_codec || null,
          video_bitrate: d.video_bitrate || null,
          audio_bitrate: d.audio_bitrate || null,
          video_fps: d.video_fps || null,
          audio_sample_rate: d.audio_sample_rate || null
        });

        if (d.path) {
          setSavePath(d.path);
        }

        const newMode = d.mode || "video";
        setMode(newMode);

        setSelectedFormat(d.format ? d.format.toUpperCase() : null);
        setSelectedQuality(newMode === "video" ? d.video_quality : d.audio_quality);

        setGeoBypass(!!d.geo_bypass);
        setEmbedMetadata(!!d.embed_metadata);
        setMuteAudio(!!d.mute_audio);
        setDownloadSubs(!!d.download_subtitles);
        setEmbedSubs(!!d.embed_subtitles);
        if (d.subtitles_code) {
          setSubsLang(d.subtitles_code);
        }
        setThumbnailAction(d.embed_thumbnail ? "embed" : "none");
        setActivePresetId(presetSummary.id);
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



  const handleSelectSearchResult = async (entry: any) => {
    const targetUrl = resolveResultUrl(entry);
    if (!targetUrl) return;
    setUrl(targetUrl);
    setPendingMetadataUrl(targetUrl);
    triggerFetchMetadata(targetUrl);
  };

  const resolveResultUrl = (entry: any) => {
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
    const payload: any = {
      url: targetUrl,
      path: savePath.trim(),
      mode: mode,
      video_format: mode === "video" ? selectedFormat : null,
      video_quality: mode === "video" ? selectedQuality : null,
      audio_format: mode === "audio" ? selectedFormat : null,
      audio_quality: mode === "audio" ? selectedQuality : null,
      is_time_range_active: isTimeRangeActive,
      start_time: timeStart,
      end_time: timeEnd,
      geo_bypass: geoBypass,
      embed_tags: embedMetadata,
      embed_thumbnail: thumbnailAction === "embed",
      mute_audio: mode === "video" ? muteAudio : false,
      download_subs: downloadSubs,
      download_chat: downloadChat,
      subs_code: subsLang.trim(),
      embed_subs: embedSubs,
      meta_sub_langs: metaSubLangs || [],
      meta_auto_langs: metaAutoLangs || []
    };

    if (activePresetId && presetOverrides) {
      Object.entries(presetOverrides).forEach(([key, value]) => {
        if (value !== null && value !== "") {
          payload[key] = value;
        }
      });
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
      path: savePath.trim()
    };
  };

  const triggerAnimationOrb = (sourceRect: DOMRect | null) => {
    const win = window as any;
    if (sourceRect && win.queueManager && win.queueManager.animateQueueOrb) {
      win.queueManager.animateQueueOrb(sourceRect);
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

  const isValid = !!(selectedFormat && selectedQuality && savePath.trim().length > 0);

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
                setUrl(e.target.value);
                if (e.target.value.trim() === "") {
                  resetToZen();
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="4" rx="1"></rect>
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
              </svg>
            </span>
            <button
              id="fetch-btn"
              className={`bar-action ${(isAnalyzing || isSearching) ? "loading" : ""}`}
              onClick={handleFetch}
              disabled={isAnalyzing || isSearching}
            >
              {(isAnalyzing || isSearching) ? (
                <svg className="btn-spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M12 3a9 9 0 0 1 9 9" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
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
                <svg className="provider-icon youtube-icon" viewBox="0 0 28.57 20" aria-hidden="true">
                  <path d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z" />
                  <path d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z" />
                </svg>
                <span>YouTube</span>
              </button>
              <button
                type="button"
                className={`provider-btn ${provider === "ytmsearch" ? "active" : ""}`}
                onClick={() => setProvider("ytmsearch")}
              >
                <svg className="provider-icon ytmusic-icon" viewBox="0 0 176 176" aria-hidden="true">
                  <circle cx="88" cy="88" r="88" />
                  <path d="M88,46c23.1,0,42,18.8,42,42s-18.8,42-42,42s-42-18.8-42-42S64.9,46,88,46 M88,42c-25.4,0-46,20.6-46,46s20.6,46,46,46s46-20.6,46-46S113.4,42,88,42L88,42z" />
                  <polygon points="72,111 111,87 72,65" />
                </svg>
                <span>YouTube Music</span>
              </button>
              <button
                type="button"
                className={`provider-btn ${provider === "scsearch" ? "active" : ""}`}
                onClick={() => setProvider("scsearch")}
              >
                <svg className="provider-icon soundcloud-icon" viewBox="0 0 2499.998 1386.695" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  <path d="M0 1137.737c0 31.024 11.247 54.481 33.737 70.382 22.491 15.898 46.533 21.52 72.126 16.868 24.041-4.653 40.91-13.185 50.607-25.593 9.693-12.408 14.542-32.962 14.542-61.657V800.372c0-24.044-8.336-44.403-25.012-61.075-16.672-16.676-37.03-25.012-61.074-25.012-23.267 0-43.237 8.336-59.912 25.012C8.339 755.969 0 776.327 0 800.372zm267.566 144.253c0 22.495 7.95 39.36 23.848 50.608 15.9 11.247 36.26 16.868 61.075 16.868 25.593 0 46.338-5.624 62.238-16.868 15.898-11.245 23.849-28.113 23.849-50.608V495.58c0-23.267-8.34-43.239-25.012-59.912-16.675-16.672-37.033-25.011-61.075-25.011-23.266 0-43.239 8.339-59.911 25.011-16.676 16.676-25.012 36.645-25.012 59.912zm266.403 37.227c0 22.492 8.143 39.36 24.43 50.607 16.286 11.245 37.226 16.869 62.822 16.869 24.816 0 45.174-5.624 61.072-16.869 15.9-11.247 23.851-28.115 23.851-50.607V601.442c0-24.041-8.339-44.595-25.012-61.657-16.675-17.061-36.644-25.59-59.911-25.59-24.044 0-44.595 8.529-61.657 25.59-17.061 17.062-25.593 37.616-25.593 61.657v717.775zm267.566 3.49c0 42.657 28.695 63.986 86.086 63.986 57.39 0 86.084-21.329 86.084-63.986V159.377c0-65.147-19.776-101.985-59.33-110.517-25.593-6.205-50.8 1.163-75.616 22.103-24.818 20.94-37.227 50.41-37.227 88.413v1163.331zm272.222 33.737V90.74c0-40.328 12.02-64.37 36.063-72.127C1161.78 6.205 1213.356 0 1264.543 0c118.657 0 229.176 27.92 331.547 83.76 102.373 55.84 185.165 132.038 248.37 228.594 63.21 96.56 99.854 203.001 109.936 319.337 47.308-20.165 97.717-30.247 151.23-30.247 108.578 0 201.452 38.39 278.618 115.17 77.168 76.782 115.754 169.072 115.754 276.875 0 108.578-38.586 201.256-115.754 278.036-77.166 76.78-169.651 115.17-277.455 115.17l-1012.097-1.163c-6.983-2.327-12.218-6.594-15.708-12.797s-5.227-11.638-5.227-16.291z" />
                </svg>
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
                <h2 id="meta-title">{metadata.title || t("common.unknownTitle")}</h2>
                <p className="meta-line">
                  <span
                    id="meta-author"
                    className={`meta-author ${metadata.uploader_url ? "meta-author-link" : ""}`}
                    role={metadata.uploader_url ? "button" : undefined}
                    tabIndex={metadata.uploader_url ? 0 : -1}
                    onClick={() => {
                      if (metadata.uploader_url) {
                        window.open(metadata.uploader_url, "_blank");
                      }
                    }}
                  >
                    {currentSource === "youtube" && (
                      <span className="meta-source-icon youtube-icon">
                        <svg viewBox="0 0 28.57 20" aria-hidden="true">
                          <path d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z" />
                          <path d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z" />
                        </svg>
                      </span>
                    )}
                    {currentSource === "ytmusic" && (
                      <span className="meta-source-icon ytmusic-icon">
                        <svg viewBox="0 0 176 176" aria-hidden="true">
                          <circle cx="88" cy="88" r="88" />
                          <path d="M88,46c23.1,0,42,18.8,42,42s-18.8,42-42,42s-42-18.8-42-42S64.9,46,88,46 M88,42c-25.4,0-46,20.6-46,46s20.6,46,46,46s46-20.6,46-46S113.4,42,88,42L88,42z" />
                          <polygon points="72,111 111,87 72,65" />
                        </svg>
                      </span>
                    )}
                    {currentSource === "soundcloud" && (
                      <span className="meta-source-icon soundcloud-icon">
                        <svg viewBox="0 0 2499.998 1386.695" aria-hidden="true">
                          <path d="M0 1137.737c0 31.024 11.247 54.481 33.737 70.382 22.491 15.898 46.533 21.52 72.126 16.868 24.041-4.653 40.91-13.185 50.607-25.593 9.693-12.408 14.542-32.962 14.542-61.657V800.372c0-24.044-8.336-44.403-25.012-61.075-16.672-16.676-37.03-25.012-61.074-25.012-23.267 0-43.237 8.336-59.912 25.012C8.339 755.969 0 776.327 0 800.372zm267.566 144.253c0 22.495 7.95 39.36 23.848 50.608 15.9 11.247 36.26 16.868 61.075 16.868 25.593 0 46.338-5.624 62.238-16.868 15.898-11.245 23.849-28.113 23.849-50.608V495.58c0-23.267-8.34-43.239-25.012-59.912-16.675-16.672-37.033-25.011-61.075-25.011-23.266 0-43.239 8.339-59.911 25.011-16.676 16.676-25.012 36.645-25.012 59.912zm266.403 37.227c0 22.492 8.143 39.36 24.43 50.607 16.286 11.245 37.226 16.869 62.822 16.869 24.816 0 45.174-5.624 61.072-16.869 15.9-11.247 23.851-28.115 23.851-50.607V601.442c0-24.041-8.339-44.595-25.012-61.657-16.675-17.061-36.644-25.59-59.911-25.59-24.044 0-44.595 8.529-61.657 25.59-17.061 17.062-25.593 37.616-25.593 61.657v717.775zm267.566 3.49c0 42.657 28.695 63.986 86.086 63.986 57.39 0 86.084-21.329 86.084-63.986V159.377c0-65.147-19.776-101.985-59.33-110.517-25.593-6.205-50.8 1.163-75.616 22.103-24.818 20.94-37.227 50.41-37.227 88.413v1163.331zm272.222 33.737V90.74c0-40.328 12.02-64.37 36.063-72.127C1161.78 6.205 1213.356 0 1264.543 0c118.657 0 229.176 27.92 331.547 83.76 102.373 55.84 185.165 132.038 248.37 228.594 63.21 96.56 99.854 203.001 109.936 319.337 47.308-20.165 97.717-30.247 151.23-30.247 108.578 0 201.452 38.39 278.618 115.17 77.168 76.782 115.754 169.072 115.754 276.875 0 108.578-38.586 201.256-115.754 278.036-77.166 76.78-169.651 115.17-277.455 115.17l-1012.097-1.163c-6.983-2.327-12.218-6.594-15.708-12.797s-5.227-11.638-5.227-16.291z" />
                        </svg>
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
                  <div className="preset-grid" id="preset-grid">
                    {downloaderPresets.map((pr: any) => (
                      <button
                        key={pr.id}
                        type="button"
                        className={`preset-card ${activePresetId === pr.id ? "active" : ""}`}
                        onClick={() => handlePresetClick(pr)}
                      >
                        <div
                          className="preset-card-icon"
                          dangerouslySetInnerHTML={{ __html: sanitizeSvg(pr.icon_data_url || DEFAULT_ICON) }}
                        />
                        <div className="preset-card-info">
                          <div className="preset-card-title">
                            {pr.title || t("settings.presetsManager.untitled")}
                          </div>
                          <div className="preset-card-summary">
                            {pr.summary ? (pr.summary.length > 50 ? `${pr.summary.slice(0, 49)}…` : pr.summary) : t("settings.presetsManager.noSummary")}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Path input */}
              <PathSelector
                className="path-selector fade-in"
                id="path-input"
                placeholder={t("downloader.path.placeholder")}
                value={savePath}
                onChange={(selected) => {
                  setSavePath(selected);
                  clearActivePreset();
                }}
                pickerCommand="pick_download_directory"
                title={t("common.browse")}
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <path d="M7 2v20M17 2v20M2 12h20" />
                  </svg>
                  <span>{t("downloader.mode.video")}</span>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>{t("downloader.mode.audio")}</span>
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

              {/* Options group (Thumbnail, subtitles, geo, metadata, advanced) */}
              <div className="extras-section fade-in">
                {/* Thumbnail Action */}
                <div className="thumb-container">
                  <span className="option-label">{t("downloader.options.thumbnail")}</span>
                  <div className="thumb-preview">
                    {metadata.thumbnail ? (
                      <img src={metadata.thumbnail} alt={t("downloader.thumbnail.alt")} />
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                    </button>
                    <button
                      className="icon-btn-small"
                      onClick={saveThumbnail}
                      title={t("downloader.thumbnail.saveToFile")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                    <button
                      className={`icon-btn-small ${thumbnailAction === "embed" ? "active" : ""}`}
                      onClick={() => {
                        setThumbnailAction("embed");
                        clearActivePreset();
                      }}
                      title={t("downloader.thumbnail.embedInVideo")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Other settings */}
                <div className="option-group">
                  <span className="option-label">{t("downloader.options.other")}</span>
                  <div className="form-row">
                    <input
                      type="checkbox"
                      id="geo-toggle"
                      className="toggle-switch"
                      checked={geoBypass}
                      onChange={(e) => {
                        setGeoBypass(e.target.checked);
                        clearActivePreset();
                      }}
                    />
                    <span className="toggle-text">{t("downloader.options.geoBypass")}</span>
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
                        checked={muteAudio}
                        onChange={(e) => {
                          setMuteAudio(e.target.checked);
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
                <div className={`option-group subtitles-group ${!subtitlesAvailable ? "hidden" : ""}`} style={{ alignItems: "flex-end" }}>
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
                            {`${entry.flag} ${entry.countryName} - ${entry.languageName} - ${entry.code}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="action-footer fade-in">
                <button
                  id="download-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={handleDownload}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>{t("downloader.actions.download")}</span>
                </button>
                <button
                  id="queue-btn"
                  className={`big-action-btn ${isValid ? "ready" : ""}`}
                  disabled={!isValid}
                  onClick={handleAddToQueue}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>{t("common.addToQueue")}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search Results Section */}
        <div id="search-results-section" className={`search-results-section ${isSearchMode ? "" : "hidden"} ${searchExiting ? "exiting" : ""}`}>
          <div className="search-results-header fade-in">
            <h3 id="search-results-title">{t("downloader.search.resultsTitle")}</h3>
            <span id="search-results-count">
              {searchResults.length > 0 ? t("downloader.search.resultsCount",  { count: searchResults.length }) : ""}
            </span>
          </div>

          <div id="search-results-grid" className="search-results-grid">
            {searchResults.length === 0 ? (
              <div className="search-results-empty">{t("downloader.search.empty")}</div>
            ) : (
              searchResults.map((entry) => {
                const isItemLoading = isAnalyzing && pendingMetadataUrl === resolveResultUrl(entry);
                return (
                  <div
                    key={entry.url || entry.id}
                    className="search-result-card fade-in"
                    style={{ "--thumb-url": `url('${entry.thumbnail || ""}')` } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className={`search-result-action ${isItemLoading ? "loading" : ""}`}
                      aria-label="Select"
                      disabled={isAnalyzing}
                      onClick={() => handleSelectSearchResult(entry)}
                    >
                      <span className="action-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <polyline points="19 12 12 19 5 12"></polyline>
                        </svg>
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