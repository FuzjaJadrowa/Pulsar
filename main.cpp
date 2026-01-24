#include <QApplication>
#include <QMainWindow>
#include <QStyleFactory>
#include <filesystem>
#include "Installer/installer_window.h"

namespace fs = std::filesystem;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow() {
        setWindowTitle("GUI Video Downloader");
        setWindowIcon(QIcon("icon.ico"));
        setMinimumSize(900, 600);

QWidget *central = new QWidget(this);
        setCentralWidget(central);
    }
};

int main(int argc, char *argv[]) {
    QApplication::setStyle(QStyleFactory::create("windowsvista"));
    QApplication app(argc, argv);

    bool needsInstallation = !fs::exists("requirements/yt-dlp.exe") ||
                              !fs::exists("requirements/ffmpeg.exe");

    if (needsInstallation) {
        InstallerWindow installer;
        if (installer.exec() != QDialog::Accepted) {
            return 0;
        }
    }

    MainWindow mainWin;
    mainWin.show();

    return app.exec();
}

#include "main.moc"