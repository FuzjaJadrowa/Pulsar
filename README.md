# Pulsar
High-performance, cross-platform utility designed to redefine how you acquire and manage digital media.
## Key Features
* **Modern & Fast**: Written in C++ with Qt6 for native performance and a responsive user interface.
* **Smart Queue System**: Add multiple media to a queue, manage priorities, and download them efficiently in the background.
* **Auto-Dependency Management**: Automatically downloads and configures the latest versions of **yt-dlp** and **ffmpeg** upon first launch. No manual setup required.
* **Cross-Platform**: Runs natively on **Windows**, **macOS**, and **Linux**.
* **Auto-Updates**: The application keeps itself and its internal tools up-to-date automatically.
* **Flexible Format Control**: Seamlessly choose between video containers and resolutions, or extract high-quality audio.
* **Console & Logs**: detailed real-time output for power users who want full visibility into the process.
* **Theming**: Dark and Light modes that can sync with your system preferences.
## How to Install
1.  Go to the **Releases** tab and download the latest version for your operating system.
### For Windows
* **Installer (.exe)**: Download the installer, run it, and follow the on-screen instructions. Pulsar will be available in your Start Menu.
* **Portable (.zip)**: Extract the archive to any folder and run `Pulsar.exe`.
### For macOS
* **Installer (.dmg)**: Open the `.dmg` file and drag the Pulsar icon into your **Applications** folder.
* **Portable (.zip)**: Unzip the file and run the application bundle.
    * *Note:* If you encounter a security warning, Right-Click the app and select **Open** to authorize the first launch.
### For Linux
* **Debian/Ubuntu (.deb)**: Install via package manager:
    ```bash
    sudo apt install ./Pulsar-X.X.X-Linux.deb
    ```
  This automatically handles dependencies like Qt6.
* **Portable (.tar.gz)**: Extract the archive. Ensure Qt6 libraries are installed on your system, then execute the binary:
    ```bash
    ./Pulsar
    ```
## Building from Source
To build Pulsar yourself, ensure you have **Qt 6.6+**, **CMake**, and a C++20 compatible compiler installed.
1.  Clone the repository:
    ```bash
    git clone https://github.com/fuzjajadrowa/Pulsar.git
    cd Pulsar
    ```
2.  Configure and Build:
    ```bash
    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release
    ```
3.  Run the application from the `build` directory.
## License
Distributed under the terms specified in the LICENSE file.
Powered by [Qt6](https://www.qt.io/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), and [ffmpeg](https://github.com/BtbN/FFmpeg-Builds).