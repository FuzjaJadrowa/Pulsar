import subprocess
import threading
from pathlib import Path
import validators
import requests
from PySide6.QtCore import QObject, Signal
from resources.notifications import PopupManager

YT_DLP_PATH = Path(__file__).parent.parent / "data" / "requirements" / "yt-dlp.exe"
FFMPEG_PATH = Path(__file__).parent.parent / "data" / "requirements"

class Downloader(QObject):
    output_signal = Signal(str)
    progress_signal = Signal(float)
    finished_signal = Signal(bool, str)

    def __init__(self, popup_manager: PopupManager, progress_callback=None, output_callback=None):
        super().__init__()
        self.popup = popup_manager
        self.process = None
        self.progress_callback = progress_callback
        self.output_callback = output_callback
        if self.output_callback:
            self.output_signal.connect(lambda s: self.output_callback(s))
        if self.progress_callback:
            self.progress_signal.connect(lambda v: self.progress_callback(v))
        self.finished_signal.connect(self._on_finished_signal)

    def _on_finished_signal(self, ok: bool, msg: str):
        if ok:
            self.popup.show_success(msg)
        else:
            self.popup.show_error(msg)

    def check_internet(self) -> bool:
        try:
            requests.get("https://www.google.com", timeout=5)
            return True
        except requests.RequestException:
            return False

    def validate_input(self, url: str, download_path: str) -> bool:
        if not url:
            self.popup.show_error("No link provided.")
            return False
        if not validators.url(url):
            self.popup.show_error("The link provided is not valid.")
            return False
        if not download_path:
            self.popup.show_error("No download path provided.")
            return False
        if not self.check_internet():
            self.popup.show_error("No internet connection.")
            return False
        return True

    def download_video(
        self, url: str, download_path: str,
        cookies=None, audio_only=False,
        audio_format="Default", audio_quality="Default",
        video_format="Default", video_quality="Default",
        frag_from=None, frag_to=None,
        custom_arg=None,
        on_finished=None
    ):
        if not self.validate_input(url, download_path):
            if on_finished:
                on_finished()
            return

        download_path = Path(download_path)
        download_path.mkdir(parents=True, exist_ok=True)

        env = dict(**subprocess.os.environ)
        env["PATH"] = str(FFMPEG_PATH) + ";" + env.get("PATH", "")

        cmd = [
            str(YT_DLP_PATH),
            "--no-playlist",
            "-P", str(download_path),
            "--ffmpeg-location", str(FFMPEG_PATH / "ffmpeg.exe")
        ]

        if cookies and cookies.lower() != "none":
            cmd += ["--cookies-from-browser", cookies.lower()]
        if frag_from and frag_to:
            cmd += ["--download-sections", f"*{frag_from}-{frag_to}"]

        if audio_only:
            cmd.append("-x")
            if audio_format.lower() != "default":
                cmd += ["--audio-format", audio_format.lower()]
            if audio_quality.lower() != "default":
                cmd += ["--audio-quality", audio_quality.replace("kbps", "K")]
        else:
            cmd += ["-f", "bv+ba"]
            if video_quality.lower() != "default":
                res_value = video_quality.replace("p", "")
                cmd += ["-S", f"res:{res_value}"]
            if video_format.lower() != "default":
                cmd += ["--merge-output-format", video_format.lower()]

        if custom_arg:
            cmd += [custom_arg]
        cmd.append(url)

        def run():
            try:
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                si.wShowWindow = subprocess.SW_HIDE
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env=env,
                    startupinfo=si,
                    bufsize=1
                )
                for line in self.process.stdout:
                    self.output_signal.emit(line.strip())
                    if "[download]" in line and "%" in line:
                        try:
                            percent_str = line.split("%")[0].split()[-1]
                            percent = float(percent_str)
                            self.progress_signal.emit(percent)
                        except Exception:
                            pass
                self.process.wait()
                if self.process.returncode == 0:
                    self.finished_signal.emit(True, "Download completed successfully!")
                else:
                    self.finished_signal.emit(False, "Download failed. Check output for details.")
            except Exception:
                self.finished_signal.emit(False, "Download failed. Check output for details.")
            finally:
                self.process = None
                self.progress_signal.emit(0.0)
                if on_finished:
                    on_finished()

        threading.Thread(target=run, daemon=True).start()

    def stop_download(self):
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass
            self.process = None
            self.popup.show_info("Download stopped by user.")
            self.progress_signal.emit(0.0)