# GUI Video Downloader
Introducing a big overhaul for my application that adds the ability to download videos and audio from various sites using yt-dlp. We rewrote Python to C++ completely and fixed many bugs and limits. Unlike other similar applications we don't require you to download **yt-dlp** and **ffmpeg** separately, because we do it automatically with your first opening.
## How to install?
1. Go to the **Releases** tab and download the latest version of the installer or portable archive.
2. **For Windows**:
    - **Installer (.exe)**: Download the `.exe` installer, open it and follow its instructions. Once it finishes, the application is installed, and you can run it from your Start Menu or Desktop shortcut.
    - **Portable (.zip)**: Extract the `.zip` file to any location on your computer. To run the application, execute the `App.exe` file.
3. **For macOS**:
    - **Installer (.dmg)**: Download the `.dmg` file, open it, and drag the application icon into the **Applications** folder.
    - **Portable (.zip)**: Extract the zip file and run the application bundle.
    - *Note:* Since the app is not signed, you might need to Right-Click the app and select **Open** to bypass the security warning on the first launch.
4. **For Linux**:
    - **Debian/Ubuntu (.deb)**: Download the `.deb` file and install it using your package manager:
      ```bash
      sudo apt install ./GUI-Video-Downloader-2.0.0-Linux.deb
      ```
      This will automatically install required dependencies like Qt6.
    - **Portable (.tar.gz)**: Extract the archive. Ensure you have Qt6 libraries installed on your system, then run the binary:
      ```bash
      ./App
      ```
## Key Features
* **Cross-Platform**: Runs natively on Windows, macOS, and Linux.
* **Auto-Dependency Management**: Automatically downloads and configures the latest versions of **yt-dlp** and **ffmpeg** upon first launch.
* **Auto-Updates**: The application keeps itself up-to-date automatically using the built-in updater.
* **Format Selection**: Easily choose between video formats (for e.g. mp4, mkv, webm) and quality (up to 4K), or convert directly to audio (mp3, m4a, wav).
* **Advanced Options**:
    * Download subtitles and live chat.
    * Trim videos by time fragments or chapters.
    * Bypass geo-restrictions using built-in options.
* **Console View**: Monitor the real-time output of the download process for debugging.
* **Dark/Light Mode**: Choose your preferred theme or sync it with your system settings.
## Building from Source
If you want to build the application yourself, ensure you have **Qt 6.6+**, **CMake**, and a C++20 compatible compiler installed.
1. Clone the repository:
   ```bash
   git clone https://github.com/fuzjajadrowa/GUI-Video-Downloader.git
   cd GUI-Video-Downloader
   ```
2. Configure and Build:
   ```bash
   cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
   cmake --build build --config Release
   ```
3. Run the application from the build directory.
## Images
![Main page](https://i.ibb.co/7tpCThvy/Zrzut-ekranu-2026-01-26-155842.png)
![Console page](https://i.ibb.co/LdkmwGhr/Zrzut-ekranu-2026-01-26-155847.png)
![Settings page](https://i.ibb.co/ynCqBqcS/Zrzut-ekranu-2026-01-26-155858.png)
## License
Distributed under the terms specified in the LICENSE file. Powered by [Qt6](https://www.qt.io/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), and [ffmpeg](https://github.com/BtbN/FFmpeg-Builds).