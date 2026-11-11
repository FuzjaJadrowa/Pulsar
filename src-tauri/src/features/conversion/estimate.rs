use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Deserialize, Default)]
pub struct EstimatePayload {
    source_size_bytes: Option<u64>,
    source_duration_seconds: Option<f64>,
    source_width: Option<u32>,
    source_height: Option<u32>,
    source_category: Option<String>,
    category: Option<String>,
    format: Option<String>,
    video_quality: Option<String>,
    video_codec: Option<String>,
    video_bitrate: Option<String>,
    video_fps: Option<String>,
    audio_codec: Option<String>,
    audio_bitrate: Option<String>,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_quality: Option<u32>,
}

#[derive(Default, Clone)]
struct ESizeDefaults {
    container_overhead: f64,
    video_bitrate_kbps: f64,
    audio_bitrate_kbps: f64,
    video_bitrate_min_kbps: f64,
    video_bitrate_max_kbps: f64,
    audio_bitrate_min_kbps: f64,
    audio_bitrate_max_kbps: f64,
    image_bpp: f64,
    image_quality_min: f64,
}

#[derive(Default, Clone)]
struct ESizeImageFormat {
    bpp: Option<f64>,
    quality_weight: Option<f64>,
}

#[derive(Default, Clone)]
struct ESizeData {
    defaults: ESizeDefaults,
    video_quality_kbps: HashMap<String, f64>,
    fps_multiplier: HashMap<String, f64>,
    video_codecs: HashMap<String, f64>,
    audio_codecs: HashMap<String, f64>,
    image_formats: HashMap<String, ESizeImageFormat>,
    container_overhead: HashMap<String, f64>,
}

static ESIZE_CACHE: OnceLock<ESizeData> = OnceLock::new();

fn load_esize() -> &'static ESizeData {
    ESIZE_CACHE.get_or_init(|| ESizeData {
        defaults: ESizeDefaults {
            container_overhead: 1.02,
            video_bitrate_kbps: 8000.0,
            audio_bitrate_kbps: 192.0,
            video_bitrate_min_kbps: 300.0,
            video_bitrate_max_kbps: 80_000.0,
            audio_bitrate_min_kbps: 32.0,
            audio_bitrate_max_kbps: 1000.0,
            image_bpp: 0.75,
            image_quality_min: 0.25,
        },
        video_quality_kbps: HashMap::from([
            ("2160p".to_string(), 20_000.0),
            ("1440p".to_string(), 12_000.0),
            ("1080p".to_string(), 8000.0),
            ("720p".to_string(), 5000.0),
            ("480p".to_string(), 2500.0),
            ("360p".to_string(), 1000.0),
            ("240p".to_string(), 600.0),
            ("144p".to_string(), 300.0),
        ]),
        fps_multiplier: HashMap::from([
            ("60".to_string(), 1.5),
            ("30".to_string(), 1.0),
            ("24".to_string(), 0.8),
        ]),
        video_codecs: HashMap::from([
            ("h264".to_string(), 1.0),
            ("h265".to_string(), 0.7),
            ("hevc".to_string(), 0.7),
            ("av1".to_string(), 0.6),
            ("vp9".to_string(), 0.75),
            ("vp8".to_string(), 1.1),
            ("mpeg2".to_string(), 1.4),
            ("mpeg4".to_string(), 1.2),
            ("h263".to_string(), 1.6),
            ("theora".to_string(), 1.3),
            ("wmv".to_string(), 1.2),
            ("prores".to_string(), 3.0),
            ("gif".to_string(), 2.4),
        ]),
        audio_codecs: HashMap::from([
            ("aac".to_string(), 1.0),
            ("mp3".to_string(), 1.15),
            ("opus".to_string(), 0.75),
            ("vorbis".to_string(), 0.85),
            ("flac".to_string(), 2.2),
            ("wav".to_string(), 3.5),
            ("aiff".to_string(), 3.5),
            ("ac3".to_string(), 1.2),
            ("wma".to_string(), 1.2),
            ("dts".to_string(), 1.6),
            ("lpcm".to_string(), 4.0),
            ("amr".to_string(), 0.5),
            ("amr-wb".to_string(), 0.6),
            ("amr-wb+".to_string(), 0.65),
            ("he-aac".to_string(), 0.85),
        ]),
        image_formats: HashMap::from([
            (
                "jpg".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.5),
                    quality_weight: Some(1.0),
                },
            ),
            (
                "jfif".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.5),
                    quality_weight: Some(1.0),
                },
            ),
            (
                "png".to_string(),
                ESizeImageFormat {
                    bpp: Some(1.6),
                    quality_weight: Some(0.25),
                },
            ),
            (
                "webp".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.45),
                    quality_weight: Some(0.9),
                },
            ),
            (
                "avif".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.4),
                    quality_weight: Some(0.9),
                },
            ),
            (
                "heic".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.45),
                    quality_weight: Some(0.9),
                },
            ),
            (
                "gif".to_string(),
                ESizeImageFormat {
                    bpp: Some(1.2),
                    quality_weight: Some(0.3),
                },
            ),
            (
                "bmp".to_string(),
                ESizeImageFormat {
                    bpp: Some(3.0),
                    quality_weight: Some(0.05),
                },
            ),
            (
                "tiff".to_string(),
                ESizeImageFormat {
                    bpp: Some(2.5),
                    quality_weight: Some(0.2),
                },
            ),
            (
                "svg".to_string(),
                ESizeImageFormat {
                    bpp: Some(0.1),
                    quality_weight: Some(0.1),
                },
            ),
            (
                "ico".to_string(),
                ESizeImageFormat {
                    bpp: Some(1.2),
                    quality_weight: Some(0.3),
                },
            ),
            (
                "tga".to_string(),
                ESizeImageFormat {
                    bpp: Some(3.0),
                    quality_weight: Some(0.1),
                },
            ),
            (
                "icns".to_string(),
                ESizeImageFormat {
                    bpp: Some(1.2),
                    quality_weight: Some(0.3),
                },
            ),
        ]),
        container_overhead: HashMap::from([
            ("avi".to_string(), 1.05),
            ("flv".to_string(), 1.04),
            ("m4v".to_string(), 1.02),
            ("mkv".to_string(), 1.01),
            ("mov".to_string(), 1.03),
            ("mp4".to_string(), 1.02),
            ("ogv".to_string(), 1.02),
            ("ts".to_string(), 1.03),
            ("vob".to_string(), 1.03),
            ("webm".to_string(), 1.01),
            ("wmv".to_string(), 1.04),
            ("aac".to_string(), 1.01),
            ("aiff".to_string(), 1.02),
            ("flac".to_string(), 1.02),
            ("m4a".to_string(), 1.01),
            ("mp3".to_string(), 1.01),
            ("ogg".to_string(), 1.01),
            ("opus".to_string(), 1.01),
            ("wav".to_string(), 1.02),
            ("wma".to_string(), 1.02),
            ("gif".to_string(), 1.03),
            ("jpg".to_string(), 1.0),
            ("png".to_string(), 1.0),
            ("webp".to_string(), 1.0),
            ("avif".to_string(), 1.0),
            ("heic".to_string(), 1.0),
            ("7z".to_string(), 1.0),
            ("bz2".to_string(), 1.0),
            ("gz".to_string(), 1.0),
            ("tar".to_string(), 1.0),
            ("xz".to_string(), 1.0),
            ("zip".to_string(), 1.0),
            ("tar.gz".to_string(), 1.0),
            ("tar.xz".to_string(), 1.0),
            ("tar.bz2".to_string(), 1.0),
            ("otf".to_string(), 1.0),
            ("ttf".to_string(), 1.0),
            ("woff".to_string(), 1.0),
            ("woff2".to_string(), 1.0),
        ]),
    })
}

fn normalize_key(value: &str) -> String {
    value.trim().to_lowercase()
}

fn normalize_format_key(value: &str) -> String {
    let mut key = normalize_key(value);
    while key.starts_with('.') {
        key.remove(0);
    }
    key
}

fn parse_kbps_value(raw: Option<&str>) -> Option<f64> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<f64>().ok()
}

fn parse_numeric_value(raw: Option<&str>) -> Option<f64> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let mut buf = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            buf.push(ch);
        }
    }
    if buf.is_empty() {
        None
    } else {
        buf.parse::<f64>().ok()
    }
}

fn clamp_value(value: f64, min: f64, max: f64) -> f64 {
    if !value.is_finite() {
        return min;
    }
    if value < min {
        return min;
    }
    if value > max {
        return max;
    }
    value
}

fn lookup_multiplier(map: &HashMap<String, f64>, key: Option<&str>, fallback: f64) -> f64 {
    let Some(raw) = key else { return fallback };
    let normalized = normalize_key(raw);
    map.get(&normalized).copied().unwrap_or(fallback)
}

fn resolve_overhead(esize: &ESizeData, format: Option<&str>) -> f64 {
    let default = if esize.defaults.container_overhead > 0.0 {
        esize.defaults.container_overhead
    } else {
        1.0
    };
    let Some(fmt) = format else { return default };
    let key = normalize_format_key(fmt);
    esize
        .container_overhead
        .get(&key)
        .copied()
        .unwrap_or(default)
}

fn resolve_audio_bitrate(payload: &EstimatePayload, esize: &ESizeData, allow_source: bool) -> f64 {
    let defaults = &esize.defaults;
    let mut bitrate = parse_kbps_value(payload.audio_bitrate.as_deref())
        .or_else(|| {
            if allow_source {
                if let (Some(size), Some(duration)) =
                    (payload.source_size_bytes, payload.source_duration_seconds)
                {
                    if duration > 0.0 {
                        return Some((size as f64 * 8.0) / (duration * 1000.0));
                    }
                }
            }
            None
        })
        .unwrap_or_else(|| {
            if defaults.audio_bitrate_kbps > 0.0 {
                defaults.audio_bitrate_kbps
            } else {
                192.0
            }
        });

    let min = if defaults.audio_bitrate_min_kbps > 0.0 {
        defaults.audio_bitrate_min_kbps
    } else {
        32.0
    };
    let max = if defaults.audio_bitrate_max_kbps > 0.0 {
        defaults.audio_bitrate_max_kbps
    } else {
        1000.0
    };
    bitrate = clamp_value(bitrate, min, max);

    let codec_multiplier =
        lookup_multiplier(&esize.audio_codecs, payload.audio_codec.as_deref(), 1.0);
    bitrate *= codec_multiplier;
    clamp_value(bitrate, min, max)
}

fn resolve_video_bitrate(payload: &EstimatePayload, esize: &ESizeData, audio_kbps: f64) -> f64 {
    let defaults = &esize.defaults;
    let source_category = payload
        .source_category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    let mut bitrate = parse_kbps_value(payload.video_bitrate.as_deref())
        .or_else(|| {
            let quality = payload.video_quality.as_deref().map(normalize_key);
            if let Some(quality_key) = quality {
                if quality_key == "best" {
                    let max_q = esize
                        .video_quality_kbps
                        .values()
                        .copied()
                        .fold(0.0, f64::max);
                    if max_q > 0.0 {
                        return Some(max_q * 1.2);
                    }
                }
                if let Some(q) = esize.video_quality_kbps.get(&quality_key) {
                    return Some(*q);
                }
            }
            if source_category == "video" {
                if let (Some(size), Some(duration)) =
                    (payload.source_size_bytes, payload.source_duration_seconds)
                {
                    if duration > 0.0 {
                        let total = (size as f64 * 8.0) / (duration * 1000.0);
                        return Some((total - audio_kbps).max(0.0));
                    }
                }
            }
            None
        })
        .unwrap_or_else(|| {
            if defaults.video_bitrate_kbps > 0.0 {
                defaults.video_bitrate_kbps
            } else {
                8000.0
            }
        });

    let min = if defaults.video_bitrate_min_kbps > 0.0 {
        defaults.video_bitrate_min_kbps
    } else {
        300.0
    };
    let max = if defaults.video_bitrate_max_kbps > 0.0 {
        defaults.video_bitrate_max_kbps
    } else {
        80_000.0
    };
    bitrate = clamp_value(bitrate, min, max);

    if let Some(fps) = parse_numeric_value(payload.video_fps.as_deref()) {
        let fps_key = if fps.fract() == 0.0 {
            fps.round().to_string()
        } else {
            fps.to_string()
        };
        let fps_mult = esize.fps_multiplier.get(&fps_key).copied().unwrap_or(1.0);
        bitrate *= fps_mult;
    }

    let codec_multiplier =
        lookup_multiplier(&esize.video_codecs, payload.video_codec.as_deref(), 1.0);
    bitrate *= codec_multiplier;
    clamp_value(bitrate, min, max)
}

fn estimate_video(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let duration = payload.source_duration_seconds.unwrap_or(0.0);
    let audio_kbps = resolve_audio_bitrate(payload, esize, false);
    let video_kbps = resolve_video_bitrate(payload, esize, audio_kbps);
    if duration <= 0.0 {
        return payload
            .source_size_bytes
            .map(|s| ((s as f64) * overhead).round() as u64);
    }
    let total_kbps = audio_kbps + video_kbps;
    let bytes = total_kbps * duration * 1000.0 / 8.0;
    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_audio(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let duration = payload.source_duration_seconds.unwrap_or(0.0);
    let source_category = payload
        .source_category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    let allow_source = source_category == "audio";
    let audio_kbps = resolve_audio_bitrate(payload, esize, allow_source);
    if duration <= 0.0 {
        return payload
            .source_size_bytes
            .map(|s| ((s as f64) * overhead).round() as u64);
    }
    let bytes = audio_kbps * duration * 1000.0 / 8.0;
    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_image(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let defaults = &esize.defaults;
    let format_key = payload.format.as_deref().map(normalize_format_key);
    let format_info = format_key
        .as_ref()
        .and_then(|key| esize.image_formats.get(key));
    let bpp = format_info.and_then(|info| info.bpp).unwrap_or_else(|| {
        if defaults.image_bpp > 0.0 {
            defaults.image_bpp
        } else {
            0.75
        }
    });
    let quality_weight = format_info
        .and_then(|info| info.quality_weight)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);

    let quality = payload.image_quality.unwrap_or(100).clamp(1, 100) as f64 / 100.0;
    let min_quality = defaults.image_quality_min.clamp(0.0, 1.0);
    let mut quality_factor = min_quality + (1.0 - min_quality) * quality;
    quality_factor = 1.0 - (1.0 - quality_factor) * quality_weight;

    let width = payload.image_width.or(payload.source_width);
    let height = payload.image_height.or(payload.source_height);
    let bytes = if let (Some(w), Some(h)) = (width, height) {
        (w as f64) * (h as f64) * bpp * quality_factor
    } else if let Some(source_size) = payload.source_size_bytes {
        let base_bpp = if defaults.image_bpp > 0.0 {
            defaults.image_bpp
        } else {
            0.75
        };
        let format_factor = if base_bpp > 0.0 { bpp / base_bpp } else { 1.0 };
        (source_size as f64) * format_factor * quality_factor
    } else {
        return None;
    };

    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_other(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    payload
        .source_size_bytes
        .map(|s| ((s as f64) * overhead).round() as u64)
}

pub(super) fn estimate(payload: EstimatePayload) -> Result<Option<u64>, String> {
    let category = payload
        .category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    if category.is_empty() {
        return Ok(None);
    }
    let esize = load_esize();
    let estimate = match category.as_str() {
        "video" => estimate_video(&payload, esize),
        "audio" => estimate_audio(&payload, esize),
        "image" => estimate_image(&payload, esize),
        _ => estimate_other(&payload, esize),
    };
    Ok(estimate)
}
