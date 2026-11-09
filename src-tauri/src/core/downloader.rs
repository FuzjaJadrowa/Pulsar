mod args;
mod bridge;
pub mod file_ops;
use self::args::{apply_filters, build_audio_filters, build_subtitle_args, build_video_filters};
use self::bridge::parse_time_to_seconds;
use crate::system::config::ConfigManager;
pub use bridge::{is_terminal_event, terminal_event_succeeded, BridgeCommand, BridgeState};
use serde::Deserialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn init_bridge(app_handle: AppHandle, state: State<BridgeState>) -> Result<(), String> {
    state.init(&app_handle)
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    url: String,
    path: String,
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
    #[serde(default, alias = "geo_bypass")]
    geo_bypass: bool,
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
        .unwrap_or_else(generate_task_id);
    let config = config_mgr.config.lock().unwrap();
    let mut effective_options = options;
    let format_id = if effective_options.mode == "audio" {
        effective_options.audio_format.as_deref()
    } else {
        effective_options.video_format.as_deref()
    };
    if let Some(format_id) = format_id {
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
        format_id,
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

    let req_path = get_requirements_path();
    let ffmpeg_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let ffmpeg_path = req_path.join(ffmpeg_name);
    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_path.to_string_lossy().to_string());

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
        let audio_filters = build_audio_filters(&options);
        let has_audio_filters = !audio_filters.is_empty();
        let selected_audio_format = options.audio_format.as_ref().map(|f| f.to_lowercase());
        let uses_audio_format = matches!(
            selected_audio_format.as_deref(),
            Some("aac" | "alac" | "flac" | "m4a" | "mp3" | "opus" | "vorbis" | "wav")
        );

        let mut audio_selector: Option<String> = None;
        if uses_audio_format {
            args.push("-x".to_string());
            if let Some(fmt_lower) = selected_audio_format {
                args.push("--audio-format".to_string());
                args.push(fmt_lower);
            }
            if let Some(ref quality) = options.audio_quality {
                let q_arg = quality.replace("kbps", "K");
                args.push("--audio-quality".to_string());
                args.push(q_arg);
            }
            if has_audio_filters {
                audio_selector = Some(apply_filters("ba", &audio_filters));
            }
        } else if let Some(fmt_lower) = selected_audio_format {
            let base = apply_filters(&format!("ba[ext={}]", fmt_lower), &audio_filters);
            let fallback = apply_filters("ba", &audio_filters);
            audio_selector = Some(format!("{}/{}", base, fallback));
            if matches!(fmt_lower.as_str(), "aiff" | "ogg") {
                args.push("--remux-video".to_string());
                args.push(fmt_lower);
            }
        }
        if let Some(selector) = audio_selector {
            args.push("-f".to_string());
            args.push(selector);
        }
    } else {
        let video_filters = build_video_filters(&options);
        let audio_filters = build_audio_filters(&options);
        let has_filters = !video_filters.is_empty() || !audio_filters.is_empty();
        let mut format_selector: Option<String> = None;
        let mut remux_format: Option<String> = None;
        let mut merge_output: Option<String> = None;

        if let Some(ref fmt) = options.video_format {
            let fmt_lower = fmt.to_lowercase();
            match fmt_lower.as_str() {
                "gif" => {
                    args.push("--recode-video".to_string());
                    args.push("gif".to_string());
                    if has_filters || options.mute_audio {
                        format_selector = Some(apply_filters("bv", &video_filters));
                    }
                }
                "mp4" | "mkv" | "webm" | "mov" | "flv" | "avi" => {
                    merge_output = Some(fmt_lower);
                    if options.mute_audio {
                        format_selector = Some(apply_filters("bv", &video_filters));
                    } else if has_filters {
                        let video_sel = apply_filters("bv*", &video_filters);
                        let audio_sel = apply_filters("ba", &audio_filters);
                        format_selector = Some(format!(
                            "{}+{}/{}/{}+{}/b",
                            video_sel, audio_sel, video_sel, video_sel, audio_sel
                        ));
                    }
                }
                _ => {
                    let video_ext =
                        apply_filters(&format!("bv*[ext={}]", fmt_lower), &video_filters);
                    let audio_ext =
                        apply_filters(&format!("ba[ext={}]", fmt_lower), &audio_filters);
                    let video_fallback = apply_filters("bv*", &video_filters);
                    let audio_fallback = apply_filters("ba", &audio_filters);
                    if options.mute_audio {
                        format_selector = Some(format!("{}/bv", video_ext));
                    } else {
                        format_selector = Some(format!(
                            "{}+{}/{}/{}+{}/b",
                            video_ext, audio_ext, video_ext, video_fallback, audio_fallback
                        ));
                    }
                    remux_format = Some(fmt_lower);
                }
            }
        } else if options.mute_audio {
            format_selector = Some(apply_filters("bv", &video_filters));
        } else if has_filters {
            let video_sel = apply_filters("bv*", &video_filters);
            let audio_sel = apply_filters("ba", &audio_filters);
            format_selector = Some(format!(
                "{}+{}/{}/{}+{}/b",
                video_sel, audio_sel, video_sel, video_sel, audio_sel
            ));
        }

        if let Some(selector) = format_selector {
            args.push("-f".to_string());
            args.push(selector);
        }
        if let Some(merge) = merge_output {
            args.push("--merge-output-format".to_string());
            args.push(merge);
        }
        if let Some(remux) = remux_format {
            args.push("--remux-video".to_string());
            args.push(remux);
        }
        if let Some(ref quality) = options.video_quality {
            let res = quality.replace("p", "");
            args.push("-S".to_string());
            args.push(format!("res:{}", res));
        }
    }

    if options.is_time_range_active {
        if let (Some(start), Some(end)) = (
            parse_time_to_seconds(&options.start_time),
            parse_time_to_seconds(&options.end_time),
        ) {
            let total = (end - start).max(0.0);
            if total > 0.0 {
                // Store expected ffmpeg range so progress events can expose ETA.
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

    if options.geo_bypass {
        args.push("--geo-bypass".to_string());
    }

    if options.embed_tags {
        args.push("--embed-metadata".to_string());
    }

    if !config.title_template.trim().is_empty() {
        let mut output_template = config.title_template.trim().to_string();
        if !output_template.contains(".%(ext)s") {
            output_template.push_str(".%(ext)s");
        }
        args.push("-o".to_string());
        args.push(output_template);
    }

    let subtitle_args = build_subtitle_args(&options);
    args.extend(subtitle_args);

    args.push(options.url.clone());

    let cmd = BridgeCommand {
        command: "download".to_string(),
        id: task_id.clone(),
        args,
    };

    state.send_command(&app_handle, cmd)?;

    Ok(task_id)
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

use crate::core::utils::{generate_task_id, get_requirements_path};
