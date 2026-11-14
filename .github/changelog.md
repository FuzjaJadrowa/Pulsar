# <p align="center">3.2.0</p>
<p align="center"><small>Yeah, so this was supposed to be a "small, fixing update"...</small></p>

<p align="center"><b>To ensure proper operation, I recommend to install the latest version of Pulsar-Bridge (b32+).</b></p>

## Added
- Added `deno` to the FFbuilder package and added backend support for it. Deno helps with resolving some formats via yt-dlp and generally increases stability of downloading.
- Added custom title setting to downloader.
- Added "Use last path" button in path selector.
- Added default save path to the settings (resolves [#6](https://github.com/FuzjaJadrowa/Pulsar/issues/6) issue).
- Added skip sponsors option to the downloader.
- Added bridge protocol version reading and popups related to it (recommendations to update Bridge).
- Added some file thumbnail support in the queue. For images, the thumbnail is generated from the file itself. For audio files, the thumbnail is generated from the thumbnail (if available). For video files, the thumbnail is generated from the thumbnail (if available) or from the random frame of the video.
- Added runtime logs options. Enabling it will print out logs from the backend to the console. This is useful for debugging and reporting issues.
## Changed
- Updated icon file a little bit.
- Refactored the Rust backend. There were many massive lines of code, so to improve the quality of development, I decided to switch to a feature-only structure.
- Refactored the frontend. Here, too, there was a lot of "spaghetti code" and CSS that was difficult to maintain, so I decided to refactor it.
- Removed geo bypass option in downloader (it's quite useless).
- Changed queue save system from JSON to SQLite. Older queue system isn't supported anymore (it will cause deleting your queue history after updating).
- The svg is moved from code to a separate files in assets.
- Translations are migrated from JSON to TOML. This is a more convenient format for translators, and it also allows for better organization of translations.
- Font now loads from the assets instead of being imported in the code.
## Fixed
- Fixed a bug with "Output name" setting when name field in converter and compressor was empty.
- Fixed opening fallback "Documents" folder using queue open path button.
- Fixed opening author channel when clicking on the author name in downloader.
- Improved startup process.
- Fixed many issues related to downloading and codecs due to a refactored Pulsar-Bridge (resolves [#5](https://github.com/FuzjaJadrowa/Pulsar/issues/5) and [#8](https://github.com/FuzjaJadrowa/Pulsar/issues/8) issues).
- Fixed some other miscellaneous bugs.