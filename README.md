<p align="center">
  <img src=".github/assets/logo.svg" alt="Pulsar Logo" width="300"/>
</p>

<p align="center">
  <img src="https://github.com/fuzjajadrowa/Pulsar/actions/workflows/build-windows.yml/badge.svg" alt="Build Windows">
  <img src="https://github.com/fuzjajadrowa/Pulsar/actions/workflows/build-macos.yml/badge.svg" alt="Build macOS">
  <img src="https://github.com/fuzjajadrowa/Pulsar/actions/workflows/build-linux.yml/badge.svg" alt="Build Linux">
</p>

---
<p align="center">A fast, modern media manager built with Tauri and Rust.</p>

---
## Features
* Fast and efficient GUI built using web tech with **Tauri** and **Rust**.
* Offers smart queue system. You can add multiple files to a queue, manage priorities, track progress and process them efficiently in the background.
* Automatically downloads and configures the latest versions of **Pulsar Bridge** (custom JSON yt-dlp wrapper) and **ffmpeg**.
* Runs natively on **Windows**, **macOS**, and **Linux**.
* Features choose between video/audio containers, qualities and bitrate, embeding metadata/thumbnails and many more advanced options.
* Can display dark, light, and system theme, along with multi-language UI support.
## How it works
Pulsar is a graphical interface for **yt-dlp** and **ffmpeg**, one of the most powerful media download tools available.
When you paste a URL, Pulsar translates your selected options into the appropriate yt-dlp commands and runs them in the background while showing live progress, download speed, ETA, and any errors.
For media conversion and compression, Pulsar also uses **ffmpeg**, allowing you to change formats, compress files, extract audio, embed metadata without opening terminal.

## Installation
Download the latest release from the **[Releases](https://github.com/fuzjajadrowa/Pulsar/releases)** page.
### For Windows (x86_64)
* **Installer (.exe)**: Download the NSIS installer, run it, and follow the on-screen instructions. Pulsar will be available in your Start Menu.
* **Portable (.zip)**: Extract the archive to any folder and run `Pulsar.exe`.

### For macOS (Apple Silicon / aarch64)
* **Installer (.pkg)**: Open the `.pkg` file and follow the on-screen instructions to install Pulsar.
* **Portable (.app.tar.gz)**: Unzip the file and run the `Pulsar.app` bundle.
    * *Note:* If you encounter a damage warning, type in command prompt: ```sudo xattr -cr [Path to Pulsar.app]``` and select **Open** to authorize the first launch.
### For Linux (x86_64)
* **Debian/Ubuntu (.deb)**: Install via your package manager:
  ```bash
  sudo apt install ./Pulsar-X.X.X-Linux.deb
  ```
* **Flatpak (Flathub) - aarch64 is possible here too!**:
  ```bash
  flatpak install flathub pl.fuzjajadrowa.pulsar
  ```
  If Flathub is not configured yet:
  ```bash
  flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
  ```
## Building from Source
To build Pulsar yourself, ensure you have **Node.js (v20+)** and the **Rust stable** toolchain installed.
1. Install OS Dependencies
   * Windows / macOS: Usually no extra system packages are required beyond build tools (C++ build tools / Xcode Command Line Tools).
   * Linux (Ubuntu/Debian):
   ```bash
   sudo apt-get update
   sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
   ```
2. Clone the repository
```bash
git clone https://github.com/fuzjajadrowa/Pulsar.git

cd Pulsar
```
3. Install deps
```bash
  npm install
```
4. Build the application
To compile a release build of the application:
  ```bash
    npx tauri build
  ```
The compiled binaries will be located in `src-tauri/target/release/bundle/`.
If you just want to run the app in development mode, use:
  ```bash
    npx tauri dev
  ```
## Screenshots
<table align="center">
  <tr>
    <td align="center"><img src=".github/assets/01-home.png" alt="Home" width="100%" /></td>
    <td align="center"><img src=".github/assets/02-downloader.png" alt="Downloader" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Home</sub></td>
    <td align="center"><sub>Downloader</sub></td>
  </tr>
  <tr>
    <td align="center"><img src=".github/assets/03-converter.png" alt="Converter" width="100%" /></td>
    <td align="center"><img src=".github/assets/04-compressor.png" alt="Compressor" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Converter</sub></td>
    <td align="center"><sub>Compressor</sub></td>
  </tr>
</table>

# License
This project is licensed under the terms described in the **LICENSE** file.
Powered by [Tauri](https://v2.tauri.app/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), and [ffmpeg](https://ffmpeg.org/).