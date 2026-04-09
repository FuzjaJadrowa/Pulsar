(function initI18n() {
    const state = {
        locale: 'en',
        dictionary: {},
        initPromise: null
    };

    function resolveKey(obj, key) {
        if (!obj || !key) return undefined;
        return key.split('.').reduce((acc, part) => {
            if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
                return acc[part];
            }
            return undefined;
        }, obj);
    }

    function interpolate(template, params) {
        if (typeof template !== 'string') return template;
        return template.replace(/\{(\w+)\}/g, (_, token) => {
            if (params && Object.prototype.hasOwnProperty.call(params, token)) {
                return String(params[token]);
            }
            return `{${token}}`;
        });
    }

    async function loadDictionary(locale) {
        const targetLocale = locale || 'en';
        const response = await fetch(`assets/langs/${targetLocale}.json`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load language file: ${response.status}`);
        }
        const json = await response.json();
        state.locale = targetLocale;
        state.dictionary = json && typeof json === 'object' ? json : {};
        return state.dictionary;
    }

    async function init(locale = 'en') {
        if (state.locale === locale && Object.keys(state.dictionary).length > 0) {
            return state.dictionary;
        }
        if (!state.initPromise) {
            // Coalesce concurrent init calls into one fetch.
            state.initPromise = loadDictionary(locale).finally(() => {
                state.initPromise = null;
            });
        }
        return state.initPromise;
    }

    function t(key, fallback = '', params = null) {
        const resolved = resolveKey(state.dictionary, key);
        const base = typeof resolved === 'string' ? resolved : (fallback || key);
        return interpolate(base, params);
    }

    function apply(root = document) {
        if (!root || typeof root.querySelectorAll !== 'function') return;

        root.querySelectorAll('[data-i18n]').forEach((el) => {
            const lockValue = el.getAttribute('data-i18n-lock');
            if (lockValue && lockValue !== 'false') return;
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const fallback = (el.textContent || '').trim();
            el.textContent = t(key, fallback);
        });

        root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (!key) return;
            const fallback = el.getAttribute('placeholder') || '';
            el.setAttribute('placeholder', t(key, fallback));
        });

        root.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            if (!key) return;
            const fallback = el.getAttribute('title') || '';
            el.setAttribute('title', t(key, fallback));
        });

        root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
            const key = el.getAttribute('data-i18n-aria-label');
            if (!key) return;
            const fallback = el.getAttribute('aria-label') || '';
            el.setAttribute('aria-label', t(key, fallback));
        });
    }

    window.i18n = {
        init,
        apply,
        t,
        get locale() {
            return state.locale;
        }
    };
})();