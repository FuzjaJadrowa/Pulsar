#include "main_page.h"
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QDebug>
#include <QStyleFactory>

MainPage::MainPage(QWidget *parent) : QWidget(parent) {
    downloader = new Downloader(this);
    popup = new Popup(this);

    setupUi();

    connect(downloader, &Downloader::finished, this, &MainPage::onDownloadFinished);
    connect(downloader, &Downloader::progressUpdated, this, &MainPage::onProgressUpdated);
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

    progressBar = new QProgressBar(this);
    progressBar->setRange(0, 100);
    progressBar->setValue(0);
    progressBar->setTextVisible(true);
    progressBar->setFormat("0%");
    progressBar->setAlignment(Qt::AlignCenter);
    progressBar->setFixedHeight(25);
    progressBar->setStyle(QStyleFactory::create("windowsvista"));
    progressBar->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    statusLabel = new QLabel("", this);
    statusLabel->setObjectName("StatusLabel");
    statusLabel->hide();

    startBtn = new QPushButton("Start", this);
    startBtn->setObjectName("StartBtn");
    startBtn->setCursor(Qt::PointingHandCursor);
    startBtn->setMinimumHeight(45);
    startBtn->setMinimumWidth(100);
    connect(startBtn, &QPushButton::clicked, this, &MainPage::onStartClicked);

    stopBtn = new QPushButton("Stop", this);
    stopBtn->setObjectName("StopBtn");
    stopBtn->setCursor(Qt::PointingHandCursor);
    stopBtn->setMinimumHeight(45);
    startBtn->setMinimumWidth(100);
    stopBtn->setEnabled(false);
    connect(stopBtn, &QPushButton::clicked, this, &MainPage::onStopClicked);

    auto *actionLayout = new QHBoxLayout();
    actionLayout->addWidget(progressBar);
    actionLayout->addWidget(statusLabel);
    actionLayout->addSpacing(15);
    actionLayout->addWidget(startBtn);
    actionLayout->addWidget(stopBtn);

    mainLayout->addLayout(actionLayout);

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
    stopBtn->setEnabled(true);
    progressBar->setFormat(" Preparing...");

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

void MainPage::onProgressUpdated(double percent, const QString &eta) {
    progressBar->setValue(static_cast<int>(percent));
    progressBar->setFormat(QString("Progress: %1% | ETA: %2").arg(percent).arg(eta));
}

void MainPage::onDownloadFinished(bool ok, const QString &msg) {
    startBtn->setEnabled(true);
    startBtn->setText("Start");
    stopBtn->setEnabled(false);
    progressBar->setFormat("0%");
    progressBar->setValue(0);

    if (ok) {
        popup->showMessage("Success", msg, Popup::Success, Popup::Temporary);
    } else {
        if (msg.contains("stopped", Qt::CaseInsensitive)) {
            popup->showMessage("Info", "Downloading cancelled by user.", Popup::Info, Popup::Temporary);
        } else {
            popup->showMessage("Error", msg, Popup::Error, Popup::Temporary);
        }
    }
}