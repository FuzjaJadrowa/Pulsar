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
        console: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path><polyline points="7 9 10 12 7 15"></polyline><line x1="12" y1="15" x2="16" y2="15"></line></svg>`
    };

    const notificationIcons = {
        success: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-6.5 7L8 13"/></svg>')}`,
        error: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/></svg>')}`,
        info: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8h.01M11 12h2v5h-2z"/></svg>')}`
    };

    const queueId = () => {
        let id = Date.now();
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

    const normalizeMaxConcurrent = (value) => {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return MAX_CONCURRENT_DEFAULT;
        if (parsed < MAX_CONCURRENT_MIN || parsed > MAX_CONCURRENT_MAX) return MAX_CONCURRENT_DEFAULT;
        return parsed;
    };

    const consoleLogs = new Map();
    let consoleOverlay = null;
    let consoleTitle = null;
    let consoleBody = null;
    let consoleCloseBtn = null;
    const consoleState = { openId: null };

    const addActive = (id) => {
        if (!state.activeItemIds.includes(id)) state.activeItemIds.push(id);
    };

    const removeActive = (id) => {
        state.activeItemIds = state.activeItemIds.filter((x) => x !== id);
    };

    const isActive = (id) => state.activeItemIds.includes(id);

    function ensureConsoleOverlay() {
        if (consoleOverlay) return;
        consoleOverlay = document.createElement('div');
        consoleOverlay.className = 'queue-console-overlay';
        consoleOverlay.innerHTML = `
            <div class="queue-console-modal">
                <div class="queue-console-header">
                    <div class="queue-console-title"></div>
                    <button class="queue-console-close" aria-label="Close">&times;</button>
                </div>
                <pre class="queue-console-body"></pre>
            </div>
        `;
        document.body.appendChild(consoleOverlay);
        consoleTitle = consoleOverlay.querySelector('.queue-console-title');
        consoleBody = consoleOverlay.querySelector('.queue-console-body');
        consoleCloseBtn = consoleOverlay.querySelector('.queue-console-close');
        consoleOverlay.addEventListener('click', (event) => {
            if (event.target === consoleOverlay) closeConsole();
        });
        if (consoleCloseBtn) {
            consoleCloseBtn.addEventListener('click', closeConsole);
        }
    }

    function updateConsoleContent() {
        if (!consoleState.openId || !consoleTitle || !consoleBody) return;
        const id = consoleState.openId;
        const lines = consoleLogs.get(id) || [];
        consoleTitle.textContent = t('queue.console.title', 'Console - {id}', { id });
        consoleBody.textContent = lines.length
            ? lines.join('\n')
            : t('queue.console.empty', 'No console output yet.');
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function openConsole(id) {
        if (!state.advancedMode) return;
        ensureConsoleOverlay();
        consoleState.openId = id;
        updateConsoleContent();
        consoleOverlay.classList.add('open');
    }

    function closeConsole() {
        if (!consoleOverlay) return;
        consoleOverlay.classList.remove('open');
        consoleState.openId = null;
    }

    function logConsole(item, payload) {
        if (!item) return;
        const id = item.id;
        const lines = consoleLogs.get(id) || [];
        const timestamp = new Date().toLocaleTimeString();
        let text = '';
        try {
            text = JSON.stringify(payload);
        } catch (_) {
            text = String(payload);
        }
        lines.push(`[${timestamp}] ${text}`);
        if (lines.length > 250) lines.splice(0, lines.length - 250);
        consoleLogs.set(id, lines);
        if (consoleState.openId === id) updateConsoleContent();
    }

    function applyAdvancedMode(enabled) {
        state.advancedMode = !!enabled;
        if (document.body) {
            document.body.classList.toggle('advanced-mode', state.advancedMode);
        }
        if (!state.advancedMode) closeConsole();
        if (state.itemsContainer) render();
    }

    const appWindow = tauri.window?.getCurrentWindow ? tauri.window.getCurrentWindow() : null;

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
        const icon = notificationIcons[type] || notificationIcons.info;
        try {
            await api.sendNotification({ title, body, icon });
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
                title: String(raw.title || t('common.unknownTitle', 'Unknown title')),
                thumbnail: String(raw.thumbnail || ''),
                status: sanitizeStatus(raw.status) === 'downloading' ? 'pending' : sanitizeStatus(raw.status),
                progress: sanitizeStatus(raw.status) === 'downloading' ? 0 : clamp(raw.progress),
                eta: String(raw.eta || '--'),
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
                    id: i.id, title: i.title, thumbnail: i.thumbnail, status: i.status, progress: i.progress, eta: i.eta,
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
            const taskId = await invoke('start_download', { options: { ...item.payload, client_task_id: String(item.id) } });
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
        if (item.startReason === 'download' || item.startReason === 'queue-manual') notifySuccessDownload();
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
        logConsole(item, payload);
        if (payload.type === 'progress' || payload.type === 'progress_ffmpeg' || typeof payload.percent !== 'undefined' || typeof payload.progress !== 'undefined') {
            let p = payload.percent;
            if (typeof p === 'undefined') p = payload.progress;
            if (typeof p === 'undefined') p = payload.percentage;
            let n = Number(p);
            if (Number.isFinite(n) && n <= 1) n *= 100;
            item.progress = clamp(n);
            if (typeof payload.eta_seconds !== 'undefined') item.eta = eta(payload.eta_seconds);
            else if (typeof payload.eta !== 'undefined') item.eta = typeof payload.eta === 'number' ? eta(payload.eta) : String(payload.eta);
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
        if (spans[0]) spans[0].textContent = `${Math.round(item.progress)}%`;
        if (spans[1]) spans[1].textContent = `${t('common.eta', 'ETA')} ${item.eta || '--'}`;
    }

    function infoLine(payload) {
        const mode = String(payload.mode || 'video').toLowerCase();
        const format = mode === 'audio' ? String(payload.audio_format || '--').toUpperCase() : String(payload.video_format || '--').toUpperCase();
        const quality = mode === 'audio' ? String(payload.audio_quality || '--') : String(payload.video_quality || '--');
        const subtitleState = payload.download_subs || payload.download_chat
            ? t('queue.subtitles.on', 'ON')
            : t('queue.subtitles.off', 'OFF');
        const subs = `${t('queue.subtitles.label', 'Subtitles')}: ${subtitleState}`;
        return `${format} | ${quality} | ${subs}`;
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
                const mode = String(item.payload.mode || 'video').toLowerCase();
                const modeIcon = mode === 'audio' ? icons.audio : icons.video;
                const el = document.createElement('div');
                el.className = `queue-item status-${item.status}`;
                el.dataset.id = item.id;
                el.innerHTML = `
                    <div class="queue-item-bg" style="background-image:${item.thumbnail ? `url('${item.thumbnail.replace(/'/g, '\\\'')}')` : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45))'}"></div>
                    <div class="queue-item-content">
                        <div class="queue-item-title-row"><span class="queue-mode-icon">${modeIcon}</span><div class="queue-item-title">${esc(item.title)}</div></div>
                        <div class="queue-item-details">${esc(infoLine(item.payload))}</div>
                        <div class="queue-item-progress-wrap">
                            <div class="queue-progress-bar"><div class="queue-progress-fill" style="width:${Math.round(item.progress)}%"></div></div>
                            <div class="queue-progress-meta"><span>${Math.round(item.progress)}%</span><span>${esc(t('common.eta', 'ETA'))} ${item.eta || '--'}</span></div>
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
        if (action === 'console') openConsole(id);
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
                consoleLogs.delete(id);
                if (consoleState.openId === id) closeConsole();
                render();
                persistSoon();
                updateQueueBtn();
            }, { once: true });
            return;
        }
        state.items.splice(idx, 1);
        consoleLogs.delete(id);
        if (consoleState.openId === id) closeConsole();
        render();
        persistSoon();
        updateQueueBtn();
    }

    async function openLocation(id) {
        const item = state.items.find((x) => x.id === id);
        if (!item || !item.path) return;
        if (invoke) {
            try {
                await invoke('open_in_file_manager', { path: String(item.path) });
                return;
            } catch (e) {
                console.error('Open location via backend failed, falling back to opener:', e);
            }
        }
        if (tauri.opener?.openPath) {
            try {
                await tauri.opener.openPath(item.path);
                return;
            } catch (e) {
                console.error('Open path failed, falling back to reveal:', e);
            }
        }
        if (tauri.opener?.revealItemInDir) {
            try {
                await tauri.opener.revealItemInDir(item.path);
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
            const keepIds = new Set(state.activeItemIds);
            for (const key of consoleLogs.keys()) {
                if (!keepIds.has(key)) consoleLogs.delete(key);
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
        consoleLogs.clear();
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
            title: meta?.title ? String(meta.title) : t('common.unknownTitle', 'Unknown title'),
            thumbnail: meta?.thumbnail ? String(meta.thumbnail) : '',
            status: 'pending',
            progress: 0,
            eta: '--',
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
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.downloadCompletedSystem', 'Download completed.'),
            'success'
        );
    }
    function notifyQueueSuccess() {
        if (window.notifier) {
            window.notifier.show(
                t('common.success', 'Success'),
                t('queue.notifications.queueCompleted', 'Queue downloads completed successfully.'),
                'success',
                false
            );
        }
        sendSystemNotification(
            t('queue.notifications.systemTitle', 'Pulsar'),
            t('queue.notifications.queueCompletedSystem', 'Queue downloads completed.'),
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