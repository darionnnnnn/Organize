// content.js － 負責從網頁中抽取主要閱讀文章內容

// 監聽來自背景腳本 (background.js) 或其他擴充功能組件的訊息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 檢查訊息類型是否為提取文章內容的請求
    if (msg.type !== "EXTRACT_ARTICLE") {
        return false; // 若不是，則明確表示不會處理此訊息 (sendResponse 不會被呼叫)
    }

    try {
        // 使用 Readability.js 函式庫來解析目前頁面的 DOM
        // document.cloneNode(true) 創建一個頁面的深拷貝副本，避免直接修改原始頁面影響其功能
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone, {
            // charThreshold: 250, // Readability 選項：內容至少應有多少字元才被認為是主要內容
            // nCharsToPreserve: 150 // Readability 選項：從被移除的元素中保留多少字元
            // 可根據需求調整 Readability 的選項以優化提取效果
        });
        const article = reader.parse(); // 執行解析

        if (!article) {
            // Readability 未能成功解析出文章
            console.warn("Readability.js 未能解析出主要文章內容。嘗試使用後備方案。");
            throw new Error("Readability.js 解析失敗"); // 拋出錯誤以便 catch 區塊處理後備方案
        }

        // 獲取解析後的文本內容，並做一些清理和限制
        // 優先使用 article.textContent (純文字)，其次是 article.content (可能包含簡化後的 HTML)
        let text = (article.textContent || "").replace(/\s\s+/g, ' ').trim(); // 將多個連續空白（包括換行）替換為單個空格，並去除頭尾空白

        // 如果 Readability 的 textContent 為空，但 content (HTML) 存在，嘗試從 HTML 提取文字
        // 這有助於處理那些主要內容在 Readability 解析為 HTML 但 textContent 較少的情況
        if (!text && article.content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = article.content; // 將 HTML 內容放入暫時的 div
            text = (tempDiv.textContent || tempDiv.innerText || "").replace(/\s\s+/g, ' ').trim(); // 從 div 中提取純文字
        }

        // 若上述方法都無法取得文字，則使用 body.innerText 作為最終後備
        if (!text) {
            console.warn("Readability.js 未提供有效文字內容，使用 document.body.innerText 作為後備。");
            text = (document.body.innerText || "").replace(/\s\s+/g, ' ').trim();
        }

        const textToSummarize = text.slice(0, 8000); // 限制擷取文字的最大長度 (可依需求調整)

        // 獲取文章標題，優先使用 Readability 解析的標題，其次是網頁的 document.title
        const title = article.title || document.title || "網頁內容"; // 若都無，則使用通用標題

        // 將提取到的文本和標題透過 sendResponse 回傳給請求方 (通常是 background.js)
        sendResponse({ text: textToSummarize, title: title });

    } catch (error) {
        // 如果在提取過程中發生任何錯誤
        console.error("內容腳本提取文章時發生錯誤:", error);

        // 作為錯誤時的後備方案，嘗試抓取 body 的前一部分 innerText
        const fallbackText = (document.body.innerText || "").replace(/\s\s+/g, ' ').trim().slice(0, 3000); // 限制後備文本長度
        const fallbackTitle = document.title || "網頁內容";

        sendResponse({
            text: fallbackText,
            title: fallbackTitle,
            error: "提取主要內容時發生錯誤，可能僅擷取部分文字或整個頁面文字。" // 附帶錯誤信息
        });
    }
    // `sendResponse` 在 `try` 和 `catch` 中都是同步（或在 Promise 回呼之外）調用，
    // 若要確保非同步的 `sendResponse` 正常運作（例如 `Workspace` 後才 `sendResponse`），則必須 `return true;`。
    // 在此特定情境下，Readability.parse() 是同步的，所以技術上不一定需要 `return true;`。
    // 但為了與 background.js 中的非同步消息處理保持一致性與未來擴展性，建議返回 true。
    return true;
});