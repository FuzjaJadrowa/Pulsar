use super::codecs::{ffmpeg_encoder_smoke_test, map_video_codec, map_video_codec_hw};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HwBackend {
    Cuda,
    Qsv,
    Amf,
    VideoToolbox,
    Vaapi(String),
}

impl HwBackend {
    pub fn as_name(&self) -> &'static str {
        match self {
            Self::Cuda => "cuda",
            Self::Qsv => "qsv",
            Self::Amf => "amf",
            Self::VideoToolbox => "videotoolbox",
            Self::Vaapi(_) => "vaapi",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedVideoEncoder {
    pub encoder: String,
    pub backend: Option<HwBackend>,
}

pub fn is_supported_encoding_backend(name: &str) -> bool {
    matches!(
        name.trim().to_ascii_lowercase().as_str(),
        "cuda" | "qsv" | "amf" | "videotoolbox" | "vaapi"
    )
}

pub fn find_vaapi_device() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let default_node = Path::new("/dev/dri/renderD128");
        if default_node.exists() {
            return Some("/dev/dri/renderD128".to_string());
        }
        let entries = std::fs::read_dir("/dev/dri").ok()?;
        let mut render_nodes: Vec<String> = entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("renderD") {
                    Some(entry.path().to_string_lossy().to_string())
                } else {
                    None
                }
            })
            .collect();
        render_nodes.sort();
        render_nodes.into_iter().next()
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

pub fn parse_hw_backend(name: &str, vaapi_device: Option<&str>) -> Option<HwBackend> {
    match name.trim().to_ascii_lowercase().as_str() {
        "cuda" => Some(HwBackend::Cuda),
        "qsv" => Some(HwBackend::Qsv),
        "amf" => Some(HwBackend::Amf),
        "videotoolbox" => Some(HwBackend::VideoToolbox),
        "vaapi" => vaapi_device
            .map(str::trim)
            .filter(|dev| !dev.is_empty())
            .map(|dev| HwBackend::Vaapi(dev.to_string())),
        _ => None,
    }
}

pub fn default_logical_video_codec_for_format(format: &str) -> &'static str {
    let fmt = format.trim().trim_start_matches('.').to_ascii_lowercase();
    match fmt.as_str() {
        "webm" => "vp9",
        "ogv" => "theora",
        "gif" => "gif",
        "vob" => "mpeg2",
        "wmv" => "wmv",
        "prores" => "prores",
        _ => "h264",
    }
}

pub fn resolve_video_encoder_with_probe<F>(
    output_format: &str,
    requested_codec: Option<&str>,
    hwaccel_name: Option<&str>,
    vaapi_device: Option<&str>,
    allow_vaapi: bool,
    mut probe_encoder: F,
) -> ResolvedVideoEncoder
where
    F: FnMut(&str) -> bool,
{
    let fmt = output_format
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if fmt == "gif" {
        return ResolvedVideoEncoder {
            encoder: "gif".to_string(),
            backend: None,
        };
    }

    let raw = requested_codec.unwrap_or("").trim().to_ascii_lowercase();
    if raw == "copy" {
        return ResolvedVideoEncoder {
            encoder: "copy".to_string(),
            backend: None,
        };
    }

    let logical_codec = if raw.is_empty() || raw == "auto" {
        default_logical_video_codec_for_format(&fmt).to_string()
    } else {
        raw
    };

    let software = map_video_codec(&logical_codec);
    let backend = hwaccel_name
        .and_then(|name| parse_hw_backend(name, vaapi_device))
        .filter(|backend| allow_vaapi || !matches!(backend, HwBackend::Vaapi(_)));

    if let Some(backend) = backend {
        let hardware = map_video_codec_hw(&logical_codec, backend.as_name());
        if hardware != software && probe_encoder(&hardware) {
            return ResolvedVideoEncoder {
                encoder: hardware,
                backend: Some(backend),
            };
        }
    }

    ResolvedVideoEncoder {
        encoder: software,
        backend: None,
    }
}

pub fn resolve_video_encoder(
    ffmpeg_path: &Path,
    output_format: &str,
    requested_codec: Option<&str>,
    hwaccel_name: Option<&str>,
    allow_vaapi: bool,
) -> ResolvedVideoEncoder {
    let vaapi_device = find_vaapi_device();
    resolve_video_encoder_with_probe(
        output_format,
        requested_codec,
        hwaccel_name,
        vaapi_device.as_deref(),
        allow_vaapi,
        |encoder| ffmpeg_encoder_smoke_test(ffmpeg_path, encoder),
    )
}

/// Appends safe pre-input FFmpeg hardware flags ONLY for active hardware video encoders.
/// Never emits `-hwaccel_output_format`, avoiding VRAM/CPU format mismatch crashes
/// with software filters (like `scale`) or inputs unsupported by hardware decoding.
pub fn append_hwaccel_input_args(args: &mut Vec<String>, backend: Option<&HwBackend>) {
    let Some(backend) = backend else {
        return;
    };
    match backend {
        HwBackend::Cuda => {
            args.push("-hwaccel".to_string());
            args.push("cuda".to_string());
        }
        HwBackend::VideoToolbox => {
            args.push("-hwaccel".to_string());
            args.push("videotoolbox".to_string());
        }
        HwBackend::Vaapi(device) => {
            args.push("-vaapi_device".to_string());
            args.push(device.clone());
        }
        // QSV and AMF encoders accept system memory frames directly without
        // decode-side `-hwaccel`, avoiding failures on unsupported input codecs
        // or FFmpeg builds without AMF decoding.
        HwBackend::Qsv | HwBackend::Amf => {}
    }
}

pub fn vaapi_upload_filter(backend: Option<&HwBackend>) -> Option<&'static str> {
    match backend {
        Some(HwBackend::Vaapi(_)) => Some("format=nv12,hwupload"),
        _ => None,
    }
}

/// Maps a CRF value (0..51, lower = higher quality) to rate-control flags
/// appropriate for the resolved video encoder.
pub fn append_video_quality_args(args: &mut Vec<String>, encoder: &str, crf: u32) {
    let crf = crf.min(51);
    match encoder {
        "copy" | "gif" => {}
        "libx264" | "libx265" | "libsvtav1" | "libaom-av1" => {
            args.extend(["-crf".to_string(), crf.to_string()]);
        }
        "libvpx-vp9" | "libvpx" => {
            args.extend([
                "-crf".to_string(),
                crf.clamp(4, 63).to_string(),
                "-b:v".to_string(),
                "0".to_string(),
            ]);
        }
        "h264_nvenc" | "hevc_nvenc" | "av1_nvenc" => {
            args.extend([
                "-rc".to_string(),
                "vbr".to_string(),
                "-cq".to_string(),
                crf.clamp(1, 51).to_string(),
                "-b:v".to_string(),
                "0".to_string(),
            ]);
        }
        "h264_qsv" | "hevc_qsv" | "av1_qsv" | "vp9_qsv" => {
            args.extend(["-global_quality".to_string(), crf.clamp(1, 51).to_string()]);
        }
        "h264_amf" | "hevc_amf" | "av1_amf" => {
            let qp = crf.to_string();
            args.extend([
                "-rc".to_string(),
                "cqp".to_string(),
                "-qp_i".to_string(),
                qp.clone(),
                "-qp_p".to_string(),
                qp,
            ]);
        }
        "h264_videotoolbox" | "hevc_videotoolbox" => {
            let quality = (100.0 - (crf as f64 / 51.0) * 90.0)
                .round()
                .clamp(1.0, 100.0) as u32;
            args.extend(["-q:v".to_string(), quality.to_string()]);
        }
        "h264_vaapi" | "hevc_vaapi" | "av1_vaapi" | "vp9_vaapi" => {
            args.extend(["-qp".to_string(), crf.clamp(1, 51).to_string()]);
        }
        "mpeg2video" | "mpeg4" | "wmv2" => {
            let qscale = (2.0 + (crf as f64 / 51.0) * 29.0).round().clamp(2.0, 31.0) as u32;
            args.extend(["-q:v".to_string(), qscale.to_string()]);
        }
        "libtheora" => {
            let qscale = (10.0 - (crf as f64 / 51.0) * 10.0).round().clamp(0.0, 10.0) as u32;
            args.extend(["-q:v".to_string(), qscale.to_string()]);
        }
        _ => {
            args.extend(["-crf".to_string(), crf.to_string()]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webm_auto_never_forces_h264_even_with_cuda() {
        let resolved = resolve_video_encoder_with_probe(
            "webm",
            Some("auto"),
            Some("cuda"),
            None,
            true,
            |_| true,
        );
        assert_eq!(resolved.encoder, "libvpx-vp9");
        assert_eq!(resolved.backend, None);
    }

    #[test]
    fn webm_auto_uses_vp9_qsv_only_when_smoke_test_succeeds() {
        let ok = resolve_video_encoder_with_probe("webm", None, Some("qsv"), None, true, |enc| {
            enc == "vp9_qsv"
        });
        assert_eq!(ok.encoder, "vp9_qsv");
        assert_eq!(ok.backend, Some(HwBackend::Qsv));

        let fallback =
            resolve_video_encoder_with_probe("webm", None, Some("qsv"), None, true, |_| false);
        assert_eq!(fallback.encoder, "libvpx-vp9");
        assert_eq!(fallback.backend, None);
    }

    #[test]
    fn decode_only_backends_like_d3d11va_fall_back_to_software() {
        let resolved =
            resolve_video_encoder_with_probe("mp4", None, Some("d3d11va"), None, true, |_| true);
        assert_eq!(resolved.encoder, "libx264");
        assert_eq!(resolved.backend, None);
    }

    #[test]
    fn quality_args_match_hardware_and_software_encoders() {
        let mut nvenc = Vec::new();
        append_video_quality_args(&mut nvenc, "h264_nvenc", 24);
        assert_eq!(nvenc, vec!["-rc", "vbr", "-cq", "24", "-b:v", "0"]);

        let mut qsv = Vec::new();
        append_video_quality_args(&mut qsv, "hevc_qsv", 24);
        assert_eq!(qsv, vec!["-global_quality", "24"]);

        let mut amf = Vec::new();
        append_video_quality_args(&mut amf, "h264_amf", 24);
        assert_eq!(amf, vec!["-rc", "cqp", "-qp_i", "24", "-qp_p", "24"]);

        let mut vt_best = Vec::new();
        append_video_quality_args(&mut vt_best, "h264_videotoolbox", 0);
        assert_eq!(vt_best, vec!["-q:v", "100"]);

        let mut vaapi = Vec::new();
        append_video_quality_args(&mut vaapi, "h264_vaapi", 26);
        assert_eq!(vaapi, vec!["-qp", "26"]);

        let mut vp9 = Vec::new();
        append_video_quality_args(&mut vp9, "libvpx-vp9", 30);
        assert_eq!(vp9, vec!["-crf", "30", "-b:v", "0"]);

        let mut x264 = Vec::new();
        append_video_quality_args(&mut x264, "libx264", 23);
        assert_eq!(x264, vec!["-crf", "23"]);
    }

    #[test]
    fn input_args_never_emit_hwaccel_output_format() {
        for backend in [
            HwBackend::Cuda,
            HwBackend::Qsv,
            HwBackend::Amf,
            HwBackend::VideoToolbox,
            HwBackend::Vaapi("/dev/dri/renderD128".to_string()),
        ] {
            let mut args = Vec::new();
            append_hwaccel_input_args(&mut args, Some(&backend));
            assert!(!args.iter().any(|arg| arg == "-hwaccel_output_format"));
        }
    }
}
