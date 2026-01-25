#include "main_page.h"
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QDebug>

MainPage::MainPage(QWidget *parent) : QWidget(parent) {
    downloader = new Downloader(this);
    popup = new Popup(this);

    setupUi();

    connect(downloader, &Downloader::outputLog, this, &MainPage::onLogReceived);
    connect(downloader, &Downloader::finished, this, &MainPage::onDownloadFinished);
}

void MainPage::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(30, 40, 30, 40);
    mainLayout->setSpacing(20);

    auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/icon.png").scaled(40, 40, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    auto *header = new QLabel("GUI Video Downloader", this);
    header->setObjectName("PageTitle");
    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(header);
    headerLayout->addStretch();
    mainLayout->addLayout(headerLayout);

    mainLayout->addSpacing(10);

    auto *inputLayout = new QHBoxLayout();
    inputLayout->setSpacing(10);

    urlInput = new QLineEdit(this);
    urlInput->setPlaceholderText("Paste link here...");
    urlInput->setObjectName("UrlInput");

    pathInput = new QLineEdit(this);
    pathInput->setPlaceholderText("Download path...");
    pathInput->setObjectName("PathInput");

    browseBtn = new QPushButton("Browse", this);
    browseBtn->setObjectName("BrowseBtn");
    browseBtn->setCursor(Qt::PointingHandCursor);
    connect(browseBtn, &QPushButton::clicked, this, &MainPage::onBrowseClicked);

    inputLayout->addWidget(urlInput, 2);
    inputLayout->addWidget(pathInput, 1);
    inputLayout->addWidget(browseBtn, 0);

    mainLayout->addLayout(inputLayout);

    auto *optionsGroup = new QWidget(this);
    auto *gridLayout = new QGridLayout(optionsGroup);
    gridLayout->setContentsMargins(0, 10, 0, 10);
    gridLayout->setHorizontalSpacing(20);
    gridLayout->setVerticalSpacing(15);

    gridLayout->addWidget(new QLabel("Video Format:", this), 0, 0);
    videoFormatCombo = new QComboBox(this);
    videoFormatCombo->addItems({"Default", "mp4", "mkv", "mov", "avi", "flv", "webm"});
    gridLayout->addWidget(videoFormatCombo, 1, 0);

    gridLayout->addWidget(new QLabel("Video Quality:", this), 0, 1);
    videoQualityCombo = new QComboBox(this);
    videoQualityCombo->addItems({"Default", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"});
    gridLayout->addWidget(videoQualityCombo, 1, 1);

    gridLayout->addWidget(new QLabel("Audio Format:", this), 2, 0);
    audioFormatCombo = new QComboBox(this);
    audioFormatCombo->addItems({"Default", "mp3", "m4a", "aac", "opus", "wav", "ogg"});
    gridLayout->addWidget(audioFormatCombo, 3, 0);

    gridLayout->addWidget(new QLabel("Audio Quality:", this), 2, 1);
    audioQualityCombo = new QComboBox(this);
    audioQualityCombo->addItems({"Default", "360kbps", "256kbps", "192kbps", "128kbps"});
    gridLayout->addWidget(audioQualityCombo, 3, 1);

    audioOnlyCheck = new QCheckBox("Audio only", this);
    audioOnlyCheck->setObjectName("AudioCheck");
    audioOnlyCheck->setCursor(Qt::PointingHandCursor);
    connect(audioOnlyCheck, &QCheckBox::toggled, this, &MainPage::onAudioOnlyToggled);
    gridLayout->addWidget(audioOnlyCheck, 1, 2, 3, 1, Qt::AlignTop);

    mainLayout->addWidget(optionsGroup);
    mainLayout->addStretch();

    auto *btnLayout = new QHBoxLayout();
    btnLayout->addStretch();

    startBtn = new QPushButton("Start Download", this);
    startBtn->setObjectName("StartBtn");
    startBtn->setCursor(Qt::PointingHandCursor);
    startBtn->setMinimumHeight(45);
    startBtn->setMinimumWidth(150);
    connect(startBtn, &QPushButton::clicked, this, &MainPage::onStartClicked);

    stopBtn = new QPushButton("Stop", this);
    stopBtn->setObjectName("StopBtn");
    stopBtn->setCursor(Qt::PointingHandCursor);
    stopBtn->setMinimumHeight(45);
    stopBtn->setEnabled(false);
    connect(stopBtn, &QPushButton::clicked, this, &MainPage::onStopClicked);

    btnLayout->addWidget(startBtn);
    btnLayout->addWidget(stopBtn);
    btnLayout->addStretch();

    mainLayout->addLayout(btnLayout);

    onAudioOnlyToggled(false);
}

void MainPage::onBrowseClicked() {
    QString dir = QFileDialog::getExistingDirectory(this, "Select Download Directory",
                                                    pathInput->text().isEmpty() ? QDir::homePath() : pathInput->text());
    if (!dir.isEmpty()) {
        pathInput->setText(dir);
    }
}

void MainPage::onAudioOnlyToggled(bool checked) {
    videoFormatCombo->setEnabled(!checked);
    videoQualityCombo->setEnabled(!checked);
    audioFormatCombo->setEnabled(checked);
    audioQualityCombo->setEnabled(checked);
}

void MainPage::onStartClicked() {
    startBtn->setEnabled(false);
    startBtn->setText("Downloading...");
    stopBtn->setEnabled(true);

    downloader->startDownload(
        urlInput->text().trimmed(),
        pathInput->text().trimmed(),
        audioOnlyCheck->isChecked(),
        videoFormatCombo->currentText(),
        videoQualityCombo->currentText(),
        audioFormatCombo->currentText(),
        audioQualityCombo->currentText()
    );
}

void MainPage::onStopClicked() {
    downloader->stopDownload();
}

void MainPage::onLogReceived(const QString &msg) {
    qDebug() << msg;
}

void MainPage::onDownloadFinished(bool ok, const QString &msg) {
    startBtn->setEnabled(true);
    startBtn->setText("Start Download");
    stopBtn->setEnabled(false);

    if (ok) {
        popup->showMessage("Success", msg, Popup::Success, Popup::Temporary);
    } else {
        popup->showMessage("Error", msg, Popup::Error, Popup::Temporary);
    }
}