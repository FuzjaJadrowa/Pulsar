# <p align="center">3.0.0</p>
## Added
- Full GUI and backend for the Converter module.
  - Wide range of formats across various categories.
  - Options for codec change, quality settings, and bitrate adjustment.
  - Estimated output file size display.
- Full GUI and backend for the Compressor module.
  - Support for video, audio, and image compression.
  - Compression options via percentage, quality, and target weight.
- Home page and clickable logo functionality for navigation.
- Hardware acceleration options for FFmpeg.
- Command display in the console output.
- Content Security Policy (CSP) protection.
- Manrope as the new primary font for the application.
## Changed
- Application ID from `com.fuzjajadrowa.pulsar` to `pl.fuzjajadrowa.pulsar`.
- License to GPL v3.
- Improved idle wave transition animation.
- Optimized several SVG icons.
- Replaced PNG logo in the navbar with an SVG version.
- Improved colors for certain elements in light mode.
- Unified and improved several CSS animations.
- Default font for all elements changed to Manrope.
- Removed support for AppImage and tar.gz on Linux.
- Removed support for internal app updates in the `.deb` package.
- Removed unnecessary NSIS installer hooks.
## Fixed
- Bug where the "Current version" text in settings did not change language.
- Reinstallation of requirements after updating Pulsar.
- Issues with on-demand updates for Pulsar Bridge.
- Frontend file paths for JS and CSS to prevent errors.
- Many other minor bugs and stability issues.