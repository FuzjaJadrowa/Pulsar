#include <QApplication>
#include <QFontDatabase>
#include <QTimer>
#include "App/Gui/container.h"
#include "App/Gui/components.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    app.setApplicationName("Pulsar");

    QFontDatabase::addApplicationFont(":/Resources/Fonts/Montserrat-ExtraBold.ttf");
    QFontDatabase::addApplicationFont(":/Resources/Fonts/Roboto-Regular.ttf");
    QFontDatabase::addApplicationFont(":/Resources/Fonts/Roboto-Black.ttf");
    app.setFont(QFont("Roboto", 10));

    app.setStyleSheet(StyleHelper::getGlobalStyle());

    Container w;

    if (!w.installer()->hasRequirements()) {
        w.installer()->startMissingFileDownload();
        if (w.installer()->exec() != QDialog::Accepted) { return 0; }
        }

    w.show();

    QTimer::singleShot(2000, w.installer(), [&w]() {
        w.installer()->checkForUpdates("yt-dlp", false);
    });

    QTimer::singleShot(3000, w.appUpdater(), [&w]() {
        w.appUpdater()->checkForAppUpdates(false);
    });

    return app.exec();
}