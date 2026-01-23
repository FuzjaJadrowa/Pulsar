import sys

from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QFontDatabase, QIcon
from launcher import Launcher
from pathlib import Path

def resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) / relative_path
    return Path(__file__).parent / relative_path

HERE = Path(__file__).parent

app = QApplication(sys.argv)

QFontDatabase.addApplicationFont(str(resource_path("fonts/Montserrat-Bold.ttf")))
QFontDatabase.addApplicationFont(str(resource_path("fonts/Montserrat-ExtraBold.ttf")))

app.setWindowIcon(QIcon(str(resource_path("icon.ico"))))

app.setStyleSheet("""
QWidget {
    background-color: #121212;
    color: #ffffff;
    font-family: 'Montserrat';
}
QLabel#title {
    font-weight: 800;
    font-size: 28px;
}
QLabel#subtitle {
    font-weight: 700;
    font-size: 14px;
    color: #bdbdbd;
}
QPushButton {
    background-color: #2b2b2b;
    color: #ffffff;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 6px 12px;
    font-weight: 700;
}
QPushButton:hover {
    background-color: #3a3f4a;
    border: 1px solid #00bfff;
}
QPushButton:disabled {
    background-color: #1b1b1b;
    color: #777777;
    border: 1px solid #2a2a2a;
}
QProgressBar {
    background-color: #1f1f1f;
    color: #ffffff;
    border: 1px solid #333333;
    border-radius: 6px;    text-align: center;
}
QProgressBar::chunk {
    background-color: #00bfff;
    border-radius: 6px;
}
QLabel#progress {
    background-color: #1f1f1f;
    color: #ffffff;
    border: 1px solid #333333;
    border-radius: 6px;
    text-align: center;
}
QComboBox:disabled, QCheckBox:disabled, QLineEdit:disabled {
    background-color: #2b2b2b;
    color: #777777;
}
QTextEdit {
    background-color: #121212;
    color: #ffffff;
}
QScrollBar:vertical {
    background: #121212;
    width: 12px;
}
QScrollBar::handle:vertical {
    background: green;
    min-height: 20px;
}
""")

window = Launcher(resource_path)
window.show()
sys.exit(app.exec())