use super::quality::{clamp, qscale_from_crf, qscale_from_percent};
use super::CompressOptions;
use crate::infrastructure::ffmpeg::codecs::{extract_file_extension, map_audio_codec};
use crate::infrastructure::ffmpeg::hwaccel::{
    append_hwaccel_input_args, append_video_quality_args, find_vaapi_device,
    resolve_video_encoder_with_probe, vaapi_upload_filter, ResolvedVideoEncoder,
};
use std::path::Path;

fn parse_kbps(value: Option<&str>, max: u32) -> Option<u32> {
    value?
        .trim()
        .trim_end_matches("kbps")
        .trim()
        .parse::<u32>()
        .ok()
        .filter(|value| *value > 0 && *value <= max)
}

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

fn effective_output_format(options: &CompressOptions, output_path: &str) -> String {
    for candidate in [
        options.output_format.as_deref(),
        options.source_format.as_deref(),
    ] {
        if let Some(raw) = candidate {
            let clean = raw.trim().trim_start_matches('.').to_ascii_lowercase();
            if !clean.is_empty() {
                return clean;
            }
        }
    }
    let from_output = extract_file_extension(output_path);
    if !from_output.is_empty() {
        return from_output;
    }
    let from_input = extract_file_extension(&options.input_path);
    if !from_input.is_empty() {
        return from_input;
    }
    "mp4".to_string()
}

pub(super) fn build_ffmpeg_args_with_probe<F>(
    options: &CompressOptions,
    output_path: &str,
    hwaccel: Option<&str>,
    vaapi_device: Option<&str>,
    probe_encoder: F,
) -> Result<Vec<String>, String>
where
    F: FnMut(&str) -> bool,
{
    let category = options
        .category
        .as_deref()
        .unwrap_or("video")
        .trim()
        .to_lowercase();
    let output_format = effective_output_format(options, output_path);

    let resolved_video: Option<ResolvedVideoEncoder> = if category == "video" {
        Some(resolve_video_encoder_with_probe(
            &output_format,
            options.video_codec.as_deref(),
            hwaccel,
            vaapi_device,
            true,
            probe_encoder,
        ))
    } else {
        None
    };

    let mut args = vec![
        "-hide_banner".to_string(),
        "-y".to_string(),
        "-threads".to_string(),
        "0".to_string(),
    ];

    // Only emit pre-input hardware flags when actively using a verified hardware video encoder.
    if let Some(ref video) = resolved_video {
        append_hwaccel_input_args(&mut args, video.backend.as_ref());
    }

    args.push("-i".to_string());
    args.push(options.input_path.clone());

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

    let requested_audio_codec = options
        .audio_codec
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("auto"))
        .map(map_audio_codec);
    let audio_is_copy = requested_audio_codec.as_deref() == Some("copy");

    if let Some(ref video) = resolved_video {
        args.push("-c:v".to_string());
        args.push(video.encoder.clone());
        if video.encoder == "libx264" || video.encoder == "libx265" {
            args.push("-preset".to_string());
            args.push("veryfast".to_string());
        }
        if let Some(upload) = vaapi_upload_filter(video.backend.as_ref()) {
            args.push("-vf".to_string());
            args.push(upload.to_string());
        }
    }

    if let Some(codec) = requested_audio_codec {
        args.push("-c:a".to_string());
        args.push(codec);
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
            if let Some(ref video) = resolved_video {
                append_video_quality_args(&mut args, &video.encoder, crf);
            }
            if !audio_is_copy {
                args.push("-b:a".to_string());
                args.push("192k".to_string());
            }
        } else if !audio_is_copy {
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
            if !audio_is_copy {
                let target_kbps = clamp(kbps, 32.0, 320.0);
                args.push("-b:a".to_string());
                args.push(format!("{}k", target_kbps.round().max(24.0)));
            }
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
            if resolved_video
                .as_ref()
                .is_some_and(|video| video.encoder != "copy")
            {
                args.push("-b:v".to_string());
                args.push(format!("{}k", video_kbps.round().max(100.0)));
            }
            if audio_kbps > 0.0 && !audio_is_copy {
                args.push("-b:a".to_string());
                args.push(format!("{}k", audio_kbps.round().max(24.0)));
            }
        }
    } else {
        return Err("Target size could not be resolved.".to_string());
    }

    if let Some(kbps) = parse_kbps(options.video_bitrate.as_deref(), 100_000) {
        if category == "video"
            && resolved_video
                .as_ref()
                .is_some_and(|video| video.encoder != "copy")
        {
            args.extend(["-b:v".to_string(), format!("{kbps}k")]);
        }
    }
    if let Some(kbps) = parse_kbps(options.audio_bitrate.as_deref(), 1_000) {
        if !audio_is_copy {
            args.extend(["-b:a".to_string(), format!("{kbps}k")]);
        }
    }

    args.push(output_path.to_string());
    Ok(args)
}

pub(super) fn build_ffmpeg_args(
    options: &CompressOptions,
    output_path: &str,
    hwaccel: Option<&str>,
    ffmpeg_path: &Path,
) -> Result<Vec<String>, String> {
    let vaapi_device = find_vaapi_device();
    build_ffmpeg_args_with_probe(
        options,
        output_path,
        hwaccel,
        vaapi_device.as_deref(),
        |encoder| {
            crate::infrastructure::ffmpeg::codecs::ffmpeg_encoder_smoke_test(ffmpeg_path, encoder)
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_compress_options(category: &str, format: &str, mode: &str) -> CompressOptions {
        CompressOptions {
            input_path: format!("input.{format}"),
            output_dir: None,
            output_name: None,
            output_format: Some(format.to_string()),
            category: Some(category.to_string()),
            compress_mode: Some(mode.to_string()),
            target_percent: Some(60.0),
            target_size_bytes: Some(10_000_000),
            crf: Some(26),
            video_codec: None,
            audio_codec: None,
            video_bitrate: None,
            audio_bitrate: None,
            source_duration_seconds: Some(60.0),
            source_size_bytes: Some(20_000_000),
            source_format: Some(format.to_string()),
            client_task_id: None,
        }
    }

    #[test]
    fn percent_mode_with_cuda_emits_nvenc_and_no_hwaccel_output_format() {
        let opts = sample_compress_options("video", "mp4", "percent");
        let args = build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("cuda"), None, |enc| {
            enc == "h264_nvenc"
        })
        .unwrap();
        assert!(args.windows(2).any(|w| w == ["-hwaccel", "cuda"]));
        assert!(!args.iter().any(|a| a == "-hwaccel_output_format"));
        assert!(args.windows(2).any(|w| w == ["-c:v", "h264_nvenc"]));
    }

    #[test]
    fn size_mode_with_amf_emits_h264_amf_without_invalid_hwaccel_flag() {
        let opts = sample_compress_options("video", "mp4", "size");
        let args = build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("amf"), None, |enc| {
            enc == "h264_amf"
        })
        .unwrap();
        assert!(args.windows(2).any(|w| w == ["-c:v", "h264_amf"]));
        assert!(!args.iter().any(|a| a == "-hwaccel"));
        assert!(!args.iter().any(|a| a == "-hwaccel_output_format"));
    }

    #[test]
    fn quality_mode_maps_crf_to_encoder_specific_flags() {
        let opts = sample_compress_options("video", "mp4", "quality");

        let nvenc = build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("cuda"), None, |enc| {
            enc == "h264_nvenc"
        })
        .unwrap();
        assert!(!nvenc.iter().any(|a| a == "-crf"));
        assert!(nvenc.windows(2).any(|w| w == ["-cq", "26"]));

        let qsv = build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("qsv"), None, |enc| {
            enc == "h264_qsv"
        })
        .unwrap();
        assert!(!qsv.iter().any(|a| a == "-crf"));
        assert!(qsv.windows(2).any(|w| w == ["-global_quality", "26"]));

        let amf = build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("amf"), None, |enc| {
            enc == "h264_amf"
        })
        .unwrap();
        assert!(!amf.iter().any(|a| a == "-crf"));
        assert!(amf.windows(2).any(|w| w == ["-qp_i", "26"]));

        let vt =
            build_ffmpeg_args_with_probe(&opts, "out.mp4", Some("videotoolbox"), None, |enc| {
                enc == "h264_videotoolbox"
            })
            .unwrap();
        assert!(!vt.iter().any(|a| a == "-crf"));
        assert!(vt.windows(2).any(|w| w[0] == "-q:v"));

        let vaapi = build_ffmpeg_args_with_probe(
            &opts,
            "out.mp4",
            Some("vaapi"),
            Some("/dev/dri/renderD128"),
            |enc| enc == "h264_vaapi",
        )
        .unwrap();
        assert!(!vaapi.iter().any(|a| a == "-crf"));
        assert!(vaapi.windows(2).any(|w| w == ["-qp", "26"]));
        assert!(vaapi
            .windows(2)
            .any(|w| w == ["-vf", "format=nv12,hwupload"]));
    }

    #[test]
    fn webm_quality_with_cuda_stays_vp9_without_hwaccel() {
        let opts = sample_compress_options("video", "webm", "quality");
        let args =
            build_ffmpeg_args_with_probe(&opts, "out.webm", Some("cuda"), None, |_| true).unwrap();
        assert!(args.windows(2).any(|w| w == ["-c:v", "libvpx-vp9"]));
        assert!(args.windows(2).any(|w| w == ["-crf", "26"]));
        assert!(args.windows(2).any(|w| w == ["-b:v", "0"]));
        assert!(!args.iter().any(|a| a == "-hwaccel"));
    }

    #[test]
    fn audio_and_image_compression_never_emit_hwaccel() {
        for (cat, fmt) in [("audio", "mp3"), ("image", "jpg")] {
            let opts = sample_compress_options(cat, fmt, "percent");
            let args = build_ffmpeg_args_with_probe(
                &opts,
                &format!("out.{fmt}"),
                Some("cuda"),
                None,
                |_| true,
            )
            .unwrap();
            assert!(!args.iter().any(|a| a == "-hwaccel"));
            assert!(!args.iter().any(|a| a == "-hwaccel_output_format"));
        }
    }
}
