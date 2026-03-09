(() => {
    const tauriCore = window.__TAURI__ && window.__TAURI__.core;
    const invoke = tauriCore && tauriCore.invoke ? tauriCore.invoke : null;
    const root = document.querySelector('.converter-page');
    if (!root) return;

    const pathInput = root.querySelector('#convert-path-input');
    const browseBtn = root.querySelector('#convert-browse-btn');
    const confirmBtn = root.querySelector('#convert-confirm-btn');

    const confirmPath = () => {
        if (!pathInput) return;
        if (pathInput.value.trim() === '') return;
    };

    const openPicker = async () => {
        if (!invoke || !pathInput) return;
        try {
            const selected = await invoke('pick_convert_file');
            if (selected) {
                pathInput.value = selected;
                confirmPath();
            }
        } catch (error) {
            console.error('Failed to pick converter file:', error);
        }
    };

    if (browseBtn) {
        browseBtn.addEventListener('click', openPicker);
        browseBtn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPicker();
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmPath);
    }

    if (pathInput) {
        pathInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                confirmPath();
            }
        });
    }
})();