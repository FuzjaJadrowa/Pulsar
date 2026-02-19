# <p align="center">2.1.1</p>

---
## Added
* GUI text is now dynamically loaded from JSON files, paving the way for seamless multi-language support.
* Added the ability to change the frequency (cooldown interval) for checking requirement updates (Bridge, FFmpeg) in the settings.

## Changed
* Pulsar has been completely rebuilt from the ground up! We transitioned from Qt C++ to **Tauri v2** (Rust + web technologies), resulting in a much lighter, faster, and more modern application.
* Transitioned from executing standard `yt-dlp` commands to a dedicated, highly stable `pulsar-bridge` process, ensuring reliable downloads and better background communication.
* The downloader interface has been completely overhauled with a brand-new, intuitive, and modern style.
* The settings tab has received a fresh new look and improved layout for easier navigation.
* The dedicated console tab has been removed to maintain a cleaner, more streamlined user interface.
* he option to pass custom CLI arguments has been removed to simplify the user experience and ensure download stability.

## Fixed
* Thanks to the new Rust-based backend, a huge number of legacy bugs, crashes, and unexpected behaviors from the previous C++ version have been resolved.