pub fn map_video_codec(value: &str) -> String {
    match value.to_lowercase().as_str() {
        "h264" => "libx264",
        "h265" | "hevc" => "libx265",
        "av1" => "libsvtav1",
        "vp9" => "libvpx-vp9",
        "vp8" => "libvpx",
        "mpeg2" => "mpeg2video",
        "mpeg4" => "mpeg4",
        "h263" => "h263",
        "theora" => "libtheora",
        "wmv" => "wmv2",
        "prores" => "prores_ks",
        "gif" => "gif",
        other => other,
    }
    .to_string()
}

pub fn map_audio_codec(value: &str) -> String {
    match value.to_lowercase().as_str() {
        "aac" => "aac",
        "mp3" => "libmp3lame",
        "opus" => "libopus",
        "vorbis" => "libvorbis",
        "flac" => "flac",
        "alac" => "alac",
        "wav" => "pcm_s16le",
        "aiff" => "pcm_s16be",
        "ac3" => "ac3",
        "wma" => "wmav2",
        "dts" => "dca",
        "lpcm" => "pcm_s16le",
        "midi" => "copy",
        "amr" => "libopencore_amrnb",
        "amr-wb" => "libopencore_amrwb",
        "he-aac" => "aac",
        other => other,
    }
    .to_string()
}

pub fn default_video_codec_for_format(format: &str) -> String {
    let fmt = format.trim().trim_start_matches('.').to_lowercase();
    match fmt.as_str() {
        "webm" => "libvpx-vp9".to_string(),
        "ogv" => "libtheora".to_string(),
        "gif" => "gif".to_string(),
        "vob" => "mpeg2video".to_string(),
        "wmv" => "wmv2".to_string(),
        "prores" => "prores_ks".to_string(),
        _ => "libx264".to_string(),
    }
}

pub fn default_audio_codec_for_format(format: &str) -> String {
    let fmt = format.trim().trim_start_matches('.').to_lowercase();
    match fmt.as_str() {
        "mp3" => "libmp3lame".to_string(),
        "aac" | "m4a" => "aac".to_string(),
        "flac" => "flac".to_string(),
        "wav" => "pcm_s16le".to_string(),
        "aiff" => "pcm_s16be".to_string(),
        "ogg" => "libvorbis".to_string(),
        "opus" => "libopus".to_string(),
        "wma" => "wmav2".to_string(),
        "ac3" => "ac3".to_string(),
        "alac" => "alac".to_string(),
        "webm" | "ogv" => "libopus".to_string(),
        _ => "aac".to_string(),
    }
}

pub fn extract_file_extension(path: &str) -> String {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .trim_start_matches('.')
        .to_lowercase()
}

pub fn is_audio_copy_compatible(source_ext: &str, target_ext: &str) -> bool {
    let src = source_ext.trim().trim_start_matches('.').to_lowercase();
    let tgt = target_ext.trim().trim_start_matches('.').to_lowercase();

    if src.is_empty() || tgt.is_empty() {
        return false;
    }

    if src == tgt {
        return true;
    }

    match tgt.as_str() {
        "mp3" => src == "mp3",
        "wav" => src == "wav",
        "flac" => src == "flac",
        "aac" => src == "aac" || src == "m4a",
        "m4a" => src == "m4a" || src == "aac" || src == "mp4",
        "ogg" | "opus" => src == "ogg" || src == "opus" || src == "webm",
        "webm" | "ogv" => src == "webm" || src == "ogg" || src == "opus",
        "mp4" | "mov" | "m4v" => {
            src == "mp4"
                || src == "mov"
                || src == "m4v"
                || src == "m4a"
                || src == "aac"
                || src == "mp3"
                || src == "flac"
        }
        "mkv" => src != "wav",
        _ => false,
    }
}

pub fn is_video_copy_compatible(source_ext: &str, target_ext: &str) -> bool {
    let src = source_ext.trim().trim_start_matches('.').to_lowercase();
    let tgt = target_ext.trim().trim_start_matches('.').to_lowercase();

    if src.is_empty() || tgt.is_empty() {
        return false;
    }

    if tgt == "gif" {
        return src == "gif";
    }

    if src == tgt {
        return true;
    }

    match tgt.as_str() {
        "mp4" | "mov" | "m4v" => src == tgt,
        "webm" => src == "webm" || src == "ogv",
        "mkv" => src != "gif",
        "avi" => src == "avi" || src == "mp4" || src == "mov",
        _ => false,
    }
}

pub fn map_video_codec_hw(codec: &str, hwaccel: &str) -> String {
    let codec_lower = codec.to_lowercase();
    let hw_lower = hwaccel.to_lowercase();

    match codec_lower.as_str() {
        "h264" => {
            if hw_lower.contains("cuda") {
                "h264_nvenc".to_string()
            } else if hw_lower.contains("qsv") {
                "h264_qsv".to_string()
            } else if hw_lower.contains("amf") {
                "h264_amf".to_string()
            } else if hw_lower.contains("videotoolbox") {
                "h264_videotoolbox".to_string()
            } else if hw_lower.contains("vaapi") {
                "h264_vaapi".to_string()
            } else {
                "libx264".to_string()
            }
        }
        "h265" | "hevc" => {
            if hw_lower.contains("cuda") {
                "hevc_nvenc".to_string()
            } else if hw_lower.contains("qsv") {
                "hevc_qsv".to_string()
            } else if hw_lower.contains("amf") {
                "hevc_amf".to_string()
            } else if hw_lower.contains("videotoolbox") {
                "hevc_videotoolbox".to_string()
            } else if hw_lower.contains("vaapi") {
                "hevc_vaapi".to_string()
            } else {
                "libx265".to_string()
            }
        }
        "av1" => {
            if hw_lower.contains("cuda") {
                "av1_nvenc".to_string()
            } else if hw_lower.contains("qsv") {
                "av1_qsv".to_string()
            } else if hw_lower.contains("vaapi") {
                "av1_vaapi".to_string()
            } else {
                "libaom-av1".to_string()
            }
        }
        "vp9" => {
            if hw_lower.contains("qsv") {
                "vp9_qsv".to_string()
            } else if hw_lower.contains("vaapi") {
                "vp9_vaapi".to_string()
            } else {
                "libvpx-vp9".to_string()
            }
        }
        "copy" => "copy".to_string(),
        other => map_video_codec(other),
    }
}
use std::path::Path;
use std::process::Command;

pub fn validate_ffmpeg_encoders(ffmpeg_path: &Path, args: &[String]) -> Result<(), String> {
    let requested: Vec<&str> = args
        .windows(2)
        .filter(|pair| pair[0] == "-c:v" || pair[0] == "-c:a")
        .map(|pair| pair[1].as_str())
        .filter(|codec| *codec != "copy")
        .collect();
    if requested.is_empty() {
        return Ok(());
    }

    let output = Command::new(ffmpeg_path)
        .args(["-hide_banner", "-encoders"])
        .output()
        .map_err(|error| format!("Unable to inspect FFmpeg encoders: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            "Unable to list encoders from the configured FFmpeg binary.".to_string()
        } else {
            format!("Unable to list FFmpeg encoders: {detail}")
        });
    }

    let listing = String::from_utf8_lossy(&output.stdout);
    for encoder in requested {
        if !ffmpeg_listing_has_encoder(&listing, encoder) {
            return Err(format!(
                "The configured FFmpeg build does not include the '{encoder}' encoder."
            ));
        }
    }
    Ok(())
}

fn ffmpeg_listing_has_encoder(listing: &str, encoder: &str) -> bool {
    listing
        .lines()
        .filter_map(|line| line.split_whitespace().nth(1))
        .any(|available| available == encoder)
}

#[cfg(test)]
mod tests {
    use super::ffmpeg_listing_has_encoder;

    #[test]
    fn encoder_lookup_matches_encoder_column_only() {
        let listing =
            "Encoders:\n V..... h264_nvenc NVIDIA NVENC H.264 encoder\n V..... gif GIF encoder";
        assert!(ffmpeg_listing_has_encoder(listing, "h264_nvenc"));
        assert!(ffmpeg_listing_has_encoder(listing, "gif"));
        assert!(!ffmpeg_listing_has_encoder(listing, "libx264"));
    }
}
