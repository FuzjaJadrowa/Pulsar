use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize, Debug, Clone)]
pub struct FormatItem {
    pub id: String,
    #[serde(rename = "type")]
    #[allow(dead_code)]
    pub format_type: String,
    #[serde(default)]
    pub video_codecs: Vec<String>,
    #[serde(default)]
    pub audio_codecs: Vec<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct FormatCatalog {
    #[serde(default)]
    pub dformats: Vec<FormatItem>,
    #[serde(default)]
    pub cformats: Vec<FormatItem>,
}

static FORMAT_CATALOG: OnceLock<FormatCatalog> = OnceLock::new();

pub fn get_format_catalog() -> &'static FormatCatalog {
    FORMAT_CATALOG.get_or_init(|| {
        let raw = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../public/assets/format.json"
        ));
        serde_json::from_str::<FormatCatalog>(raw).unwrap_or_else(|_| FormatCatalog {
            dformats: Vec::new(),
            cformats: Vec::new(),
        })
    })
}

pub fn find_format_info(format_id: &str) -> Option<FormatItem> {
    find_in_formats(format_id, true)
}

pub fn find_convert_format_info(format_id: &str) -> Option<FormatItem> {
    find_in_formats(format_id, false)
}

fn find_in_formats(format_id: &str, download: bool) -> Option<FormatItem> {
    let clean = format_id.trim().trim_start_matches('.').to_lowercase();
    if clean.is_empty() {
        return None;
    }

    let catalog = get_format_catalog();
    let formats = if download {
        &catalog.dformats
    } else {
        &catalog.cformats
    };
    formats
        .iter()
        .find(|f| f.id.eq_ignore_ascii_case(&clean))
        .cloned()
}

pub fn normalize_codec_name(raw: &str) -> String {
    let lower = raw.trim().to_lowercase();
    match lower.as_str() {
        "h264" | "libx264" | "avc" | "avc1" => "h264".to_string(),
        "h265" | "hevc" | "libx265" => "h265".to_string(),
        "av1" | "libsvtav1" | "libaom-av1" => "av1".to_string(),
        "vp9" | "libvpx-vp9" => "vp9".to_string(),
        "vp8" | "libvpx" => "vp8".to_string(),
        "prores" | "prores_ks" => "prores".to_string(),
        "mp3" | "libmp3lame" => "mp3".to_string(),
        "aac" => "aac".to_string(),
        "opus" | "libopus" => "opus".to_string(),
        "vorbis" | "libvorbis" => "vorbis".to_string(),
        "flac" => "flac".to_string(),
        "alac" => "alac".to_string(),
        "wav" => "wav".to_string(),
        "aiff" => "aiff".to_string(),
        "ac3" => "ac3".to_string(),
        _ => lower,
    }
}

pub fn is_codec_supported_by_format(format_item: &FormatItem, codec: &str, is_video: bool) -> bool {
    let norm_req = normalize_codec_name(codec);
    if norm_req.is_empty() || norm_req == "auto" {
        return true;
    }

    let target_list = if is_video {
        &format_item.video_codecs
    } else {
        &format_item.audio_codecs
    };

    target_list
        .iter()
        .any(|c| normalize_codec_name(c) == norm_req)
}

pub fn validate_codec_support(
    format_id: &str,
    codec: Option<&str>,
    is_video: bool,
    conversion: bool,
) -> Result<(), String> {
    let Some(codec) = codec
        .map(str::trim)
        .filter(|codec| !codec.is_empty() && *codec != "auto" && *codec != "copy")
    else {
        return Ok(());
    };
    let info = if conversion {
        find_convert_format_info(format_id)
    } else {
        find_format_info(format_id)
    };
    let Some(info) = info else { return Ok(()) };
    let codecs = if is_video {
        &info.video_codecs
    } else {
        &info.audio_codecs
    };
    if codecs.is_empty() || is_codec_supported_by_format(&info, codec, is_video) {
        return Ok(());
    }
    Err(format!(
        "Codec '{codec}' is not listed as supported for the '{format_id}' format."
    ))
}

pub fn resolve_effective_codecs(
    format_id: Option<&str>,
    req_vcodec: Option<&str>,
    req_acodec: Option<&str>,
    default_vcodec: Option<&str>,
    default_acodec: Option<&str>,
) -> (Option<String>, Option<String>) {
    resolve_codecs_with_lookup(
        format_id,
        req_vcodec,
        req_acodec,
        default_vcodec,
        default_acodec,
        find_format_info,
    )
}

pub fn resolve_effective_convert_codecs(
    format_id: Option<&str>,
    req_vcodec: Option<&str>,
    req_acodec: Option<&str>,
    default_vcodec: Option<&str>,
    default_acodec: Option<&str>,
) -> (Option<String>, Option<String>) {
    resolve_codecs_with_lookup(
        format_id,
        req_vcodec,
        req_acodec,
        default_vcodec,
        default_acodec,
        find_convert_format_info,
    )
}

fn resolve_codecs_with_lookup(
    format_id: Option<&str>,
    req_vcodec: Option<&str>,
    req_acodec: Option<&str>,
    default_vcodec: Option<&str>,
    default_acodec: Option<&str>,
    lookup: fn(&str) -> Option<FormatItem>,
) -> (Option<String>, Option<String>) {
    let cand_v = req_vcodec
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && s.to_lowercase() != "auto")
        .or_else(|| {
            default_vcodec
                .map(|s| s.trim())
                .filter(|s| !s.is_empty() && s.to_lowercase() != "auto")
        });

    let cand_a = req_acodec
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && s.to_lowercase() != "auto")
        .or_else(|| {
            default_acodec
                .map(|s| s.trim())
                .filter(|s| !s.is_empty() && s.to_lowercase() != "auto")
        });

    let fmt_info = format_id.and_then(lookup);

    let final_v = match (cand_v, &fmt_info) {
        (Some(c), Some(fmt)) => {
            if is_codec_supported_by_format(fmt, c, true) {
                Some(c.to_string())
            } else if !fmt.video_codecs.is_empty() {
                Some(fmt.video_codecs[0].to_string())
            } else {
                None
            }
        }
        (Some(c), None) => Some(c.to_string()),
        (None, _) => None,
    };

    let final_a = match (cand_a, &fmt_info) {
        (Some(c), Some(fmt)) => {
            if is_codec_supported_by_format(fmt, c, false) {
                Some(c.to_string())
            } else if !fmt.audio_codecs.is_empty() {
                // Fall back to primary default audio codec of target format
                Some(fmt.audio_codecs[0].to_string())
            } else {
                None
            }
        }
        (Some(c), None) => Some(c.to_string()),
        (None, _) => None,
    };

    (final_v, final_a)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_format_info() {
        let info = find_format_info("mp4");
        assert!(info.is_some());
        let info = info.unwrap();
        assert!(info.video_codecs.contains(&"H264".to_string()));
    }

    #[test]
    fn download_and_conversion_catalogs_are_resolved_separately() {
        assert_eq!(find_format_info("gif").unwrap().format_type, "video");
        assert_eq!(
            find_convert_format_info("gif").unwrap().format_type,
            "image"
        );
    }

    #[test]
    fn incompatible_conversion_codec_is_rejected() {
        assert!(validate_codec_support("webm", Some("h264"), true, true).is_err());
        assert!(validate_codec_support("mp4", Some("h264"), true, true).is_ok());
    }

    #[test]
    fn test_resolve_effective_codecs_supported() {
        let (v, a) = resolve_effective_codecs(Some("mp4"), None, None, Some("h264"), Some("aac"));
        assert_eq!(v, Some("h264".to_string()));
        assert_eq!(a, Some("aac".to_string()));
    }

    #[test]
    fn test_resolve_effective_codecs_fallback() {
        let (v, a) = resolve_effective_codecs(Some("webm"), None, None, Some("h264"), Some("aac"));
        assert_eq!(v, Some("VP8".to_string()));
        assert_eq!(a, Some("Opus".to_string()));
    }
}
