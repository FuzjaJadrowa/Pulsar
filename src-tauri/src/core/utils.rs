use directories::BaseDirs;
use std::path::PathBuf;

pub fn is_flatpak() -> bool {
    if cfg!(target_os = "linux") {
        let flatpak_channel = std::env::var("PULSAR_DIST")
            .map(|v| v.trim().eq_ignore_ascii_case("flatpak"))
            .unwrap_or(false);
        let in_flatpak = std::env::var("FLATPAK_ID")
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);
        return flatpak_channel || in_flatpak;
    }
    false
}

pub fn get_requirements_path() -> PathBuf {
    if is_flatpak() {
        if let Ok(dir) = std::env::var("PULSAR_REQUIREMENTS_DIR") {
            let trimmed = dir.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
        return PathBuf::from("/app/lib/pulsar/requirements");
    }
    if let Some(base_dirs) = BaseDirs::new() {
        let path = base_dirs
            .data_local_dir()
            .join("Pulsar")
            .join("Requirements");
        if !path.exists() {
            let _ = std::fs::create_dir_all(&path);
        }
        return path;
    }
    PathBuf::from("Requirements")
}

pub fn get_ffmpeg_path() -> PathBuf {
    let req_path = get_requirements_path();
    let name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    req_path.join(name)
}

pub fn generate_task_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    now.to_string()
}

pub fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
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

pub fn qscale_from_percent(percent: f64) -> u32 {
    let clamped = clamp_f64(percent, 1.0, 100.0);
    let q = 2.0 + (100.0 - clamped) / 100.0 * 29.0;
    clamp_f64(q, 2.0, 31.0).round() as u32
}

pub fn qscale_from_crf(crf: u32) -> u32 {
    let clamped = (crf.min(51)) as f64;
    let q = 2.0 + (clamped / 51.0) * 29.0;
    clamp_f64(q, 2.0, 31.0).round() as u32
}

pub fn parse_kbps_string(raw: Option<&str>) -> Option<String> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    Some(digits)
}

pub fn parse_numeric_string(raw: Option<&str>) -> Option<String> {
    let raw = raw?.trim();
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

pub fn attach_process_to_job_object(child: &std::process::Child) {
    use std::os::windows::io::AsRawHandle;

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    extern "system" {
        fn CreateJobObjectW(
            lpJobAttributes: *const std::ffi::c_void,
            lpName: *const u16,
        ) -> *mut std::ffi::c_void;
        fn SetInformationJobObject(
            hJob: *mut std::ffi::c_void,
            JobObjectInformationClass: u32,
            lpJobObjectInformation: *const std::ffi::c_void,
            cbJobObjectInformationLength: u32,
        ) -> i32;
        fn AssignProcessToJobObject(
            hJob: *mut std::ffi::c_void,
            hProcess: *mut std::ffi::c_void,
        ) -> i32;
    }

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if !job.is_null() {
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.basic_limit_information.limit_flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if SetInformationJobObject(
                job,
                9,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) != 0
            {
                AssignProcessToJobObject(job, child.as_raw_handle() as *mut std::ffi::c_void);
            }
        }
    }
}
