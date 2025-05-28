// options.js - 設定頁面邏輯
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s); // Helper for querySelectorAll

// API Provider and API Key related elements
const apiProviderSelect = $("#apiProvider");
const apiUrlInput = $("#apiUrl");
const chatgptApiKeyInput = $("#chatgptApiKey");
const groqApiKeyInput = $("#groqApiKey");
const geminiApiKeyInput = $("#geminiApiKey");
const deepseekApiKeyInput = $("#deepseekApiKey");

const apiKeyGroups = {
    chatgpt: $(".chatgpt-key-group"),
    groq: $(".groq-key-group"),
    gemini: $(".gemini-key-group"),
    deepseek: $(".deepseek-key-group")
};

// Model related elements
const modelSelect = $("#model");
const cloudModelNameInput = $("#cloudModelNameInput"); // New input field for cloud models
const modelDropdownGroup = $(".model-selection-group"); // The div containing the dropdown and refresh button
const refreshModelsButton = $("#refreshModels");
const modelsLoadingIndicator = $("#modelsLoadingIndicator");
// const modelFormGroup = $(".model-selection-group").closest(".form-group"); // This is the overall form group, still useful for general visibility if needed.

// 預設設定值
const defaults = {
    detail: "medium",
    apiProvider: "ollama",
    apiUrl: "http://localhost:11434",
    model: "qwen2:7b-instruct", // Default model example
    font: "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // AI request timeout in seconds (預設120秒)
    showErr: false,
    directOutput: false,
    pinQuestionArea: false,
    chatgptApiKey: "",
    groqApiKey: "",
    geminiApiKey: "",
    deepseekApiKey: ""
};

// Function to show/hide API key fields and model selection based on provider
function updateApiKeyFieldsVisibility(selectedProvider) {
    Object.values(apiKeyGroups).forEach(group => {
        if (group) group.style.display = "none";
    });

    if (apiKeyGroups[selectedProvider]) {
        apiKeyGroups[selectedProvider].style.display = "block";
    }

    // Show/hide model selection based on provider & control visibility of specific model inputs
    if (selectedProvider === 'ollama' || selectedProvider === 'lmstudio') {
        if (modelDropdownGroup) modelDropdownGroup.style.display = "flex"; // Show dropdown and refresh button
        if (cloudModelNameInput) cloudModelNameInput.style.display = "none"; // Hide text input for cloud models
        if (apiUrlInput.closest(".form-group")) apiUrlInput.closest(".form-group").style.display = "block"; // Show API URL for local
        if (refreshModelsButton) refreshModelsButton.disabled = false;
        if (modelSelect) modelSelect.disabled = false;
    } else { // Cloud providers (ChatGPT, Groq, Gemini, DeepSeek)
        if (modelDropdownGroup) modelDropdownGroup.style.display = "none"; // Hide dropdown and refresh button
        if (cloudModelNameInput) cloudModelNameInput.style.display = "block"; // Show text input for cloud models
        if (apiUrlInput.closest(".form-group")) apiUrlInput.closest(".form-group").style.display = "none"; // Hide API URL for cloud
        if (refreshModelsButton) refreshModelsButton.disabled = true; // Effectively hidden by parent display:none
        if (modelSelect) modelSelect.disabled = true; // Effectively hidden
    }
}


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

    // API Provider and API Keys
    apiProviderSelect.value = cfg.apiProvider || defaults.apiProvider;
    apiUrlInput.value     = cfg.apiUrl || defaults.apiUrl;
    chatgptApiKeyInput.value = cfg.chatgptApiKey || defaults.chatgptApiKey;
    groqApiKeyInput.value    = cfg.groqApiKey || defaults.groqApiKey;
    geminiApiKeyInput.value  = cfg.geminiApiKey || defaults.geminiApiKey;
    deepseekApiKeyInput.value= cfg.deepseekApiKey || defaults.deepseekApiKey;

    // Other settings
    $("#outputLanguage").value = cfg.outputLanguage || defaults.outputLanguage;
    $("#panelWidth").value = cfg.panelWidth || defaults.panelWidth;
    $("#aiTimeout").value  = cfg.aiTimeout || defaults.aiTimeout;
    $("#showErr").checked  = typeof cfg.showErr === 'boolean' ? cfg.showErr : defaults.showErr;
    $("#directOutputToggle").checked = typeof cfg.directOutput === 'boolean' ? cfg.directOutput : defaults.directOutput;
    $("#pinQuestionAreaToggle").checked = typeof cfg.pinQuestionArea === 'boolean' ? cfg.pinQuestionArea : defaults.pinQuestionArea;

    // Update visibility of API key fields and model input types based on loaded provider
    updateApiKeyFieldsVisibility(apiProviderSelect.value);

    // Populate models or set model text input after other settings are loaded and UI visibility is set
    if (apiProviderSelect.value === "ollama" || apiProviderSelect.value === "lmstudio") {
        await populateModelDropdown(cfg.model); // Populates the modelSelect dropdown
        cloudModelNameInput.value = ""; // Clear cloud input when loading a local provider
    } else {
        cloudModelNameInput.value = cfg.model || ""; // Sets the cloudModelNameInput text
        modelSelect.innerHTML = ""; // Clear dropdown when loading a cloud provider
    }
}

async function fetchAvailableModels() {
    const currentApiProvider = apiProviderSelect.value;
    const currentApiUrl = apiUrlInput.value.trim();

    // This function is only for Ollama/LM Studio, so return early if not them.
    if (currentApiProvider !== "ollama" && currentApiProvider !== "lmstudio") {
        return [];
    }

    // Proceed with fetching for Ollama/LM Studio
    modelsLoadingIndicator.style.display = "inline";
    refreshModelsButton.disabled = true;
    modelSelect.disabled = true;

    let fetchUrl = "";
    if (!currentApiUrl || !(currentApiUrl.startsWith("http://") || currentApiUrl.startsWith("https://"))) {
        showSaveStatus("❌ API 位址無效。請檢查 Ollama 或 LM Studio 的 API Base URL 設定。", true);
        modelsLoadingIndicator.style.display = "none";
        refreshModelsButton.disabled = false;
        modelSelect.disabled = false;
        return [];
    }

    if (currentApiProvider === "ollama") {
        fetchUrl = currentApiUrl.replace(/\/+$/, '') + '/api/tags';
    } else if (currentApiProvider === "lmstudio") {
        fetchUrl = currentApiUrl.replace(/\/+$/, '') + '/v1/models';
    }
    // No 'else' needed here because cloud providers are handled above

    try {
        // Only proceed if fetchUrl is defined (i.e., for Ollama/LM Studio)
        if (fetchUrl) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

            const response = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                showSaveStatus(`❌ 無法取得模型列表 (HTTP ${response.status})。請檢查 API 位址與服務狀態。`, true);
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
        } else {
             // This case should ideally not be reached if cloud providers are handled at the start
            return [];
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            showSaveStatus("❌ 取得模型列表超時。請檢查 API 服務是否運行中。", true);
        } else {
            showSaveStatus(`❌ 取得模型列表失敗: ${error.message}`, true);
        }
        return [];
    } finally {
        modelsLoadingIndicator.style.display = "none";
        // Only re-enable if it's a provider that should have models listed
        if (apiProviderSelect.value === "ollama" || apiProviderSelect.value === "lmstudio") {
            refreshModelsButton.disabled = false;
            modelSelect.disabled = false;
        }
    }
}

async function populateModelDropdown(selectedModelFromStorage) {
    // This function is now only for Ollama/LM Studio.
    // Cloud model input is handled by cloudModelNameInput directly.
    const currentApiProvider = apiProviderSelect.value;
    if (currentApiProvider !== "ollama" && currentApiProvider !== "lmstudio") {
        return; 
    }

    // Proceed for Ollama/LM Studio
    const models = await fetchAvailableModels();
    // const previouslySelectedValue = modelSelect.value; // Save current selection before clearing - not needed if we pass selectedModelFromStorage
    modelSelect.innerHTML = ""; // Clear existing options

    if (models.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "未能載入或無可用模型";
        option.disabled = true; // Keep it disabled as it's not a valid choice
        modelSelect.appendChild(option);
        // showSaveStatus can be called by fetchAvailableModels for more specific errors
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

    if (selectedModelFromStorage && !foundSelectedModel && models.length > 0) {
        // If the stored model isn't in the new list, but the list is not empty
        showSaveStatus(`⚠️ 先前選擇的模型 (${selectedModelFromStorage}) 不在目前列表中。已選擇第一個可用模型。`, false);
        modelSelect.options[0].selected = true; // Select the first model as a fallback
    } else if (!selectedModelFromStorage && models.length > 0) {
        // If no model was pre-selected (e.g. first load with defaults), select the first one
        modelSelect.options[0].selected = true;
    } else if (models.length === 0 && selectedModelFromStorage) {
        // List is empty, but there was a selected model (e.g. user cleared API URL for Ollama)
        // The "未能載入..." option is already added. No specific model can be selected.
        // We could add the stored model as a manual option here too, but might be confusing if API is meant to list.
    }
}


$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");
    const aiTimeoutValue = parseInt($("#aiTimeout").value, 10);
    const currentApiProvider = apiProviderSelect.value;
    let modelToSave = "";

    if (currentApiProvider === "ollama" || currentApiProvider === "lmstudio") {
        modelToSave = modelSelect.value;
        if (modelToSave === "" || modelToSave === "未能載入或無可用模型") {
            modelToSave = defaults.model; // Fallback to default local model if selection is invalid
        }
    } else { // Cloud provider
        modelToSave = cloudModelNameInput.value.trim();
        // No default model for cloud; if it's empty, it's empty.
        // Could add validation here if a model name is mandatory for cloud.
    }

    const data = {
        detail: detailChecked ? detailChecked.value : defaults.detail,
        font:   fontChecked ? fontChecked.value : defaults.font,
        apiProvider: currentApiProvider,
        apiUrl: apiUrlInput.value.trim() || defaults.apiUrl,
        model:  modelToSave,
        outputLanguage: $("#outputLanguage").value.trim() || defaults.outputLanguage,
        panelWidth: Math.min(
            Math.max(parseInt($("#panelWidth").value, 10) || defaults.panelWidth, 320),
            800
        ),
        aiTimeout: (aiTimeoutValue && aiTimeoutValue >= 5) ? aiTimeoutValue : defaults.aiTimeout,
        showErr: $("#showErr").checked,
        directOutput: $("#directOutputToggle").checked,
        pinQuestionArea: $("#pinQuestionAreaToggle").checked,
        chatgptApiKey: chatgptApiKeyInput.value.trim(),
        groqApiKey: groqApiKeyInput.value.trim(),
        geminiApiKey: geminiApiKeyInput.value.trim(),
        deepseekApiKey: deepseekApiKeyInput.value.trim()
    };
    chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
            showSaveStatus("❌ 儲存失敗: " + chrome.runtime.lastError.message, true);
        } else {
            showSaveStatus("✅ 設定已儲存！部分設定可能需重新開啟側邊欄生效。", false);
        }
    });
};

$("#reset").onclick = async () => {
    if (confirm("您確定要將所有設定恢復為預設值嗎？")) {
        // Before setting to defaults, ensure UI reflects the default provider state
        updateApiKeyFieldsVisibility(defaults.apiProvider);
        await chrome.storage.sync.set(defaults);
        await loadUI(defaults); // loadUI now correctly calls updateApiKeyFieldsVisibility and populateModelDropdown
        showSaveStatus("🔄 已恢復為預設值！", false);
    }
};

refreshModelsButton.onclick = async () => {
    // Pass the currently selected model value to try and preserve it for Ollama/LMStudio
    const currentProvider = apiProviderSelect.value;
    if (currentProvider === "ollama" || currentProvider === "lmstudio") {
        await populateModelDropdown(modelSelect.value);
    }
    // For other providers, this button should be disabled, but good to be safe.
};

// Event listener for API Provider change
apiProviderSelect.addEventListener('change', async function() {
    updateApiKeyFieldsVisibility(this.value);
    // For Ollama/LM Studio, populate the dropdown. For cloud, set the text input.
    if (this.value === "ollama" || this.value === "lmstudio") {
        cloudModelNameInput.value = ""; // Clear cloud input
        await populateModelDropdown(); // Fetches and populates modelSelect
    } else { // Cloud provider
        modelSelect.innerHTML = ""; // Clear dropdown
        modelSelect.value = "";
        // Load the model name previously saved for this specific cloud provider, if any
        chrome.storage.sync.get(["model", "apiProvider"], (storage) => {
            if (storage.apiProvider === this.value && storage.model) {
                cloudModelNameInput.value = storage.model;
            } else {
                cloudModelNameInput.value = ""; // Or a default cloud model placeholder if desired
            }
        });
    }
});

apiUrlInput.addEventListener('blur', async () => {
    // Refresh models only if a local provider is selected and API URL might be relevant
    const currentProvider = apiProviderSelect.value;
    if (currentProvider === "ollama" || currentProvider === "lmstudio") {
        await populateModelDropdown(modelSelect.value);
    }
});

// Initial load is handled by chrome.storage.sync.get(defaults, loadUI); at the top.