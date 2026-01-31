#include "downloader_page.h"
#include "components.h"
#include "../Core/config_manager.h"
#include "../Core/queue_manager.h"
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QRegularExpression>
#include <QRegularExpressionValidator>
#include <QPropertyAnimation>
#include <QAbstractItemView>

DownloaderPage::DownloaderPage(QWidget *parent) : QWidget(parent) {
    downloader = new Downloader(this);
    popup = new Popup(this);
    setupUi();
}

void DownloaderPage::updateThemeProperty() {}

QPoint DownloaderPage::getStartBtnPos() const {
    if (m_lastClickedBtn) {
        return m_lastClickedBtn->mapToGlobal(QPoint(m_lastClickedBtn->width()/2, m_lastClickedBtn->height()/2));
    }
    return startBtn->mapToGlobal(QPoint(startBtn->width()/2, startBtn->height()/2));
}

void DownloaderPage::setupUi() {
    setAttribute(Qt::WA_TranslucentBackground);

    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; border: none; }");
    scrollArea->viewport()->setAutoFillBackground(false);
    auto *scrollContent = new QWidget();
    scrollContent->setAttribute(Qt::WA_TranslucentBackground);
    scrollContent->setStyleSheet("background: transparent;");
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setContentsMargins(30, 40, 30, 20);
    mainLayout->setSpacing(20);

    auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    QPixmap icon(":/Resources/Icons/downloader.png");
    QPainter p(&icon);
    p.setCompositionMode(QPainter::CompositionMode_SourceIn);
    p.fillRect(icon.rect(), Qt::white);
    p.end();
    iconLabel->setPixmap(icon.scaled(40, 40, Qt::KeepAspectRatio, Qt::SmoothTransformation));
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
    optionsGroup->setStyleSheet("border-radius: 10px; padding: 10px;");
    auto *gridLayout = new QGridLayout(optionsGroup);
    videoFormatCombo = new QComboBox(this);
    videoFormatCombo->addItems({"Default", "mp4", "mkv", "mov", "avi", "flv", "webm"});
    videoQualityCombo = new QComboBox(this);
    videoQualityCombo->addItems({"Default", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"});
    audioFormatCombo = new QComboBox(this);
    audioFormatCombo->addItems({"Default", "mp3", "m4a", "aac", "opus", "wav", "ogg"});
    audioQualityCombo = new QComboBox(this);
    audioQualityCombo->addItems({"Default", "320kbps", "256kbps", "192kbps", "128kbps"});
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
    subsLangInput->setPlaceholderText("Code");
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
    fragLayout->addWidget(new QLabel("Download fragments (hh:mm:ss):", this));
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
    advLayout->setContentsMargins(0, 10, 0, 0);
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
    bottomContainer->setStyleSheet(
        "background-color: rgba(20, 20, 30, 180);"
        "border-top: 1px solid rgba(255, 255, 255, 20);"
        "border-bottom-left-radius: 15px;"
        "border-bottom-right-radius: 15px;"
    );
    auto *bottomLayout = new QHBoxLayout(bottomContainer);
    bottomLayout->setContentsMargins(30, 20, 30, 20);
    bottomLayout->setSpacing(15);
    bottomLayout->setAlignment(Qt::AlignCenter);

    startBtn = new AnimatedButton("Download", this, QColor("#00e676"), QColor("#00c853"));
    startBtn->setFixedSize(140, 50);

    addToQueueBtn = new AnimatedButton("Add to queue", this, QColor("#2979ff"), QColor("#2962ff"));
    addToQueueBtn->setFixedSize(140, 50);;

    bottomLayout->addStretch();
    bottomLayout->addWidget(startBtn);
    bottomLayout->addWidget(addToQueueBtn);
    bottomLayout->addStretch();

    rootLayout->addWidget(bottomContainer);

    for (auto *combo : findChildren<QComboBox*>()) {
        if (combo->view()->window()) {
            combo->view()->window()->setAttribute(Qt::WA_TranslucentBackground, false);
        }
        combo->view()->setStyleSheet(
            "QAbstractItemView { "
            "   background-color: #252525; "
            "   color: #e0e0e0; "
            "   border: 1px solid #3d3d3d; "
            "   selection-background-color: #6200ea; "
            "}"
        );

        combo->setAttribute(Qt::WA_TranslucentBackground, false);

        combo->setStyleSheet(
            "QComboBox { "
            "   background-color: #252525; "
            "   border: 1px solid #3d3d3d; "
            "   border-radius: 8px; "
            "   color: white; "
            "}"
            "QComboBox:hover { "
            "   background-color: #2a2a2a; "
            "   border: 1px solid #555; "
            "}"
            "QComboBox::drop-down { border: none; width: 20px; }"
            "QComboBox::down-arrow { image: none; border: none; }"
        );
    }

    connect(advancedBtn, &QPushButton::toggled, this, [this](bool c){
        advancedBtn->setText(c ? "Advanced Settings ▲" : "Advanced Settings ▼");
        auto *anim = new QPropertyAnimation(advancedContent, "maximumHeight");
        anim->setDuration(300);
        anim->setEasingCurve(QEasingCurve::OutCubic);
        if (c) {
            advancedContent->setVisible(true);
            int h = advancedContent->layout()->sizeHint().height();
            anim->setStartValue(0);
            anim->setEndValue(h > 0 ? h : 300);
        } else {
            anim->setStartValue(advancedContent->height());
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

    connect(startBtn, &QPushButton::clicked, this, &DownloaderPage::onStartClicked);
    connect(addToQueueBtn, &QPushButton::clicked, this, &DownloaderPage::onAddToQueueClicked);

    for(auto *e : findChildren<QLineEdit*>()) connect(e, &QLineEdit::textChanged, this, &DownloaderPage::updateCommandPreview);
    for(auto *c : findChildren<QComboBox*>()) connect(c, &QComboBox::currentTextChanged, this, &DownloaderPage::updateCommandPreview);
    for(auto *x : findChildren<QCheckBox*>()) connect(x, &QCheckBox::toggled, this, &DownloaderPage::updateCommandPreview);
    onAudioOnlyToggled(false);
}

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

bool DownloaderPage::validateInputs() {
    if (urlInput->text().trimmed().isEmpty() || pathInput->text().trimmed().isEmpty()) {
        popup->showMessage("Error", "Check URL and Path.", Popup::Error, Popup::Temporary);
        return false;
    }
    return true;
}

void DownloaderPage::onStartClicked() {
    if (!validateInputs()) return;

    m_lastClickedBtn = startBtn;

    emit downloadRequested();

    QueueItem item;
    item.url = urlInput->text();
    item.path = pathInput->text();
    item.audioOnly = audioOnlyCheck->isChecked();
    item.vFormat = videoFormatCombo->currentText();
    item.vQuality = videoQualityCombo->currentText();
    item.aFormat = audioFormatCombo->currentText();
    item.aQuality = audioQualityCombo->currentText();
    item.dlSubs = downloadSubsCheck->isChecked();
    item.subLang = subsLangInput->text();
    item.dlChat = downloadChatCheck->isChecked();
    item.timeStart = timeStartInput->text();
    item.timeEnd = timeEndInput->text();
    item.customArgs = customArgsInput->text();

    if (item.audioOnly) item.formatInfo = QString("Audio: %1 (%2)").arg(item.aFormat, item.aQuality);
    else item.formatInfo = QString("Video: %1 (%2)").arg(item.vFormat, item.vQuality);

    QueueManager::instance().fetchAndAdd(item.url, item, true);
    urlInput->clear();
}

void DownloaderPage::onAddToQueueClicked() {
    if (!validateInputs()) return;

    if (sender() == addToQueueBtn) m_lastClickedBtn = addToQueueBtn;

    QueueItem item;
    item.url = urlInput->text();
    item.path = pathInput->text();
    item.audioOnly = audioOnlyCheck->isChecked();
    item.vFormat = videoFormatCombo->currentText();
    item.vQuality = videoQualityCombo->currentText();
    item.aFormat = audioFormatCombo->currentText();
    item.aQuality = audioQualityCombo->currentText();
    item.dlSubs = downloadSubsCheck->isChecked();
    item.subLang = subsLangInput->text();
    item.dlChat = downloadChatCheck->isChecked();
    item.timeStart = timeStartInput->text();
    item.timeEnd = timeEndInput->text();
    item.customArgs = customArgsInput->text();

    if (item.audioOnly) item.formatInfo = QString("Audio: %1 (%2)").arg(item.aFormat, item.aQuality);
    else item.formatInfo = QString("Video: %1 (%2)").arg(item.vFormat, item.vQuality);

    if (sender() == addToQueueBtn) {
        emit downloadRequested();
    }

    QueueManager::instance().fetchAndAdd(item.url, item, false);
    urlInput->clear();
}

void DownloaderPage::onBrowseClicked() {
    QString d = QFileDialog::getExistingDirectory(this, "Select Directory", pathInput->text());
    if (!d.isEmpty()) pathInput->setText(d);
}
void DownloaderPage::onAudioOnlyToggled(bool c) {
    videoFormatCombo->setEnabled(!c); videoQualityCombo->setEnabled(!c);
    audioFormatCombo->setEnabled(c); audioQualityCombo->setEnabled(c);
}