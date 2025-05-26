// Qrganize/sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiProvider: "ollama", // Added apiProvider
    apiUrl: "http://localhost:11434", // Updated apiUrl to base URL
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

            // Construct currentChatUrl based on apiProvider
            const baseUrl = currentConfig.apiUrl.trim().replace(/\/+$/, '');
            if (currentConfig.apiProvider === "ollama") {
                currentChatUrl = baseUrl + '/api/chat';
            } else if (currentConfig.apiProvider === "lmstudio") {
                currentChatUrl = baseUrl + '/v1/chat/completions';
            } else {
                // Default or fallback, though options.js should ensure apiProvider is set
                currentChatUrl = baseUrl + '/api/chat';
            }

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