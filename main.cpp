#include <QApplication>
#include <QMainWindow>
#include <QStackedWidget>
#include <filesystem>
#include "Installer/installer_window.h"

namespace fs = std::filesystem;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow() {
        setWindowTitle("GUI Video Downloader");
        setWindowIcon(QIcon("icon.ico"));

        stackedWidget = new QStackedWidget(this);
        setCentralWidget(stackedWidget);

        installer = new InstallerWindow(this);

mainAppWidget = new QWidget(this);
        mainAppWidget->setStyleSheet("background-color: #f0f0f0;");
        stackedWidget->addWidget(installer);
        stackedWidget->addWidget(mainAppWidget);

        connect(installer, &InstallerWindow::installationFinished, this, &MainWindow::showMainApp);

        if (fs::exists("requirements/yt-dlp.exe") && fs::exists("requirements/ffmpeg.exe")) {
            showMainApp();
        } else {
            setFixedSize(450, 140);
            stackedWidget->setCurrentIndex(0);
        }
    }

private slots:
    void showMainApp() {
        stackedWidget->setCurrentIndex(1);
        setMinimumSize(800, 500);
        resize(900, 600);
        }

private:
    QStackedWidget *stackedWidget;
    InstallerWindow *installer;
    QWidget *mainAppWidget;
};

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    MainWindow window;
    window.show();
    return app.exec();
}

#include "main.moc"