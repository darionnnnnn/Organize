// Qrganize/sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiProvider: "ollama", // Added apiProvider
    apiUrl: "http://localhost:11434", // Updated apiUrl to base URL
    model: "qwen2:7b-instruct", // Updated to match options.js default
    font: "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // Default AI timeout 120 seconds
    showErr: false,
    directOutput: false,
    pinQuestionArea: false,
    chatgptApiKey: "",
    groqApiKey: "",
    geminiApiKey: "",
    deepseekApiKey: ""
};

let currentConfig = { ...defaultConfig };
// let currentChatUrl = ""; // Removed, will be handled in sidepanel-api.js

export async function loadConfig() {
    return new Promise(resolve => {
        chrome.storage.sync.get(defaultConfig, (loadedCfg) => {
            currentConfig = { ...defaultConfig, ...loadedCfg };

            // currentChatUrl construction logic removed.
            // API URL for Ollama/LMStudio is in currentConfig.apiUrl
            // API keys for cloud providers are in currentConfig.chatgptApiKey, etc.

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

// export function getChatUrl() { // Removed
//     return currentChatUrl;
// }

export function getLevelText() {
    return ({ high: "詳細", medium: "中等", low: "精簡" }[currentConfig.detail] || "中等");
}