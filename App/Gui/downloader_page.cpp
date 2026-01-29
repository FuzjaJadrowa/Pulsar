#include "downloader_page.h"
#include "components.h"
#include "../Core/config_manager.h"
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QRegularExpression>
#include <QRegularExpressionValidator>
#include <QPropertyAnimation>

DownloaderPage::DownloaderPage(QWidget *parent) : QWidget(parent) {
    downloader = new Downloader(this);
    popup = new Popup(this);

    setStyleSheet(StyleHelper::getGlobalStyle());
    setupUi();

    connect(downloader, &Downloader::finished, this, &DownloaderPage::onDownloadFinished);
    connect(downloader, &Downloader::progressUpdated, this, &DownloaderPage::onProgressUpdated);
}

void DownloaderPage::updateThemeProperty() {}

void DownloaderPage::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);

    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; border: none; }");

    auto *scrollContent = new QWidget();
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setContentsMargins(30, 40, 30, 20);
    mainLayout->setSpacing(20);

auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/downloader.png").scaled(40, 40, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    auto *header = new QLabel("Downloader", this);
    header->setObjectName("PageTitle");
    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(header);
    headerLayout->addStretch();
    mainLayout->addLayout(headerLayout);

    auto *inputLayout = new QHBoxLayout();
    urlInput = new QLineEdit(this);
    urlInput->setPlaceholderText("Paste YouTube link here...");
    pathInput = new QLineEdit(this);
    pathInput->setPlaceholderText("Download path...");
    browseBtn = new AnimatedButton("Browse", this, QColor("#333"), QColor("#444"));
    browseBtn->setFixedWidth(100);
    inputLayout->addWidget(urlInput, 2);
    inputLayout->addWidget(pathInput, 1);
    inputLayout->addWidget(browseBtn, 0);
    mainLayout->addLayout(inputLayout);

     auto *optionsGroup = new QWidget(this);
    optionsGroup->setStyleSheet("background-color: #1e1e1e; border-radius: 10px; padding: 10px;");
    auto *gridLayout = new QGridLayout(optionsGroup);
    videoFormatCombo = new QComboBox(this);
    videoFormatCombo->addItems({"Default", "mp4", "mkv", "webm"});
    videoQualityCombo = new QComboBox(this);
    videoQualityCombo->addItems({"Default", "2160p", "1080p", "720p"});
    audioFormatCombo = new QComboBox(this);
    audioFormatCombo->addItems({"Default", "mp3", "m4a"});
    audioQualityCombo = new QComboBox(this);
    audioQualityCombo->addItems({"Default", "320kbps", "128kbps"});
    audioOnlyCheck = new AnimatedCheckBox("Audio only mode", this);

    gridLayout->addWidget(new QLabel("Video Format:", this), 0, 0);
    gridLayout->addWidget(videoFormatCombo, 1, 0);
    gridLayout->addWidget(new QLabel("Video Quality:", this), 0, 1);
    gridLayout->addWidget(videoQualityCombo, 1, 1);
    gridLayout->addWidget(new QLabel("Audio Format:", this), 2, 0);
    gridLayout->addWidget(audioFormatCombo, 3, 0);
    gridLayout->addWidget(new QLabel("Audio Quality:", this), 2, 1);
    gridLayout->addWidget(audioQualityCombo, 3, 1);
    gridLayout->addWidget(audioOnlyCheck, 1, 2, 3, 1, Qt::AlignTop);
    mainLayout->addWidget(optionsGroup);

    auto *advancedRow = new QHBoxLayout();
    auto *subsLayout = new QVBoxLayout();
    downloadSubsCheck = new AnimatedCheckBox("Download subtitles", this);
    subsLangInput = new QLineEdit(this);
    subsLangInput->setPlaceholderText("en, pl");
    subsLangInput->setFixedWidth(80);
    subsLangInput->setEnabled(false);
    downloadChatCheck = new AnimatedCheckBox("Download live chat", this);

    auto *subsInputRow = new QHBoxLayout();
    subsInputRow->addWidget(downloadSubsCheck);
    subsInputRow->addWidget(subsLangInput);
    subsInputRow->addStretch();
    subsLayout->addLayout(subsInputRow);
    subsLayout->addWidget(downloadChatCheck);

    auto *fragLayout = new QVBoxLayout();
    fragLayout->addWidget(new QLabel("Download fragments:", this));
    auto *timeRow = new QHBoxLayout();
    timeStartInput = new QLineEdit(this);
    timeEndInput = new QLineEdit(this);
    timeStartInput->setFixedWidth(80);
    timeEndInput->setFixedWidth(80);
    QRegularExpression flexTime("^(\\d{1,2}:)?(\\d{1,2}:)?\\d{1,2}$");
    timeStartInput->setValidator(new QRegularExpressionValidator(flexTime, this));
    timeEndInput->setValidator(new QRegularExpressionValidator(flexTime, this));
    timeRow->addWidget(timeStartInput);
    timeRow->addWidget(new QLabel("-"));
    timeRow->addWidget(timeEndInput);
    timeRow->addStretch();
    fragLayout->addLayout(timeRow);

    advancedRow->addLayout(subsLayout, 1);
    advancedRow->addLayout(fragLayout, 1);
    mainLayout->addLayout(advancedRow);

    advancedBtn = new AnimatedButton("Advanced Settings ▼", this, Qt::transparent, QColor("#333"));
    advancedBtn->setStyleSheet("text-align: left; border: none; color: #aaa;");
    advancedBtn->setCheckable(true);
    mainLayout->addWidget(advancedBtn);

    advancedContent = new QWidget(this);
    auto *advLayout = new QVBoxLayout(advancedContent);
    customArgsInput = new QLineEdit(this);
    cmdPreview = new QTextEdit(this);
    cmdPreview->setReadOnly(true);
    cmdPreview->setMinimumHeight(80);
    cmdPreview->setStyleSheet("background-color: #111; border: 1px solid #333; border-radius: 5px; color: #00ff00; font-family: Consolas;");
    advLayout->addWidget(new QLabel("Custom Arguments:"));
    advLayout->addWidget(customArgsInput);
    advLayout->addWidget(new QLabel("Command Preview:"));
    advLayout->addWidget(cmdPreview);

    advancedContent->setVisible(false);
    advancedContent->setMaximumHeight(0);
    mainLayout->addWidget(advancedContent);

    mainLayout->addStretch();
    scrollArea->setWidget(scrollContent);
    rootLayout->addWidget(scrollArea);

    auto *bottomContainer = new QWidget(this);
    bottomContainer->setStyleSheet("background-color: #181818;");
    auto *bottomLayout = new QHBoxLayout(bottomContainer);
    bottomLayout->setContentsMargins(30, 15, 30, 15);

    progressBar = new QProgressBar(this);
    progressBar->setFixedHeight(15);
    progressBar->setTextVisible(false);
    progressBar->setStyleSheet("QProgressBar { background: #333; border-radius: 5px; border: none; } QProgressBar::chunk { background-color: #6200ea; border-radius: 5px; }");

    startBtn = new AnimatedButton("Start", this, QColor("#6200ea"), QColor("#7c4dff"));
    startBtn->setFixedSize(140, 45);
    stopBtn = new AnimatedButton("Stop", this, QColor("#d32f2f"), QColor("#e57373"));
    stopBtn->setFixedSize(100, 45);
    stopBtn->setEnabled(false);

    auto *progLayout = new QVBoxLayout();
    auto *progLabel = new QLabel("Progress: 0% | ETA: 0:00", this);
    connect(downloader, &Downloader::progressUpdated, this, [=](double p, QString e){
        progLabel->setText(QString("Progress: %1% | ETA: %2").arg(p, 0, 'f', 1).arg(e));
    });
    progLayout->addWidget(progLabel);
    progLayout->addWidget(progressBar);

    bottomLayout->addLayout(progLayout, 1);
    bottomLayout->addWidget(startBtn);
    bottomLayout->addWidget(stopBtn);
    rootLayout->addWidget(bottomContainer);

    connect(advancedBtn, &QPushButton::toggled, this, [this](bool c){
        advancedBtn->setText(c ? "Advanced Settings ▲" : "Advanced Settings ▼");

        auto *anim = new QPropertyAnimation(advancedContent, "maximumHeight");
        anim->setDuration(300);
        anim->setEasingCurve(QEasingCurve::OutCubic);

        if (c) {
            advancedContent->setVisible(true);
            anim->setStartValue(0);
            anim->setEndValue(300);
        } else {
            anim->setStartValue(300);
            anim->setEndValue(0);
            connect(anim, &QPropertyAnimation::finished, [this](){
                if(!advancedBtn->isChecked()) advancedContent->setVisible(false);
            });
        }
        anim->start(QAbstractAnimation::DeleteWhenStopped);
    });

    connect(browseBtn, &QPushButton::clicked, this, &DownloaderPage::onBrowseClicked);
    connect(audioOnlyCheck, &QCheckBox::toggled, this, &DownloaderPage::onAudioOnlyToggled);
    connect(downloadSubsCheck, &QCheckBox::toggled, this, &DownloaderPage::onSubsOptionsChanged);
    connect(downloadChatCheck, &QCheckBox::toggled, this, &DownloaderPage::onSubsOptionsChanged);
    connect(advancedBtn, &QPushButton::toggled, this, [this](bool c){
        advancedContent->setVisible(c);
        advancedBtn->setText(c ? "Advanced Settings ▲" : "Advanced Settings ▼");
    });
    connect(startBtn, &QPushButton::clicked, this, &DownloaderPage::onStartClicked);
    connect(stopBtn, &QPushButton::clicked, this, &DownloaderPage::onStopClicked);

    for(auto *e : findChildren<QLineEdit*>()) connect(e, &QLineEdit::textChanged, this, &DownloaderPage::updateCommandPreview);
    for(auto *c : findChildren<QComboBox*>()) connect(c, &QComboBox::currentTextChanged, this, &DownloaderPage::updateCommandPreview);
    for(auto *x : findChildren<QCheckBox*>()) connect(x, &QCheckBox::toggled, this, &DownloaderPage::updateCommandPreview);
    onAudioOnlyToggled(false);
}
// troche sie zrobił z tego spagetti code ale dziala XD
void DownloaderPage::updateCommandPreview() {
    cmdPreview->setPlainText(downloader->generateCommand(
        urlInput->text(), pathInput->text(), audioOnlyCheck->isChecked(),
        videoFormatCombo->currentText(), videoQualityCombo->currentText(),
        audioFormatCombo->currentText(), audioQualityCombo->currentText(),
        downloadSubsCheck->isChecked(), subsLangInput->text(), downloadChatCheck->isChecked(),
        timeStartInput->text(), timeEndInput->text(), customArgsInput->text()
    ));
}

void DownloaderPage::onSubsOptionsChanged() {
    subsLangInput->setEnabled(downloadSubsCheck->isChecked());
    if (qobject_cast<QCheckBox*>(sender()) == downloadSubsCheck && downloadSubsCheck->isChecked())
        downloadChatCheck->setChecked(false);
    else if (qobject_cast<QCheckBox*>(sender()) == downloadChatCheck && downloadChatCheck->isChecked())
        downloadSubsCheck->setChecked(false);
}

bool DownloaderPage::isValidTimeFormat(const QString &t) {
    return QRegularExpression("^(\\d{1,2}:)?(\\d{1,2}:)?\\d{1,2}$").match(t).hasMatch();
}

void DownloaderPage::onStartClicked() {
    if (urlInput->text().trimmed().isEmpty()) return;
    if (pathInput->text().trimmed().isEmpty()) {
        popup->showMessage("Error", "Please select a download path.", Popup::Error, Popup::Temporary);
        return;
    }
    QString ts = timeStartInput->text().trimmed(), te = timeEndInput->text().trimmed();
    if ((!ts.isEmpty() && !isValidTimeFormat(ts)) || (!te.isEmpty() && !isValidTimeFormat(te))) {
        popup->showMessage("Error", "Invalid time format.", Popup::Error, Popup::Temporary);
        return;
    }
    startBtn->setEnabled(false); stopBtn->setEnabled(true);
    progressBar->setFormat(" Preparing...");
    downloader->startDownload(urlInput->text(), pathInput->text(), audioOnlyCheck->isChecked(),
        videoFormatCombo->currentText(), videoQualityCombo->currentText(),
        audioFormatCombo->currentText(), audioQualityCombo->currentText(),
        downloadSubsCheck->isChecked(), subsLangInput->text(), downloadChatCheck->isChecked(),
        ts, te, customArgsInput->text());
}

void DownloaderPage::onStopClicked() { downloader->stopDownload(); }
void DownloaderPage::onProgressUpdated(double p, const QString &e) {
    progressBar->setValue(static_cast<int>(p));
    progressBar->setFormat(QString("Progress: %1% | ETA: %2").arg(p).arg(e));
}

void DownloaderPage::onDownloadFinished(bool ok, const QString &msg) {
    startBtn->setEnabled(true); stopBtn->setEnabled(false);
    progressBar->setFormat("Progress: 0% | ETA: 0s"); progressBar->setValue(0);
    popup->showMessage(ok ? "Success" : "Error", msg, ok ? Popup::Success : Popup::Error, Popup::Temporary);
}

void DownloaderPage::onBrowseClicked() {
    QString d = QFileDialog::getExistingDirectory(this, "Select Directory", pathInput->text());
    if (!d.isEmpty()) pathInput->setText(d);
}

void DownloaderPage::onAudioOnlyToggled(bool c) {
    videoFormatCombo->setEnabled(!c); videoQualityCombo->setEnabled(!c);
    audioFormatCombo->setEnabled(c); audioQualityCombo->setEnabled(c);
}