# <p align="center">3.1.0</p>
## Added
- Complete migration of frontend architecture to React and Vite.
- Added French 🇫🇷 translation support by Zetsukae.
- Added Rust and frontend tests.
- Added copy button for notifications.
- Added bulk converting and compressing.
- Added codec selection for downloader.
- Added codecs section in settings with default codec selection for downloader, converter and compressor.
- Added test scripts for building and contributors.
- And many other small features and improvements.
## Changed
- Optimized FFmpeg and Pulsar-Bridge process spawning and communication.
- Deduplicated and refactored stylesheets, many unnecessary animations are changed or removed.
- Redesigned style of the titlebar icons.
- Converter and compressor now use intelligent codec coping management.
- Now elements from the queue are sorted by the lastest added element.
- Removed pages from the queue panel, now using simple scrollable list.
- Changed background color of queue element to gray.
## Fixed
- Fixed some misc bugs and memory leaks.
- Fixed scaling of queue panel.
- Fixed no display of thumbnails.
- Fixed some preset creator bugs.
- Fixed some flatpak issues.