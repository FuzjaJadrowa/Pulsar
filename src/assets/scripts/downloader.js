(function initUi() {
    const body = document.body;
    const searchSection = document.getElementById('search-section');
    const dashboard = document.getElementById('dashboard-section');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');

    const downloadBtn = document.getElementById('download-btn');
    const queueBtn = document.getElementById('queue-btn');
    const browseBtn = document.getElementById('browse-btn');

    const pathInput = document.getElementById('path-input');

    if (!searchSection || !urlInput) return;

    const modeVideoBtn = document.getElementById('mode-video');
    const modeAudioBtn = document.getElementById('mode-audio');
    const formatList = document.getElementById('format-list');
    const qualityList = document.getElementById('quality-list');
    const optionsWrapper = document.getElementById('options-wrapper');
    const thumbBtns = document.querySelectorAll('.thumb-actions .icon-btn-small');
    const thumbPreview = document.querySelector('.thumb-preview');

    const rangeStart = document.getElementById('range-start');
    const rangeEnd = document.getElementById('range-end');
    const rangeFill = document.getElementById('range-fill');
    const timeStartDisplay = document.getElementById('time-start');
    const timeEndDisplay = document.getElementById('time-end');

    let state = {
        mode: 'video',
        isAnalyzed: false,
        duration: 330,
        selectedFormat: null,
        selectedQuality: null
    };

    function activateDashboard() {
        if (!urlInput.value || urlInput.value.trim() === '') return;

        searchSection.classList.remove('centered');
        searchSection.classList.add('sticky');

        setTimeout(() => {
            dashboard.classList.remove('hidden');
            state.isAnalyzed = true;
            thumbPreview.innerHTML = `<img src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="Thumb">`;
            document.getElementById('meta-title').innerText = "Rick Astley - Never Gonna Give You Up";
            document.getElementById('meta-duration').innerText = formatTime(state.duration);

            setMode('video');
        }, 500);
    }

    function resetToZen() {
        if (urlInput.value.trim() === '') {
            dashboard.classList.add('hidden');
            searchSection.classList.remove('sticky');
            searchSection.classList.add('centered');
            state.isAnalyzed = false;
            state.selectedFormat = null;
            state.selectedQuality = null;
            validateReadyState();
        }
    }

    fetchBtn.onclick = activateDashboard;
    urlInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); activateDashboard(); urlInput.blur(); }};
    urlInput.oninput = resetToZen;

    async function setMode(mode) {
        if (state.mode === mode && state.isAnalyzed) return;
        state.mode = mode;

        if (optionsWrapper) optionsWrapper.classList.add('fading-out');

        await new Promise(r => setTimeout(r, 300));

        body.classList.remove('mode-video', 'mode-audio');
        if (mode === 'video') {
            body.classList.add('mode-video');
            modeVideoBtn.classList.add('active');
            modeAudioBtn.classList.remove('active');
            renderVideoOptions();
        } else {
            body.classList.add('mode-audio');
            modeAudioBtn.classList.add('active');
            modeVideoBtn.classList.remove('active');
            renderAudioOptions();
        }

        state.selectedFormat = null;
        state.selectedQuality = null;
        validateReadyState();
        updateSlider();

        if (optionsWrapper) optionsWrapper.classList.remove('fading-out');
    }

    modeVideoBtn.onclick = () => setMode('video');
    modeAudioBtn.onclick = () => setMode('audio');


    function createTile(text, subtext = '') {
        const div = document.createElement('div');
        div.className = 'tile';
        div.innerHTML = `<span>${text}</span> ${subtext ? `<small style="font-size:0.7em; opacity:0.7">${subtext}</small>` : ''}`;

        div.onclick = () => {
            const parent = div.parentElement;
            parent.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
            div.classList.add('active');

            if (parent.id === 'format-list') state.selectedFormat = text;
            if (parent.id === 'quality-list') state.selectedQuality = text;
            validateReadyState();
        };
        return div;
    }

    function renderVideoOptions() {
        formatList.innerHTML = ''; qualityList.innerHTML = '';
        ['MP4', 'MKV', 'WEBM', 'MOV', 'FLV'].forEach(f => formatList.appendChild(createTile(f)));
        ['4K', '1440p', '1080p', '720p', '480p', '360p'].forEach(q => qualityList.appendChild(createTile(q)));
    }

    function renderAudioOptions() {
        formatList.innerHTML = ''; qualityList.innerHTML = '';
        ['MP3', 'M4A', 'FLAC', 'OPUS', 'WAV', 'OGG'].forEach(f => formatList.appendChild(createTile(f)));
        ['320k', '256k', '192k', '128k', '96k'].forEach(q => qualityList.appendChild(createTile(q)));
    }


    browseBtn.onclick = () => {
        pathInput.value = "C:/Downloads/Pulsar";
        validateReadyState();
    };
    pathInput.oninput = validateReadyState;


    function updateSlider() {
        if (!rangeStart) return;
        let min = parseInt(rangeStart.value);
        let max = parseInt(rangeEnd.value);

        if (min > max) { rangeStart.value = max; min = max; }
        if (max < min) { rangeEnd.value = min; max = min; }

        rangeFill.style.left = min + "%";
        rangeFill.style.right = (100 - max) + "%";

        if (document.activeElement !== timeStartDisplay)
            timeStartDisplay.value = formatTime(state.duration * (min/100));

        if (document.activeElement !== timeEndDisplay)
            timeEndDisplay.value = formatTime(state.duration * (max/100));
    }

    function formatTime(s) {
        const min = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `00:${min}:${sec}`;
    }

    if(rangeStart) {
        rangeStart.oninput = updateSlider;
        rangeEnd.oninput = updateSlider;
    }

    [timeStartDisplay, timeEndDisplay].forEach(input => {
        input.onchange = () => {
            console.log("Time manually changed:", input.value);
        };
    });


    thumbBtns.forEach(btn => {
        btn.onclick = () => {
            thumbBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });


    function validateReadyState() {
        const hasPath = pathInput.value.trim().length > 0;
        const isValid = state.selectedFormat && state.selectedQuality && hasPath;

        if (isValid) {
            downloadBtn.removeAttribute('disabled');
            downloadBtn.classList.add('ready');

            queueBtn.removeAttribute('disabled');
            queueBtn.classList.add('ready');
        } else {
            downloadBtn.setAttribute('disabled', 'true');
            downloadBtn.classList.remove('ready');

            queueBtn.setAttribute('disabled', 'true');
            queueBtn.classList.remove('ready');
        }
    }

    updateSlider();
})();