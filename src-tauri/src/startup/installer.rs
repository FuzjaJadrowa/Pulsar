use super::updater::get_executable_name;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn replace_file_with_rollback(source: &Path, destination: &Path) -> Result<(), String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let backup = destination.with_file_name(format!(
        ".{}.backup-{}-{nonce}",
        destination
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("component"),
        std::process::id()
    ));
    let had_previous = destination.exists();
    if had_previous {
        fs::rename(destination, &backup)
            .map_err(|e| format!("Failed to preserve existing file: {e}"))?;
    }
    if let Err(error) = fs::rename(source, destination) {
        if had_previous {
            let _ = fs::rename(&backup, destination);
        }
        return Err(format!("Failed to install downloaded file: {error}"));
    }
    if had_previous {
        if let Err(error) = fs::remove_file(backup) {
            eprintln!("Installed file but could not remove backup: {error}");
        }
    }
    Ok(())
}

pub(super) fn validate_bridge_binary(path: &Path) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0_u8; 4];
    file.read_exact(&mut magic)
        .map_err(|e| format!("Downloaded bridge binary is incomplete: {e}"))?;
    let valid = if cfg!(target_os = "windows") {
        magic[0..2] == *b"MZ"
    } else if cfg!(target_os = "macos") {
        matches!(
            magic,
            [0xFE, 0xED, 0xFA, 0xCE]
                | [0xCE, 0xFA, 0xED, 0xFE]
                | [0xFE, 0xED, 0xFA, 0xCF]
                | [0xCF, 0xFA, 0xED, 0xFE]
                | [0xCA, 0xFE, 0xBA, 0xBE]
                | [0xBE, 0xBA, 0xFE, 0xCA]
        )
    } else {
        magic == [0x7F, b'E', b'L', b'F']
    };
    if valid {
        Ok(())
    } else {
        Err("Downloaded bridge asset is not a valid executable for this platform.".to_string())
    }
}

pub(super) fn install_staged_directory(staging: &Path, destination: &Path) -> Result<(), String> {
    fn collect_files(
        root: &Path,
        directory: &Path,
        files: &mut Vec<PathBuf>,
    ) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            if file_type.is_symlink() {
                return Err("Update archive contains a symbolic link.".to_string());
            }
            if file_type.is_dir() {
                collect_files(root, &path, files)?;
            } else if file_type.is_file() {
                let _ = path.strip_prefix(root).map_err(|e| e.to_string())?;
                files.push(path);
            }
        }
        Ok(())
    }

    let mut files = Vec::new();
    collect_files(staging, staging, &mut files)?;
    files.sort();
    let mut installed: Vec<(PathBuf, Option<PathBuf>)> = Vec::new();

    for (index, source) in files.iter().enumerate() {
        let relative = source.strip_prefix(staging).map_err(|e| e.to_string())?;
        let target = destination.join(relative);
        if let Some(parent) = target.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                rollback_installed_files(&installed);
                return Err(format!("Failed to create update directory: {error}"));
            }
        }

        let backup = if target.exists() {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let backup = target.with_file_name(format!(
                ".{}.backup-{}-{index}-{nonce}",
                target
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("component"),
                std::process::id()
            ));
            if let Err(error) = fs::rename(&target, &backup) {
                rollback_installed_files(&installed);
                return Err(format!(
                    "Failed to preserve existing component file: {error}"
                ));
            }
            Some(backup)
        } else {
            None
        };

        if let Err(error) = fs::rename(source, &target) {
            if let Some(backup_path) = &backup {
                let _ = fs::rename(backup_path, &target);
            }
            rollback_installed_files(&installed);
            return Err(format!("Failed to install component file: {error}"));
        }
        installed.push((target, backup));
    }

    for (_, backup) in installed {
        if let Some(backup) = backup {
            if let Err(error) = fs::remove_file(backup) {
                eprintln!("Component updated but backup cleanup failed: {error}");
            }
        }
    }
    Ok(())
}

fn rollback_installed_files(installed: &[(PathBuf, Option<PathBuf>)]) {
    for (target, backup) in installed.iter().rev() {
        let _ = fs::remove_file(target);
        if let Some(backup) = backup {
            let _ = fs::rename(backup, target);
        }
    }
}

pub(super) fn extract_archive(
    archive_path: &Path,
    dest_dir: &Path,
    component: &str,
) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|e| e.to_string())?;

    if archive_path.extension().unwrap_or_default() == "zip" {
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(dest_dir).map_err(|e| e.to_string())?;
    } else {
        let mut cmd = std::process::Command::new("tar");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let output = cmd
            .arg("-xf")
            .arg(archive_path)
            .arg("-C")
            .arg(dest_dir)
            .output()
            .map_err(|e| format!("Failed to run tar command: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "Archive extraction failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }

    if component == "ffmpeg" {
        ensure_ffmpeg_permissions(dest_dir)?;
    }

    Ok(())
}

fn ensure_ffmpeg_permissions(dest_dir: &Path) -> Result<(), String> {
    for name in ["ffmpeg", "ffprobe", "deno"] {
        set_executable_permissions(&dest_dir.join(get_executable_name(name)))?;
    }
    Ok(())
}

pub(super) fn set_executable_permissions(path: &Path) -> Result<(), String> {
    #[cfg(target_family = "unix")]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_family = "unix"))]
    {
        let _ = path;
    }
    Ok(())
}
