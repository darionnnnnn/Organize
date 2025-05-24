// Qrganize/sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiUrl: "https://192.168.68.103/api", // 更新以匹配 options.js 的預設值
    model: "qwen3", // 更新以匹配 options.js 的預設值
    font: "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // Default AI timeout 120 seconds
    showErr: false
};

let currentConfig = { ...defaultConfig };
let currentChatUrl = "";

export async function loadConfig() {
    return new Promise(resolve => {
        chrome.storage.sync.get(defaultConfig, (loadedCfg) => {
            currentConfig = { ...defaultConfig, ...loadedCfg };

            let endpoint = currentConfig.apiUrl.trim();
            const lowerApiUrl = endpoint.toLowerCase();
            if (!lowerApiUrl.endsWith('/chat') && !lowerApiUrl.endsWith('/chat/')) {
                endpoint = endpoint.replace(/\/+$/, '') + '/chat';
            } else {
                endpoint = endpoint.replace(/\/+$/, '');
            }
            currentChatUrl = endpoint;

            // 確保 body 存在才操作 classList
            if (document.body) {
                // 先移除可能存在的舊字體 class，再添加新的
                document.body.classList.remove('font-small', 'font-medium', 'font-large');
                document.body.classList.add(`font-${currentConfig.font}`);
            }
            resolve(currentConfig);
        });
    });
}

export function getConfig() {
    return currentConfig;
}

export function getChatUrl() {
    return currentChatUrl;
}

export function getLevelText() {
    return ({ high: "詳細", medium: "中等", low: "精簡" }[currentConfig.detail] || "中等");
}

// 此 errMsg 函式目前未在專案其他地方被直接呼叫，但其邏輯是存在的。
// 若要使用，建議直接在呼叫處根據 getConfig().showErr 來組裝錯誤訊息。
export function errMsg(error) {
    console.error("側邊欄執行時發生錯誤:", error);
    const messageText = error.message || "未知錯誤";
    return currentConfig.showErr ? `❗ ${messageText}` : "⚠️ 處理過程中發生錯誤";
}