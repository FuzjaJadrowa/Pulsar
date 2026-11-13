import iconAddToQueueUrl from "../../assets/icons/add-to-queue.svg?url&no-inline";
import iconArchiveUrl from "../../assets/icons/archive.svg?url&no-inline";
import iconAudioUrl from "../../assets/icons/audio.svg?url&no-inline";
import iconCheckUrl from "../../assets/icons/check.svg?url&no-inline";
import iconChevronRightUrl from "../../assets/icons/chevron-right.svg?url&no-inline";
import iconClearSelectionUrl from "../../assets/icons/clear-selection.svg?url&no-inline";
import iconGearUrl from "../../assets/icons/gear.svg?url&no-inline";
import iconCompressUrl from "../../assets/icons/compress.svg?url&no-inline";
import iconCompressionPercentUrl from "../../assets/icons/compression-percent.svg?url&no-inline";
import iconCompressionQualityUrl from "../../assets/icons/compression-quality.svg?url&no-inline";
import iconCompressionSizeUrl from "../../assets/icons/compression-size.svg?url&no-inline";
import iconConvertUrl from "../../assets/icons/convert.svg?url&no-inline";
import iconCopyUrl from "../../assets/icons/copy.svg?url&no-inline";
import iconDefaultPresetUrl from "../../assets/icons/default-preset.svg?url&no-inline";
import iconDownloadArrowUrl from "../../assets/icons/download-arrow.svg?url&no-inline";
import iconDownloadCircleUrl from "../../assets/icons/download-circle.svg?url&no-inline";
import iconDownloadProgressUrl from "../../assets/icons/download-progress.svg?url&no-inline";
import iconEditUrl from "../../assets/icons/edit.svg?url&no-inline";
import iconFolderBrowseUrl from "../../assets/icons/folder-browse.svg?url&no-inline";
import iconFolderOpenUrl from "../../assets/icons/folder-open.svg?url&no-inline";
import iconFontUrl from "../../assets/icons/font.svg?url&no-inline";
import iconImageUrl from "../../assets/icons/image.svg?url&no-inline";
import iconLoadingSpinnerUrl from "../../assets/icons/loading-spinner.svg?url&no-inline";
import iconPlayUrl from "../../assets/icons/play.svg?url&no-inline";
import iconQueueNavigationUrl from "../../assets/icons/queue-navigation.svg?url&no-inline";
import iconRemoveFileUrl from "../../assets/icons/remove-file.svg?url&no-inline";
import iconRetryUrl from "../../assets/icons/retry.svg?url&no-inline";
import iconSearchUrl from "../../assets/icons/search.svg?url&no-inline";
import iconStopUrl from "../../assets/icons/stop.svg?url&no-inline";
import iconThumbnailNoneUrl from "../../assets/icons/thumbnail-none.svg?url&no-inline";
import iconTitleTagUrl from "../../assets/icons/title-tag.svg?url&no-inline";
import iconTrashUrl from "../../assets/icons/trash.svg?url&no-inline";
import iconVideoUrl from "../../assets/icons/video.svg?url&no-inline";
import iconWindowCloseUrl from "../../assets/icons/window-close.svg?url&no-inline";
import iconWindowMaximizeUrl from "../../assets/icons/window-maximize.svg?url&no-inline";
import iconWindowMinimizeUrl from "../../assets/icons/window-minimize.svg?url&no-inline";
import iconPulsarLogoUrl from "../../assets/icons/pulsar/logo.svg?url&no-inline";
import iconPlatformApplemusicUrl from "../../assets/icons/platform/applemusic.svg?url&no-inline";
import iconPlatformDeezerUrl from "../../assets/icons/platform/deezer.svg?url&no-inline";
import iconPlatformSoundcloudUrl from "../../assets/icons/platform/soundcloud.svg?url&no-inline";
import iconPlatformSpotifyUrl from "../../assets/icons/platform/spotify.svg?url&no-inline";
import iconPlatformYoutubeUrl from "../../assets/icons/platform/youtube.svg?url&no-inline";
import iconPlatformYtmusicUrl from "../../assets/icons/platform/ytmusic.svg?url&no-inline";

export const ICON_ASSETS = {
  "add-to-queue": `${iconAddToQueueUrl}#add-to-queue`,
  "archive": `${iconArchiveUrl}#archive`,
  "audio": `${iconAudioUrl}#audio`,
  "check": `${iconCheckUrl}#check`,
  "chevron-right": `${iconChevronRightUrl}#chevron-right`,
  "clear-selection": `${iconClearSelectionUrl}#clear-selection`,
  "gear": `${iconGearUrl}#gear`,
  "compress": `${iconCompressUrl}#compress`,
  "compression-percent": `${iconCompressionPercentUrl}#compression-percent`,
  "compression-quality": `${iconCompressionQualityUrl}#compression-quality`,
  "compression-size": `${iconCompressionSizeUrl}#compression-size`,
  "convert": `${iconConvertUrl}#convert`,
  "copy": `${iconCopyUrl}#copy`,
  "default-preset": `${iconDefaultPresetUrl}#default-preset`,
  "download-arrow": `${iconDownloadArrowUrl}#download-arrow`,
  "download-circle": `${iconDownloadCircleUrl}#download-circle`,
  "download-progress": `${iconDownloadProgressUrl}#download-progress`,
  "edit": `${iconEditUrl}#edit`,
  "folder-browse": `${iconFolderBrowseUrl}#folder-browse`,
  "folder-open": `${iconFolderOpenUrl}#folder-open`,
  "font": `${iconFontUrl}#font`,
  "image": `${iconImageUrl}#image`,
  "loading-spinner": `${iconLoadingSpinnerUrl}#loading-spinner`,
  "play": `${iconPlayUrl}#play`,
  "queue-navigation": `${iconQueueNavigationUrl}#queue-navigation`,
  "remove-file": `${iconRemoveFileUrl}#remove-file`,
  "retry": `${iconRetryUrl}#retry`,
  "search": `${iconSearchUrl}#search`,
  "stop": `${iconStopUrl}#stop`,
  "thumbnail-none": `${iconThumbnailNoneUrl}#thumbnail-none`,
  "title-tag": `${iconTitleTagUrl}#title-tag`,
  "trash": `${iconTrashUrl}#trash`,
  "video": `${iconVideoUrl}#video`,
  "window-close": `${iconWindowCloseUrl}#window-close`,
  "window-maximize": `${iconWindowMaximizeUrl}#window-maximize`,
  "window-minimize": `${iconWindowMinimizeUrl}#window-minimize`,
  "pulsar-logo": iconPulsarLogoUrl,
} as const;

export const ICONS = {
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["play"]} /></svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["stop"]} /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["trash"]} /></svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["folder-open"]} /></svg>
  ),
  retry: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["retry"]} /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><use href={ICON_ASSETS["check"]} /></svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><use href={ICON_ASSETS["window-close"]} /></svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["video"]} /></svg>
  ),
  audio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["audio"]} /></svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["image"]} /></svg>
  ),
  font: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["font"]} /></svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["archive"]} /></svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><use href={ICON_ASSETS["download-arrow"]} /></svg>
  ),
  convert: (
    <svg viewBox="0 0 256 256" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["convert"]} /></svg>
  ),
  compress: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><use href={ICON_ASSETS["compress"]} /></svg>
  ),
};

export const SOURCE_ICONS = {
  youtube: `${iconPlatformYoutubeUrl}#platform-youtube`,
  ytmusic: `${iconPlatformYtmusicUrl}#platform-ytmusic`,
  soundcloud: `${iconPlatformSoundcloudUrl}#platform-soundcloud`,
  spotify: `${iconPlatformSpotifyUrl}#platform-spotify`,
  applemusic: `${iconPlatformApplemusicUrl}#platform-applemusic`,
  deezer: `${iconPlatformDeezerUrl}#platform-deezer`,
} as const;

export type SourceIconName = keyof typeof SOURCE_ICONS;

export function SourceIcon({ source, className }: { source?: string | null; className?: string }) {
  if (!source || !(source in SOURCE_ICONS)) return null;

  const icon = SOURCE_ICONS[source as SourceIconName];
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={icon} />
    </svg>
  );
}

export const TAG_ICON_SVG = (
  <span className="title-tag-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24"><use href={ICON_ASSETS["title-tag"]} /></svg>
  </span>
);

export const PRESET_DEFAULT_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;fill:currentColor"><use href="${ICON_ASSETS["default-preset"]}" /></svg>`;

export const CATEGORY_ICONS: Record<string, string> = {
  video: `<svg viewBox="0 0 24 24"><use href="${ICON_ASSETS["video"]}" /></svg>`,
  audio: `<svg viewBox="0 0 24 24"><use href="${ICON_ASSETS["audio"]}" /></svg>`,
  image: `<svg viewBox="0 0 24 24"><use href="${ICON_ASSETS["image"]}" /></svg>`,
  archive: `<svg viewBox="0 0 24 24"><use href="${ICON_ASSETS["archive"]}" /></svg>`,
  font: `<svg viewBox="0 0 24 24"><use href="${ICON_ASSETS["font"]}" /></svg>`
};