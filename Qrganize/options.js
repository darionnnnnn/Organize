// options.js - 設定頁面邏輯
const $ = s => document.querySelector(s);

// 預設設定值
const defaults = {
    detail: "medium",
    apiUrl: "http://localhost:11434/api", // 預設為 Ollama 的本機位址
    model:  "qwen2:7b-instruct", // 您的預設模型
    font:   "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // AI request timeout in seconds (預設120秒)
    showErr: false,
    aiProvider: "ollama", // 新增: AI 提供者，預設為 ollama
    apiKey: "" // 新增: API 金鑰，預設為空
};

// 新增: 控制 API Key 輸入框顯示/隱藏的函數
function toggleApiKeyField(providerValue) {
    const apiKeyFormGroup = $("#apiKeyFormGroup"); // HTML 中 API Key 的 form-group 應有此 ID
    if (!apiKeyFormGroup) {
        console.error("apiKeyFormGroup not found!");
        return;
    }
    if (providerValue === "openai" || providerValue === "googleai" || providerValue === "grokai") {
        apiKeyFormGroup.style.display = ""; // 或者 "block"
    } else { // "ollama" 或其他
        apiKeyFormGroup.style.display = "none";
    }
}

// Refactored showSaveStatus to be more generic
function showStatusMessage(elementId, message, isError = false, duration = 3000) {
    const statusElement = $(elementId);
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'status-message status-error' : 'status-message status-success';
        
        // Clear message after specified duration
        if (statusElement.timeoutId) {
            clearTimeout(statusElement.timeoutId); // Clear existing timeout if any
        }
        statusElement.timeoutId = setTimeout(() => {
            statusElement.textContent = "";
            statusElement.className = 'status-message';
            delete statusElement.timeoutId;
        }, duration);
    } else {
        // Fallback for critical errors if element not found (though unlikely for hardcoded IDs)
        console.error(`Status element ${elementId} not found. Message: ${message}`);
        alert(message); 
    }
}


chrome.storage.sync.get(defaults, loadUI);

function loadUI(cfg) {
    const detailValue = cfg.detail || defaults.detail;
    const detailRadio = $(`[name=detail][value=${detailValue}]`);
    if (detailRadio) detailRadio.checked = true;

    const fontValue = cfg.font || defaults.font;
    const fontRadio = $(`[name=font][value=${fontValue}]`);
    if (fontRadio) fontRadio.checked = true;

    $("#aiProvider").value = cfg.aiProvider || defaults.aiProvider; // 新增: 載入 AI 提供者
    $("#apiUrl").value     = cfg.apiUrl || defaults.apiUrl;
    $("#apiKey").value     = cfg.apiKey || defaults.apiKey; // 新增: 載入 API Key
    $("#model").value      = cfg.model || defaults.model;
    $("#outputLanguage").value = cfg.outputLanguage || defaults.outputLanguage;
    $("#panelWidth").value = cfg.panelWidth || defaults.panelWidth;
    $("#aiTimeout").value  = cfg.aiTimeout || defaults.aiTimeout; // Load AI timeout (seconds)
    $("#showErr").checked  = typeof cfg.showErr === 'boolean' ? cfg.showErr : defaults.showErr;

    // 新增: 初始設定 API Key 輸入框的顯示狀態
    toggleApiKeyField(cfg.aiProvider || defaults.aiProvider);
}

// 新增: AI 提供者下拉選單變動時的事件監聽
$("#aiProvider").addEventListener("change", function() {
    toggleApiKeyField(this.value);
});


$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");
    const aiTimeoutValue = parseInt($("#aiTimeout").value, 10);

    const data = {
        detail: detailChecked ? detailChecked.value : defaults.detail,
        font:   fontChecked ? fontChecked.value : defaults.font,
        aiProvider: $("#aiProvider").value || defaults.aiProvider, // 新增: 儲存 AI 提供者
        apiUrl: $("#apiUrl").value.trim() || defaults.apiUrl,
        apiKey: $("#apiKey").value.trim(), // 新增: 儲存 API Key (允許為空)
        model:  $("#model").value.trim()  || defaults.model,
        outputLanguage: $("#outputLanguage").value.trim() || defaults.outputLanguage,
        panelWidth: Math.min(
            Math.max(parseInt($("#panelWidth").value, 10) || defaults.panelWidth, 320),
            800
        ),
        // Save AI timeout in seconds, min 5s
        aiTimeout: (aiTimeoutValue && aiTimeoutValue >= 5) ? aiTimeoutValue : defaults.aiTimeout,
        showErr: $("#showErr").checked
    };
    chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
            showSaveStatus("❌ 儲存失敗: " + chrome.runtime.lastError.message, true);
        } else {
            showSaveStatus("✅ 設定已儲存！部分設定可能需重新開啟側邊欄生效。", false);
        }
    });
};

$("#reset").onclick = () => {
    if (confirm("您確定要將所有設定恢復為預設值嗎？")) {
        chrome.storage.sync.set(defaults, () => {
            loadUI(defaults);
            showStatusMessage("#save-status", "🔄 已恢復為預設值！", false);
        });
    }
};

// Event Listener for Test Connection Button
$("#testConnectionBtn").onclick = () => {
    const testBtn = $("#testConnectionBtn");
    testBtn.disabled = true;
    showStatusMessage("#connectionStatus", "測試中...", false, 15000); // Longer default for testing message

    const aiProvider = $("#aiProvider").value;
    const apiUrl = $("#apiUrl").value.trim();
    const apiKey = $("#apiKey").value.trim();
    // const model = $("#model").value.trim(); // Not used in current test logic

    let testUrl = "";
    let fetchOptions = { method: 'GET' };
    let providerName = "";

    switch (aiProvider) {
        case "ollama":
            providerName = "Ollama";
            testUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
            // Ollama's /api endpoint typically returns version info or "Ollama is running"
            // If it doesn't end with /api, and doesn't look like a full path to /api/chat or /api/tags, append /api
            if (!testUrl.endsWith('/api') && !testUrl.includes('/api/')) {
                 testUrl += '/api';
            } else if (testUrl.endsWith('/api/chat') || testUrl.endsWith('/api/tags')) {
                // if user provided full path to chat or tags, strip that to get to /api
                testUrl = testUrl.substring(0, testUrl.lastIndexOf('/'));
            }
            // If apiUrl is just 'http://localhost:11434', it becomes 'http://localhost:11434/api'
            // If apiUrl is 'http://localhost:11434/api', it remains 'http://localhost:11434/api'
            break;
        case "openai":
            providerName = "OpenAI";
            testUrl = apiUrl.replace(/\/+$/, '') + "/models";
            fetchOptions.headers = { "Authorization": `Bearer ${apiKey}` };
            break;
        case "googleai":
            providerName = "Google AI (Gemini)";
            testUrl = apiUrl.replace(/\/+$/, '') + `/v1beta/models?key=${apiKey}`;
            break;
        case "grokai":
            providerName = "Groq AI";
            testUrl = apiUrl.replace(/\/+$/, '') + "/models";
            fetchOptions.headers = { "Authorization": `Bearer ${apiKey}` };
            break;
        default:
            showStatusMessage("#connectionStatus", "❌ 未知的 AI 提供者，無法測試。", true, 10000);
            testBtn.disabled = false;
            return;
    }

    if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) {
        showStatusMessage("#connectionStatus", "❌ API 位址格式錯誤，應以 http:// 或 https:// 開頭。", true, 10000);
        testBtn.disabled = false;
        return;
    }
    
    // Clear previous timeout for connectionStatus before new message
    const connStatusEl = $("#connectionStatus");
    if (connStatusEl && connStatusEl.timeoutId) {
        clearTimeout(connStatusEl.timeoutId);
        delete connStatusEl.timeoutId;
    }

    fetch(testUrl, fetchOptions)
        .then(response => {
            if (response.ok) {
                // For Ollama, check if response is "Ollama is running." or a JSON object
                if (aiProvider === "ollama") {
                    return response.text().then(text => {
                        try {
                            JSON.parse(text); // If it's JSON, it's likely a valid response (e.g. /api/tags)
                            showStatusMessage("#connectionStatus", `✅ ${providerName} 連線成功! (收到 JSON 回應)`, false, 5000);
                        } catch (e) {
                            if (text.trim().toLowerCase().includes("ollama is running")) {
                                showStatusMessage("#connectionStatus", `✅ ${providerName} 連線成功! (${text.trim()})`, false, 5000);
                            } else {
                                showStatusMessage("#connectionStatus", `⚠️ ${providerName} 回應非預期格式: ${text.substring(0,50)}...`, true, 10000);
                            }
                        }
                    });
                } else { // For other providers, a 200 OK is usually enough
                    showStatusMessage("#connectionStatus", `✅ ${providerName} 連線成功! (狀態 ${response.status})`, false, 5000);
                }
            } else {
                response.text().then(text => {
                    const errorDetail = text ? text.substring(0, 100) + (text.length > 100 ? "..." : "") : "";
                    showStatusMessage("#connectionStatus", `❌ ${providerName} 連線失敗: ${response.status} ${response.statusText}. ${errorDetail}`, true, 10000);
                }).catch(() => {
                     showStatusMessage("#connectionStatus", `❌ ${providerName} 連線失敗: ${response.status} ${response.statusText}`, true, 10000);
                });
            }
        })
        .catch(err => {
            // Network error or other fetch-related error
            showStatusMessage("#connectionStatus", `❌ ${providerName} 連線錯誤: ${err.message}`, true, 10000);
        })
        .finally(() => {
            testBtn.disabled = false; // Re-enable button
        });
};

// Update existing call to showSaveStatus to use the new function
$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");
    const aiTimeoutValue = parseInt($("#aiTimeout").value, 10);

    const data = {
        detail: detailChecked ? detailChecked.value : defaults.detail,
        font:   fontChecked ? fontChecked.value : defaults.font,
        aiProvider: $("#aiProvider").value || defaults.aiProvider, 
        apiUrl: $("#apiUrl").value.trim() || defaults.apiUrl,
        apiKey: $("#apiKey").value.trim(), 
        model:  $("#model").value.trim()  || defaults.model,
        outputLanguage: $("#outputLanguage").value.trim() || defaults.outputLanguage,
        panelWidth: Math.min(
            Math.max(parseInt($("#panelWidth").value, 10) || defaults.panelWidth, 320),
            800
        ),
        aiTimeout: (aiTimeoutValue && aiTimeoutValue >= 5) ? aiTimeoutValue : defaults.aiTimeout,
        showErr: $("#showErr").checked
    };
    chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
            showStatusMessage("#save-status", "❌ 儲存失敗: " + chrome.runtime.lastError.message, true);
        } else {
            showStatusMessage("#save-status", "✅ 設定已儲存！部分設定可能需重新開啟側邊欄生效。", false);
        }
    });
};