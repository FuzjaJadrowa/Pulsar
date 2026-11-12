use super::quality::{clamp, qscale_from_crf, qscale_from_percent};
use super::CompressOptions;
use crate::infrastructure::ffmpeg::codecs::{map_audio_codec, map_video_codec, map_video_codec_hw};

fn resolve_target_bytes(options: &CompressOptions, mode: &str) -> Option<u64> {
    match mode {
        "size" => options.target_size_bytes,
        "percent" => {
            let percent = options.target_percent.unwrap_or(60.0).clamp(1.0, 100.0);
            options
                .source_size_bytes
                .map(|s| ((s as f64) * (percent / 100.0)).round() as u64)
        }
        _ => None,
    }
}

pub(super) fn build_ffmpeg_args(
    options: &CompressOptions,
    output_path: &str,
    hwaccel: Option<String>,
) -> Result<Vec<String>, String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-y".to_string(),
        "-threads".to_string(),
        "0".to_string(),
    ];

    if let Some(accel) = hwaccel.clone() {
        args.push("-hwaccel".to_string());
        args.push(accel.clone());
        if accel == "cuda" || accel == "qsv" || accel == "d3d11va" {
            args.push("-hwaccel_output_format".to_string());
            args.push(accel);
        }
    }

    args.push("-i".to_string());
    args.push(options.input_path.clone());

    let category = options
        .category
        .as_deref()
        .unwrap_or("video")
        .trim()
        .to_lowercase();

    if category == "audio" {
        args.push("-map".to_string());
        args.push("0:a?".to_string());
        args.push("-vn".to_string());
    } else if category == "image" {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-frames:v".to_string());
        args.push("1".to_string());
    } else {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    let mode = options
        .compress_mode
        .as_deref()
        .unwrap_or("percent")
        .trim()
        .to_lowercase();

    if category == "video" {
        let requested_video_codec = options
            .video_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|c| {
                if let Some(ref accel) = hwaccel {
                    map_video_codec_hw(c, accel)
                } else {
                    map_video_codec(c)
                }
            });
        if let Some(codec) = requested_video_codec {
            args.push("-c:v".to_string());
            args.push(codec.clone());
            if (codec == "libx264" || codec == "libx265")
                && options.video_codec.as_deref().unwrap_or("").to_lowercase() != "copy"
            {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }
        } else if mode == "quality" {
            args.push("-c:v".to_string());
            let default_codec = if let Some(ref accel) = hwaccel {
                map_video_codec_hw("h264", accel)
            } else {
                "libx264".to_string()
            };
            args.push(default_codec.clone());
            if default_codec == "libx264" {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }
        } else if hwaccel.is_none() {
            let codec = crate::infrastructure::ffmpeg::codecs::default_video_codec_for_format(
                options.output_format.as_deref().unwrap_or("mp4"),
            );
            args.push("-c:v".to_string());
            args.push(codec.clone());
            if codec == "libx264" || codec == "libx265" {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }
        }

        let requested_audio_codec = options
            .audio_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(map_audio_codec);
        if let Some(codec) = requested_audio_codec {
            args.push("-c:a".to_string());
            args.push(codec);
        }
    } else {
        let requested_audio_codec = options
            .audio_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(map_audio_codec);
        if let Some(codec) = requested_audio_codec {
            args.push("-c:a".to_string());
            args.push(codec);
        }
    }

    if category == "image" {
        let mut quality_percent = options.target_percent.unwrap_or(60.0);
        if mode == "size" {
            if let (Some(target), Some(source)) =
                (options.target_size_bytes, options.source_size_bytes)
            {
                if source > 0 {
                    quality_percent = (target as f64 / source as f64) * 100.0;
                }
            }
        } else if mode == "quality" {
            let crf = options.crf.unwrap_or(26);
            let qscale = qscale_from_crf(crf);
            args.push("-q:v".to_string());
            args.push(qscale.to_string());
            args.push(output_path.to_string());
            return Ok(args);
        }

        let qscale = qscale_from_percent(quality_percent);
        args.push("-q:v".to_string());
        args.push(qscale.to_string());
        args.push(output_path.to_string());
        return Ok(args);
    }

    let duration = options.source_duration_seconds.unwrap_or(0.0);
    let target_bytes = resolve_target_bytes(options, mode.as_str());
    if target_bytes.is_some() && duration <= 0.0 {
        return Err(
            "A valid source duration is required to target a compressed file size. The app will not truncate the output to force a size limit."
                .to_string(),
        );
    }
    let total_kbps = if let (Some(bytes), true) = (target_bytes, duration > 0.0) {
        Some((bytes as f64 * 8.0) / (duration * 1000.0))
    } else {
        None
    };

    if mode == "quality" {
        let crf = options.crf.unwrap_or(26).min(51);
        if category == "video" {
            args.push("-crf".to_string());
            args.push(crf.to_string());
            args.push("-b:a".to_string());
            args.push("192k".to_string());
        } else {
            let source_kbps = if duration > 0.0 {
                options
                    .source_size_bytes
                    .map(|s| (s as f64 * 8.0) / (duration * 1000.0))
                    .unwrap_or(192.0)
            } else {
                192.0
            };
            let factor = 1.0 - (crf as f64 / 51.0) * 0.7;
            let target_kbps = clamp(source_kbps * factor, 48.0, 320.0);
            args.push("-b:a".to_string());
            args.push(format!("{}k", target_kbps.round().max(24.0)));
        }
    } else if let Some(kbps) = total_kbps {
        if category == "audio" {
            let target_kbps = clamp(kbps, 32.0, 320.0);
            args.push("-b:a".to_string());
            args.push(format!("{}k", target_kbps.round().max(24.0)));
        } else {
            if kbps < 232.0 {
                return Err(
                    "The requested target is too small for minimum video and audio bitrates. Increase the target size or use quality mode."
                        .to_string(),
                );
            }
            let mut audio_kbps = clamp(kbps * 0.1, 64.0, 192.0);
            let mut video_kbps = kbps - audio_kbps;
            // Keep a safe floor for video bitrate in constrained-size mode.
            if video_kbps < 200.0 {
                video_kbps = 200.0;
                audio_kbps = (kbps - video_kbps).max(32.0);
            }
            args.push("-b:v".to_string());
            args.push(format!("{}k", video_kbps.round().max(100.0)));
            if audio_kbps > 0.0 {
                args.push("-b:a".to_string());
                args.push(format!("{}k", audio_kbps.round().max(24.0)));
            }
        }
    } else {
        return Err("Target size could not be resolved.".to_string());
    }

    args.push(output_path.to_string());
    Ok(args)
}
