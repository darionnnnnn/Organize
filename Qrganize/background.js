// Qrganize/background.js

// 擴充功能安裝或更新時執行
chrome.runtime.onInstalled.addListener(() => {
    // 建立右鍵選單項目：AI 摘要 (全文或選取文字)
    chrome.contextMenus.create({
        id: "ai-summary",
        title: "AI 摘要（全文或選取）",
        contexts: ["all", "selection"] // 可在頁面任何地方或選取文字時顯示
    });

    // 建立右鍵選單項目：開啟設定頁面 (僅在擴充功能圖示上點擊右鍵時顯示)
    chrome.contextMenus.create({
        id: "ai-settings",
        title: "Settings", // 維持英文以便使用者辨識標準設定選項
        contexts: ["action"]
    });
});

// 右鍵選單項目點擊事件監聽器
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) {
        console.warn("無法取得分頁資訊，操作取消。");
        return;
    }
    if (info.menuItemId === "ai-settings") {
        chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "ai-summary") {
        openPanel(tab, info.selectionText ?? "");
    }
});

// 擴充功能圖示 (Action Button) 點擊事件監聽器
chrome.action.onClicked.addListener(tab => {
    if (!tab) {
        console.warn("無法取得分頁資訊，操作取消。");
        return;
    }
    openPanel(tab, "");
});

function openPanel(tab, selectionText = "") {
    if (!tab || !tab.id) {
        console.error("無效的分頁資訊，無法開啟側邊欄。");
        return;
    }
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            files: ["toggle-panel.js"]
        },
        () => {
            if (chrome.runtime.lastError) {
                console.error("腳本注入失敗 (toggle-panel.js):", chrome.runtime.lastError.message);
                return;
            }
            chrome.tabs.sendMessage(tab.id, {
                type: "SUMMARY_SELECTED_TEXT",
                text: selectionText
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(`訊息傳遞失敗 (SUMMARY_SELECTED_TEXT to tab ${tab.id}):`, chrome.runtime.lastError.message);
                }
            });
        }
    );
}

function getApiUrl(callback) {
    chrome.storage.sync.get({ apiUrl: "http://localhost:11434/api" }, ({ apiUrl }) => { // Default updated for common Ollama
        callback(apiUrl);
    });
}

const keepAliveInterval = setInterval(() => {
    getApiUrl(apiUrl => {
        if (!apiUrl || !(apiUrl.startsWith("http://") || apiUrl.startsWith("https://"))) {
            return;
        }
        // Ensure API URL doesn't already end with /api or /api/tags
        let pingUrl = apiUrl.replace(/\/api\/tags$/, "").replace(/\/api$/, "").replace(/\/$/, "");
        fetch(`${pingUrl}/api/tags`)
            .catch(err => {
                // console.debug("保持連線 Ping 失敗 (Keep-alive ping failed):", err.message);
            });
    });
}, 20000);

// --- Offscreen Document Logic ---
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument() {
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
            documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
        });
        return !!contexts.length;
    }
    console.warn("chrome.runtime.getContexts is not available.");
    return false; // Fallback, assume no
}

async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log("Offscreen document already exists.");
        return;
    }
    try {
        console.log("Attempting to create offscreen document...");
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: 'Needed for copying text to the clipboard securely due to iframe restrictions.',
        });
        console.log("Offscreen document created successfully or creation initiated.");
    } catch (error) {
        if (error.message.includes("Only a single offscreen document may be created")) {
            console.warn("Offscreen document creation failed as one already exists (or is being created):", error.message);
        } else {
            console.error("Error creating offscreen document:", error);
        }
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_ARTICLE") {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: "EXTRACT_ARTICLE" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(`轉發 EXTRACT_ARTICLE 請求至內容腳本 (tabId: ${sender.tab.id}) 失敗:`, chrome.runtime.lastError.message);
                    sendResponse({ error: "轉發請求至內容腳本失敗: " + chrome.runtime.lastError.message });
                } else {
                    sendResponse(response);
                }
            });
        } else {
            console.warn("收到 EXTRACT_ARTICLE 請求，但無法確定來源分頁 (sender.tab.id 未定義)。");
            sendResponse({ error: "無法確定目標分頁以提取文章" });
        }
        return true;

    } else if (msg.type === 'copy-data-to-clipboard') {
        (async () => {
            try {
                await createOffscreenDocument();
                // It might take a moment for the offscreen document to be ready to receive messages.
                // A more robust solution would involve a handshake (offscreen sends "ready" message).
                // For now, a small delay or hoping it's ready quickly.
                // Let's try sending immediately; offscreen.js's listener should be set up quickly.

                // Add a small delay to allow offscreen document to initialize listener
                await new Promise(resolve => setTimeout(resolve, 150));


                const responseFromOffscreen = await chrome.runtime.sendMessage({
                    type: 'copy-to-clipboard',
                    target: 'offscreen', // Target the offscreen script
                    data: msg.data
                });
                sendResponse(responseFromOffscreen);
            } catch (error) {
                console.error("Background: Error during copy-data-to-clipboard message relay:", error);
                // Try to check if offscreen document exists if messaging fails
                if (!await hasOffscreenDocument()) {
                    console.error("Background: Offscreen document does not seem to exist when trying to send message.");
                }
                sendResponse({ success: false, error: error.message || "Failed to process copy request in background." });
            }
        })();
        return true;
    }
    // For any other synchronous message types:
    return false;
});