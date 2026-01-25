#include "main_page.h"
#include "config_manager.h"
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QStyleFactory>
#include <QRegularExpression>
#include <QRegularExpressionValidator>
#include <QGuiApplication>
#include <QStyleHints>
#include <QStyle>

MainPage::MainPage(QWidget *parent) : QWidget(parent) {
    downloader = new Downloader(this);
    popup = new Popup(this);
    setupUi();
    updateThemeProperty();
    connect(downloader, &Downloader::finished, this, &MainPage::onDownloadFinished);
    connect(downloader, &Downloader::progressUpdated, this, &MainPage::onProgressUpdated);
}

void MainPage::updateThemeProperty() {
    QString theme = ConfigManager::instance().getTheme();
    if (theme == "System") theme = (QGuiApplication::styleHints()->colorScheme() == Qt::ColorScheme::Dark) ? "Dark" : "Light";
    QString themeName = theme.toLower();
    this->setProperty("theme", themeName);
    this->style()->unpolish(this);
    this->style()->polish(this);
    for (auto child : findChildren<QWidget*>()) {
        child->setProperty("theme", themeName);
        child->style()->unpolish(child);
        child->style()->polish(child);
    }
}

void MainPage::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; }");

    auto *scrollContent = new QWidget();
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setContentsMargins(30, 40, 30, 20);
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

    auto *inputLayout = new QHBoxLayout();
    urlInput = new QLineEdit(this);
    urlInput->setPlaceholderText("Paste link here...");
    pathInput = new QLineEdit(this);
    pathInput->setPlaceholderText("Download path...");
    browseBtn = new QPushButton("Browse", this);
    browseBtn->setObjectName("BrowseBtn");
    inputLayout->addWidget(urlInput, 2);
    inputLayout->addWidget(pathInput, 1);
    inputLayout->addWidget(browseBtn, 0);
    mainLayout->addLayout(inputLayout);

    auto *optionsGroup = new QWidget(this);
    auto *gridLayout = new QGridLayout(optionsGroup);
    videoFormatCombo = new QComboBox(this);
    videoFormatCombo->addItems({"Default", "mp4", "mkv", "mov", "avi", "flv", "webm"});
    videoQualityCombo = new QComboBox(this);
    videoQualityCombo->addItems({"Default", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"});
    audioFormatCombo = new QComboBox(this);
    audioFormatCombo->addItems({"Default", "mp3", "m4a", "aac", "opus", "wav", "ogg"});
    audioQualityCombo = new QComboBox(this);
    audioQualityCombo->addItems({"Default", "360kbps", "256kbps", "192kbps", "128kbps"});
    audioOnlyCheck = new QCheckBox("Audio only", this);
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
    downloadSubsCheck = new QCheckBox("Download subtitles", this);
    subsLangInput = new QLineEdit(this);
    subsLangInput->setPlaceholderText("en, pl...");
    subsLangInput->setFixedWidth(60);
    subsLangInput->setEnabled(false);
    downloadChatCheck = new QCheckBox("Download live chat", this);
    auto *subsInputRow = new QHBoxLayout();
    subsInputRow->addWidget(downloadSubsCheck);
    subsInputRow->addWidget(subsLangInput);
    subsInputRow->addStretch();
    subsLayout->addLayout(subsInputRow);
    subsLayout->addWidget(downloadChatCheck);

    auto *fragLayout = new QVBoxLayout();
    fragLayout->addWidget(new QLabel("Download fragments (hh:mm:ss):", this));
    auto *timeRow = new QHBoxLayout();
    timeStartInput = new QLineEdit(this);
    timeEndInput = new QLineEdit(this);
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

    advancedBtn = new QPushButton("Advanced Settings ▼", this);
    advancedBtn->setObjectName("AdvancedToggle");
    advancedBtn->setCheckable(true);
    mainLayout->addWidget(advancedBtn);

    advancedContent = new QWidget(this);
    auto *advLayout = new QVBoxLayout(advancedContent);
    customArgsInput = new QLineEdit(this);
    cmdPreview = new QTextEdit(this);
    cmdPreview->setObjectName("CommandPreview");
    cmdPreview->setReadOnly(true);
    cmdPreview->setMinimumHeight(100);
    advLayout->addWidget(new QLabel("Custom Arguments:"));
    advLayout->addWidget(customArgsInput);
    advLayout->addWidget(new QLabel("Command Preview:"));
    advLayout->addWidget(cmdPreview);
    advancedContent->setVisible(false);
    mainLayout->addWidget(advancedContent);
    mainLayout->addStretch();
    scrollArea->setWidget(scrollContent);
    rootLayout->addWidget(scrollArea);

    auto *bottomContainer = new QWidget(this);
    bottomContainer->setObjectName("BottomActionArea");
    auto *bottomLayout = new QHBoxLayout(bottomContainer);
    bottomLayout->setContentsMargins(30, 10, 30, 30);
    progressBar = new QProgressBar(this);
    progressBar->setStyle(QStyleFactory::create("windowsvista"));
    progressBar->setFixedHeight(30);
    progressBar->setAlignment(Qt::AlignCenter);
    progressBar->setFormat("Progress: 0% | ETA: 0s");
    progressBar->setStyleSheet("QProgressBar { color: black; text-align: center; font-weight: bold; }");
    startBtn = new QPushButton("Start", this);
    startBtn->setObjectName("StartBtn");
    startBtn->setFixedSize(120, 45);
    stopBtn = new QPushButton("Stop", this);
    stopBtn->setObjectName("StopBtn");
    stopBtn->setFixedSize(120, 45);
    stopBtn->setEnabled(false);
    bottomLayout->addWidget(progressBar, 1);
    bottomLayout->addWidget(startBtn);
    bottomLayout->addWidget(stopBtn);
    rootLayout->addWidget(bottomContainer);

    connect(browseBtn, &QPushButton::clicked, this, &MainPage::onBrowseClicked);
    connect(audioOnlyCheck, &QCheckBox::toggled, this, &MainPage::onAudioOnlyToggled);
    connect(downloadSubsCheck, &QCheckBox::toggled, this, &MainPage::onSubsOptionsChanged);
    connect(downloadChatCheck, &QCheckBox::toggled, this, &MainPage::onSubsOptionsChanged);
    connect(advancedBtn, &QPushButton::toggled, this, [this](bool c){
        advancedContent->setVisible(c);
        advancedBtn->setText(c ? "Advanced Settings ▲" : "Advanced Settings ▼");
    });
    connect(startBtn, &QPushButton::clicked, this, &MainPage::onStartClicked);
    connect(stopBtn, &QPushButton::clicked, this, &MainPage::onStopClicked);
    for(auto *e : findChildren<QLineEdit*>()) connect(e, &QLineEdit::textChanged, this, &MainPage::updateCommandPreview);
    for(auto *c : findChildren<QComboBox*>()) connect(c, &QComboBox::currentTextChanged, this, &MainPage::updateCommandPreview);
    for(auto *x : findChildren<QCheckBox*>()) connect(x, &QCheckBox::toggled, this, &MainPage::updateCommandPreview);
    onAudioOnlyToggled(false);
}

void MainPage::updateCommandPreview() {
    cmdPreview->setPlainText(downloader->generateCommand(
        urlInput->text(), pathInput->text(), audioOnlyCheck->isChecked(),
        videoFormatCombo->currentText(), videoQualityCombo->currentText(),
        audioFormatCombo->currentText(), audioQualityCombo->currentText(),
        downloadSubsCheck->isChecked(), subsLangInput->text(), downloadChatCheck->isChecked(),
        timeStartInput->text(), timeEndInput->text(), customArgsInput->text()
    ));
}

void MainPage::onSubsOptionsChanged() {
    subsLangInput->setEnabled(downloadSubsCheck->isChecked());
    if (qobject_cast<QCheckBox*>(sender()) == downloadSubsCheck && downloadSubsCheck->isChecked())
        downloadChatCheck->setChecked(false);
    else if (qobject_cast<QCheckBox*>(sender()) == downloadChatCheck && downloadChatCheck->isChecked())
        downloadSubsCheck->setChecked(false);
}

bool MainPage::isValidTimeFormat(const QString &t) {
    return QRegularExpression("^(\\d{1,2}:)?(\\d{1,2}:)?\\d{1,2}$").match(t).hasMatch();
}

void MainPage::onStartClicked() {
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

void MainPage::onStopClicked() { downloader->stopDownload(); }
void MainPage::onProgressUpdated(double p, const QString &e) {
    progressBar->setValue(static_cast<int>(p));
    progressBar->setFormat(QString("Progress: %1% | ETA: %2").arg(p).arg(e));
}

void MainPage::onDownloadFinished(bool ok, const QString &msg) {
    startBtn->setEnabled(true); stopBtn->setEnabled(false);
    progressBar->setFormat("Progress: 0% | ETA: 0s"); progressBar->setValue(0);
    popup->showMessage(ok ? "Success" : "Error", msg, ok ? Popup::Success : Popup::Error, Popup::Temporary);
}

void MainPage::onBrowseClicked() {
    QString d = QFileDialog::getExistingDirectory(this, "Select Directory", pathInput->text());
    if (!d.isEmpty()) pathInput->setText(d);
}

void MainPage::onAudioOnlyToggled(bool c) {
    videoFormatCombo->setEnabled(!c); videoQualityCombo->setEnabled(!c);
    audioFormatCombo->setEnabled(c); audioQualityCombo->setEnabled(c);
}