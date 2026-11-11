use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Debug, Clone)]
pub struct FormatItem {
    pub id: String,
    #[serde(rename = "type")]
    pub format_type: String,
    pub video_codecs: Vec<String>,
    pub audio_codecs: Vec<String>,
    pub default_video_codec: Option<String>,
    pub default_audio_codec: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct FormatCatalog {
    pub dformats: Vec<FormatItem>,
    pub cformats: Vec<FormatItem>,
}

#[derive(Clone, Copy)]
struct FormatCapabilities {
    format_type: &'static str,
    video_codecs: &'static [&'static str],
    audio_codecs: &'static [&'static str],
    default_video_codec: Option<&'static str>,
    default_audio_codec: Option<&'static str>,
}

#[derive(Clone, Copy)]
struct FormatDefinition {
    id: &'static str,
    download: Option<FormatCapabilities>,
    convert: Option<FormatCapabilities>,
}

const fn capabilities(
    format_type: &'static str,
    video_codecs: &'static [&'static str],
    audio_codecs: &'static [&'static str],
    default_video_codec: Option<&'static str>,
    default_audio_codec: Option<&'static str>,
) -> FormatCapabilities {
    FormatCapabilities {
        format_type,
        video_codecs,
        audio_codecs,
        default_video_codec,
        default_audio_codec,
    }
}

const fn both(
    id: &'static str,
    format_type: &'static str,
    video_codecs: &'static [&'static str],
    audio_codecs: &'static [&'static str],
    default_video_codec: Option<&'static str>,
    default_audio_codec: Option<&'static str>,
) -> FormatDefinition {
    let support = Some(capabilities(
        format_type,
        video_codecs,
        audio_codecs,
        default_video_codec,
        default_audio_codec,
    ));
    FormatDefinition {
        id,
        download: support,
        convert: support,
    }
}

const fn convert_only(
    id: &'static str,
    format_type: &'static str,
    video_codecs: &'static [&'static str],
    audio_codecs: &'static [&'static str],
    default_video_codec: Option<&'static str>,
    default_audio_codec: Option<&'static str>,
) -> FormatDefinition {
    FormatDefinition {
        id,
        download: None,
        convert: Some(capabilities(
            format_type,
            video_codecs,
            audio_codecs,
            default_video_codec,
            default_audio_codec,
        )),
    }
}

const fn roles(
    id: &'static str,
    download: Option<FormatCapabilities>,
    convert: Option<FormatCapabilities>,
) -> FormatDefinition {
    FormatDefinition {
        id,
        download,
        convert,
    }
}

const VIDEO_H264_H265: &[&str] = &["H264", "H265"];
const VIDEO_H264_H265_PRORES_AV1: &[&str] = &["H264", "H265", "ProRes", "AV1"];
const VIDEO_H264_VP6: &[&str] = &["H264", "VP6"];
const VIDEO_H264_H265_MPEG4: &[&str] = &["H264", "H265", "MPEG4"];
const VIDEO_H264_H265_VP_AV1_PRORES: &[&str] = &["H264", "H265", "VP8", "VP9", "AV1", "ProRes"];
const VIDEO_VP8_VP9_AV1: &[&str] = &["VP8", "VP9", "AV1"];
const VIDEO_H264_VP9_AV1: &[&str] = &["H264", "H265", "AV1", "VP9"];
const VIDEO_THEORA: &[&str] = &["Theora"];
const VIDEO_MPEG2: &[&str] = &["MPEG2"];
const VIDEO_WMV: &[&str] = &["WMV"];
const VIDEO_NONE: &[&str] = &[];

const AUDIO_MP3_AAC: &[&str] = &["MP3", "AAC"];
const AUDIO_AAC_MP3_AC3_FLAC_OPUS: &[&str] = &["AAC", "MP3", "AC3", "FLAC", "Opus"];
const AUDIO_AAC_ALAC_FLAC_MP3: &[&str] = &["AAC", "ALAC", "FLAC", "MP3"];
const AUDIO_MKV: &[&str] = &["MP3", "AAC", "FLAC", "Opus", "Vorbis", "AC3"];
const AUDIO_WEBM: &[&str] = &["Opus", "Vorbis"];
const AUDIO_AAC_ALAC: &[&str] = &["AAC", "ALAC"];
const AUDIO_OGG: &[&str] = &["Vorbis", "Opus", "FLAC"];
const AUDIO_TS: &[&str] = &["AAC", "AC3", "MP3", "MP2", "LPCM"];
const AUDIO_VOB: &[&str] = &["AC3", "DTS", "MP2", "LPCM"];
const AUDIO_MP3_AC3_AAC: &[&str] = &["MP3", "AC3", "AAC"];
const AUDIO_WAV: &[&str] = &["WAV"];
const AUDIO_AIFF: &[&str] = &["AIFF"];
const AUDIO_FLAC: &[&str] = &["FLAC"];
const AUDIO_MP3: &[&str] = &["MP3"];
const AUDIO_AAC: &[&str] = &["AAC"];
const AUDIO_OPUS: &[&str] = &["Opus"];
const AUDIO_VORBIS_OPUS_FLAC: &[&str] = &["Vorbis", "Opus", "FLAC"];
const AUDIO_AAC_AC3: &[&str] = &["AAC", "AC3"];
const AUDIO_AC3_DTS_MP2_LPCM: &[&str] = &["AC3", "DTS", "MP2", "LPCM"];
const AUDIO_WMA: &[&str] = &["WMA"];
const AUDIO_NONE: &[&str] = &[];

const DEFINITIONS: &[FormatDefinition] = &[
    both(
        "flv",
        "video",
        VIDEO_H264_VP6,
        AUDIO_MP3_AAC,
        Some("H264"),
        Some("MP3"),
    ),
    both(
        "mkv",
        "video",
        VIDEO_H264_H265_VP_AV1_PRORES,
        AUDIO_MKV,
        Some("H264"),
        Some("AAC"),
    ),
    both(
        "mp4",
        "video",
        VIDEO_H264_VP9_AV1,
        AUDIO_AAC_MP3_AC3_FLAC_OPUS,
        Some("H264"),
        Some("AAC"),
    ),
    both(
        "mov",
        "video",
        VIDEO_H264_H265_PRORES_AV1,
        AUDIO_AAC_ALAC_FLAC_MP3,
        Some("H264"),
        Some("AAC"),
    ),
    both(
        "avi",
        "video",
        VIDEO_H264_H265,
        AUDIO_MP3_AC3_AAC,
        Some("H264"),
        Some("MP3"),
    ),
    roles(
        "gif",
        Some(capabilities("video", VIDEO_NONE, AUDIO_NONE, None, None)),
        Some(capabilities("image", VIDEO_NONE, AUDIO_NONE, None, None)),
    ),
    both(
        "webm",
        "video",
        VIDEO_VP8_VP9_AV1,
        AUDIO_WEBM,
        Some("VP9"),
        Some("Opus"),
    ),
    both("wav", "audio", VIDEO_NONE, AUDIO_WAV, None, Some("WAV")),
    both("aiff", "audio", VIDEO_NONE, AUDIO_AIFF, None, Some("AIFF")),
    both(
        "m4a",
        "audio",
        VIDEO_NONE,
        AUDIO_AAC_ALAC,
        None,
        Some("AAC"),
    ),
    both("flac", "audio", VIDEO_NONE, AUDIO_FLAC, None, Some("FLAC")),
    both("mp3", "audio", VIDEO_NONE, AUDIO_MP3, None, Some("MP3")),
    both("ogg", "audio", VIDEO_NONE, AUDIO_OGG, None, Some("Vorbis")),
    both("opus", "audio", VIDEO_NONE, AUDIO_OPUS, None, Some("Opus")),
    convert_only(
        "m4v",
        "video",
        VIDEO_H264_H265_MPEG4,
        AUDIO_AAC_AC3,
        Some("H264"),
        Some("AAC"),
    ),
    convert_only(
        "ogv",
        "video",
        VIDEO_THEORA,
        AUDIO_VORBIS_OPUS_FLAC,
        Some("Theora"),
        Some("Vorbis"),
    ),
    convert_only(
        "ts",
        "video",
        VIDEO_H264_H265,
        AUDIO_TS,
        Some("H264"),
        Some("AAC"),
    ),
    convert_only(
        "vob",
        "video",
        VIDEO_MPEG2,
        AUDIO_VOB,
        Some("MPEG2"),
        Some("AC3"),
    ),
    convert_only(
        "wmv",
        "video",
        VIDEO_WMV,
        &["WMA"],
        Some("WMV"),
        Some("WMA"),
    ),
    convert_only("aac", "audio", VIDEO_NONE, AUDIO_AAC, None, Some("AAC")),
    convert_only("wma", "audio", VIDEO_NONE, AUDIO_WMA, None, Some("WMA")),
    convert_only("avif", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("bmp", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("heic", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("ico", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("jfif", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("jpg", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("png", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("svg", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tga", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tiff", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("webp", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("icns", "image", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("7z", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("bz2", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("gz", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tar", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("xz", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("zip", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tar.gz", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tar.xz", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("tar.bz2", "archive", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("otf", "font", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("ttf", "font", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("woff", "font", VIDEO_NONE, AUDIO_NONE, None, None),
    convert_only("woff2", "font", VIDEO_NONE, AUDIO_NONE, None, None),
];

static FORMAT_CATALOG: OnceLock<FormatCatalog> = OnceLock::new();

fn catalog() -> &'static FormatCatalog {
    FORMAT_CATALOG.get_or_init(|| {
        let mut dformats = Vec::new();
        let mut cformats = Vec::new();
        for definition in DEFINITIONS {
            if let Some(capabilities) = definition.download {
                dformats.push(project_format(definition.id, capabilities));
            }
            if let Some(capabilities) = definition.convert {
                cformats.push(project_format(definition.id, capabilities));
            }
        }
        FormatCatalog { dformats, cformats }
    })
}

fn project_format(id: &str, capabilities: FormatCapabilities) -> FormatItem {
    FormatItem {
        id: id.to_string(),
        format_type: capabilities.format_type.to_string(),
        video_codecs: capabilities
            .video_codecs
            .iter()
            .map(|codec| (*codec).to_string())
            .collect(),
        audio_codecs: capabilities
            .audio_codecs
            .iter()
            .map(|codec| (*codec).to_string())
            .collect(),
        default_video_codec: capabilities.default_video_codec.map(str::to_string),
        default_audio_codec: capabilities.default_audio_codec.map(str::to_string),
    }
}

#[tauri::command]
pub fn get_format_catalog() -> FormatCatalog {
    catalog().clone()
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

    let catalog = catalog();
    let formats = if download {
        &catalog.dformats
    } else {
        &catalog.cformats
    };
    formats
        .iter()
        .find(|format| format.id.eq_ignore_ascii_case(&clean))
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
        .any(|candidate| normalize_codec_name(candidate) == norm_req)
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
    if is_codec_supported_by_format(&info, codec, is_video) {
        return Ok(());
    }
    Err(format!(
        "Codec '{codec}' is not supported for the '{format_id}' format."
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
    let cand_v = requested_codec(req_vcodec).or_else(|| requested_codec(default_vcodec));
    let cand_a = requested_codec(req_acodec).or_else(|| requested_codec(default_acodec));
    let fmt_info = format_id.and_then(lookup);

    let final_v = resolve_codec_for_format(cand_v, fmt_info.as_ref(), true);
    let final_a = resolve_codec_for_format(cand_a, fmt_info.as_ref(), false);
    (final_v, final_a)
}

fn requested_codec(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|codec| !codec.is_empty() && !codec.eq_ignore_ascii_case("auto"))
}

fn resolve_codec_for_format(
    codec: Option<&str>,
    format: Option<&FormatItem>,
    is_video: bool,
) -> Option<String> {
    let codec = codec?;
    let Some(format) = format else {
        return Some(codec.to_string());
    };
    if is_codec_supported_by_format(format, codec, is_video) {
        return Some(codec.to_string());
    }
    if is_video {
        format.default_video_codec.clone()
    } else {
        format.default_audio_codec.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_catalog_has_unique_identifiers_per_role() {
        for formats in [&catalog().dformats, &catalog().cformats] {
            for (index, format) in formats.iter().enumerate() {
                assert!(!formats[index + 1..]
                    .iter()
                    .any(|other| other.id == format.id));
            }
        }
    }

    #[test]
    fn video_gif_has_no_download_codec_but_is_an_image_in_converter() {
        let download_gif = find_format_info("gif").unwrap();
        let convert_gif = find_convert_format_info("gif").unwrap();
        assert_eq!(download_gif.format_type, "video");
        assert!(download_gif.video_codecs.is_empty());
        assert_eq!(convert_gif.format_type, "image");
    }

    #[test]
    fn incompatible_defaults_use_explicit_container_defaults_not_array_order() {
        let (video, audio) =
            resolve_effective_codecs(Some("webm"), None, None, Some("h264"), Some("aac"));
        assert_eq!(video.as_deref(), Some("VP9"));
        assert_eq!(audio.as_deref(), Some("Opus"));
    }
}
