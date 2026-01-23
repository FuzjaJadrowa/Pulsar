from PySide6.QtWidgets import QWidget, QLabel, QPushButton, QLineEdit, QVBoxLayout, QHBoxLayout, QProgressBar, QComboBox, QCheckBox, QFileDialog, QTextEdit, QStackedWidget
from PySide6.QtGui import QIcon, Qt, QPixmap
from PySide6.QtCore import QTimer

from resources.downloader import Downloader
from resources.notifications import PopupManager
from PySide6.QtWidgets import QWidget, QLabel, QPushButton, QLineEdit, QVBoxLayout, QHBoxLayout, QComboBox, QCheckBox, QFileDialog, QTextEdit, QStackedWidget
from PySide6.QtGui import QIcon, QPixmap, Qt
from PySide6.QtCore import QTimer

class VideoDownloaderGUI(QWidget):
    def __init__(self, resource_path_func):
        super().__init__()
        self.resource_path = resource_path_func
        self.setWindowTitle("GUI Video Downloader")
        self.setFixedSize(550, 600)
        self.setWindowIcon(QIcon(str(self.resource_path("icon.ico"))))
        self.init_ui()

    def init_ui(self):
        icon_label = QLabel()
        icon_label.setPixmap(QPixmap(str(self.resource_path("icon.ico"))).scaled(32, 32, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        main_layout = QVBoxLayout()

        title_layout = QHBoxLayout()
        title_layout.setAlignment(Qt.AlignCenter)
        icon_label = QLabel()
        icon_label.setPixmap(QPixmap(str(self.resource_path("icon.ico"))).scaled(32, 32, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        title_layout.addWidget(icon_label)
        self.title_label = QLabel("GUI Video Downloader")
        self.title_label.setObjectName("title")
        self.title_label.setAlignment(Qt.AlignCenter)
        title_layout.addWidget(self.title_label)
        main_layout.addLayout(title_layout)

        self.stack = QStackedWidget()
        main_layout.addWidget(self.stack)

        download_widget = QWidget()
        download_layout = QVBoxLayout(download_widget)

        self.url_label = QLabel("Video URL:")
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("Paste your video URL here")
        download_layout.addWidget(self.url_label)
        download_layout.addWidget(self.url_input)

        self.path_label = QLabel("Download path:")
        path_layout = QHBoxLayout()
        self.path_input = QLineEdit()
        self.path_input.setPlaceholderText("Select download folder")
        self.path_button = QPushButton("Browse")
        self.path_button.clicked.connect(self.select_download_path)
        path_layout.addWidget(self.path_input)
        path_layout.addWidget(self.path_button)
        download_layout.addWidget(self.path_label)
        download_layout.addLayout(path_layout)

        self.cookies_label = QLabel("Cookies from browser:")
        self.cookies_combo = QComboBox()
        self.cookies_combo.addItems(["None", "Brave", "Chrome", "Chromium", "Edge", "Firefox", "Opera", "Safari", "Vivaldi", "Whale"])
        download_layout.addWidget(self.cookies_label)
        download_layout.addWidget(self.cookies_combo)

        self.frag_label = QLabel("Download fragments:")
        frag_layout = QHBoxLayout()
        self.frag_from = QLineEdit()
        self.frag_from.setPlaceholderText("From (hh:mm:ss)")
        self.frag_to = QLineEdit()
        self.frag_to.setPlaceholderText("To (hh:mm:ss)")
        frag_layout.addWidget(self.frag_from)
        frag_layout.addWidget(self.frag_to)
        download_layout.addWidget(self.frag_label)
        download_layout.addLayout(frag_layout)

        self.audio_only_checkbox = QCheckBox("Audio only")
        self.audio_only_checkbox.stateChanged.connect(self.toggle_audio_only)
        download_layout.addWidget(self.audio_only_checkbox)

        video_layout = QHBoxLayout()
        self.video_quality_label = QLabel("Video quality:")
        self.video_quality_combo = QComboBox()
        self.video_quality_combo.setMinimumWidth(100)
        self.video_quality_combo.addItems(["Default", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"])
        self.video_format_label = QLabel("Video format:")
        self.video_format_combo = QComboBox()
        self.video_format_combo.setMinimumWidth(100)
        self.video_format_combo.addItems(["Default", "mp4", "mkv", "mov", "avi", "flv", "webm"])
        video_layout.addWidget(self.video_quality_label)
        video_layout.addWidget(self.video_quality_combo)
        video_layout.addWidget(self.video_format_label)
        video_layout.addWidget(self.video_format_combo)
        download_layout.addLayout(video_layout)

        audio_layout = QHBoxLayout()
        self.audio_quality_label = QLabel("Audio quality:")
        self.audio_quality_combo = QComboBox()
        self.audio_quality_combo.setMinimumWidth(100)
        self.audio_quality_combo.addItems(["Default", "320kbps", "256kbps", "192kbps", "128kbps"])
        self.audio_format_label = QLabel("Audio format:")
        self.audio_format_combo = QComboBox()
        self.audio_format_combo.setMinimumWidth(100)
        self.audio_format_combo.addItems(["Default", "mp3", "m4a", "aac", "opus", "wav", "ogg"])
        audio_layout.addWidget(self.audio_quality_label)
        audio_layout.addWidget(self.audio_quality_combo)
        audio_layout.addWidget(self.audio_format_label)
        audio_layout.addWidget(self.audio_format_combo)
        download_layout.addLayout(audio_layout)

        self.custom_arg_label = QLabel("Custom arguments:")
        self.custom_arg_input = QLineEdit()
        self.custom_arg_input.setPlaceholderText("None")
        download_layout.addWidget(self.custom_arg_label)
        download_layout.addWidget(self.custom_arg_input)

        self.cmd_preview_label = QLabel("Command preview:")
        self.cmd_preview_text = QLabel("")
        self.cmd_preview_text.setWordWrap(True)
        download_layout.addWidget(self.cmd_preview_label)
        download_layout.addWidget(self.cmd_preview_text)

        self.progress_label = QLabel("Press Start")
        self.progress_label.setObjectName("progress")
        self.progress_label.setAlignment(Qt.AlignCenter)
        download_layout.addWidget(self.progress_label)

        buttons_layout = QHBoxLayout()
        self.start_button = QPushButton("Start")
        self.start_button.clicked.connect(self.start_download)
        self.stop_button = QPushButton("Stop")
        self.stop_button.setEnabled(False)
        self.stop_button.clicked.connect(self.stop_download)
        buttons_layout.addWidget(self.start_button)
        buttons_layout.addWidget(self.stop_button)
        download_layout.addLayout(buttons_layout)

        switch_layout = QHBoxLayout()
        self.download_tab_btn = QPushButton("Download")
        self.console_tab_btn = QPushButton("Console output")
        self.download_tab_btn.clicked.connect(lambda: self.switch_tab(0))
        self.console_tab_btn.clicked.connect(lambda: self.switch_tab(1))
        switch_layout.addWidget(self.download_tab_btn)
        switch_layout.addWidget(self.console_tab_btn)
        main_layout.addLayout(switch_layout)

        download_widget.setLayout(download_layout)
        self.stack.addWidget(download_widget)

        console_widget = QWidget()
        console_layout = QVBoxLayout(console_widget)
        self.console_output = QTextEdit()
        self.console_output.setReadOnly(True)
        console_layout.addWidget(self.console_output)
        console_widget.setLayout(console_layout)
        self.stack.addWidget(console_widget)

        self.setLayout(main_layout)
        self.toggle_audio_only(False)

        self.timer = QTimer()
        self.timer.timeout.connect(self.update_command_preview)
        self.timer.start(500)

        self.switch_tab(0)

    def switch_tab(self, index):
        self.stack.setCurrentIndex(index)
        self.download_tab_btn.setEnabled(index != 0)
        self.console_tab_btn.setEnabled(index != 1)

    def toggle_audio_only(self, state):
        audio_only = bool(state)
        self.video_quality_combo.setEnabled(not audio_only)
        self.video_format_combo.setEnabled(not audio_only)
        self.audio_quality_combo.setEnabled(audio_only)
        self.audio_format_combo.setEnabled(audio_only)

    def select_download_path(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Download Folder")
        if folder:
            self.path_input.setText(folder)

    def build_command(self):
        url = self.url_input.text().strip()
        path = self.path_input.text().strip()
        cookies = self.cookies_combo.currentText()
        audio_only = self.audio_only_checkbox.isChecked()
        audio_format = self.audio_format_combo.currentText()
        audio_quality = self.audio_quality_combo.currentText()
        video_format = self.video_format_combo.currentText()
        video_quality = self.video_quality_combo.currentText()
        frag_from = self.frag_from.text().strip()
        frag_to = self.frag_to.text().strip()
        custom_arg = self.custom_arg_input.text().strip()
        cmd = ["yt-dlp"]
        if cookies and cookies.lower() != "none":
            cmd += ["--cookies-from-browser", cookies.lower()]
        if frag_from and frag_to:
            cmd += ["--download-sections", f'"*{frag_from}-{frag_to}"']
        if audio_only:
            cmd.append("-x")
            if audio_format.lower() != "default":
                cmd += ["--audio-format", audio_format.lower()]
            if audio_quality.lower() != "default":
                cmd += ["--audio-quality", audio_quality.replace("kbps", "K")]
        else:
            if video_quality.lower() != "default":
                res_value = video_quality.replace("p", "")
                cmd += ["-S", f"res:{res_value}"]
            if video_format.lower() != "default":
                cmd += ["--merge-output-format", video_format.lower()]
        if custom_arg:
            cmd += [custom_arg]
        if url:
            cmd.append(url)
        return " ".join(cmd)

    def update_command_preview(self):
        self.cmd_preview_text.setText(self.build_command())

    def start_download(self):
        popup = PopupManager(self)
        self.downloader = Downloader(popup, progress_callback=self.update_progress, output_callback=self.update_console)
        url = self.url_input.text().strip()
        path = self.path_input.text().strip()
        cookies = self.cookies_combo.currentText()
        audio_only = self.audio_only_checkbox.isChecked()
        audio_format = self.audio_format_combo.currentText()
        audio_quality = self.audio_quality_combo.currentText()
        video_format = self.video_format_combo.currentText()
        video_quality = self.video_quality_combo.currentText()
        frag_from = self.frag_from.text().strip()
        frag_to = self.frag_to.text().strip()
        custom_arg = self.custom_arg_input.text().strip()
        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        self.progress_label.setText("Downloading...")
        self.downloader.download_video(
            url, path, cookies=cookies, audio_only=audio_only,
            audio_format=audio_format, audio_quality=audio_quality,
            video_format=video_format, video_quality=video_quality,
            frag_from=frag_from, frag_to=frag_to,
            custom_arg=custom_arg,
            on_finished=self.on_download_finished
        )

    def on_download_finished(self):
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.progress_label.setText("Press Start")

    def stop_download(self):
        if hasattr(self, "downloader") and self.downloader:
            self.downloader.stop_download()
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.progress_label.setText("Press Start")

    def update_progress(self, percent):
        if percent > 0:
            self.progress_label.setText("Downloading...")
        else:
            self.progress_label.setText("Press Start")

    def update_console(self, text):
        self.console_output.append(text)