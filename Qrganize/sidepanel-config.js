// Qrganize/sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiUrl: "https://localhost/api/chat", // 更新以匹配 options.js 的預設值
    model: "ollama", // 更新以匹配 options.js 的預設值
    font: "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // Default AI timeout 120 seconds
    showErr: false,
    directOutput: false,
    pinQuestionArea: false
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