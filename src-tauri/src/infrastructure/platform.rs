use directories::BaseDirs;
use std::path::PathBuf;

pub fn is_flatpak() -> bool {
    if cfg!(target_os = "linux") {
        let flatpak_channel = std::env::var("PULSAR_DIST")
            .map(|value| value.trim().eq_ignore_ascii_case("flatpak"))
            .unwrap_or(false);
        let in_flatpak = std::env::var("FLATPAK_ID")
            .map(|value| !value.trim().is_empty())
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

pub fn append_js_runtime_args(args: &mut Vec<String>) {
    let deno_name = if cfg!(target_os = "windows") {
        "deno.exe"
    } else {
        "deno"
    };
    let deno_path = get_requirements_path().join(deno_name);
    if deno_path.is_file() {
        args.push("--js-runtimes".to_string());
        args.push(format!("deno:{}", deno_path.to_string_lossy()));
    }
}

pub fn attach_process_to_job_object(child: &std::process::Child) {
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;

        #[repr(C)]
        struct BasicLimitInformation {
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
        struct IoCounters {
            read_operation_count: u64,
            write_operation_count: u64,
            other_operation_count: u64,
            read_transfer_count: u64,
            write_transfer_count: u64,
            other_transfer_count: u64,
        }

        #[repr(C)]
        struct ExtendedLimitInformation {
            basic_limit_information: BasicLimitInformation,
            io_info: IoCounters,
            process_memory_limit: usize,
            job_memory_limit: usize,
            peak_process_memory_used: usize,
            peak_job_memory_used: usize,
        }

        extern "system" {
            fn CreateJobObjectW(
                attributes: *const std::ffi::c_void,
                name: *const u16,
            ) -> *mut std::ffi::c_void;
            fn SetInformationJobObject(
                job: *mut std::ffi::c_void,
                information_class: u32,
                information: *const std::ffi::c_void,
                information_length: u32,
            ) -> i32;
            fn AssignProcessToJobObject(
                job: *mut std::ffi::c_void,
                process: *mut std::ffi::c_void,
            ) -> i32;
        }

        // The job object is intentionally kept open for the process lifetime so
        // closing it terminates child processes together with the bridge.
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if !job.is_null() {
                let mut info: ExtendedLimitInformation = std::mem::zeroed();
                info.basic_limit_information.limit_flags = 0x2000;
                if SetInformationJobObject(
                    job,
                    9,
                    &info as *const _ as *const _,
                    std::mem::size_of::<ExtendedLimitInformation>() as u32,
                ) != 0
                {
                    AssignProcessToJobObject(job, child.as_raw_handle() as *mut std::ffi::c_void);
                }
            }
        }
    }
    #[cfg(not(windows))]
    let _ = child;
}
