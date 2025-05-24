// Qrganize/sidepanel-config.js

const defaultConfig = {
    detail: "medium",
    apiUrl: "http://localhost:11434/api", // Default for Ollama, base path
    model: "qwen2:7b-instruct",
    font: "medium",
    outputLanguage: "繁體中文",
    panelWidth: 420,
    aiTimeout: 120, // Default AI timeout 120 seconds
    showErr: false,
    aiProvider: "ollama", // Added: AI Provider
    apiKey: "" // Added: API Key
};

let currentConfig = { ...defaultConfig };
let currentChatUrl = "";

export async function loadConfig() {
    return new Promise(resolve => {
        chrome.storage.sync.get(defaultConfig, (loadedCfg) => {
            currentConfig = { ...defaultConfig, ...loadedCfg };

            // Determine currentChatUrl based on provider and apiUrl
            const provider = currentConfig.aiProvider;
            let apiUrl = currentConfig.apiUrl.trim().replace(/\/+$/, ''); // Trim and remove trailing slashes

            if (provider === "ollama") {
                // Ensure Ollama URL ends with /api/chat
                // Handles: http://host:port, http://host:port/api, http://host:port/api/chat
                if (apiUrl.toLowerCase().endsWith("/api/chat")) {
                    currentChatUrl = apiUrl;
                } else if (apiUrl.toLowerCase().endsWith("/api")) {
                    currentChatUrl = apiUrl + "/chat";
                } else {
                    // Assuming it's a base URL like http://localhost:11434
                    currentChatUrl = apiUrl + "/api/chat";
                }
            } else if (provider === "openai") {
                // User provides the full chat completions URL
                // e.g., https://api.openai.com/v1/chat/completions
                currentChatUrl = apiUrl;
            } else if (provider === "googleai") {
                // User provides the base URL
                // e.g., https://generativelanguage.googleapis.com
                // Path components like /v1beta/models/... are added in sidepanel-api.js
                currentChatUrl = apiUrl;
            } else if (provider === "grokai") {
                // User provides the full chat completions URL
                // e.g., https://api.groq.com/openai/v1/chat/completions
                currentChatUrl = apiUrl;
            } else {
                // Fallback: Default to Ollama-like behavior or just use apiUrl if provider is unknown
                console.warn(`Unknown AI provider: ${provider}. Defaulting to Ollama URL structure.`);
                if (apiUrl.toLowerCase().endsWith("/api/chat")) {
                    currentChatUrl = apiUrl;
                } else if (apiUrl.toLowerCase().endsWith("/api")) {
                    currentChatUrl = apiUrl + "/chat";
                } else {
                    currentChatUrl = apiUrl + "/api/chat";
                }
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

// 此 errMsg 函式目前未在專案其他地方被直接呼叫，但其邏輯是存在的。
// 若要使用，建議直接在呼叫處根據 getConfig().showErr 來組裝錯誤訊息。
export function errMsg(error) {
    console.error("側邊欄執行時發生錯誤:", error);
    const messageText = error.message || "未知錯誤";
    return currentConfig.showErr ? `❗ ${messageText}` : "⚠️ 處理過程中發生錯誤";
}