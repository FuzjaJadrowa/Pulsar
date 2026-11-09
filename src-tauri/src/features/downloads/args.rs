use super::DownloadOptions;

pub(super) fn push_unique(target: &mut Vec<String>, value: String) {
    if !target.iter().any(|existing| existing == &value) {
        target.push(value);
    }
}

pub(super) fn ensure_flag(args: &mut Vec<String>, flag: &str) {
    if !args.iter().any(|existing| existing == flag) {
        args.push(flag.to_string());
    }
}

fn find_lang_match<'a>(langs: &'a [String], requested: &str) -> Option<&'a str> {
    let requested_lower = requested.to_lowercase();
    langs.iter().find_map(|lang| {
        let trimmed = lang.trim();
        if trimmed.to_lowercase().starts_with(&requested_lower) {
            Some(trimmed)
        } else {
            None
        }
    })
}

pub(super) fn parse_kbps_value(value: &Option<String>) -> Option<String> {
    let raw = value.as_ref()?.trim();
    if raw.is_empty() {
        return None;
    }
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    Some(digits)
}

pub(super) fn parse_numeric_value(value: &Option<String>) -> Option<String> {
    let raw = value.as_ref()?.trim();
    if raw.is_empty() {
        return None;
    }
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            out.push(ch);
        }
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

pub(super) fn quote_filter_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-')
    {
        return trimmed.to_string();
    }
    let escaped = trimmed.replace('\'', "\\'");
    format!("'{}'", escaped)
}

pub(super) fn build_video_filters(options: &DownloadOptions) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(codec) = options
        .video_codec
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        filters.push(format!("vcodec={}", quote_filter_value(codec)));
    }
    if let Some(vbr) = parse_kbps_value(&options.video_bitrate) {
        filters.push(format!("vbr={}", vbr));
    }
    if let Some(fps) = parse_numeric_value(&options.video_fps) {
        filters.push(format!("fps={}", fps));
    }
    filters
}

pub(super) fn build_audio_filters(options: &DownloadOptions) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(codec) = options
        .audio_codec
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        filters.push(format!("acodec={}", quote_filter_value(codec)));
    }
    if let Some(abr) = parse_kbps_value(&options.audio_bitrate) {
        filters.push(format!("abr={}", abr));
    }
    if let Some(asr) = parse_numeric_value(&options.audio_sample_rate) {
        filters.push(format!("asr={}", asr));
    }
    filters
}

pub(super) fn apply_filters(base: &str, filters: &[String]) -> String {
    let mut out = base.to_string();
    for filter in filters {
        if filter.trim().is_empty() {
            continue;
        }
        out.push('[');
        out.push_str(filter);
        out.push(']');
    }
    out
}

pub(super) fn build_subtitle_args(options: &DownloadOptions) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut target_langs: Vec<String> = Vec::new();

    if options.download_chat {
        ensure_flag(&mut args, "--write-subs");
        push_unique(&mut target_langs, "live_chat".to_string());
    }

    if options.download_subs {
        let code_input = options.subs_code.trim();
        if !code_input.is_empty() {
            for raw in code_input.split(',') {
                let lang_req = raw.trim();
                if lang_req.is_empty() {
                    continue;
                }

                if let Some(found) = find_lang_match(&options.meta_sub_langs, lang_req) {
                    push_unique(&mut target_langs, found.to_string());
                    ensure_flag(&mut args, "--write-subs");
                    continue;
                }
                if let Some(found) = find_lang_match(&options.meta_auto_langs, lang_req) {
                    push_unique(&mut target_langs, found.to_string());
                    ensure_flag(&mut args, "--write-auto-subs");
                    continue;
                }

                push_unique(&mut target_langs, lang_req.to_string());
                ensure_flag(&mut args, "--write-subs");
                ensure_flag(&mut args, "--write-auto-subs");
            }
        } else {
            ensure_flag(&mut args, "--write-subs");
            if !options.meta_auto_langs.is_empty() {
                ensure_flag(&mut args, "--write-auto-subs");
            }
        }
    }

    if !target_langs.is_empty() {
        args.push("--sub-langs".to_string());
        args.push(target_langs.join(","));
    }

    if options.embed_subs && (options.download_subs || options.download_chat) {
        ensure_flag(&mut args, "--embed-subs");
    }

    args
}
