(function initSearch() {
    const tauriCore = window.__TAURI__.core;
    const tauriEvent = window.__TAURI__.event;
    if (!tauriCore || !tauriEvent) return;

    const { invoke } = tauriCore;
    const { listen } = tauriEvent;

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

    const body = document.body;
    const searchSection = document.getElementById('search-section');
    const dashboard = document.getElementById('dashboard-section');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const providerPanel = document.getElementById('search-provider-panel');
    const providerButtons = providerPanel ? Array.from(providerPanel.querySelectorAll('.provider-btn')) : [];
    const resultsSection = document.getElementById('search-results-section');
    const resultsGrid = document.getElementById('search-results-grid');
    const resultsCount = document.getElementById('search-results-count');

    if (!urlInput || !fetchBtn || !resultsSection || !resultsGrid || !searchSection) return;

    let currentSearchId = null;
    let pendingMetadataId = null;
    let pendingMetadataBtn = null;
    let isSearching = false;
    let maxSearchResults = 10;
    let selectedBasePrefix = 'ytsearch';
    let selectedPrefix = buildProviderPrefix(selectedBasePrefix);

    function clampSearchLimit(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 10;
        const rounded = Math.floor(parsed);
        if (rounded < 1) return 1;
        if (rounded > 50) return 50;
        return rounded;
    }

    function extractBasePrefix(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return 'ytsearch';
        return raw.replace(/\d+$/, '') || 'ytsearch';
    }

    function buildProviderPrefix(value) {
        const base = extractBasePrefix(value);
        return `${base}${maxSearchResults}`;
    }

    function applyMaxSearchResults(value) {
        maxSearchResults = clampSearchLimit(value);
        selectedPrefix = buildProviderPrefix(selectedBasePrefix);
    }

    async function loadSearchConfig() {
        try {
            const config = await invoke('get_config');
            if (config && typeof config.maximum_search_results !== 'undefined') {
                applyMaxSearchResults(config.maximum_search_results);
            }
        } catch (error) {
            console.error('Failed to load search config:', error);
        }
    }

    function triggerShake(element) {
        if (element) {
            element.classList.remove('shake-feedback');
            void element.offsetWidth;
            element.classList.add('shake-feedback');
            return;
        }
        if (window.downloaderUi && typeof window.downloaderUi.triggerShake === 'function') {
            window.downloaderUi.triggerShake(urlInput);
        }
    }

    function looksLikeUrl(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return false;
        return /^https?:\/\//i.test(trimmed);
    }

    function setProviderPanelVisible(visible) {
        if (!providerPanel) return;
        providerPanel.classList.toggle('visible', visible);
        providerPanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
        searchSection.classList.toggle('has-provider-panel', visible);
        if (window.downloaderUi && typeof window.downloaderUi.updateRadarAnchor === 'function') {
            window.downloaderUi.updateRadarAnchor();
        }
    }

    function updateProviderPanelVisibility() {
        const raw = urlInput.value.trim();
        const hasQuery = raw.length > 0 && !looksLikeUrl(raw);
        const resultsHidden = resultsSection ? resultsSection.classList.contains('hidden') : true;
        const dashboardHidden = dashboard ? dashboard.classList.contains('hidden') : true;
        const shouldShow = hasQuery && resultsHidden && dashboardHidden && !isSearching;
        setProviderPanelVisible(shouldShow);
    }

    function applyProviderSelection(button) {
        if (!button) return;
        providerButtons.forEach((btn) => {
            btn.classList.toggle('active', btn === button);
            btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
        });
        selectedBasePrefix = extractBasePrefix(button.dataset.prefix || 'ytsearch');
        selectedPrefix = buildProviderPrefix(selectedBasePrefix);
    }

    function formatDuration(totalSeconds) {
        const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
        const hrs = Math.floor(safe / 3600);
        const min = Math.floor((safe % 3600) / 60);
        const sec = safe % 60;
        if (hrs > 0) {
            return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        }
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    function resolveResultUrl(entry) {
        const raw = String(entry?.url || '').trim();
        if (raw) {
            if (/^https?:\/\//i.test(raw)) return raw;
            if (raw.startsWith('www.')) return `https://${raw}`;
            if (/^[\w-]{11}$/.test(raw)) return `https://www.youtube.com/watch?v=${raw}`;
            return raw;
        }
        const id = String(entry?.id || '').trim();
        if (id) return `https://www.youtube.com/watch?v=${id}`;
        return '';
    }

    function clearResults() {
        resultsGrid.innerHTML = '';
    }

    function setResultsCount(count) {
        if (!resultsCount) return;
        if (typeof count === 'number') {
            resultsCount.textContent = t('downloader.search.resultsCount', '{count} results', { count });
        } else {
            resultsCount.textContent = '';
        }
    }

    function showSearchEmpty() {
        clearResults();
        const empty = document.createElement('div');
        empty.className = 'search-results-empty';
        empty.textContent = t('downloader.search.empty', 'No results.');
        resultsGrid.appendChild(empty);
        setResultsCount(0);
    }

    function prepareSearchLayout() {
        searchSection.classList.remove('centered');
        searchSection.classList.add('sticky');
        if (dashboard) dashboard.classList.add('hidden');
        if (body) body.classList.remove('mode-video', 'mode-audio');
    }

    function revealResultsSection() {
        if (body) body.classList.add('search-mode');
        resultsSection.classList.remove('hidden');
        resultsSection.classList.remove('exiting');
    }

    function exitSearchMode() {
        resultsSection.classList.add('exiting');
        if (body) body.classList.remove('search-mode');
        setTimeout(() => {
            resultsSection.classList.add('hidden');
            resultsSection.classList.remove('exiting');
            clearResults();
            setResultsCount(null);
        }, 320);
    }

    function resetSearchIfEmpty() {
        if (urlInput.value.trim() !== '') return;
        currentSearchId = null;
        isSearching = false;
        pendingMetadataId = null;
        pendingMetadataBtn = null;
        setProviderPanelVisible(false);
        if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
            window.downloaderUi.setFetchLoading(false);
        }
        if (!resultsSection.classList.contains('hidden')) {
            resultsSection.classList.add('hidden');
            resultsSection.classList.remove('exiting');
        }
        if (body) body.classList.remove('search-mode');
        clearResults();
        setResultsCount(null);
    }

    async function startSearch(query, prefixOverride = null) {
        if (isSearching) return;
        isSearching = true;
        currentSearchId = null;
        pendingMetadataId = null;
        pendingMetadataBtn = null;
        const prefix = prefixOverride ? buildProviderPrefix(prefixOverride) : (selectedPrefix || buildProviderPrefix('ytsearch'));

        setProviderPanelVisible(false);
        if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
            window.downloaderUi.setFetchLoading(true);
        }
        if (!resultsSection.classList.contains('hidden')) {
            resultsSection.classList.add('hidden');
            resultsSection.classList.remove('exiting');
        }
        if (body) body.classList.remove('search-mode', 'mode-video', 'mode-audio');
        if (dashboard) dashboard.classList.add('hidden');
        clearResults();
        setResultsCount(null);

        try {
            const taskId = await invoke('search', { query, prefix });
            currentSearchId = taskId;
        } catch (error) {
            isSearching = false;
            if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
                window.downloaderUi.setFetchLoading(false);
            }
            console.error('Search failed:', error);
            if (window.notifier) {
                window.notifier.show(
                    t('common.error', 'Error'),
                    t('downloader.errors.searchFailed', 'Search failed.'),
                    'error',
                    false
                );
            }
            showSearchEmpty();
        }
    }

    async function handleFetch() {
        const raw = urlInput.value.trim();
        if (!raw) {
            triggerShake(urlInput);
            return;
        }

        if (looksLikeUrl(raw)) {
            isSearching = false;
            currentSearchId = null;
            setProviderPanelVisible(false);
            if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
                window.downloaderUi.setFetchLoading(false);
            }
            exitSearchMode();
            if (window.downloaderUi && typeof window.downloaderUi.startMetadataForUrl === 'function') {
                await window.downloaderUi.startMetadataForUrl(raw);
            }
            return;
        }

        startSearch(raw);
    }

    function setButtonLoading(button, loading) {
        if (!button) return;
        button.disabled = !!loading;
        button.classList.toggle('loading', !!loading);
    }

    function renderResults(entries) {
        clearResults();
        const data = Array.isArray(entries) ? entries.slice(0, maxSearchResults) : [];
        if (!data.length) {
            showSearchEmpty();
            return;
        }
        setResultsCount(data.length);

        data.forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'search-result-card fade-in';
            const thumbnail = entry.thumbnail || '';
            if (thumbnail) {
                card.style.setProperty('--thumb-url', `url('${thumbnail}')`);
            } else {
                card.style.setProperty('--thumb-url', 'linear-gradient(135deg, #1c1c2b, #151515)');
            }

            const content = document.createElement('div');
            content.className = 'search-result-content';

            const title = document.createElement('div');
            title.className = 'search-result-title';
            title.textContent = entry.title || t('common.unknownTitle', 'Unknown title');

            const meta = document.createElement('div');
            meta.className = 'search-result-meta';
            const author = entry.uploader
                || entry.channel
                || entry.uploader_id
                || entry.channel_id
                || t('common.unknownChannel', 'Unknown channel');
            const durationText = entry.duration_string || entry.durationString;
            const durationRaw = entry.duration;
            const durationSeconds = Number(durationRaw);
            let duration = '--:--';
            if (durationText) {
                duration = durationText;
            } else if (typeof durationRaw === 'string' && durationRaw.includes(':')) {
                duration = durationRaw;
            } else if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                duration = formatDuration(durationSeconds);
            }
            meta.textContent = `${author} • ${duration}`;

            content.appendChild(title);
            content.appendChild(meta);

            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'search-result-action';
            action.setAttribute('aria-label', 'Select');
            action.innerHTML = `
                <span class="action-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                </span>
                <span class="action-spinner"><span class="search-action-spinner"></span></span>
            `;

            action.onclick = async () => {
                if (pendingMetadataId) return;
                const targetUrl = resolveResultUrl(entry);
                if (!targetUrl) {
                    triggerShake(action);
                    return;
                }
                setButtonLoading(action, true);
                pendingMetadataBtn = action;

                if (window.downloaderUi && typeof window.downloaderUi.startMetadataForUrl === 'function') {
                    const taskId = await window.downloaderUi.startMetadataForUrl(targetUrl);
                    if (taskId) {
                        pendingMetadataId = taskId;
                    } else {
                        setButtonLoading(action, false);
                        pendingMetadataBtn = null;
                        pendingMetadataId = null;
                    }
                }
            };

            card.appendChild(action);
            card.appendChild(content);
            resultsGrid.appendChild(card);
        });
    }

    fetchBtn.onclick = handleFetch;
    urlInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleFetch();
            urlInput.blur();
        }
    };

    urlInput.addEventListener('input', () => {
        resetSearchIfEmpty();
        updateProviderPanelVisibility();
    });

    listen('download-event', (event) => {
        const payload = event.payload;
        if (!payload || !payload.type) return;

        if (payload.type === 'search_results' && payload.id === currentSearchId) {
            isSearching = false;
            if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
                window.downloaderUi.setFetchLoading(false);
            }
            const results = payload.data || [];
            const shouldAnimate = searchSection.classList.contains('centered');
            prepareSearchLayout();
            renderResults(results);
            if (shouldAnimate) {
                setTimeout(revealResultsSection, 420);
            } else {
                revealResultsSection();
            }
            setProviderPanelVisible(false);
            return;
        }

        if (payload.type === 'finished' && payload.id === currentSearchId && payload.success === false) {
            isSearching = false;
            if (window.downloaderUi && typeof window.downloaderUi.setFetchLoading === 'function') {
                window.downloaderUi.setFetchLoading(false);
            }
            updateProviderPanelVisibility();
            if (window.notifier) {
                window.notifier.show(
                    t('common.error', 'Error'),
                    payload.error || t('downloader.errors.searchFailed', 'Search failed.'),
                    'error',
                    false
                );
            }
            return;
        }

        if (payload.type === 'metadata' && payload.success) {
            setProviderPanelVisible(false);
        }

        if (pendingMetadataId && payload.id === pendingMetadataId) {
            if (payload.type === 'metadata' && payload.success) {
                if (pendingMetadataBtn) setButtonLoading(pendingMetadataBtn, false);
                pendingMetadataBtn = null;
                pendingMetadataId = null;
                exitSearchMode();
                return;
            }
            if (payload.type === 'finished' && payload.success === false) {
                if (pendingMetadataBtn) setButtonLoading(pendingMetadataBtn, false);
                pendingMetadataBtn = null;
                pendingMetadataId = null;
            }
        }
    });

    if (providerButtons.length) {
        const initial = providerButtons.find((btn) => btn.classList.contains('active')) || providerButtons[0];
        if (initial) applyProviderSelection(initial);
        providerButtons.forEach((btn) => {
            btn.addEventListener('click', () => applyProviderSelection(btn));
        });
    }
    window.addEventListener('pulsar-config-updated', (event) => {
        if (!event?.detail) return;
        if (typeof event.detail.maximum_search_results !== 'undefined') {
            applyMaxSearchResults(event.detail.maximum_search_results);
        }
    });
    loadSearchConfig();
    updateProviderPanelVisibility();

    window.searchUi = {
        startSearch: (query, prefixOverride = null) => startSearch(query, prefixOverride),
        handleFetch: () => handleFetch()
    };
})();