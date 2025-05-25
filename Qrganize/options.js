// options.js - 設定頁面邏輯
const $ = s => document.querySelector(s);

// 預設設定值
const defaults = {
    detail: "medium",
    apiUrl: "https://localhost/api/chat", // 您的預設 API URL
    model:  "ollama", // 您的預設模型
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

function loadUI(cfg) {
    const detailValue = cfg.detail || defaults.detail;
    const detailRadio = $(`[name=detail][value=${detailValue}]`);
    if (detailRadio) detailRadio.checked = true;

    const fontValue = cfg.font || defaults.font;
    const fontRadio = $(`[name=font][value=${fontValue}]`);
    if (fontRadio) fontRadio.checked = true;

    $("#apiUrl").value     = cfg.apiUrl || defaults.apiUrl;
    $("#model").value      = cfg.model || defaults.model;
    $("#outputLanguage").value = cfg.outputLanguage || defaults.outputLanguage;
    $("#panelWidth").value = cfg.panelWidth || defaults.panelWidth;
    $("#aiTimeout").value  = cfg.aiTimeout || defaults.aiTimeout; // Load AI timeout (seconds)
    $("#showErr").checked  = typeof cfg.showErr === 'boolean' ? cfg.showErr : defaults.showErr;
    $("#directOutputToggle").checked = typeof cfg.directOutput === 'boolean' ? cfg.directOutput : defaults.directOutput;
    $("#pinQuestionAreaToggle").checked = typeof cfg.pinQuestionArea === 'boolean' ? cfg.pinQuestionArea : defaults.pinQuestionArea;
}

$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");
    const aiTimeoutValue = parseInt($("#aiTimeout").value, 10);

    const data = {
        detail: detailChecked ? detailChecked.value : defaults.detail,
        font:   fontChecked ? fontChecked.value : defaults.font,
        apiUrl: $("#apiUrl").value.trim() || defaults.apiUrl,
        model:  $("#model").value.trim()  || defaults.model,
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

$("#reset").onclick = () => {
    if (confirm("您確定要將所有設定恢復為預設值嗎？")) {
        chrome.storage.sync.set(defaults, () => {
            loadUI(defaults);
            showSaveStatus("🔄 已恢復為預設值！", false);
        });
    }
};