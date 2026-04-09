(function initQueueConsole() {
    if (window.queueConsole) return;

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

    const logs = new Map();
    const state = { openId: null, enabled: false };
    let overlay = null;
    let titleEl = null;
    let bodyEl = null;
    let closeBtn = null;

    const ensureOverlay = () => {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'queue-console-overlay';
        overlay.innerHTML = `
            <div class="queue-console-modal">
                <div class="queue-console-header">
                    <div class="queue-console-title"></div>
                    <button class="queue-console-close" aria-label="Close">&times;</button>
                </div>
                <pre class="queue-console-body"></pre>
            </div>
        `;
        document.body.appendChild(overlay);
        titleEl = overlay.querySelector('.queue-console-title');
        bodyEl = overlay.querySelector('.queue-console-body');
        closeBtn = overlay.querySelector('.queue-console-close');
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });
        if (closeBtn) closeBtn.addEventListener('click', close);
    };

    const updateContent = () => {
        if (!state.openId || !titleEl || !bodyEl) return;
        const id = state.openId;
        const lines = logs.get(id) || [];
        titleEl.textContent = t('queue.console.title', 'Console - {id}', { id });
        bodyEl.textContent = lines.length
            ? lines.join('\n')
            : t('queue.console.empty', 'No console output yet.');
        bodyEl.scrollTop = bodyEl.scrollHeight;
    };

    const open = (id) => {
        if (!state.enabled || !id) return;
        ensureOverlay();
        state.openId = String(id);
        updateContent();
        overlay.classList.add('open');
    };

    const close = () => {
        if (!overlay) return;
        overlay.classList.remove('open');
        state.openId = null;
    };

    const log = (id, payload) => {
        if (!id) return;
        const key = String(id);
        const lines = logs.get(key) || [];
        const timestamp = new Date().toLocaleTimeString();
        let text = '';
        try {
            text = JSON.stringify(payload);
        } catch (_) {
            text = String(payload);
        }
        lines.push(`[${timestamp}] ${text}`);
        // Keep memory bounded for long-running sessions.
        if (lines.length > 250) lines.splice(0, lines.length - 250);
        logs.set(key, lines);
        if (state.openId === key) updateContent();
    };

    const remove = (id) => {
        if (!id) return;
        const key = String(id);
        logs.delete(key);
        if (state.openId === key) close();
    };

    const retain = (ids) => {
        const keep = new Set((ids || []).map((x) => String(x)));
        for (const key of logs.keys()) {
            if (!keep.has(key)) logs.delete(key);
        }
        if (state.openId && !keep.has(state.openId)) close();
    };

    const clear = () => {
        logs.clear();
        close();
    };

    const setEnabled = (enabled) => {
        state.enabled = !!enabled;
        if (!state.enabled) close();
    };

    window.queueConsole = {
        open,
        close,
        log,
        remove,
        retain,
        clear,
        setEnabled
    };
})();