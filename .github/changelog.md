# <p align="center">2.3.1</p>
## Added
* Icons of platforms from which media are downloaded have been added to the queue panel.
* Added killing of ffmpeg process on application exit.
* Added support for FFmpeg on macOS.
* Added the ability to manually check the requirements and show its version in the settings.
## Changed
* Changed placeholder in bitrate field in preset creator to `Auto`.
* Separated the queue code from the console output code.
* TS and WMA format is no longer supported.
* Changed FFmpeg build repository from BtbN to my build repository.
* Simplified svg for tag in settings.
## Fixed
* Fixed an issue with the expanded part of the dropdown menu not being attached in the preset creator.
* Fixed section change not jumping smoothly when deleting presets.
* Fixed a memory leak related to idle wave animations where invisible objects were added.
* Improved idle wave fade animations.