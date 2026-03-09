(() => {
    const tauriCore = window.__TAURI__ && window.__TAURI__.core;
    const invoke = tauriCore && tauriCore.invoke ? tauriCore.invoke : null;
    const root = document.querySelector('.compressor-page');
    if (!root) return;

    const pathInput = root.querySelector('#compress-path-input');
    const browseBtn = root.querySelector('#compress-browse-btn');
    const confirmBtn = root.querySelector('#compress-confirm-btn');

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
            console.error('Failed to pick compressor file:', error);
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