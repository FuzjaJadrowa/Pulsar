#ifndef DOWNLOADER_PAGE_H
#define DOWNLOADER_PAGE_H

#include <QWidget>
#include <QLabel>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QCheckBox>
#include <QTextEdit>
#include <QScrollArea>
#include "../Core/popup.h"
#include "../Core/downloader.h"
#include "components.h"

class DownloaderPage : public QWidget {
    Q_OBJECT
public:
    explicit DownloaderPage(QWidget *parent = nullptr);
    Downloader* getDownloader() const { return downloader; }
    void refreshStyles();

    QPoint getStartBtnPos() const;

    signals:
        void downloadRequested();

private slots:
    void onBrowseClicked();
    void onAudioOnlyToggled(bool checked);
    void onStartClicked();
    void onAddToQueueClicked();
    void onSubsOptionsChanged();
    void updateCommandPreview();

private:
    void setupUi();

    bool isValidTimeFormat(const QString &timeStr);
    bool validateInputs();

    QLabel *iconLabel;
    QLineEdit *urlInput;
    QLineEdit *pathInput;
    AnimatedButton *browseBtn;
    QComboBox *videoFormatCombo, *videoQualityCombo, *audioFormatCombo, *audioQualityCombo;
    QCheckBox *audioOnlyCheck, *downloadSubsCheck, *downloadChatCheck;
    QLineEdit *subsLangInput, *timeStartInput, *timeEndInput, *customArgsInput;
    AnimatedButton *advancedBtn, *startBtn, *addToQueueBtn;
    QPushButton *m_lastClickedBtn = nullptr;
    QWidget *advancedContent;
    QTextEdit *cmdPreview;
    Downloader *downloader;
    Popup *popup;
};

#endif