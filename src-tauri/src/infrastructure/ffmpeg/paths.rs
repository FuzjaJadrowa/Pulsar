use std::path::PathBuf;

pub fn get_ffmpeg_path() -> PathBuf {
    let name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    crate::infrastructure::platform::get_requirements_path().join(name)
}
