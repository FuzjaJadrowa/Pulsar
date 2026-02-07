const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

let isAppLoaded = false;
let currentPageIndex = 0;
let currentPageName = null;
let queueVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('minimize-btn')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('maximize-btn')?.addEventListener('click', () => appWindow.toggleMaximize());
    document.getElementById('close-btn')?.addEventListener('click', () => appWindow.close());

    await setupSplashListeners();

    window.initCustomSelects();
    document.addEventListener('click', window.closeAllSelects);

    invoke('run_splash_checks').catch(err => {
        console.error("Failed to invoke splash checks:", err);
        finishSplash();
    });
});

const splashScreen = document.getElementById('splash-screen');
const appContent = document.getElementById('app-content');
const statusLabel = document.getElementById('splash-status');
const progressLabel = document.getElementById('splash-progress');
const skipBtn = document.getElementById('splash-skip-btn');

function finishSplash() {
    if (isAppLoaded) return;
    isAppLoaded = true;

    if (splashScreen) {
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 500);
    }

    if (appContent) {
        appContent.style.opacity = '1';
    }

    loadPage('downloader', 0);
}

if (skipBtn) {
    skipBtn.addEventListener('click', () => {
        finishSplash();
    });
}

async function setupSplashListeners() {
    try {
        await listen('splash-status', (event) => {
            const payload = event.payload;
            if (statusLabel) statusLabel.innerText = payload.status;

            if (skipBtn) {
                if (payload.can_skip) {
                    skipBtn.style.display = 'inline-block';
                } else {
                    skipBtn.style.display = 'none';
                }
            }

            if (!payload.is_downloading && progressLabel) {
                progressLabel.innerText = "";
            }
        });

        await listen('splash-progress', (event) => {
            const payload = event.payload;
            if (payload.progress && progressLabel) {
                progressLabel.innerText = payload.progress;
            }
        });

        await listen('splash-finished', () => {
            finishSplash();
        });
    } catch (error) {
        console.error("Błąd uprawnień Tauri (event.listen). Sprawdź capabilities/default.json:", error);
        setTimeout(finishSplash, 2000);
    }
}

window.initCustomSelects = function() {
    const selects = document.querySelectorAll('select.custom-select');
    selects.forEach(origSelect => {
        if (origSelect.nextElementSibling && origSelect.nextElementSibling.classList.contains('select-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        if (origSelect.style.width) wrapper.style.width = origSelect.style.width;

        const head = document.createElement('div');
        head.className = 'select-head';
        if (origSelect.options.length > 0) {
            head.innerText = origSelect.options[origSelect.selectedIndex].text;
        }

        const list = document.createElement('div');
        list.className = 'select-list';

        Array.from(origSelect.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'select-item';
            if(opt.selected) item.classList.add('selected');
            item.innerText = opt.text;
            item.addEventListener('click', () => {
                head.innerText = opt.text;
                list.querySelectorAll('.select-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                origSelect.value = opt.value;
                origSelect.dispatchEvent(new Event('change'));
                window.closeAllSelects();
            });
            list.appendChild(item);
        });

        head.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = head.classList.contains('open');
            window.closeAllSelects();
            if (!wasOpen) { head.classList.add('open'); list.classList.add('open'); }
        });

        wrapper.appendChild(head);
        wrapper.appendChild(list);
        origSelect.parentNode.insertBefore(wrapper, origSelect.nextSibling);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'disabled') {
                    if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
                    else { head.style.opacity = '1'; head.style.pointerEvents = 'auto'; }
                }
            });
        });
        observer.observe(origSelect, { attributes: true });

        if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
    });
};

window.closeAllSelects = function() {
    document.querySelectorAll('.select-head').forEach(h => h.classList.remove('open'));
    document.querySelectorAll('.select-list').forEach(l => l.classList.remove('open'));
};

async function loadPage(pageName, pageIndex) {
    if (currentPageName === pageName) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${pageName}`);
    if(navBtn) navBtn.classList.add('active');

    try {
        const response = await fetch(`app/${pageName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const html = await response.text();
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = html;

        const container = contentArea.querySelector('.page-container');
        if (container) {
            if (pageIndex > currentPageIndex) {
                container.classList.add('slide-in-right');
            } else if (pageIndex < currentPageIndex) {
                container.classList.add('slide-in-left');
            } else {
                container.classList.add('slide-in-right');
            }
        }

        currentPageIndex = pageIndex;
        currentPageName = pageName;

        const scripts = contentArea.querySelectorAll("script");
        scripts.forEach(oldScript => {
            const newScript = document.createElement("script");
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });

        window.initCustomSelects();

    } catch (err) {
        console.error('Failed to load page:', err);
    }
}

window.toggleQueue = async function() {
    const panel = document.getElementById('queue-panel');
    const btn = document.getElementById('btn-queue');
    if (!panel || !btn) return;

    if (!queueVisible) {
        if(panel.innerHTML.trim() === "") {
            try {
                const res = await fetch('app/queue.html');
                if(res.ok) panel.innerHTML = await res.text();
            } catch(e) { console.error("Error loading queue:", e); }
        }
        panel.style.display = 'block';
        panel.animate([{opacity: 0, transform: 'translateY(-20px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 250, easing: 'ease-out'});
        btn.classList.add('active');
    } else {
        const anim = panel.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(-20px)'}], {duration: 200});
        anim.onfinish = () => panel.style.display = 'none';
        btn.classList.remove('active');
    }
    queueVisible = !queueVisible;
};