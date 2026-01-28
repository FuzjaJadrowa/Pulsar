#ifndef CONSOLE_PAGE_H
#define CONSOLE_PAGE_H

#include <QWidget>
#include <QLabel>
#include <QTextEdit>
#include <QVBoxLayout>

class ConsolePage : public QWidget {
    Q_OBJECT
public:
    explicit ConsolePage(QWidget *parent = nullptr);
    void appendLog(const QString &text);

private:
    QTextEdit *consoleOutput;
};

#endif