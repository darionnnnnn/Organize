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
                console.error("腳本注入失敗 (toggle-panel.js)：", chrome.runtime.lastError.message);
                return;
            }
            chrome.tabs.sendMessage(tab.id, {
                type: "SUMMARY_SELECTED_TEXT",
                text: selectionText
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(`訊息傳遞失敗 (SUMMARY_SELECTED_TEXT 至分頁 ${tab.id})：`, chrome.runtime.lastError.message);
                }
            });
        }
    );
}

// Removed getApiUrl function as its logic will be incorporated directly into keepAliveInterval

const keepAliveInterval = setInterval(() => {
    chrome.storage.sync.get({ apiUrl: "http://localhost:11434", apiProvider: "ollama" }, ({ apiUrl, apiProvider }) => {
        if (apiProvider === "ollama") {
            if (!apiUrl || !(apiUrl.startsWith("http://") || apiUrl.startsWith("https://"))) {
                // console.debug("Ollama API URL無效，跳過 Ping。");
                return;
            }
            // 確保 apiUrl 是基底 URL，然後附加 /api/tags
            let pingUrl = apiUrl.trim().replace(/\/+$/, ""); // 移除尾部斜線
            pingUrl += '/api/tags';

            fetch(pingUrl)
                .then(response => {
                    if (!response.ok) {
                        // console.debug(`保持連線 Ping 失敗 (Ollama): ${response.status}`);
                    } else {
                        // console.debug("保持連線 Ping 成功 (Ollama)");
                    }
                })
                .catch(err => {
                    // console.debug("保持連線 Ping 錯誤 (Ollama):", err.message);
                });
        } else {
            // console.debug(`Keep-alive ping skipped for non-Ollama provider: ${apiProvider}`);
            // For other providers like lmstudio, chatgpt, etc., no ping is needed.
        }
    });
}, 20000); // Runs every 20 seconds

// --- 離屏文件邏輯 ---
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument() {
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
            documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
        });
        return !!contexts.length;
    }
    console.warn("chrome.runtime.getContexts 不可用。");
    return false; // 後備方案，假設沒有
}

async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log("離屏文件已存在。");
        return;
    }
    try {
        console.log("嘗試建立離屏文件...");
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: '由於 iframe 限制，需要此文件來安全地複製文字到剪貼簿。',
        });
        console.log("離屏文件已成功建立或已啟動建立程序。");
    } catch (error) {
        if (error.message.includes("Only a single offscreen document may be created")) {
            console.warn("離屏文件建立失敗，因為已存在一個 (或正在建立中)：", error.message);
        } else {
            console.error("建立離屏文件時發生錯誤：", error);
        }
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_ARTICLE") {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: "EXTRACT_ARTICLE" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(`轉發 EXTRACT_ARTICLE 請求至內容腳本 (分頁ID: ${sender.tab.id}) 失敗：`, chrome.runtime.lastError.message);
                    sendResponse({ error: "轉發請求至內容腳本失敗：" + chrome.runtime.lastError.message });
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
                // 離屏文件可能需要一些時間才能準備好接收訊息。
                // 一個更穩健的解決方案會包含交握機制 (離屏文件傳送 "ready" 訊息)。
                // 目前採用短暫延遲，或期望它能快速準備就緒。
                // 我們嘗試立即傳送；offscreen.js 的監聽器應該會很快設定完成。

                // 加入短暫延遲以允許離屏文件初始化監聽器
                await new Promise(resolve => setTimeout(resolve, 150));


                const responseFromOffscreen = await chrome.runtime.sendMessage({
                    type: 'copy-to-clipboard',
                    target: 'offscreen', // 指定目標為離屏腳本
                    data: msg.data
                });
                sendResponse(responseFromOffscreen);
            } catch (error) {
                console.error("背景腳本：在 copy-data-to-clipboard 訊息轉發過程中發生錯誤：", error);
                // 如果訊息傳送失敗，嘗試檢查離屏文件是否存在
                if (!await hasOffscreenDocument()) {
                    console.error("背景腳本：嘗試傳送訊息時，離屏文件似乎不存在。");
                }
                sendResponse({ success: false, error: error.message || "背景腳本處理複製請求失敗。" });
            }
        })();
        return true;
    }
    // 對於任何其他同步訊息類型：
    return false;
});