// sidepanel-utils.js – 側邊欄輔助函式庫，用於優化與增強文字及 HTML 處理

/**
 * HTML 特殊字元轉義函式。
 * 將字串中的 '<', '>', '&', '"', ''' 替換為對應的 HTML 實體編碼。
 * @param {string} s - 需要轉義的原始字串。
 * @returns {string} - 轉義後的字串。若輸入非字串，則回傳空字串。
 */
export const esc = s => {
    if (typeof s !== 'string') return "";
    return s.replace(/[<>&"']/g, c => ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
};

/**
 * 移除 AI 回應中可能包含的 <think>...</think> 標籤及其內容。
 * 這類標籤有時是 AI 模型在思考或產生回應過程中的內部標記。
 * @param {string} s - AI 的原始回應字串。
 * @returns {string} - 移除 <think> 標籤及其內容後的字串。若輸入非字串，則回傳空字串。
 */
export const stripThink = s => {
    if (typeof s !== 'string') return "";
    return s.replace(/<think>[\s\S]*?<\/think>/gi, "");
};

/**
 * 將 AI 回應的類 Markdown 文本或純文字內容轉換為基礎的 HTML 結構。
 * 主要處理邏輯：
 * 1. 如果內容被 ```html ... ``` 包裹，則直接提取並使用內部的 HTML 內容（假設其為安全）。
 * 2. 逐行處理文本：
 * - 以 '<' 開頭並以 '>' 結尾的單行簡單 HTML 標籤，直接保留。
 * - Markdown 的無序列表符號（-, +, *）轉換為 <ul><li> HTML 列表項。
 * - Markdown 的標題符號（# 至 ######）轉換為對應級別的 <h> HTML 標題。
 * - Markdown 的程式碼區塊（```）轉換為 <pre> HTML 標籤。
 * - 其他非空行被視為一般段落，包裹在 <p> HTML 標籤中。
 * 3. 所有插入到 HTML 中的文本內容（非直接 HTML 標籤部分）都會經過 `esc()` 函式進行 HTML 特殊字元轉義。
 *
 * @param {string} src - AI 回應的原始文本內容。
 * @returns {string} - 轉換後的 HTML 字串。若輸入非字串或為空，則回傳空字串。
 */
export function cleanAI(src) {
    if (typeof src !== 'string' || !src.trim()) {
        return "";
    }

    // 優先處理被 ```html ... ``` 包裹的內容 (假設內容是安全的 HTML 片段)
    const htmlBlockMatch = src.match(/^```html\s*([\s\S]*?)\s*```$/i);
    if (htmlBlockMatch && htmlBlockMatch[1].trim()) {
        return htmlBlockMatch[1].trim();
    }

    const outputLines = [];
    let isInUnorderedList = false;
    let isInCodeBlock = false;
    const lines = src.split(/\r?\n/); // 按換行符分割成多行

    for (const line of lines) {
        const trimmedLine = line.trim(); // 去除該行前後空白

        // 處理程式碼區塊 (```)
        if (trimmedLine.startsWith("```")) {
            if (isInCodeBlock) { // 若已在程式碼區塊內，則此行為結束標記
                outputLines.push("</pre>");
                isInCodeBlock = false;
            } else { // 若不在程式碼區塊內，則此行為開始標記
                if (isInUnorderedList) { outputLines.push("</ul>"); isInUnorderedList = false; } // 結束可能未閉合的列表
                outputLines.push("<pre>"); // 為了簡化，不特別處理語言標識符 (如 ```javascript)
                isInCodeBlock = true;
            }
            continue; // 處理完 ``` 標記行，跳到下一行
        }

        if (isInCodeBlock) { // 若在程式碼區塊內
            outputLines.push(esc(line)); // 保留原始行的縮排，但對內容進行 HTML 轉義
            continue;
        }

        // 忽略純粹的空行 (trim 後為空)
        if (!trimmedLine) {
            if (isInUnorderedList) { // 如果在列表中遇到空行，視為列表結束
                outputLines.push("</ul>");
                isInUnorderedList = false;
            }
            continue;
        }

        // 檢查是否為已存在的簡單 HTML 標籤行 (例如 AI 直接給出 <b>text</b>)
        // 此判斷較為基礎，複雜或跨多行的 HTML 可能無法正確處理
        if (trimmedLine.startsWith("<") && trimmedLine.endsWith(">") && !trimmedLine.includes('\n')) {
            if (isInUnorderedList) { outputLines.push("</ul>"); isInUnorderedList = false; } // 結束可能未閉合的列表
            outputLines.push(trimmedLine); // 直接輸出，假設此 HTML 是安全的
            continue;
        }

        // 處理 Markdown 無序列表
        if (/^\s*[-+*]\s+/.test(trimmedLine)) { // 以 -, +, * 後跟至少一個空白開頭
            if (!isInUnorderedList) { // 如果不是在列表中，則開啟 <ul>
                outputLines.push("<ul>");
                isInUnorderedList = true;
            }
            // 移除列表符號，轉義內容，然後加入 <li>
            outputLines.push(`<li>${esc(trimmedLine.replace(/^\s*[-+*]\s+/, ""))}</li>`);
            continue;
        } else if (isInUnorderedList) { // 如果先前是列表，但目前行不再是列表項，則結束列表
            outputLines.push("</ul>");
            isInUnorderedList = false;
        }

        // 處理 Markdown 標題 (H1-H6)
        if (/^\s*#{1,6}\s+/.test(trimmedLine)) { // 以 1-6 個 # 後跟至少一個空白開頭
            const level = trimmedLine.match(/^#+/)[0].length; // 計算 # 的數量以決定標題級別
            const content = trimmedLine.replace(/^#+\s*/, ""); // 移除 # 號和後續空白
            outputLines.push(`<h${level}>${esc(content)}</h${level}>`);
            continue;
        }

        // 其他所有非空行，皆視為段落處理
        outputLines.push(`<p>${esc(trimmedLine)}</p>`);
    }

    // 確保在文本結束時，所有開啟的列表或程式碼區塊都已正確關閉
    if (isInUnorderedList) outputLines.push("</ul>");
    if (isInCodeBlock) outputLines.push("</pre>"); // 理論上 ``` 結束符會處理，此為保險措施

    return outputLines.join("\n"); // 將處理後的各行HTML合併回一個字串
}


/**
 * (此函式 createOutline 在目前的 JSON 結構化摘要流程中未被 sidepanel-main.js 直接使用，
 * 其功能已被新的、基於 JSON 的重點列表生成邏輯所取代。
 * 但基於它是您原始碼的一部分，予以保留並加入註解，以供未來可能的其他用途或參考。)
 * * 從一段 HTML 內容中提取主要的標題元素 (h1-h3, strong, b)，並依此產生一個大綱列表的 HTML。
 * 它同時會嘗試從輸入的 HTML 中移除與 `mainTitle` 參數內容相同的第一個主要標題元素，以避免重複顯示。
 * * @param {string} html - 包含內容的原始 HTML 字串。
 * @param {string} mainTitle - 網頁或摘要的主標題，用於比對並嘗試移除重複。
 * @returns {{outline: string, body: string}} - 一個物件，包含：
 * `outline`: 代表大綱列表的 HTML 字串 (例如 <div class="outline-list"><a href="...">...</a>...</div>)。
 * `body`: 經過處理後 (可能移除了重複標題) 的原始 HTML 字串。
 */
export function createOutline(html, mainTitle) {
    // 檢查是否在瀏覽器環境 (因為使用了 DOM API)
    if (typeof document === 'undefined') {
        // console.warn("createOutline: 'document' is not available in this context (e.g., Service Worker). Returning original HTML.");
        return { outline: "", body: html }; // 在非瀏覽器環境，直接回傳原始 HTML
    }

    const tempWrapper = document.createElement("div"); // 創建一個暫存的 div 容器來解析 HTML 字串
    tempWrapper.innerHTML = html;

    // 嘗試移除與頁面主標題 (mainTitle) 重複的摘要內第一個大標題
    const firstHeadingCandidate = tempWrapper.querySelector("h1,h2,h3,strong,b");
    if (firstHeadingCandidate && mainTitle &&
        typeof firstHeadingCandidate.textContent === 'string' && // 確保 textContent 存在且為字串
        firstHeadingCandidate.textContent.trim() === mainTitle.trim()) {
        firstHeadingCandidate.remove(); // 若找到重複且內容相符，則移除該元素
    }

    // 搜集所有可作為大綱項目的標題元素 (h1, h2, h3, strong, b)
    const headings = [...tempWrapper.querySelectorAll("h1,h2,h3,strong,b")];
    if (headings.length === 0) {
        return { outline: "", body: tempWrapper.innerHTML }; // 若沒有找到任何可作為大綱的元素
    }

    // 為每個找到的標題元素設定唯一的 ID，以便大綱連結可以跳轉
    headings.forEach((h, i) => (h.id = `generated-outline-sec-${i}`));

    // 產生大綱列表的 HTML 內容
    const listHTML = headings
        .map((h, i) => {
            const textContent = h.textContent ? h.textContent.trim() : ""; // 獲取並清理標題文字
            // 只有當標題文字有效時才產生連結
            return textContent ? `<a href="#generated-outline-sec-${i}">${esc(textContent)}</a>` : "";
        })
        .filter(item => item) // 過濾掉可能因 textContent 為空而產生的空連結字串
        .join(""); // 將所有連結合併成一個 HTML 字串

    // 如果最終沒有產生任何有效的大綱連結 (例如所有標題都為空)
    if (!listHTML.trim()) {
        return { outline: "", body: tempWrapper.innerHTML };
    }

    return {
        outline: `<div class="outline-list">${listHTML}</div>`, // 包裹大綱列表的 div
        body: tempWrapper.innerHTML // 返回處理後 (可能移除了重複標題) 的 body HTML
    };
}