(function initQueueManager() {
    const tauri = window.__TAURI__ || {};
    const invoke = tauri.core ? tauri.core.invoke : null;
    const listen = tauri.event ? tauri.event.listen : null;
    let saveTimer = null;
    let hydratePromise = null;

    const state = {
        items: [],
        activeItemIds: [],
        priorityQueue: [],
        startAllActive: false,
        startAllSuccess: true,
        startAllStarted: 0,
        clearAfterCurrent: false,
        currentPage: 1,
        maxConcurrent: 3,
        advancedMode: false,
        systemNotifications: true,
        configLoaded: false,
        panel: null,
        panelInner: null,
        itemsContainer: null,
        pagination: null,
        pageLabel: null,
        hydrated: false,
        bound: false,
        orbInFlight: false
    };

    const MAX_CONCURRENT_DEFAULT = 3;
    const MAX_CONCURRENT_MIN = 1;
    const MAX_CONCURRENT_MAX = 10;

    const calcPerPage = () => {
        const h = window.innerHeight || 800;
        const w = window.innerWidth || 1000;
        if (h < 760 || w < 900) return 2;
        if (h < 900 || w < 1100) return 3;
        return 4;
    };

    const getPerPage = () => calcPerPage();

    const icons = {
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"></polygon></svg>`,
        stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`,
        trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>`,
        open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H3z"></path><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2"></path></svg>`,
        retry: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.5 15a9 9 0 1 0 .5-9.3L1 10"></path></svg>`,
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.2"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>`,
        audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
        image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m1 16 5.36-5.36c.49-.49 1.27-.49 1.76 0h0l4.11 4.11m.02 0 3.49-3.49c.49-.49 1.27-.49 1.76 0h0l3.49 3.49m-8.74 0 2.81 2.81"/><path d="M15 1H7c-2.11 0-3.15 0-3.95.41-.7.36-1.27.94-1.64 1.64C1 3.85 1 4.9 1 7v8c0 2.1 0 3.15.41 3.95.36.7.94 1.27 1.64 1.64C3.85 21 4.9 21 7 21h8c2.1 0 3.15 0 3.95-.41.7-.36 1.27-.94 1.64-1.64.41-.8.41-1.85.41-3.95V7m0 .01c0-2.11 0-3.15-.41-3.95-.36-.7-.94-1.27-1.64-1.64-.8-.41-1.85-.41-3.95-.41"/></svg>`,
        font: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.99 3.3.48 20.7h3l1.13-4.35h4.47l1.13 4.35h3L8.69 3.3H5Zm3.33 10.15L6.84 7.73l-1.48 5.72h2.97Zm12.3-2.41c-2.53-1.2-5.56-.12-6.76 2.41s-.12 5.56 2.41 6.76c1.38.65 2.97.65 4.35 0v.49h2.9V10.55h-2.9zm-4.35 4.59c0-1.2.97-2.18 2.18-2.18s2.18.97 2.18 2.18-.97 2.18-2.18 2.18-2.18-.97-2.18-2.18" style="fill-rule:evenodd"/></svg>`,
        archive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m21.71 5.79-3-3A1 1 0 0 0 18 2.5H6c-.27 0-.52.11-.71.29l-3 3A1 1 0 0 0 2 6.5v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-13c0-.27-.11-.52-.29-.71M6.41 4.5h11.17l1 1H5.41zM4 19.5v-12h16v12z"/><path d="M14 9.5h-4v3H7l5 5 5-5h-3z"/></svg>`,
        download: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        convert: `<svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M7.288 48.34c.061.04.129.068.193.105.18.105.363.201.559.277.093.036.19.06.286.089.175.053.351.098.535.127.049.008.094.028.144.034q.238.027.476.028h.001q.401-.001.79-.08c.154-.031.297-.086.443-.134.101-.033.206-.054.304-.094.162-.067.31-.158.46-.245.075-.043.156-.075.228-.124a4 4 0 0 0 .604-.495l7.492-7.492a3.995 3.995 0 0 0-4.249-6.56c4.535-11.868 16.033-20.322 29.475-20.322 12.266 0 23.516 7.2 28.658 18.342a4 4 0 1 0 7.264-3.352C74.503 14.478 60.403 5.455 45.027 5.455c-17.837 0-32.947 11.873-37.859 28.129-1.224-1.611-3.48-2.084-5.247-1.008a4 4 0 0 0-1.338 5.496l5.481 9.007c.014.023.035.041.049.063q.189.291.424.545c.036.039.064.085.101.122q.297.3.65.531m82.128 3.589-5.48-9.008c-.014-.023-.035-.04-.049-.063a4 4 0 0 0-.424-.546c-.035-.039-.063-.084-.1-.121a4 4 0 0 0-.65-.531c-.061-.04-.129-.067-.192-.104a4 4 0 0 0-.56-.277c-.093-.036-.19-.06-.287-.089a4 4 0 0 0-.534-.127c-.049-.008-.095-.028-.144-.034-.07-.008-.138.003-.208-.001-.091-.007-.177-.028-.269-.028-.082 0-.159.019-.239.024q-.18.01-.36.036a4 4 0 0 0-.503.113c-.105.03-.209.058-.312.097a4 4 0 0 0-.509.243c-.082.045-.166.082-.245.133-.237.153-.46.326-.659.524l-.001.001-7.492 7.492a4 4 0 0 0 0 5.656 3.99 3.99 0 0 0 4.249.904c-4.535 11.868-16.033 20.321-29.475 20.321a31.505 31.505 0 0 1-29.068-19.268 4 4 0 0 0-7.368 3.117 39.49 39.49 0 0 0 36.436 24.151c17.831 0 32.937-11.864 37.854-28.111a4 4 0 0 0 3.176 1.574c.708 0 1.426-.188 2.075-.584a3.996 3.996 0 0 0 1.338-5.494" transform="translate(1.407 1.407)scale(2.81)"/></svg>`,
        compress: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.94 0h6.12c-2.06 9.33-2.28 14.67 0 24H8.94c2.19-9.33 2.15-14.67 0-24m.04 12.87L5.8 16.99l-1.77-1.42 1.82-2.44H0v-2.26h5.85L4.03 8.42 5.8 7l3.15 4.08c.53.68.57 1.09.03 1.79m6.02 0L18.19 17l1.77-1.42-1.82-2.44h5.85v-2.26h-5.86l1.82-2.45-1.77-1.42-3.15 4.08c-.53.68-.57 1.09-.03 1.79Z"/></svg>`,
        console: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path><polyline points="7 9 10 12 7 15"></polyline><line x1="12" y1="15" x2="16" y2="15"></line></svg>`
    };

    const sourceIcons = {
        youtube: `<svg viewBox="0 0 28.57 20" aria-hidden="true"><path d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"/><path d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z"/></svg>`,
        ytmusic: `<svg viewBox="0 0 176 176" aria-hidden="true"><circle cx="88" cy="88" r="88"/><path d="M88,46c23.1,0,42,18.8,42,42s-18.8,42-42,42s-42-18.8-42-42S64.9,46,88,46 M88,42c-25.4,0-46,20.6-46,46s20.6,46,46,46s46-20.6,46-46S113.4,42,88,42L88,42z"/><polygon points="72,111 111,87 72,65"/></svg>`,
        soundcloud: `<svg viewBox="0 0 2499.998 1386.695" aria-hidden="true"><path d="M0 1137.737c0 31.024 11.247 54.481 33.737 70.382 22.491 15.898 46.533 21.52 72.126 16.868 24.041-4.653 40.91-13.185 50.607-25.593 9.693-12.408 14.542-32.962 14.542-61.657V800.372c0-24.044-8.336-44.403-25.012-61.075-16.672-16.676-37.03-25.012-61.074-25.012-23.267 0-43.237 8.336-59.912 25.012C8.339 755.969 0 776.327 0 800.372zm267.566 144.253c0 22.495 7.95 39.36 23.848 50.608 15.9 11.247 36.26 16.868 61.075 16.868 25.593 0 46.338-5.624 62.238-16.868 15.898-11.245 23.849-28.113 23.849-50.608V495.58c0-23.267-8.34-43.239-25.012-59.912-16.675-16.672-37.033-25.011-61.075-25.011-23.266 0-43.239 8.339-59.911 25.011-16.676 16.676-25.012 36.645-25.012 59.912zm266.403 37.227c0 22.492 8.143 39.36 24.43 50.607 16.286 11.245 37.226 16.869 62.822 16.869 24.816 0 45.174-5.624 61.072-16.869 15.9-11.247 23.851-28.115 23.851-50.607V601.442c0-24.041-8.339-44.595-25.012-61.657-16.675-17.061-36.644-25.59-59.911-25.59-24.044 0-44.595 8.529-61.657 25.59-17.061 17.062-25.593 37.616-25.593 61.657v717.775zm267.566 3.49c0 42.657 28.695 63.986 86.086 63.986 57.39 0 86.084-21.329 86.084-63.986V159.377c0-65.147-19.776-101.985-59.33-110.517-25.593-6.205-50.8 1.163-75.616 22.103-24.818 20.94-37.227 50.41-37.227 88.413v1163.331zm272.222 33.737V90.74c0-40.328 12.02-64.37 36.063-72.127C1161.78 6.205 1213.356 0 1264.543 0c118.657 0 229.176 27.92 331.547 83.76 102.373 55.84 185.165 132.038 248.37 228.594 63.21 96.56 99.854 203.001 109.936 319.337 47.308-20.165 97.717-30.247 151.23-30.247 108.578 0 201.452 38.39 278.618 115.17 77.168 76.782 115.754 169.072 115.754 276.875 0 108.578-38.586 201.256-115.754 278.036-77.166 76.78-169.651 115.17-277.455 115.17l-1012.097-1.163c-6.983-2.327-12.218-6.594-15.708-12.797s-5.227-11.638-5.227-16.291z"/></svg>`,
        spotify: `<svg viewBox="0 0 496 512" aria-hidden="true"><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8Z"/><path d="M406.6 231.1c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3zm-31 76.2c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm-26.9 65.6c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"/></svg>`,
        applemusic: `<svg viewBox="0 0 361 361" aria-hidden="true"><path d="M254.5,55c-0.87,0.08-8.6,1.45-9.53,1.64l-107,21.59l-0.04,0.01c-2.79,0.59-4.98,1.58-6.67,3c-2.04,1.71-3.17,4.13-3.6,6.95c-0.09,0.6-0.24,1.82-0.24,3.62c0,0,0,109.32,0,133.92c0,3.13-0.25,6.17-2.37,8.76c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.28,14.54-7.46,22.38c0.7,6.69,3.71,13.09,8.88,17.82c3.49,3.2,7.85,5.63,12.99,6.66c5.33,1.07,11.01,0.7,19.31-0.98c4.42-0.89,8.56-2.28,12.5-4.61c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1.19-8.7,1.19-13.26l0-116.15c0-6.22,1.76-7.86,6.78-9.08c0,0,88.94-17.94,93.09-18.75c5.79-1.11,8.52,0.54,8.52,6.61l0,79.29c0,3.14-0.03,6.32-2.17,8.92c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.49,14.54-7.67,22.38c0.7,6.69,3.92,13.09,9.09,17.82c3.49,3.2,7.85,5.56,12.99,6.6c5.33,1.07,11.01,0.69,19.31-0.98c4.42-0.89,8.56-2.22,12.5-4.55c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1-8.7,1-13.26V64.46C263.54,58.3,260.29,54.5,254.5,55z"/></svg>`,
        deezer: `<svg viewBox="-0.02 0 277.13 277.12" aria-hidden="true"><g transform="translate(-13.9)"><path d="M21.9 115.7c4.4 0 8-14.5 8-32.4s-3.6-32.4-8-32.4-8 14.5-8 32.4 3.6 32.4 8 32.4"/><path d="M256.8 18c-4.2 0-7.9 9.3-10.5 24.2C242.1 16.7 235.4 0 227.8 0c-9 0-16.9 23.5-20.6 57.7C203.5 32.9 198 17 191.9 17c-8.6 0-16 31.2-18.7 74.7-5.1-22.3-12.5-36.3-20.7-36.3s-15.6 14-20.7 36.3C129 48.2 121.7 17 113 17c-6.2 0-11.7 15.9-15.3 40.8C94 23.5 86.2 0 77.1 0c-7.6 0-14.4 16.7-18.5 42.3C56 27.4 52.3 18 48.1 18 40.3 18 34 50.5 34 90.5s6.3 72.4 14.1 72.4c3.2 0 6.2-5.5 8.5-14.7 3.7 33.8 11.5 57 20.5 57 7 0 13.2-13.9 17.4-35.9 2.9 41.8 10.1 71.5 18.5 71.5 5.3 0 10.1-11.8 13.7-30.9 4.3 39.5 14.2 67.2 25.8 67.2s21.5-27.7 25.8-67.2c3.6 19.1 8.4 30.9 13.7 30.9 8.4 0 15.6-29.7 18.5-71.5 4.2 22 10.4 35.9 17.4 35.9 9 0 16.8-23.2 20.5-57 2.4 9.2 5.3 14.7 8.5 14.7 7.8 0 14.1-32.4 14.1-72.4-.2-40-6.5-72.5-14.2-72.5"/><path d="M283 115.7c4.4 0 8-14.5 8-32.4s-3.6-32.4-8-32.4-8 14.5-8 32.4 3.6 32.4 8 32.4"/></g></svg>`
    };

    const queueId = () => {
        let id = Date.now();
        // Prevent collisions when multiple items are created in the same tick.
        while (state.items.some((i) => String(i.id) === String(id))) id += 1;
        return String(id);
    };

    const sanitizeStatus = (s) => ['pending', 'downloading', 'failed', 'completed'].includes(String(s)) ? String(s) : 'pending';
    const clamp = (v) => Math.min(Math.max(Number(v) || 0, 0), 100);
    const eta = (seconds) => {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const h = Math.floor(total / 3600);
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const s = String(total % 60).padStart(2, '0');
        return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    };
    const formatBytes = (bytes) => {
        const value = Number(bytes);
        if (!Number.isFinite(value)) return '--';
        if (value < 1024) return `${value} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let idx = -1;
        let size = value;
        while (size >= 1024 && idx < units.length - 1) {
            size /= 1024;
            idx += 1;
        }
        return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[idx]}`;
    };
    const t = (key, fallback = '', params = null) => {
        if (window.i18n && typeof window.i18n.t === 'function') {
            return window.i18n.t(key, fallback, params);
        }
        if (params && typeof fallback === 'string') {
            return fallback.replace(/\{(\w+)\}/g, (_, token) => {
                if (Object.prototype.hasOwnProperty.call(params, token)) return String(params[token]);
                return `{${token}}`;
            });
        }
        return fallback || key;
    };

    const normalizeItemType = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'convert' || raw === 'compress') return raw;
        return 'download';
    };

    const detectSourceFromUrl = (rawUrl) => {
        const input = String(rawUrl || '').trim().toLowerCase();
        if (!input) return null;
        try {
            const url = new URL(input);
            const host = url.hostname.toLowerCase();
            if (host === 'music.youtube.com' || host.endsWith('.music.youtube.com')) return 'ytmusic';
            if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
            if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com') || host === 'soundcloud.app.goo.gl') return 'soundcloud';
            if (host === 'spotify.com' || host.endsWith('.spotify.com')) return 'spotify';
            if (host === 'music.apple.com' || host.endsWith('.music.apple.com') || host === 'itunes.apple.com' || host.endsWith('.itunes.apple.com') || host === 'apple.co') return 'applemusic';
            if (host === 'deezer.com' || host.endsWith('.deezer.com') || host === 'deezer.page.link') return 'deezer';
            if (host === 'dzr.page.link' || host === 'link.deezer.com' || host === 'dzr.fm') return 'deezer';
        } catch (_) {
            if (input.includes('music.youtube.com')) return 'ytmusic';
            if (input.includes('youtube.com') || input.includes('youtu.be')) return 'youtube';
            if (input.includes('soundcloud.com') || input.includes('soundcloud.app.goo.gl')) return 'soundcloud';
            if (input.includes('spotify.com')) return 'spotify';
            if (input.includes('music.apple.com') || input.includes('itunes.apple.com') || input.includes('apple.co/')) return 'applemusic';
            if (input.includes('deezer.com') || input.includes('deezer.page.link') || input.includes('dzr.page.link') || input.includes('link.deezer.com') || input.includes('dzr.fm')) return 'deezer';
        }
        return null;
    };

    const createSourceIconMarkup = (source) => {
        if (!source) return '';
        const markup = sourceIcons[source];
        if (!markup) return '';
        return `<span class="queue-source-icon ${source}-icon" aria-hidden="true">${markup}</span>`;
    };

    const createTypeIconMarkup = (type) => {
        const normalized = normalizeItemType(type);
        const markup = icons[normalized];
        if (!markup) return '';
        return `<span class="queue-type-icon ${normalized}-type-icon" aria-hidden="true">${markup}</span>`;
    };

    const normalizeMaxConcurrent = (value) => {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return MAX_CONCURRENT_DEFAULT;
        if (parsed < MAX_CONCURRENT_MIN || parsed > MAX_CONCURRENT_MAX) return MAX_CONCURRENT_DEFAULT;
        return parsed;
    };

    const addActive = (id) => {
        if (!state.activeItemIds.includes(id)) state.activeItemIds.push(id);
    };

    const removeActive = (id) => {
        state.activeItemIds = state.activeItemIds.filter((x) => x !== id);
    };

    const isActive = (id) => state.activeItemIds.includes(id);

    function applyAdvancedMode(enabled) {
        state.advancedMode = !!enabled;
        if (document.body) {
            document.body.classList.toggle('advanced-mode', state.advancedMode);
        }
        if (window.queueConsole && typeof window.queueConsole.setEnabled === 'function') {
            window.queueConsole.setEnabled(state.advancedMode);
        }
        if (state.itemsContainer) render();
    }

    const appWindow = tauri.window?.getCurrentWindow ? tauri.window.getCurrentWindow() : null;

    const successSound = {
        audio: null,
        src: 'assets/success.mp3'
    };

    async function shouldSystemNotify() {
        if (!state.systemNotifications) return false;
        if (!appWindow) return false;
        try {
            const visible = typeof appWindow.isVisible === 'function' ? await appWindow.isVisible() : true;
            const minimized = typeof appWindow.isMinimized === 'function' ? await appWindow.isMinimized() : false;
            return minimized || visible === false;
        } catch (e) {
            console.error('Failed to check window state:', e);
            return false;
        }
    }

    async function shouldPlaySuccessSound() {
        if (!appWindow) {
            return document.visibilityState === 'visible' && !document.hidden;
        }
        try {
            const visible = typeof appWindow.isVisible === 'function' ? await appWindow.isVisible() : true;
            const minimized = typeof appWindow.isMinimized === 'function' ? await appWindow.isMinimized() : false;
            return visible && minimized === false;
        } catch (e) {
            console.error('Failed to check window state for sound:', e);
            return document.visibilityState === 'visible' && !document.hidden;
        }
    }

    function getSuccessAudio() {
        if (!successSound.audio) {
            const audio = new Audio(successSound.src);
            audio.preload = 'auto';
            successSound.audio = audio;
        }
        return successSound.audio;
    }

    async function playSuccessSound() {
        const canPlay = await shouldPlaySuccessSound();
        if (!canPlay) return;
        try {
            const audio = getSuccessAudio();
            audio.currentTime = 0;
            await audio.play();
        } catch (e) {
            console.error('Failed to play success sound:', e);
        }
    }

    async function ensureNotificationPermission() {
        const api = tauri.notification;
        if (!api) return false;
        try {
            if (typeof api.isPermissionGranted === 'function') {
                const granted = await api.isPermissionGranted();
                if (granted) return true;
                if (typeof api.requestPermission === 'function') {
                    const result = await api.requestPermission();
                    return result === 'granted';
                }
                return false;
            }
            return true;
        } catch (e) {
            console.error('Failed to request notification permission:', e);
            return false;
        }
    }

    async function sendSystemNotification(title, body, type) {
        try {
            const shouldNotify = await shouldSystemNotify();
            if (!shouldNotify) return;
            if (invoke) {
                await invoke('send_system_notification', { title, body, kind: type });
                return;
            }
        } catch (e) {
            console.error('Failed to send system notification via backend:', e);
        }

        const api = tauri.notification;
        if (!api || typeof api.sendNotification !== 'function') return;
        const allowed = await ensureNotificationPermission();
        if (!allowed) return;
        try {
            await api.sendNotification({ title, body });
        } catch (e) {
            console.error('Failed to send system notification via frontend:', e);
        }
    }

    async function refreshConfig() {
        if (!invoke) return;
        try {
            const config = await invoke('get_config');
            state.maxConcurrent = normalizeMaxConcurrent(config?.maximum_concurrent_processes);
            applyAdvancedMode(config?.advanced_mode);
            state.systemNotifications = config?.system_notifications !== false;
            state.configLoaded = true;
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }

    window.addEventListener('pulsar-config-updated', (event) => {
        if (!event?.detail) return;
        if (typeof event.detail.maximum_concurrent_processes !== 'undefined') {
            state.maxConcurrent = normalizeMaxConcurrent(event.detail.maximum_concurrent_processes);
        }
        if (typeof event.detail.advanced_mode !== 'undefined') {
            applyAdvancedMode(event.detail.advanced_mode);
        }
        if (typeof event.detail.system_notifications !== 'undefined') {
            state.systemNotifications = !!event.detail.system_notifications;
        }
    });

    function bindPanel(panel) {
        if (!panel) return;
        state.panel = panel;
        if (window.i18n && typeof window.i18n.apply === 'function') {
            window.i18n.apply(panel);
        }
        state.panelInner = panel.querySelector('.queue-panel-inner');
        state.itemsContainer = panel.querySelector('#queue-items');
        state.pagination = panel.querySelector('#queue-pagination');
        state.pageLabel = panel.querySelector('#queue-page-label');
        if (!state.bound) {
            panel.addEventListener('click', onPanelClick);
            state.bound = true;
        }
        if (!state.hydrated) ensureHydrated();
        render();
        resizePanel(true);
    }

    async function hydrate() {
        if (state.hydrated) return;
        if (!invoke) {
            state.hydrated = true;
            updateQueueBtn();
            return;
        }
        try {
            if (!state.configLoaded) {
                await refreshConfig();
            }
            const data = await invoke('get_queue_state');
            state.items = Array.isArray(data?.items) ? data.items.map((raw) => ({
                id: String(raw.id || queueId()),
                itemType: normalizeItemType(raw.item_type || raw.itemType || raw.type),
                title: String(raw.title || t('common.unknownTitle', 'Unknown title')),
                thumbnail: String(raw.thumbnail || ''),
                status: sanitizeStatus(raw.status) === 'downloading' ? 'pending' : sanitizeStatus(raw.status),
                progress: sanitizeStatus(raw.status) === 'downloading' ? 0 : clamp(raw.progress),
                eta: String(raw.eta || '--'),
                listProgress: null,
                addedAt: Number(raw.added_at) || Date.now(),
                payload: (raw.payload && typeof raw.payload === 'object') ? raw.payload : {},
                path: String(raw.path || ''),
                taskId: null,
                skippedByStop: Boolean(raw.skipped_by_stop),
                startReason: null,
                pendingStartReason: raw.pending_start_reason ? String(raw.pending_start_reason) : null,
                source: String(raw.source || 'queue')
            })) : [];
            state.activeItemIds = [];
            state.priorityQueue = Array.isArray(data?.priority_queue) ? data.priority_queue.filter((id) => state.items.some((i) => i.id === id)) : [];
            state.startAllActive = false;
            state.startAllSuccess = true;
            state.startAllStarted = 0;
            state.clearAfterCurrent = false;
            state.currentPage = Number(data?.current_page) > 0 ? Number(data.current_page) : 1;
            render();
        } catch (e) {
            console.error('Queue hydrate failed:', e);
        }
        state.hydrated = true;
        updateQueueBtn();
    }

    async function ensureHydrated() {
        if (state.hydrated) return;
        if (!hydratePromise) hydratePromise = hydrate().finally(() => { hydratePromise = null; });
        await hydratePromise;
    }

    function persistSoon() {
        if (!invoke) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            const payload = {
                items: state.items.map((i) => ({
                    id: i.id, item_type: i.itemType, title: i.title, thumbnail: i.thumbnail, status: i.status, progress: i.progress, eta: i.eta,
                    added_at: i.addedAt, payload: i.payload, path: i.path, task_id: i.taskId, skipped_by_stop: !!i.skippedByStop,
                    start_reason: i.startReason, pending_start_reason: i.pendingStartReason, source: i.source
                })),
                current_item_id: state.activeItemIds.length ? state.activeItemIds[0] : null,
                active_item_ids: [...state.activeItemIds],
                priority_queue: [...state.priorityQueue],
                start_all_active: state.startAllActive,
                start_all_success: state.startAllSuccess,
                start_all_started: state.startAllStarted,
                clear_after_current: state.clearAfterCurrent,
                current_page: state.currentPage
            };
            try {
                await invoke('save_queue_state', { queue_state: payload, queueState: payload });
            } catch (e) {
                console.error('Queue persist failed:', e);
            }
        }, 120);
    }

    function updateQueueBtn() {
        const btn = document.getElementById('btn-queue');
        if (!btn) return;
        const show = state.items.length > 0 || state.orbInFlight;
        btn.style.display = show ? 'flex' : 'none';
        if (!show) {
            btn.classList.remove('active', 'queue-pulse', 'force-open');
            if (typeof window.setQueuePanelVisible === 'function') window.setQueuePanelVisible(false);
        }
    }

    function resizePanel(immediate) {
        if (!state.panel || !state.panelInner) return;
        const target = state.panelInner.scrollHeight;
        if (immediate) return state.panel.style.height = `${target}px`;
        const current = state.panel.getBoundingClientRect().height;
        state.panel.style.height = `${current}px`;
        requestAnimationFrame(() => { state.panel.style.height = `${target}px`; });
    }

    function pulseQueueBtn() {
        const btn = document.getElementById('btn-queue');
        if (!btn) return;
        btn.classList.add('queue-pulse', 'force-open');
        setTimeout(() => {
            btn.classList.remove('queue-pulse', 'force-open');
            state.orbInFlight = false;
            updateQueueBtn();
        }, 1000);
    }

    function animateQueueOrb(sourceEl) {
        const btn = document.getElementById('btn-queue');
        if (!sourceEl || !btn) return;
        state.orbInFlight = true;
        updateQueueBtn();
        const s = sourceEl.getBoundingClientRect();
        const t = btn.getBoundingClientRect();
        const startX = s.left + s.width / 2;
        const startY = s.top + s.height / 2;
        const endX = t.left + t.width / 2;
        const endY = t.top + t.height / 2;
        const dx = endX - startX;
        const dy = endY - startY;
        const orb = document.createElement('div');
        orb.className = 'queue-orb';
        orb.style.left = `${startX}px`;
        orb.style.top = `${startY}px`;
        document.body.appendChild(orb);
        const a = orb.animate([
            { transform: 'translate(-50%, -50%) scale(0.65)', opacity: 0.95 },
            { transform: `translate(-50%, -50%) translate(${dx * 0.62}px, ${dy * 0.62}px) scale(1.15)`, opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.85)`, opacity: 0 }
        ], { duration: 750, easing: 'cubic-bezier(0.22,1,0.36,1)' });
        a.onfinish = () => { orb.remove(); pulseQueueBtn(); };
    }

    const findItemByTaskId = (id) => state.items.find((i) => i.taskId === id);

    async function cancelTask(taskId) {
        if (!invoke || !taskId) return false;
        try {
            await invoke('cancel_download', { task_id: taskId, taskId });
            return true;
        } catch (e) {
            console.error('Cancel failed:', e);
            return false;
        }
    }

    async function startItem(item, reason) {
        if (item.status === 'downloading') return;
        item.status = 'downloading';
        item.progress = 0;
        item.eta = '--';
        item.taskId = item.id;
        item.startReason = reason;
        item.pendingStartReason = null;
        item.skippedByStop = false;
        addActive(item.id);
        render();
        persistSoon();
        if (!invoke) return markFailed(item, 'NO_BRIDGE');
        try {
            const type = normalizeItemType(item.itemType);
            let taskId = null;
            if (type === 'convert') {
                taskId = await invoke('start_convert', { options: { ...item.payload, client_task_id: String(item.id) } });
            } else if (type === 'compress') {
                taskId = await invoke('start_compress', { options: { ...item.payload, client_task_id: String(item.id) } });
            } else {
                taskId = await invoke('start_download', { options: { ...item.payload, client_task_id: String(item.id) } });
            }
            if (!isActive(item.id) || item.status !== 'downloading') {
                if (taskId) await cancelTask(String(taskId));
                return;
            }
            item.taskId = String(taskId);
            persistSoon();
        } catch (e) {
            console.error('Start failed:', e);
            item.taskId = null;
            markFailed(item, 'START_FAILED');
        }
    }

    function startItemOrQueue(item, reason) {
        if (item.status === 'downloading') return;
        if (state.activeItemIds.length >= state.maxConcurrent) {
            if (!state.priorityQueue.includes(item.id)) state.priorityQueue.push(item.id);
            item.pendingStartReason = reason;
            item.skippedByStop = false;
            render();
            persistSoon();
            return;
        }
        state.priorityQueue = state.priorityQueue.filter((id) => id !== item.id);
        startItem(item, reason);
    }

    function maybeStartNext() {
        if (state.clearAfterCurrent) {
            if (state.activeItemIds.length === 0) {
                clearAllItems();
                state.clearAfterCurrent = false;
                persistSoon();
            }
            return;
        }

        let slots = state.maxConcurrent - state.activeItemIds.length;
        if (slots <= 0) return;

        while (slots > 0) {
            const prio = state.priorityQueue.find((id) => state.items.some((i) => i.id === id && i.status === 'pending'));
            if (!prio) break;
            state.priorityQueue = state.priorityQueue.filter((id) => id !== prio);
            const item = state.items.find((i) => i.id === prio);
            if (item) {
                startItem(item, item.pendingStartReason || 'download');
                slots -= 1;
            } else {
                break;
            }
        }

        if (state.startAllActive) {
            while (slots > 0) {
                const next = state.items.find((i) => i.status === 'pending' && !i.skippedByStop);
                if (!next) break;
                state.startAllStarted += 1;
                startItem(next, 'start-all');
                slots -= 1;
            }
            const hasPending = state.items.some((i) => i.status === 'pending' && !i.skippedByStop);
            if (!hasPending && state.activeItemIds.length === 0) {
                state.startAllActive = false;
                if (state.startAllSuccess && state.startAllStarted > 0) notifyQueueSuccess();
                state.startAllSuccess = true;
                state.startAllStarted = 0;
                persistSoon();
            }
        }
    }

    function markCompleted(item) {
        item.status = 'completed';
        item.progress = 100;
        item.eta = '00:00';
        item.taskId = null;
        removeActive(item.id);
        const itemType = normalizeItemType(item.itemType);
        if (item.startReason === 'download' || item.startReason === 'queue-manual' || item.startReason === 'convert' || item.startReason === 'compress') {
            if (itemType === 'download') {
                notifySuccessDownload();
            } else if (itemType === 'convert') {
                notifySuccessConvert();
            } else if (itemType === 'compress') {
                notifySuccessCompress();
            }
        }
        render();
        persistSoon();
        maybeStartNext();
    }

    function markFailed(item, code) {
        const cancelLike = String(code || '').toLowerCase().includes('cancel');
        if (cancelLike) {
            item.status = 'pending';
            item.progress = 0;
            item.eta = '--';
            item.taskId = null;
            item.skippedByStop = true;
            item.startReason = null;
            removeActive(item.id);
            render();
            persistSoon();
            maybeStartNext();
            return;
        }
        item.status = 'failed';
        item.taskId = null;
        removeActive(item.id);
        if (state.startAllActive && item.startReason === 'start-all') state.startAllSuccess = false;
        notifyError(code);
        render();
        persistSoon();
        maybeStartNext();
    }

    function onBridgeEvent(payload) {
        if (!payload || payload.type === 'metadata' || !payload.id) return;
        const item = findItemByTaskId(String(payload.id));
        if (!item) return;
        if (window.queueConsole && typeof window.queueConsole.log === 'function') {
            window.queueConsole.log(item.id, payload);
        }
        if (payload.type === 'progress' || payload.type === 'progress_ffmpeg' || typeof payload.percent !== 'undefined' || typeof payload.progress !== 'undefined') {
            let p = payload.percent;
            if (typeof p === 'undefined') p = payload.progress;
            if (typeof p === 'undefined') p = payload.percentage;
            const n = parseProgressValue(p, payload);
            if (Number.isFinite(n)) item.progress = clamp(n);
            if (typeof payload.eta_seconds !== 'undefined') item.eta = eta(payload.eta_seconds);
            else if (typeof payload.eta !== 'undefined') item.eta = typeof payload.eta === 'number' ? eta(payload.eta) : String(payload.eta);
            const index = Number(payload.item_index);
            const count = Number(payload.item_count);
            if (Number.isFinite(index) && Number.isFinite(count)) {
                item.listProgress = `${Math.max(1, Math.floor(index))}/${Math.max(1, Math.floor(count))}`;
            }
            updateVisible(item);
            persistSoon();
        }
        if (payload.type === 'cancelled') {
            item.status = 'pending';
            item.progress = 0;
            item.eta = '--';
            item.taskId = null;
            item.skippedByStop = true;
            item.startReason = null;
            removeActive(item.id);
            render();
            persistSoon();
            maybeStartNext();
            return;
        }
        const finished = payload.type === 'finished' || payload.status === 'finished' || payload.event === 'finished';
        const success = payload.success === true || payload.status === 'success' || payload.event === 'success';
        const failure = payload.success === false || payload.status === 'error' || payload.event === 'error';
        if (finished || success || failure) success ? markCompleted(item) : markFailed(item, payload.error || payload.code || payload.reason || 'UNKNOWN');
    }

    function updateVisible(item) {
        if (!state.itemsContainer) return;
        const el = state.itemsContainer.querySelector(`.queue-item[data-id="${item.id}"]`);
        if (!el) return;
        const f = el.querySelector('.queue-progress-fill');
        if (f) f.style.width = `${Math.round(item.progress)}%`;
        const spans = el.querySelectorAll('.queue-progress-meta span');
        if (spans[0]) {
            const suffix = item.listProgress ? ` (${item.listProgress})` : '';
            spans[0].textContent = `${Math.round(item.progress)}%${suffix}`;
        }
        if (spans[1]) spans[1].textContent = `${t('common.eta', 'ETA')} ${item.eta || '--'}`;
    }

    function buildInfoLine(item) {
        const payload = item?.payload || {};
        const itemType = normalizeItemType(item?.itemType);
        const typeIcon = createTypeIconMarkup(itemType);
        if (itemType === 'compress') {
            const outputFormat = String(payload.output_format || payload.format || payload.source_format || '--').toUpperCase();
            const sourceSize = formatBytes(payload.source_size_bytes);
            return {
                icon: typeIcon,
                text: `${outputFormat} | ${sourceSize}`
            };
        }
        if (itemType === 'convert') {
            const outputFormat = String(payload.output_format || payload.format || '--').toUpperCase();
            const sourceSize = formatBytes(payload.source_size_bytes);
            return {
                icon: typeIcon,
                text: `${outputFormat} | ${sourceSize}`
            };
        }
        const mode = String(payload.mode || 'video').toLowerCase();
        const format = mode === 'audio' ? String(payload.audio_format || '--').toUpperCase() : String(payload.video_format || '--').toUpperCase();
        const quality = mode === 'audio' ? String(payload.audio_quality || '--') : String(payload.video_quality || '--');
        const subtitleState = payload.download_subs || payload.download_chat || payload.embed_subs
            ? t('queue.subtitles.on', 'ON')
            : t('queue.subtitles.off', 'OFF');
        const subs = `${t('queue.subtitles.label', 'Subtitles')}: ${subtitleState}`;
        return {
            icon: typeIcon,
            text: `${format} | ${quality} | ${subs}`
        };
    }

    function itemButtons(item) {
        const consoleBtn = state.advancedMode
            ? `<button class="queue-icon-btn" data-item-action="console" title="${esc(t('queue.itemActions.console', 'Console'))}">${icons.console}</button>`
            : '';
        if (item.status === 'pending') return `<button class="queue-icon-btn" data-item-action="start" title="${esc(t('queue.itemActions.start', 'Start'))}">${icons.play}</button><button class="queue-icon-btn" data-item-action="remove" title="${esc(t('queue.itemActions.remove', 'Remove'))}">${icons.trash}</button>${consoleBtn}`;
        if (item.status === 'downloading') return `<button class="queue-icon-btn" data-item-action="stop" title="${esc(t('queue.itemActions.stop', 'Stop'))}">${icons.stop}</button>${consoleBtn}`;
        if (item.status === 'failed') return `<button class="queue-icon-btn" data-item-action="retry" title="${esc(t('queue.itemActions.retry', 'Retry'))}">${icons.retry}</button><button class="queue-icon-btn" data-item-action="remove" title="${esc(t('queue.itemActions.remove', 'Remove'))}">${icons.trash}</button><button class="queue-icon-btn" data-item-action="open" title="${esc(t('queue.itemActions.openLocation', 'Open location'))}">${icons.open}</button>${consoleBtn}`;
        return `<button class="queue-icon-btn" data-item-action="open" title="${esc(t('queue.itemActions.openLocation', 'Open location'))}">${icons.open}</button><button class="queue-icon-btn" data-item-action="remove" title="${esc(t('queue.itemActions.remove', 'Remove'))}">${icons.trash}</button>${consoleBtn}`;
    }

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function parseProgressValue(value, payload) {
        if (typeof value === 'undefined' || value === null) return null;
        let raw = value;
        if (typeof raw === 'string') {
            raw = raw.trim();
            if (!raw) return null;
            if (raw.endsWith('%')) raw = raw.slice(0, -1);
            raw = raw.replace(',', '.');
        }
        let n = Number(raw);
        if (!Number.isFinite(n)) return null;
        const isRatio = payload && (payload.percent_is_ratio === true || payload.progress_is_ratio === true);
        if (isRatio) n *= 100;
        return n;
    }

    function render() {
        if (!state.itemsContainer) return;
        const perPage = getPerPage();
        const total = Math.max(1, Math.ceil(state.items.length / perPage));
        state.currentPage = Math.min(state.currentPage, total);
        const start = (state.currentPage - 1) * perPage;
        const pageItems = state.items.slice(start, start + perPage);
        state.itemsContainer.innerHTML = '';
        if (!pageItems.length) {
            state.itemsContainer.innerHTML = `<div class="queue-empty">${esc(t('queue.empty', 'Queue is empty.'))}</div>`;
        } else {
            pageItems.forEach((item) => {
                const itemType = normalizeItemType(item.itemType);
                const payloadCategory = String(item.payload?.category || item.payload?.target_category || '').toLowerCase();
                const mode = itemType === 'download'
                    ? String(item.payload.mode || 'video').toLowerCase()
                    : (payloadCategory || itemType);
                const modeIcon = itemType === 'download'
                    ? (mode === 'audio' ? icons.audio : icons.video)
                    : (payloadCategory === 'audio' ? icons.audio
                        : payloadCategory === 'image' ? icons.image
                        : payloadCategory === 'video' ? icons.video
                        : payloadCategory === 'font' ? icons.font
                        : payloadCategory === 'archive' ? icons.archive
                        : (itemType === 'convert' ? icons.convert : icons.compress));
                const source = detectSourceFromUrl(item.payload?.url);
                const sourceIcon = createSourceIconMarkup(source);
                const info = buildInfoLine(item);
                const infoText = esc(info.text);
                const infoMarkup = info.icon
                    ? `${info.icon}<span class="queue-item-details-text">${infoText}</span>`
                    : infoText;
                const el = document.createElement('div');
                el.className = `queue-item status-${item.status}`;
                el.dataset.id = item.id;
                el.innerHTML = `
                    <div class="queue-item-bg" style="background-image:${item.thumbnail ? `url('${item.thumbnail.replace(/'/g, '\\\'')}')` : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45))'}"></div>
                    <div class="queue-item-content">
                        <div class="queue-item-title-row"><span class="queue-mode-icon">${modeIcon}</span>${sourceIcon}<div class="queue-item-title">${esc(item.title)}</div></div>
                        <div class="queue-item-details">${infoMarkup}</div>
                        <div class="queue-item-progress-wrap">
                            <div class="queue-progress-bar"><div class="queue-progress-fill" style="width:${Math.round(item.progress)}%"></div></div>
                            <div class="queue-progress-meta"><span>${Math.round(item.progress)}%${item.listProgress ? ` (${esc(item.listProgress)})` : ''}</span><span>${esc(t('common.eta', 'ETA'))} ${item.eta || '--'}</span></div>
                        </div>
                    </div>
                    <div class="queue-item-actions">${itemButtons(item)}</div>
                `;
                if (item.status === 'failed' || item.status === 'completed') {
                    const s = document.createElement('div');
                    s.className = `queue-status-icon ${item.status === 'completed' ? 'success' : 'failed'}`;
                    s.innerHTML = item.status === 'completed' ? icons.check : icons.cross;
                    el.appendChild(s);
                }
                state.itemsContainer.appendChild(el);
            });
        }
        if (state.pageLabel) {
            state.pageLabel.textContent = t('common.pageLabel', 'Page {current}/{total}', {
                current: state.currentPage,
                total
            });
        }
        if (state.pagination) state.pagination.classList.toggle('hidden', state.items.length <= perPage);
        resizePanel();
        updateQueueBtn();
    }

    async function onPanelClick(e) {
        const q = e.target.closest('[data-queue-action]');
        if (q) {
            const action = q.dataset.queueAction;
            if (action === 'start-all') startAll();
            if (action === 'stop-all') await stopAll();
            if (action === 'clear-queue') clearQueue();
            if (action === 'prev-page') setPage(state.currentPage - 1);
            if (action === 'next-page') setPage(state.currentPage + 1);
            return;
        }
        const i = e.target.closest('[data-item-action]');
        if (!i) return;
        const card = i.closest('.queue-item');
        if (!card) return;
        const id = card.dataset.id;
        const action = i.dataset.itemAction;
        if (action === 'start') startItemById(id, 'queue-manual');
        if (action === 'stop') await stopItem(id);
        if (action === 'remove') removeItem(id);
        if (action === 'open') openLocation(id);
        if (action === 'retry') startItemById(id, 'queue-manual', true);
        if (action === 'console' && window.queueConsole && typeof window.queueConsole.open === 'function') {
            window.queueConsole.open(id);
        }
    }

    const setPage = (p) => {
        const perPage = getPerPage();
        state.currentPage = Math.min(Math.max(1, p), Math.max(1, Math.ceil(state.items.length / perPage)));
        render();
    };

    function startItemById(id, reason, reset) {
        const item = state.items.find((x) => x.id === id);
        if (!item) return;
        if (reset) { item.progress = 0; item.eta = '--'; item.status = 'pending'; }
        startItemOrQueue(item, reason);
        persistSoon();
    }

    async function stopItem(id) {
        const item = state.items.find((x) => x.id === id);
        if (!item) return;
        if (item.status !== 'downloading') return;
        if (item.taskId) await cancelTask(item.taskId);
        item.status = 'pending';
        item.progress = 0;
        item.eta = '--';
        item.taskId = null;
        item.skippedByStop = true;
        item.startReason = null;
        item.pendingStartReason = null;
        removeActive(item.id);
        notifyStopped();
        render();
        persistSoon();
        maybeStartNext();
    }

    function removeItem(id) {
        const idx = state.items.findIndex((x) => x.id === id);
        if (idx === -1) return;
        if (state.items[idx].status === 'downloading') return;
        state.priorityQueue = state.priorityQueue.filter((itemId) => itemId !== id);
        const el = state.itemsContainer ? state.itemsContainer.querySelector(`.queue-item[data-id="${id}"]`) : null;
        if (el) {
            el.style.height = `${el.offsetHeight}px`;
            el.classList.add('removing');
            requestAnimationFrame(() => { el.style.height = '0px'; });
            el.addEventListener('transitionend', () => {
                state.items.splice(idx, 1);
                if (window.queueConsole && typeof window.queueConsole.remove === 'function') {
                    window.queueConsole.remove(id);
                }
                render();
                persistSoon();
                updateQueueBtn();
            }, { once: true });
            return;
        }
        state.items.splice(idx, 1);
        if (window.queueConsole && typeof window.queueConsole.remove === 'function') {
            window.queueConsole.remove(id);
        }
        render();
        persistSoon();
        updateQueueBtn();
    }

    const extractFolderPath = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const normalized = raw.replace(/[/\\]+$/, '');
        const idx = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
        if (idx === -1) return '';
        return normalized.slice(0, idx);
    };

    const looksLikeFilePath = (value) => /[\\/][^\\/]+\\.[^\\/]+$/.test(String(value || ''));

    async function openLocation(id) {
        const item = state.items.find((x) => x.id === id);
        if (!item) return;
        const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
        let targetPath = item.path ? String(item.path) : '';
        if (item.status === 'failed') {
            if (payload.output_dir) {
                targetPath = String(payload.output_dir);
            } else if (payload.path) {
                targetPath = String(payload.path);
            } else if (looksLikeFilePath(targetPath)) {
                const dir = extractFolderPath(targetPath);
                if (dir) targetPath = dir;
            }
        }
        if (!targetPath) return;
        if (invoke) {
            try {
                await invoke('open_in_file_manager', { path: String(targetPath) });
                return;
            } catch (e) {
                console.error('Open location via backend failed, falling back to opener:', e);
            }
        }
        if (tauri.opener?.openPath) {
            try {
                await tauri.opener.openPath(targetPath);
                return;
            } catch (e) {
                console.error('Open path failed, falling back to reveal:', e);
            }
        }
        if (tauri.opener?.revealItemInDir) {
            try {
                await tauri.opener.revealItemInDir(targetPath);
            } catch (e) {
                console.error('Reveal item failed:', e);
            }
        }
    }

    function startAll() {
        if (!state.items.length) return;
        state.startAllActive = true;
        state.startAllSuccess = true;
        state.startAllStarted = 0;
        maybeStartNext();
        render();
        persistSoon();
    }

    async function stopAll() {
        state.startAllActive = false;
        state.priorityQueue = [];
        const activeItems = state.items.filter((x) => x.status === 'downloading');
        for (const item of activeItems) {
            if (item.taskId) await cancelTask(item.taskId);
            item.status = 'pending';
            item.progress = 0;
            item.eta = '--';
            item.taskId = null;
            item.skippedByStop = true;
            item.startReason = null;
            item.pendingStartReason = null;
        }
        state.activeItemIds = [];
        notifyStopped();
        render();
        persistSoon();
    }

    function clearQueue() {
        if (state.activeItemIds.length > 0) {
            state.items = state.items.filter((x) => x.status === 'downloading');
            state.activeItemIds = state.items.map((x) => x.id);
            if (window.queueConsole && typeof window.queueConsole.retain === 'function') {
                window.queueConsole.retain(state.activeItemIds);
            }
            state.clearAfterCurrent = true;
            state.startAllActive = false;
            state.priorityQueue = [];
            state.currentPage = 1;
            render();
            persistSoon();
            return;
        }
        clearAllItems();
        persistSoon();
    }

    function clearAllItems() {
        state.items = [];
        state.priorityQueue = [];
        state.activeItemIds = [];
        if (window.queueConsole && typeof window.queueConsole.clear === 'function') {
            window.queueConsole.clear();
        }
        state.startAllActive = false;
        state.startAllSuccess = true;
        state.startAllStarted = 0;
        state.clearAfterCurrent = false;
        state.currentPage = 1;
        render();
        updateQueueBtn();
    }

    async function enqueue(payload, meta, opts = {}) {
        await ensureHydrated();
        const item = {
            id: queueId(),
            itemType: normalizeItemType(opts.itemType || payload?.item_type || payload?.type),
            title: meta?.title ? String(meta.title) : t('common.unknownTitle', 'Unknown title'),
            thumbnail: meta?.thumbnail ? String(meta.thumbnail) : '',
            status: 'pending',
            progress: 0,
            eta: '--',
            listProgress: null,
            addedAt: Date.now(),
            payload: payload && typeof payload === 'object' ? payload : {},
            path: payload?.path ? String(payload.path) : '',
            taskId: null,
            skippedByStop: false,
            startReason: null,
            pendingStartReason: null,
            source: opts.source || 'queue'
        };
        state.items.push(item);
        if (opts.autoStart) startItemOrQueue(item, opts.startReason || 'download');
        else if (state.startAllActive) maybeStartNext();
        else render();
        persistSoon();
        updateQueueBtn();
        return item;
    }

    function notifySuccessDownload() {
        if (window.notifier) {
            window.notifier.show(
                t('common.success', 'Success'),
                t('queue.notifications.downloadCompleted', 'Download completed successfully.'),
                'success',
                false
            );
        }
        playSuccessSound();
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.downloadCompletedSystem', 'Download completed.'),
            'success'
        );
    }

    function notifySuccessConvert() {
        if (window.notifier) {
            window.notifier.show(
                t('common.success', 'Success'),
                t('queue.notifications.convertCompleted', 'Convert completed successfully.'),
                'success',
                false
            );
        }
        playSuccessSound();
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.convertCompletedSystem', 'Convert completed.'),
            'success'
        );
    }

    function notifySuccessCompress() {
        if (window.notifier) {
            window.notifier.show(
                t('common.success', 'Success'),
                t('queue.notifications.compressCompleted', 'Compress completed successfully.'),
                'success',
                false
            );
        }
        playSuccessSound();
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.compressCompletedSystem', 'Compression completed.'),
            'success'
        );
    }
    function notifyQueueSuccess() {
        if (window.notifier) {
            window.notifier.show(
                t('common.success', 'Success'),
                t('queue.notifications.queueCompleted', 'Queue elements completed successfully.'),
                'success',
                false
            );
        }
        playSuccessSound();
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.queueCompletedSystem', 'Queue elements completed.'),
            'success'
        );
    }
    function notifyError(code) {
        if (window.notifier) {
            const suffix = code
                ? t('queue.notifications.errorSuffix', ' Error code: {code}', { code })
                : '';
            window.notifier.show(
                t('common.error', 'Error'),
                t('queue.notifications.downloadFailed', 'Download failed.{suffix}', { suffix }),
                'error',
                false
            );
        }
        const systemSuffix = code
            ? t('queue.notifications.errorSuffix', ' Error code: {code}', { code })
            : '';
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.downloadFailedSystem', 'Download failed.{suffix}', { suffix: systemSuffix }),
            'error'
        );
    }
    function notifyStopped() {
        if (window.notifier) {
            window.notifier.show(
                t('common.info', 'Info'),
                t('queue.notifications.downloadStopped', 'Download stopped by user.'),
                'info',
                false
            );
        }
    }

    if (listen) listen('download-event', (event) => onBridgeEvent(event.payload));
    if (listen) listen('tray-clear-queue', () => clearQueue());
    window.addEventListener('resize', () => { if (state.itemsContainer) render(); });
    updateQueueBtn();
    ensureHydrated();

    window.queueManager = {
        bindPanel,
        enqueue,
        startAll,
        stopAll,
        clearQueue,
        animateQueueOrb,
        refreshConfig,
        handleBridgeEvent: onBridgeEvent,
        hasItems: () => state.items.length > 0,
        getMaxConcurrent: () => state.maxConcurrent
    };
})();