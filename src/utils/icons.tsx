import {
  siApplemusic,
  siDeezer,
  siSoundcloud,
  siSpotify,
  siYoutube,
  siYoutubemusic,
} from "simple-icons";

export const ICONS = {
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <polygon points="5 3 19 12 5 21"></polygon>
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <rect x="6" y="6" width="12" height="12" rx="2"></rect>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H3z"></path>
      <path d="M3 7V5a2 2 0 0 1 2-2h5l2 2"></path>
    </svg>
  ),
  retry: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polyline points="1 4 1 10 7 10"></polyline>
      <path d="M3.5 15a9 9 0 1 0 .5-9.3L1 10"></path>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="2" y="2" width="20" height="20" rx="2.2"></rect>
      <line x1="7" y1="2" x2="7" y2="22"></line>
      <line x1="17" y1="2" x2="17" y2="22"></line>
      <line x1="2" y1="12" x2="22" y2="12"></line>
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="m1 16 5.36-5.36c.49-.49 1.27-.49 1.76 0h0l4.11 4.11m.02 0 3.49-3.49c.49-.49 1.27-.49 1.76 0h0l3.49 3.49m-8.74 0 2.81 2.81" />
      <path d="M15 1H7c-2.11 0-3.15 0-3.95.41-.7.36-1.27.94-1.64 1.64C1 3.85 1 4.9 1 7v8c0 2.1 0 3.15.41 3.95.36.7.94 1.27 1.64 1.64C3.85 21 4.9 21 7 21h8c2.1 0 3.15 0 3.95-.41.7-.36 1.27-.94 1.64-1.64.41-.8.41-1.85.41-3.95V7m0 .01c0-2.11 0-3.15-.41-3.95-.36-.7-.94-1.27-1.64-1.64-.8-.41-1.85-.41-3.95-.41" />
    </svg>
  ),
  font: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M4.99 3.3.48 20.7h3l1.13-4.35h4.47l1.13 4.35h3L8.69 3.3H5Zm3.33 10.15L6.84 7.73l-1.48 5.72h2.97Zm12.3-2.41c-2.53-1.2-5.56-.12-6.76 2.41s-.12 5.56 2.41 6.76c1.38.65 2.97.65 4.35 0v.49h2.9V10.55h-2.9zm-4.35 4.59c0-1.2.97-2.18 2.18-2.18s2.18.97 2.18 2.18-.97 2.18-2.18 2.18-2.18-.97-2.18-2.18" />
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="m21.71 5.79-3-3A1 1 0 0 0 18 2.5H6c-.27 0-.52.11-.71.29l-3 3A1 1 0 0 0 2 6.5v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-13c0-.27-.11-.52-.29-.71M6.41 4.5h11.17l1 1H5.41zM4 19.5v-12h16v12z" />
      <path d="M14 9.5h-4v3H7l5 5 5-5h-3z" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  ),
  convert: (
    <svg viewBox="0 0 256 256" fill="currentColor" width="16" height="16">
      <path
        d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494"
        transform="translate(1.407 1.407)scale(2.81)"
      />
    </svg>
  ),
  compress: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z" />
    </svg>
  ),
  console: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path>
      <polyline points="7 9 10 12 7 15"></polyline>
      <line x1="12" y1="15" x2="16" y2="15"></line>
    </svg>
  ),
};

export const SOURCE_ICONS = {
  youtube: siYoutube,
  ytmusic: siYoutubemusic,
  soundcloud: siSoundcloud,
  spotify: siSpotify,
  applemusic: siApplemusic,
  deezer: siDeezer,
} as const;

export type SourceIconName = keyof typeof SOURCE_ICONS;

export function SourceIcon({ source, className }: { source?: string | null; className?: string }) {
  if (!source || !(source in SOURCE_ICONS)) return null;

  const icon = SOURCE_ICONS[source as SourceIconName];
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={icon.path} />
    </svg>
  );
}

export const GEAR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "100%", height: "100%", display: "block" }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const TAG_ICON_SVG = (
  <span className="title-tag-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path className="tag-outline" d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line className="tag-outline" x1="7" y1="7" x2="7.01" y2="7" />
      <circle className="tag-dot" cx="7" cy="7" r="1.2" />
    </svg>
  </span>
);

export const DEFAULT_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;fill:#ffffff"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>`;

export const CATEGORY_ICONS: Record<string, string> = {
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M7 2v20M17 2v20M2 12h20"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m1 16 5.36-5.36c.49-.49 1.27-.49 1.76 0h0l4.11 4.11m.02 0 3.49-3.49c.49-.49 1.27-.49 1.76 0h0l3.49 3.49m-8.74 0 2.81 2.81"/><path d="M15 1H7c-2.11 0-3.15 0-3.95.41-.7.36-1.27.94-1.64 1.64C1 3.85 1 4.9 1 7v8c0 2.1 0 3.15.41 3.95.36.7.94 1.27 1.64 1.64C3.85 21 4.9 21 7 21h8c2.1 0 3.15 0 3.95-.41.7-.36 1.27-.94 1.64-1.64.41-.8.41-1.85.41-3.95V7m0 .01c0-2.11 0-3.15-.41-3.95-.36-.7-.94-1.27-1.64-1.64-.8-.41-1.85-.41-3.95-.41"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m21.71 5.79-3-3A1 1 0 0 0 18 2.5H6c-.27 0-.52.11-.71.29l-3 3A1 1 0 0 0 2 6.5v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-13c0-.27-.11-.52-.29-.71M6.41 4.5h11.17l1 1H5.41zM4 19.5v-12h16v12z"/><path d="M14 9.5h-4v3H7l5 5 5-5h-3z"/></svg>`,
  font: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.99 3.3.48 20.7h3l1.13-4.35h4.47l1.13 4.35h3L8.69 3.3H5Zm3.33 10.15L6.84 7.73l-1.48 5.72h2.97Zm12.3-2.41c-2.53-1.2-5.56-.12-6.76 2.41s-.12 5.56 2.41 6.76c1.38.65 2.97.65 4.35 0v.49h2.9V10.55h-2.9zm-4.35 4.59c0-1.2.97-2.18 2.18-2.18s2.18.97 2.18 2.18-.97 2.18-2.18 2.18-2.18-.97-2.18-2.18" style="fill-rule:evenodd"/></svg>`
};