// options.js - 設定頁面邏輯
const $ = s => document.querySelector(s);
const modelSelect = $("#model");
const refreshModelsButton = $("#refreshModels");
const modelsLoadingIndicator = $("#modelsLoadingIndicator");
const apiProviderOllama = $("#apiProviderOllama");
const apiProviderLmstudio = $("#apiProviderLmstudio");
const apiUrlInput = $("#apiUrl");


// 預設設定值
const defaults = {
    detail: "medium",
    apiProvider: "ollama", 
    apiUrl: "http://localhost:11434", 
    model:  "qwen2:7b-instruct", // Default model example
    font:   "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // AI request timeout in seconds (預設120秒)
    showErr: false,
    directOutput: false,
    pinQuestionArea: false
};

function showSaveStatus(message, isError = false) {
    const statusElement = $("#save-status");
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'status-message status-error' : 'status-message status-success';
        setTimeout(() => {
            statusElement.textContent = "";
            statusElement.className = 'status-message';
        }, 3000);
    } else {
        alert(message);
    }
}

chrome.storage.sync.get(defaults, loadUI);

async function loadUI(cfg) { // <<< MODIFIED HERE
    const detailValue = cfg.detail || defaults.detail;
    const detailRadio = $(`[name=detail][value=${detailValue}]`);
    if (detailRadio) detailRadio.checked = true;

    const fontValue = cfg.font || defaults.font;
    const fontRadio = $(`[name=font][value=${fontValue}]`);
    if (fontRadio) fontRadio.checked = true;

    const apiProviderValue = cfg.apiProvider || defaults.apiProvider;
    const apiProviderRadio = $(`[name=apiProvider][value=${apiProviderValue}]`);
    if (apiProviderRadio) apiProviderRadio.checked = true;

    $("#apiUrl").value     = cfg.apiUrl || defaults.apiUrl;
    // $("#model").value will be populated by populateModelDropdown
    $("#outputLanguage").value = cfg.outputLanguage || defaults.outputLanguage;
    $("#panelWidth").value = cfg.panelWidth || defaults.panelWidth;
    $("#aiTimeout").value  = cfg.aiTimeout || defaults.aiTimeout; // Load AI timeout (seconds)
    $("#showErr").checked  = typeof cfg.showErr === 'boolean' ? cfg.showErr : defaults.showErr;
    $("#directOutputToggle").checked = typeof cfg.directOutput === 'boolean' ? cfg.directOutput : defaults.directOutput;
    $("#pinQuestionAreaToggle").checked = typeof cfg.pinQuestionArea === 'boolean' ? cfg.pinQuestionArea : defaults.pinQuestionArea;

    // Populate models after other settings are loaded
    await populateModelDropdown(cfg.model);
}

async function fetchAvailableModels() {
    const currentApiProvider = apiProviderOllama.checked ? "ollama" : "lmstudio";
    const currentApiUrl = apiUrlInput.value.trim();

    modelsLoadingIndicator.style.display = "inline";
    refreshModelsButton.disabled = true;
    modelSelect.disabled = true;

    let fetchUrl = "";
    if (!currentApiUrl || !(currentApiUrl.startsWith("http://") || currentApiUrl.startsWith("https://"))) {
        showSaveStatus("❌ API 位址無效。", true);
        modelsLoadingIndicator.style.display = "none";
        refreshModelsButton.disabled = false;
        modelSelect.disabled = false;
        return [];
    }

    if (currentApiProvider === "ollama") {
        fetchUrl = currentApiUrl.replace(/\/+$/, '') + '/api/tags';
    } else if (currentApiProvider === "lmstudio") {
        fetchUrl = currentApiUrl.replace(/\/+$/, '') + '/v1/models';
    } else {
        modelsLoadingIndicator.style.display = "none";
        refreshModelsButton.disabled = false;
        modelSelect.disabled = false;
        return []; // Should not happen
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            showSaveStatus(`❌ 無法取得模型列表 (HTTP ${response.status})。`, true);
            return [];
        }
        const data = await response.json();
        if (currentApiProvider === "ollama" && data.models && Array.isArray(data.models)) {
            return data.models.map(m => m.name).sort();
        } else if (currentApiProvider === "lmstudio" && data.data && Array.isArray(data.data)) {
            return data.data.map(m => m.id).sort();
        } else {
            showSaveStatus("❌ 模型列表格式錯誤。", true);
            return [];
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            showSaveStatus("❌ 取得模型列表超時。", true);
        } else {
            showSaveStatus(`❌ 取得模型列表失敗: ${error.message}`, true);
        }
        return [];
    } finally {
        modelsLoadingIndicator.style.display = "none";
        refreshModelsButton.disabled = false;
        modelSelect.disabled = false;
    }
}

async function populateModelDropdown(selectedModelFromStorage) {
    const models = await fetchAvailableModels();
    const previouslySelectedValue = modelSelect.value; // Save current selection before clearing
    modelSelect.innerHTML = ""; // Clear existing options

    if (models.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "未能載入或無可用模型";
        option.disabled = true;
        modelSelect.appendChild(option);
        // Keep showSaveStatus for fetchAvailableModels for more specific errors.
        // showSaveStatus("⚠️ 未能載入模型列表，或無可用模型。", true); 
        return;
    }

    let foundSelectedModel = false;
    models.forEach(modelName => {
        const option = document.createElement("option");
        option.value = modelName;
        option.textContent = modelName;
        if (modelName === selectedModelFromStorage) {
            option.selected = true;
            foundSelectedModel = true;
        }
        modelSelect.appendChild(option);
    });

    if (selectedModelFromStorage && !foundSelectedModel) {
        showSaveStatus(`⚠️ 先前選擇的模型 (${selectedModelFromStorage}) 不在目前列表中。已選擇第一個可用模型。`, false);
        if (modelSelect.options.length > 0) {
            modelSelect.options[0].selected = true; // Select the first model as a fallback
        }
    } else if (!selectedModelFromStorage && models.length > 0) {
        // If no model was pre-selected (e.g. first load with defaults), select the first one
        modelSelect.options[0].selected = true;
    }
}


$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");
    const apiProviderChecked = $("[name=apiProvider]:checked");
    const aiTimeoutValue = parseInt($("#aiTimeout").value, 10);

    const selectedModelValue = modelSelect.value;

    const data = {
        detail: detailChecked ? detailChecked.value : defaults.detail,
        font:   fontChecked ? fontChecked.value : defaults.font,
        apiProvider: apiProviderChecked ? apiProviderChecked.value : defaults.apiProvider,
        apiUrl: apiUrlInput.value.trim() || defaults.apiUrl,
        model:  selectedModelValue && selectedModelValue !== "未能載入或無可用模型" ? selectedModelValue : defaults.model,
        outputLanguage: $("#outputLanguage").value.trim() || defaults.outputLanguage,
        panelWidth: Math.min(
            Math.max(parseInt($("#panelWidth").value, 10) || defaults.panelWidth, 320),
            800
        ),
        // Save AI timeout in seconds, min 5s
        aiTimeout: (aiTimeoutValue && aiTimeoutValue >= 5) ? aiTimeoutValue : defaults.aiTimeout,
        showErr: $("#showErr").checked,
        directOutput: $("#directOutputToggle").checked,
        pinQuestionArea: $("#pinQuestionAreaToggle").checked
    };
    chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
            showSaveStatus("❌ 儲存失敗: " + chrome.runtime.lastError.message, true);
        } else {
            showSaveStatus("✅ 設定已儲存！部分設定可能需重新開啟側邊欄生效。", false);
        }
    });
};

$("#reset").onclick = async () => { // Made async for populateModelDropdown
    if (confirm("您確定要將所有設定恢復為預設值嗎？")) {
        await chrome.storage.sync.set(defaults); // Ensure set completes before loadUI
        await loadUI(defaults); // loadUI is now async
        showSaveStatus("🔄 已恢復為預設值！", false);
    }
};

refreshModelsButton.onclick = async () => {
    // Pass the currently selected model value to try and preserve it
    await populateModelDropdown(modelSelect.value);
};

apiProviderOllama.addEventListener('change', async () => {
    await populateModelDropdown(); // Load models for the new provider
});
apiProviderLmstudio.addEventListener('change', async () => {
    await populateModelDropdown(); // Load models for the new provider
});
apiUrlInput.addEventListener('blur', async () => {
    await populateModelDropdown(modelSelect.value); // Refresh models if URL changed
});

// Initial load is handled by chrome.storage.sync.get(defaults, loadUI); at the top.
// loadUI itself is now async and calls populateModelDropdown.