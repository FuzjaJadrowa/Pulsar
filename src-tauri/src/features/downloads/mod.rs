mod args;
pub mod file_ops;
use self::args::build_subtitle_args;
use crate::app::config::ConfigManager;
use crate::infrastructure::bridge::parse_time_to_seconds;
pub use crate::infrastructure::bridge::{
    is_terminal_event, terminal_event_succeeded, BridgeCommand, BridgeState,
};
use serde::Deserialize;
use tauri::{AppHandle, State};

fn parse_quality_limits(value: Option<&str>) -> (Option<u32>, Option<u32>) {
    let Some((height, fps)) = value.unwrap_or_default().trim().split_once('p') else {
        return (None, None);
    };
    (height.parse::<u32>().ok(), fps.parse::<u32>().ok())
}

fn parse_kbps(value: Option<&str>) -> Option<u32> {
    value?
        .trim()
        .trim_end_matches("kbps")
        .trim()
        .parse::<u32>()
        .ok()
        .filter(|value| *value > 0)
}

fn parse_sample_rate(value: Option<&str>) -> Option<u32> {
    value?
        .trim()
        .trim_end_matches("Hz")
        .trim()
        .parse::<u32>()
        .ok()
        .filter(|value| *value >= 8_000 && *value <= 192_000)
}

fn download_video_encoder(
    requested: &str,
    format: &str,
    config: &crate::app::config::AppConfig,
) -> String {
    let codec_key = if requested.is_empty() || requested.eq_ignore_ascii_case("auto") {
        match format.to_ascii_lowercase().as_str() {
            "webm" => "vp9",
            "ogv" => "theora",
            "gif" => "gif",
            "prores" => "prores",
            _ => "h264",
        }
    } else {
        requested
    };
    let hwaccel = if config.ffmpeg_hwaccel == "none" || config.ffmpeg_hwaccel == "false" {
        None
    } else if config.ffmpeg_hwaccel_preferred != "auto"
        && config
            .ffmpeg_hwaccels
            .iter()
            .any(|candidate| candidate == &config.ffmpeg_hwaccel_preferred)
    {
        Some(config.ffmpeg_hwaccel_preferred.as_str())
    } else {
        config.ffmpeg_hwaccels.first().map(String::as_str)
    };
    if let Some(accel) = hwaccel {
        crate::infrastructure::ffmpeg::codecs::map_video_codec_hw(codec_key, accel)
    } else {
        crate::infrastructure::ffmpeg::codecs::map_video_codec(codec_key)
    }
}

fn video_format_selector(height: Option<u32>, fps: Option<u32>, gif: bool) -> String {
    let mut filters = Vec::new();
    if let Some(height) = height {
        filters.push(format!("height<={height}"));
    }
    if let Some(fps) = fps {
        filters.push(format!("fps<={fps}"));
    }
    let bounded = if filters.is_empty() {
        String::new()
    } else {
        format!("[{}]", filters.join("]["))
    };
    if gif {
        if bounded.is_empty() {
            "bv".to_string()
        } else {
            format!("bv{bounded}/bv")
        }
    } else if bounded.is_empty() {
        "bv+ba/b".to_string()
    } else {
        let height_only = height
            .map(|height| format!("[height<={height}]"))
            .unwrap_or_default();
        let fps_only = fps.map(|fps| format!("[fps<={fps}]")).unwrap_or_default();
        let mut choices = vec![format!("bv{bounded}+ba/b{bounded}")];
        if !fps_only.is_empty() {
            choices.push(format!("bv{height_only}+ba/b{height_only}"));
        }
        if !height_only.is_empty() {
            choices.push(format!("bv{fps_only}+ba/b{fps_only}"));
        }
        choices.push("bv+ba/b".to_string());
        choices.join("/")
    }
}

#[tauri::command]
pub fn init_bridge(app_handle: AppHandle, state: State<BridgeState>) -> Result<(), String> {
    state.init(&app_handle)
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    url: String,
    path: String,
    #[serde(default, rename = "custom_filename", alias = "customFilename")]
    custom_filename: Option<String>,
    mode: String,
    #[serde(alias = "video_format")]
    video_format: Option<String>,
    #[serde(alias = "video_quality")]
    video_quality: Option<String>,
    #[serde(alias = "audio_format")]
    audio_format: Option<String>,
    #[serde(alias = "audio_quality")]
    audio_quality: Option<String>,
    #[serde(default, alias = "is_time_range_active")]
    is_time_range_active: bool,
    #[serde(default, alias = "start_time")]
    start_time: String,
    #[serde(default, alias = "end_time")]
    end_time: String,
    #[serde(default, alias = "skip_sponsors")]
    skip_sponsors: bool,
    #[serde(default, alias = "embed_tags")]
    embed_tags: bool,
    #[serde(default, alias = "embed_thumbnail")]
    embed_thumbnail: bool,
    #[serde(default, alias = "mute_audio")]
    mute_audio: bool,
    #[serde(default, alias = "download_subs")]
    download_subs: bool,
    #[serde(default, alias = "download_chat")]
    download_chat: bool,
    #[serde(default, alias = "subs_code")]
    subs_code: String,
    #[serde(default, alias = "embed_subs")]
    embed_subs: bool,
    #[serde(default, alias = "meta_sub_langs")]
    meta_sub_langs: Vec<String>,
    #[serde(default, alias = "meta_auto_langs")]
    meta_auto_langs: Vec<String>,
    #[serde(default, alias = "video_codec")]
    video_codec: Option<String>,
    #[serde(default, alias = "audio_codec")]
    audio_codec: Option<String>,
    #[serde(default, alias = "video_bitrate")]
    video_bitrate: Option<String>,
    #[serde(default, alias = "audio_bitrate")]
    audio_bitrate: Option<String>,
    #[serde(default, alias = "video_fps")]
    video_fps: Option<String>,
    #[serde(default, alias = "audio_sample_rate")]
    audio_sample_rate: Option<String>,
    #[serde(default, alias = "prefer_ffmpeg_while_converting")]
    prefer_ffmpeg_while_converting: bool,
    #[serde(default, alias = "prefer_ffmpeg_while_downloading")]
    prefer_ffmpeg_while_downloading: bool,
    #[serde(default, alias = "custom_args")]
    custom_args: Option<Vec<String>>,
    #[serde(default, alias = "client_task_id")]
    client_task_id: Option<String>,
}

#[tauri::command]
pub fn start_download(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: DownloadOptions,
) -> Result<String, String> {
    println!("Received download request: {:?}", options);

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate);
    let explicitly_selected_video_codec = options.video_codec.as_deref().is_some_and(|codec| {
        !codec.trim().is_empty()
            && !codec.eq_ignore_ascii_case("auto")
            && !codec.eq_ignore_ascii_case("copy")
    });
    let explicitly_selected_audio_codec = options.audio_codec.as_deref().is_some_and(|codec| {
        !codec.trim().is_empty()
            && !codec.eq_ignore_ascii_case("auto")
            && !codec.eq_ignore_ascii_case("copy")
    });
    let conversion_requested = options.video_codec.as_deref().is_some_and(|codec| {
        !codec.is_empty()
            && !codec.eq_ignore_ascii_case("auto")
            && !codec.eq_ignore_ascii_case("copy")
    }) || options.audio_codec.as_deref().is_some_and(|codec| {
        !codec.is_empty()
            && !codec.eq_ignore_ascii_case("auto")
            && !codec.eq_ignore_ascii_case("copy")
    }) || options.video_bitrate.is_some()
        || options.audio_bitrate.is_some()
        || options.video_fps.is_some()
        || options.audio_sample_rate.is_some();
    let config = config_mgr.config.lock().unwrap();
    let mut effective_options = options;
    let format_id = if effective_options.mode == "audio" {
        effective_options.audio_format.as_deref()
    } else {
        effective_options.video_format.as_deref()
    };
    let is_gif = effective_options.mode == "video"
        && effective_options
            .video_format
            .as_deref()
            .is_some_and(|format| format.eq_ignore_ascii_case("gif"));
    if let Some(format_id) = format_id.filter(|_| !is_gif) {
        crate::system::formats::validate_codec_support(
            format_id,
            effective_options.video_codec.as_deref(),
            true,
            false,
        )?;
        crate::system::formats::validate_codec_support(
            format_id,
            effective_options.audio_codec.as_deref(),
            false,
            false,
        )?;
    }
    let (eff_vcodec, eff_acodec) = crate::system::formats::resolve_effective_codecs(
        format_id.filter(|_| !is_gif),
        effective_options.video_codec.as_deref(),
        effective_options.audio_codec.as_deref(),
        Some(&config.default_video_codec),
        Some(&config.default_audio_codec),
    );
    if effective_options.video_codec.is_none()
        || effective_options.video_codec.as_deref() == Some("")
        || effective_options.video_codec.as_deref() == Some("auto")
    {
        effective_options.video_codec = eff_vcodec;
    }
    if effective_options.audio_codec.is_none()
        || effective_options.audio_codec.as_deref() == Some("")
        || effective_options.audio_codec.as_deref() == Some("auto")
    {
        effective_options.audio_codec = eff_acodec;
    }
    if is_gif {
        effective_options.video_codec = None;
        effective_options.audio_codec = None;
        effective_options.mute_audio = true;
    }

    let options = effective_options;
    let mut args: Vec<String> = options
        .custom_args
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|arg| arg.trim())
        .filter(|arg| !arg.is_empty() && *arg != "--")
        .map(str::to_string)
        .collect();

    let direct_ffmpeg_features_supported = !options.is_time_range_active
        && !options.skip_sponsors
        && !options.embed_tags
        && !options.embed_thumbnail
        && !options.download_subs
        && !options.download_chat
        && !options.embed_subs;
    let use_ffmpeg_direct_conversion = options.prefer_ffmpeg_while_converting
        && conversion_requested
        && direct_ffmpeg_features_supported;
    if options.prefer_ffmpeg_while_downloading && !use_ffmpeg_direct_conversion {
        args.extend(["--downloader".to_string(), "ffmpeg".to_string()]);
    }

    let req_path = get_requirements_path();
    let ffmpeg_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let ffmpeg_path = req_path.join(ffmpeg_name);
    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_path.to_string_lossy().to_string());

    crate::infrastructure::platform::append_js_runtime_args(&mut args);

    if !options.path.is_empty() {
        args.push("-P".to_string());
        args.push(options.path.clone());
    }

    args.push("--concurrent-fragments".to_string());
    args.push("3".to_string());

    if config.cookies_browser.to_lowercase() != "none" && !config.cookies_browser.trim().is_empty()
    {
        args.push("--cookies-from-browser".to_string());
        args.push(config.cookies_browser.to_lowercase());
    }

    if options.mode == "audio" {
        let selected_audio_format = options.audio_format.as_ref().map(|f| f.to_lowercase());
        let audio_target_format = selected_audio_format.as_deref().unwrap_or("m4a");
        if audio_target_format == "aiff" {
            args.extend(["-f".to_string(), "ba".to_string()]);
            args.extend(["--recode-video".to_string(), "aiff".to_string()]);
            let codec = options.audio_codec.as_deref().unwrap_or("").trim();
            let codec = if codec.is_empty() || codec.eq_ignore_ascii_case("auto") {
                crate::infrastructure::ffmpeg::codecs::default_audio_codec_for_format("aiff")
            } else {
                crate::infrastructure::ffmpeg::codecs::map_audio_codec(codec)
            };
            let mut pp_args = vec!["-vn".to_string(), "-c:a".to_string(), codec];
            if let Some(sample_rate) = parse_sample_rate(options.audio_sample_rate.as_deref()) {
                pp_args.extend(["-ar".to_string(), sample_rate.to_string()]);
            }
            args.extend([
                "--postprocessor-args".to_string(),
                format!("VideoConvertor+ffmpeg_o:{}", pp_args.join(" ")),
            ]);
        } else {
            let uses_audio_format = matches!(
                selected_audio_format.as_deref(),
                Some("aac" | "alac" | "flac" | "m4a" | "mp3" | "opus" | "vorbis" | "wav" | "ogg")
            );

            let mut audio_selector: Option<String> = None;
            if uses_audio_format {
                args.push("-x".to_string());
                if let Some(fmt_lower) = selected_audio_format.as_ref() {
                    args.push("--audio-format".to_string());
                    args.push(if fmt_lower == "ogg" {
                        "vorbis".to_string()
                    } else {
                        fmt_lower.clone()
                    });
                }
                if options
                    .audio_bitrate
                    .as_deref()
                    .and_then(|value| parse_kbps(Some(value)))
                    .is_none()
                {
                    if let Some(ref quality) = options.audio_quality {
                        let q_arg = quality.replace("kbps", "K");
                        args.push("--audio-quality".to_string());
                        args.push(q_arg);
                    }
                }
                let target_codec = options.audio_codec.as_deref().unwrap_or("").trim();
                let bitrate = parse_kbps(options.audio_bitrate.as_deref());
                let sample_rate = parse_sample_rate(options.audio_sample_rate.as_deref());
                if !target_codec.is_empty() || bitrate.is_some() || sample_rate.is_some() {
                    let codec =
                        if target_codec.is_empty() || target_codec.eq_ignore_ascii_case("auto") {
                            crate::infrastructure::ffmpeg::codecs::default_audio_codec_for_format(
                                selected_audio_format.as_deref().unwrap_or(""),
                            )
                        } else {
                            crate::infrastructure::ffmpeg::codecs::map_audio_codec(target_codec)
                        };
                    let mut pp_args = vec!["-c:a".to_string(), codec];
                    if let Some(bitrate) = bitrate {
                        pp_args.extend(["-b:a".to_string(), format!("{bitrate}k")]);
                    }
                    if let Some(sample_rate) = sample_rate {
                        pp_args.extend(["-ar".to_string(), sample_rate.to_string()]);
                    }
                    args.push("--postprocessor-args".to_string());
                    args.push(format!("ExtractAudio+ffmpeg_o:{}", pp_args.join(" ")));
                }
                audio_selector = Some("ba".to_string());
            }
            if let Some(selector) = audio_selector {
                args.push("-f".to_string());
                args.push(selector);
            }
        }
    } else {
        let fmt = options
            .video_format
            .as_deref()
            .unwrap_or("mp4")
            .to_lowercase();
        let gif = fmt == "gif";
        let (height, quality_fps) = parse_quality_limits(options.video_quality.as_deref());
        let target_fps = options
            .video_fps
            .as_deref()
            .and_then(|value| value.trim().parse::<u32>().ok())
            .or(quality_fps);
        let selector = video_format_selector(height, target_fps, gif);
        args.extend(["-f".to_string(), selector]);

        if gif {
            args.extend(["--recode-video".to_string(), "gif".to_string()]);
            let mut gif_args = vec!["-c:v".to_string(), "gif".to_string(), "-an".to_string()];
            let gif_fps = target_fps;
            if let (Some(height), Some(fps)) = (height, gif_fps) {
                gif_args.extend([
                    "-vf".to_string(),
                    format!("scale=-2:{height}"),
                    "-r".to_string(),
                    fps.to_string(),
                ]);
            } else if let Some(height) = height {
                gif_args.extend(["-vf".to_string(), format!("scale=-2:{height}")]);
            } else if let Some(fps) = gif_fps {
                gif_args.extend(["-r".to_string(), fps.to_string()]);
            }
            args.push("--postprocessor-args".to_string());
            args.push(format!("VideoConvertor+ffmpeg_o:{}", gif_args.join(" ")));
        } else {
            let video_bitrate = parse_kbps(options.video_bitrate.as_deref());
            let audio_bitrate = parse_kbps(options.audio_bitrate.as_deref());
            let sample_rate = parse_sample_rate(options.audio_sample_rate.as_deref());
            let requested_video_codec = options.video_codec.as_deref().unwrap_or("").trim();
            let requested_audio_codec = options.audio_codec.as_deref().unwrap_or("").trim();
            let needs_encode = explicitly_selected_video_codec
                || explicitly_selected_audio_codec
                || video_bitrate.is_some()
                || audio_bitrate.is_some()
                || sample_rate.is_some()
                || target_fps.is_some();
            if needs_encode {
                args.extend(["--merge-output-format".to_string(), fmt.clone()]);
                args.extend(["--recode-video".to_string(), fmt.clone()]);
                let video_codec = download_video_encoder(requested_video_codec, &fmt, &config);
                let audio_codec = if requested_audio_codec.is_empty()
                    || requested_audio_codec.eq_ignore_ascii_case("auto")
                {
                    crate::infrastructure::ffmpeg::codecs::default_audio_codec_for_format(&fmt)
                } else {
                    crate::infrastructure::ffmpeg::codecs::map_audio_codec(requested_audio_codec)
                };
                let mut pp_args = vec!["-c:v".to_string(), video_codec];
                if options.mute_audio {
                    pp_args.push("-an".to_string());
                } else {
                    pp_args.extend(["-c:a".to_string(), audio_codec]);
                    if let Some(bitrate) = audio_bitrate {
                        pp_args.extend(["-b:a".to_string(), format!("{bitrate}k")]);
                    } else {
                        pp_args.extend(["-b:a".to_string(), "192k".to_string()]);
                    }
                    if let Some(sample_rate) = sample_rate {
                        pp_args.extend(["-ar".to_string(), sample_rate.to_string()]);
                    }
                }
                if let Some(bitrate) = video_bitrate {
                    pp_args.extend(["-b:v".to_string(), format!("{bitrate}k")]);
                }
                if let Some(fps) = target_fps {
                    pp_args.extend(["-r".to_string(), fps.to_string()]);
                }
                if let Some(height) = height {
                    pp_args.extend(["-vf".to_string(), format!("scale=-2:{height}")]);
                }
                args.push("--postprocessor-args".to_string());
                let encode_args = pp_args.join(" ");
                args.push(format!("Merger+ffmpeg_o:{encode_args}"));
                args.push("--postprocessor-args".to_string());
                args.push(format!("VideoConvertor+ffmpeg_o:{encode_args}"));
            } else {
                args.extend(["--merge-output-format".to_string(), fmt]);
            }
        }
    }

    if options.is_time_range_active {
        if let (Some(start), Some(end)) = (
            parse_time_to_seconds(&options.start_time),
            parse_time_to_seconds(&options.end_time),
        ) {
            let total = (end - start).max(0.0);
            if total > 0.0 {
                state.set_ffmpeg_range(task_id.clone(), total);
            }
        }
        args.push("--download-sections".to_string());
        args.push(format!("*{}-{}", options.start_time, options.end_time));
        args.push("--force-keyframes-at-cuts".to_string());
    }

    if options.embed_thumbnail {
        args.push("--embed-thumbnail".to_string());
    }

    if options.skip_sponsors {
        args.push("--sponsorblock-remove".to_string());
        args.push("sponsor".to_string());
    }

    if options.embed_tags {
        args.push("--embed-metadata".to_string());
    }

    let custom_output_template = options
        .custom_filename
        .as_deref()
        .map(sanitize_custom_filename)
        .filter(|name| !name.is_empty())
        .map(|name| format!("{}.%(ext)s", name.replace('%', "%%")));
    let configured_output_template = if config.title_template.trim().is_empty() {
        None
    } else {
        let mut template = config.title_template.trim().to_string();
        if !template.contains(".%(ext)s") {
            template.push_str(".%(ext)s");
        }
        Some(template)
    };

    if let Some(output_template) = custom_output_template.or(configured_output_template) {
        args.push("-o".to_string());
        args.push(output_template);
    }

    let subtitle_args = build_subtitle_args(&options);
    args.extend(subtitle_args);

    args.push(options.url.clone());

    let cmd = BridgeCommand {
        command: if use_ffmpeg_direct_conversion {
            "download_ffmpeg"
        } else {
            "download"
        }
        .to_string(),
        id: task_id.clone(),
        args,
    };

    drop(config);
    state.send_command(&app_handle, cmd)?;

    Ok(task_id)
}

fn sanitize_custom_filename(filename: &str) -> String {
    filename
        .trim()
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim_matches([' ', '.'])
        .to_string()
}

#[tauri::command]
pub fn cancel_download(
    app_handle: AppHandle,
    state: State<BridgeState>,
    task_id: String,
) -> Result<(), String> {
    if task_id.trim().is_empty() {
        return Err("Task ID cannot be empty.".to_string());
    }

    let trimmed = task_id.trim().to_string();
    state.cancel_batch(&trimmed);

    let cmd = BridgeCommand {
        command: "cancel".to_string(),
        id: trimmed.clone(),
        args: Vec::new(),
    };

    let result = state.send_command(&app_handle, cmd);
    state.clear_ffmpeg_range(trimmed.as_str());
    result
}

use crate::app::task_id::generate;
use crate::infrastructure::platform::get_requirements_path;
