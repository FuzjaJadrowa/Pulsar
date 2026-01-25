#ifndef MAIN_PAGE_H
#define MAIN_PAGE_H

#include <QWidget>
#include <QLabel>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QCheckBox>
#include <QProgressBar>
#include "popup.h"
#include "downloader.h"

class MainPage : public QWidget {
    Q_OBJECT
public:
    explicit MainPage(QWidget *parent = nullptr);
    Downloader* getDownloader() const { return downloader; }

private slots:
    void onBrowseClicked();
    void onAudioOnlyToggled(bool checked);
    void onStartClicked();
    void onStopClicked();
    // USUNIĘTO: void onLogReceived(const QString &msg);
    void onDownloadFinished(bool ok, const QString &msg);
    void onProgressUpdated(double percent, const QString &eta);

private:
    void setupUi();

    QLineEdit *urlInput;
    QLineEdit *pathInput;
    QPushButton *browseBtn;

    QComboBox *videoFormatCombo;
    QComboBox *videoQualityCombo;
    QComboBox *audioFormatCombo;
    QComboBox *audioQualityCombo;

    QCheckBox *audioOnlyCheck;

    QPushButton *startBtn;
    QPushButton *stopBtn;

    QProgressBar *progressBar;
    QLabel *statusLabel;

    Downloader *downloader;
    Popup *popup;
};

#endif