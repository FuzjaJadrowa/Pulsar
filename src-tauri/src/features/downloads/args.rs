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
