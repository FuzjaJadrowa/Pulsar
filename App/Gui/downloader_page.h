#ifndef DOWNLOADER_PAGE_H
#define DOWNLOADER_PAGE_H

#include <QWidget>
#include <QLabel>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QCheckBox>
#include <QProgressBar>
#include <QTextEdit>
#include <QScrollArea>
#include "../Core/popup.h"
#include "../Core/downloader.h"

class DownloaderPage : public QWidget {
    Q_OBJECT
public:
    explicit DownloaderPage(QWidget *parent = nullptr);
    Downloader* getDownloader() const { return downloader; }
    void updateThemeProperty();

private slots:
    void onBrowseClicked();
    void onAudioOnlyToggled(bool checked);
    void onStartClicked();
    void onStopClicked();
    void onDownloadFinished(bool ok, const QString &msg);
    void onProgressUpdated(double percent, const QString &eta);
    void onSubsOptionsChanged();
    void updateCommandPreview();

private:
    void setupUi();
    bool isValidTimeFormat(const QString &timeStr);

    QLineEdit *urlInput;
    QLineEdit *pathInput;
    QPushButton *browseBtn;
    QComboBox *videoFormatCombo, *videoQualityCombo, *audioFormatCombo, *audioQualityCombo;
    QCheckBox *audioOnlyCheck, *downloadSubsCheck, *downloadChatCheck;
    QLineEdit *subsLangInput, *timeStartInput, *timeEndInput, *customArgsInput;
    QPushButton *advancedBtn, *startBtn, *stopBtn;
    QWidget *advancedContent;
    QTextEdit *cmdPreview;
    QProgressBar *progressBar;
    Downloader *downloader;
    Popup *popup;
};

#endif