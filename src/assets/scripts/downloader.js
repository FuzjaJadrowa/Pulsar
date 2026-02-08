{
    const { invoke } = window.__TAURI__.core;

    const initUI = () => {
        const audioCheck = document.getElementById('audio-only-check');
        const subsCheck = document.getElementById('subs-check');
        const chatCheck = document.getElementById('chat-check');
        const advBtn = document.getElementById('advanced-toggle-btn');

        if (!audioCheck || !advBtn) return;

        const updateAudioState = () => {
            const isAudio = audioCheck.checked;
            const vFmt = document.getElementById('video-fmt');
            const vQual = document.getElementById('video-qual');
            const aFmt = document.getElementById('audio-fmt');
            const aQual = document.getElementById('audio-qual');

            if(vFmt) vFmt.disabled = isAudio;
            if(vQual) vQual.disabled = isAudio;
            if(aFmt) aFmt.disabled = !isAudio;
            if(aQual) aQual.disabled = !isAudio;
        };

        const updateSubsState = () => {
            const hasSubs = subsCheck.checked;
            const sCode = document.getElementById('subs-code');
            if(sCode) sCode.disabled = !hasSubs;
            if(hasSubs && chatCheck) chatCheck.checked = false;
        };

        const updateChatState = () => {
            if(chatCheck.checked && subsCheck) {
                subsCheck.checked = false;
                updateSubsState();
            }
        };

        audioCheck.onchange = updateAudioState;
        if(subsCheck) subsCheck.onchange = updateSubsState;
        if(chatCheck) chatCheck.onchange = updateChatState;

        advBtn.onclick = function() {
            const content = document.getElementById('adv-content');
            const isOpen = content.classList.contains('open');
            if (isOpen) {
                content.classList.remove('open');
                this.innerText = "Advanced Settings ▼";
            } else {
                content.classList.add('open');
                this.innerText = "Advanced Settings ▲";
            }
        };

        updateAudioState();
        if (window.initCustomSelects) window.initCustomSelects();
    };

    initUI();

    window.addToQueueSim = function() {
        const urlInput = document.getElementById('url-input');
        const pathInput = document.getElementById('path-input');

        if (!urlInput.value || !pathInput.value) {
            window.notifier.show("Error", "Missing information. Make sure the path and link fields are completed.", "error");
            return;
        }

        const qBtn = document.getElementById('btn-queue');
        if(qBtn) qBtn.style.display = 'flex';

        window.notifier.show("Success", "Added to queue (Simulation)", "success");
    }

    window.startDownload = async function() {
        const urlInput = document.getElementById('url-input');
        const pathInput = document.getElementById('path-input');

        if (!urlInput || !pathInput) {
            console.error("Inputs not found!");
            return;
        }

        const url = urlInput.value;
        const path = pathInput.value;

        if (!url || !path) {
            window.notifier.show("Error", "Missing information. Make sure the path and link fields are completed.", "error");
            return;
        }

        const timeInputs = document.querySelectorAll('.custom-input[style*="text-align: center"]');
        const startTime = timeInputs.length > 0 ? timeInputs[0].value : "";
        const endTime = timeInputs.length > 1 ? timeInputs[1].value : "";

        const options = {
            url: url,
            path: path,
            audio_only: document.getElementById('audio-only-check').checked,
            video_format: document.getElementById('video-fmt').value,
            video_quality: document.getElementById('video-qual').value,
            audio_format: document.getElementById('audio-fmt').value,
            audio_quality: document.getElementById('audio-qual').value,
            download_subs: document.getElementById('subs-check').checked,
            subs_lang: document.getElementById('subs-code').value,
            download_chat: document.getElementById('chat-check').checked,
            start_time: startTime,
            end_time: endTime,
            custom_args: document.querySelector('#adv-content input').value || ""
        };

        console.log("Sending download request:", options);

        try {
            const taskId = await invoke('start_download', { options: options });
            console.log("Download started successfully. Task ID:", taskId);
        } catch (error) {
            console.error("Failed to start download:", error);
            window.notifier.show("Error", `Failed to start download: ${error}`, "error");
        }
    };
}