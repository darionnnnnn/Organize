// options.js - 設定頁面邏輯
const $ = s => document.querySelector(s); // 簡化版 querySelector

// 預設設定值
const defaults = {
    detail: "medium", // 摘要詳細程度
    apiUrl: "https://192.168.68.103/api", // Ollama API 位址
    model:  "qwen3", // AI 模型名稱
    font:   "medium", // 側邊欄字體大小 (新的預設值)
    outputLanguage: "繁體中文", // AI 輸出語言
    panelWidth: 420, // 側邊欄預設寬度
    showErr: false // 是否顯示詳細錯誤訊息
};

// 顯示儲存狀態訊息的函式
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
        alert(message); // 若 HTML 中沒有 #save-status 元素，則用 alert 提示
    }
}

// 從 Chrome Storage 讀取設定，若無則使用預設值，然後更新 UI
chrome.storage.sync.get(defaults, loadUI);

// 將設定值載入到 UI 表單元素中
function loadUI(cfg) {
    // 單選按鈕 - 摘要詳細程度
    const detailValue = cfg.detail || defaults.detail;
    const detailRadio = $(`[name=detail][value=${detailValue}]`);
    if (detailRadio) detailRadio.checked = true;

    // 單選按鈕 - 字體大小
    const fontValue = cfg.font || defaults.font;
    const fontRadio = $(`[name=font][value=${fontValue}]`);
    if (fontRadio) fontRadio.checked = true;

    // 文字輸入框 和 數字輸入框
    $("#apiUrl").value     = cfg.apiUrl || defaults.apiUrl;
    $("#model").value      = cfg.model || defaults.model;
    $("#outputLanguage").value = cfg.outputLanguage || defaults.outputLanguage;
    $("#panelWidth").value = cfg.panelWidth || defaults.panelWidth;

    // 滑動開關 - 是否顯示詳細錯誤
    $("#showErr").checked  = typeof cfg.showErr === 'boolean' ? cfg.showErr : defaults.showErr;
}

// 「儲存設定」按鈕的點擊事件
$("#save").onclick = () => {
    const detailChecked = $("[name=detail]:checked");
    const fontChecked = $("[name=font]:checked");

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

// 「恢復預設值」按鈕的點擊事件
$("#reset").onclick = () => {
    if (confirm("您確定要將所有設定恢復為預設值嗎？")) {
        chrome.storage.sync.set(defaults, () => {
            loadUI(defaults); // 重新載入預設值到 UI
            showSaveStatus("🔄 已恢復為預設值！", false);
        });
    }
};