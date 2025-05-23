// sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiUrl: "http://localhost:11434/api", // Default, will be overridden by user's
    model: "qwen2:7b", // Default, will be overridden
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

            document.body.classList.add(`font-${currentConfig.font}`);
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

export function errMsg(error) {
    console.error("側邊欄執行時發生錯誤:", error);
    const messageText = error.message || "未知錯誤";
    // Assuming 'esc' is globally available or imported if sidepanel-utils is also modularized
    // For now, let's assume esc is available (e.g. from a utils module imported in main)
    // This function might need 'esc' passed or utils imported here.
    // For simplicity in this refactor, error messages will be constructed more directly in calling modules.
    return currentConfig.showErr ? `❗ ${messageText}` : "⚠️ 處理過程中發生錯誤";
}