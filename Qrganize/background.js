// background.js - 背景服務腳本 (Service Worker)

// 擴充功能安裝或更新時執行
chrome.runtime.onInstalled.addListener(() => {
    // 建立右鍵選單項目：AI 摘要 (全文或選取文字)
    chrome.contextMenus.create({
        id: "ai-summary",
        title: "AI 摘要（全文或選取）",
        contexts: ["all", "selection"] // 可在頁面任何地方或選取文字時顯示
    });

    // 建立右鍵選單項目：開啟設定頁面 (僅在擴充功能圖示上點擊時顯示)
    chrome.contextMenus.create({
        id: "ai-settings",
        title: "Settings", // 維持英文以便使用者辨識標準設定選項
        contexts: ["action"]
    });
});

// 右鍵選單項目點擊事件監聽器
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ai-settings") {
        // 如果點擊的是 "ai-settings"，開啟擴充功能的設定頁面
        chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "ai-summary") {
        // 如果點擊的是 "ai-summary"，開啟側邊欄並傳送選取的文字 (如果有的話)
        openPanel(tab, info.selectionText ?? "");
    }
});

// 擴充功能圖示 (Action Button) 點擊事件監聽器
chrome.action.onClicked.addListener(tab => openPanel(tab, ""));

// 開啟側邊欄並傳送選取文字的函式
function openPanel(tab, selectionText = "") {
    // 執行 toggle-panel.js 腳本來開啟或關閉側邊欄 iframe
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            files: ["toggle-panel.js"] // 假設 toggle-panel.js 處理側邊欄的顯示/隱藏邏輯
        },
        (results) => {
            const err = chrome.runtime.lastError;
            if (err) {
                // 腳本注入失敗時，在背景腳本的控制台輸出錯誤訊息
                console.error("腳本注入失敗 (Script injection failed):", err.message);
                return;
            }

            // 腳本注入成功後，向該分頁的內容腳本或側邊欄傳送選取的文字
            // 這裡假設 toggle-panel.js 執行後，側邊欄的 iframe 環境會建立並監聽此訊息
            // 或者 toggle-panel.js 本身會處理此訊息並在 iframe 載入後傳遞
            chrome.tabs.sendMessage(tab.id, {
                type: "SUMMARY_SELECTED_TEXT",
                text: selectionText
            }, (response) => { // sendMessage 的回呼函式
                if (chrome.runtime.lastError) {
                    // 如果訊息傳送失敗 (例如目標沒有監聽器)，在背景腳本的控制台輸出警告
                    console.warn("訊息傳遞失敗 (Message delivery failed to tab " + tab.id + "):", chrome.runtime.lastError.message);
                }
                //  可以根據 response 做進一步處理 (如果有的話)
            });
        }
    );
}

// 從 Chrome Storage 獲取 API URL 的輔助函式
function getApiUrl(callback) {
    chrome.storage.sync.get({ apiUrl: "https://192.168.68.103/api" }, ({ apiUrl }) => {
        callback(apiUrl);
    });
}

// 定期 (每20秒) ping Ollama API 的 /api/tags 端點，以保持連線 (keep-alive)
// 這有助於防止 Ollama 模型在長時間未使用後被卸載，從而加速下次請求的回應
setInterval(() => {
    getApiUrl(apiUrl => {
        if (!apiUrl || !apiUrl.startsWith("http")) {
            // console.debug("API URL 無效或未設定，無法執行 Keep-alive ping。請檢查擴充功能設定。");
            return;
        }
        fetch(`${apiUrl}/tags`) // /api/tags 是 Ollama 用於獲取本地模型列表的端點
            .catch(err => {
                // Ping 失敗通常不是嚴重問題，可能只是 Ollama 服務暫時不可用或網路問題
                console.debug("保持連線 Ping 失敗 (Keep-alive ping failed):", err.message);
            });
    });
}, 20000); // 每 20 秒執行一次

// 監聽來自內容腳本或側邊欄的訊息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_ARTICLE") {
        // 如果收到提取文章內容的請求 (通常來自側邊欄)
        // 將此請求轉發給發送此請求的分頁的內容腳本 (content.js)
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: "EXTRACT_ARTICLE" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("轉發 EXTRACT_ARTICLE 請求至內容腳本失敗:", chrome.runtime.lastError.message);
                    sendResponse({ error: "轉發請求至內容腳本失敗: " + chrome.runtime.lastError.message });
                } else {
                    sendResponse(response); // 將內容腳本的回應回傳給原始請求方 (側邊欄)
                }
            });
        } else {
            console.warn("收到 EXTRACT_ARTICLE 請求，但無法確定來源分頁 (sender.tab.id 未定義)。");
            sendResponse({ error: "無法確定目標分頁以提取文章" });
        }

        // **重要**: `return true;` 表示 `sendResponse` 將會被非同步呼叫。
        // 這是 Chrome 擴充功能訊息傳遞的標準做法，
        // 用於告知 Chrome 等待 `sendResponse` 被確實呼叫後再關閉訊息通道。
        return true;
    }
    // 若有其他類型的訊息，可以在此加入 else if 條件判斷
    // 如果沒有 return true，且 sendResponse 是在此監聽器函式執行完畢後才非同步呼叫，
    // 則訊息通道可能會被過早關閉，導致 sendResponse 失敗。
    return false; // 對於未處理的同步訊息，可以返回 false 或不返回
});