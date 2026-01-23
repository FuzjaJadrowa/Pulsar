import sys
from pathlib import Path
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout, QProgressBar, QApplication
from PySide6.QtCore import Qt

from app import VideoDownloaderGUI
from resources.notifications import PopupManager
from resources.reqdownloader import DependencyManager

HERE = Path(__file__).parent
DATA_DIR = HERE / "data"
REQUIREMENTS_DIR = DATA_DIR / "requirements"
DATA_DIR.mkdir(exist_ok=True)
REQUIREMENTS_DIR.mkdir(parents=True, exist_ok=True)

class Launcher(QWidget):
    def __init__(self, resource_path_func):
        super().__init__()
        self.resource_path = resource_path_func

        self.setWindowTitle("GUI Video Downloader Launcher")
        self.setFixedSize(680, 300)
        self.setStyleSheet("background-color: #121212;")

        top_row = QHBoxLayout()
        icon_label = QLabel()
        icon_path = self.resource_path("icon.ico")
        if icon_path.exists():
            icon_label.setPixmap(QPixmap(str(icon_path)).scaled(48, 48, Qt.KeepAspectRatio, Qt.SmoothTransformation))

        self.popup = PopupManager(self)
        self.deps = DependencyManager(
            self.popup,
            requirements_dir=REQUIREMENTS_DIR,
            json_path=DATA_DIR / "version_info.json"
        )

        self.downloading = False

        self.deps.signals.progress.connect(self.on_progress)
        self.deps.signals.finished.connect(self.on_op_finished_wrapper)
        self.deps.signals.info.connect(self.show_info_popup_wrapper)
        self.deps.signals.error.connect(self.show_error_popup_wrapper)

        top_row = QHBoxLayout()
        icon_label = QLabel()
        icon_path = HERE / "icon.ico"
        if icon_path.exists():
            icon_label.setPixmap(QPixmap(str(icon_path)).scaled(48, 48, Qt.KeepAspectRatio, Qt.SmoothTransformation))

        title_label = QLabel("GUI Video Downloader Launcher")
        title_label.setObjectName("title")
        subtitle_label = QLabel("Version 1.1.2")
        subtitle_label.setObjectName("subtitle")

        title_col = QVBoxLayout()
        title_col.addWidget(title_label, alignment=Qt.AlignLeft)
        title_col.addWidget(subtitle_label, alignment=Qt.AlignLeft)

        top_row.addWidget(icon_label, alignment=Qt.AlignLeft)
        top_row.addSpacing(8)
        top_row.addLayout(title_col)
        top_row.addStretch()

        ff_row = QHBoxLayout()
        ff_label = QLabel("ffmpeg")
        ff_label.setMinimumWidth(90)
        self.ff_progress = QProgressBar()
        self.ff_progress.setValue(0)
        self.ff_button = QPushButton("Install")
        self.ff_button.setFixedWidth(140)
        self.ff_button.clicked.connect(lambda: self.on_dep_clicked("ffmpeg"))
        ff_row.addWidget(ff_label)
        ff_row.addWidget(self.ff_progress, stretch=1)
        ff_row.addWidget(self.ff_button)

        yt_row = QHBoxLayout()
        yt_label = QLabel("yt-dlp")
        yt_label.setMinimumWidth(90)
        self.yt_progress = QProgressBar()
        self.yt_progress.setValue(0)
        self.yt_button = QPushButton("Install")
        self.yt_button.setFixedWidth(140)
        self.yt_button.clicked.connect(lambda: self.on_dep_clicked("yt-dlp"))
        yt_row.addWidget(yt_label)
        yt_row.addWidget(self.yt_progress, stretch=1)
        yt_row.addWidget(self.yt_button)

        self.launch_btn = QPushButton("Launch")
        self.launch_btn.setFixedWidth(140)
        self.launch_btn.clicked.connect(self.on_launch)

        layout = QVBoxLayout()
        layout.addLayout(top_row)
        layout.addSpacing(18)
        layout.addLayout(ff_row)
        layout.addLayout(yt_row)
        layout.addStretch()
        layout.addWidget(self.launch_btn, alignment=Qt.AlignCenter)
        layout.addSpacing(10)

        self.setLayout(layout)
        self.update_buttons_state()

    def show_info_popup_wrapper(self, message):
        self.popup.show_info(message)

    def show_error_popup_wrapper(self, message):
        self.popup.show_error(message)

    def on_op_finished_wrapper(self, name, success, message):
        self.downloading = False
        self.update_buttons_state()
        if success:
            self.popup.show_success(f"{name} {message}")
        else:
            self.popup.show_error(f"{name} {message}")

    def update_buttons_state(self):
        states = self.deps.check_existing_requirements()
        if states.get("ffmpeg"):
            self.ff_button.setText("Check Update")
            self.ff_progress.setValue(0)
        else:
            self.ff_button.setText("Install")
            self.ff_progress.setValue(0)
        if states.get("yt-dlp"):
            self.yt_button.setText("Check Update")
            self.yt_progress.setValue(0)
        else:
            self.yt_button.setText("Install")
            self.yt_progress.setValue(0)

        if states.get("ffmpeg") and states.get("yt-dlp"):
            self.launch_btn.setEnabled(True)
        else:
            self.launch_btn.setEnabled(False)

    def on_dep_clicked(self, name):
        btn = self.ff_button if name == "ffmpeg" else self.yt_button
        progress = self.ff_progress if name == "ffmpeg" else self.yt_progress

        if btn.text().lower() == "install":
            self.deps.install_dependency(name, progress, btn)
        else:
            self.deps.check_update_dependency(name, progress, btn)

    def on_progress(self, name, pct):
        if name == "ffmpeg":
            self.ff_progress.setValue(pct)
        elif name == "yt-dlp":
            self.yt_progress.setValue(pct)

    def on_launch(self):
        try:
            self.window = VideoDownloaderGUI(self.resource_path)
            self.window.show()
            self.close()
        except Exception as e:
            self.popup.show_error(f"Error: Cannot launch app.")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    w = Launcher()
    w.show()
    sys.exit(app.exec())