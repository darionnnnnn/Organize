// Qrganize/sidepanel-utils.js – 側邊欄輔助函式庫，用於優化與增強文字及 HTML 處理

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
 * 解析 AI 回應的 JSON 字串，提取結構化的重點。
 * @param {string} jsonString - AI 回應的 JSON 字串。
 * @returns {Array|null} - 如果解析成功且結構符合預期，則回傳包含重點物件的陣列。
 * 如果 JSON 無效，則回傳 null。
 * 如果 JSON 有效但結構不符，則回傳空陣列。
 */
export function parseAIJsonResponse(jsonString) {
    if (typeof jsonString !== 'string') {
        console.error("Invalid input to parseAIJsonResponse: not a string.", jsonString);
        return null;
    }

    let processingString = jsonString.trim();

    const parts = processingString.split('</think>');
    if (parts.length > 1) {
        processingString = parts.slice(1).join('');
    }

    // 步驟 1: 移除 Markdown 程式碼區塊符號
    if (processingString.startsWith("```json")) {
        processingString = processingString.substring(7).trimStart();
    } else if (processingString.startsWith("```")) {
        processingString = processingString.substring(3).trimStart();
    }

    if (processingString.endsWith("```")) {
        processingString = processingString.substring(0, processingString.length - 3).trimEnd();
    }

    if (!processingString) {
        console.warn("JSON string is empty after attempting to strip markdown fences.", "\nOriginal string (first 300):", jsonString);
        return null;
    }

    // 步驟 2: 嘗試修復特定的 JSON 字串內部錯誤換行問題
    // 此正則表達式尋找：一個結束引號、可選的空白、一個換行符、可選的空白、一個開始引號
    // 然後將其替換為 '\\n' (JSON 字串中合法的換行符)，有效地將兩個字串片段合併。
    // 例如： "... some text"\n "more text..."  =>  "... some text\\nmore text..."
    processingString = processingString.replace(/\"\s*\n\s*\"/g, "\\n");

    try {
        const parsedData = JSON.parse(processingString);
        if (parsedData && Array.isArray(parsedData.keyPoints)) {
            return parsedData.keyPoints.filter(p => p && typeof p.title === 'string' && typeof p.details === 'string' && (typeof p.quote === 'string' || typeof p.quote === 'undefined'));
        }
        // console.warn(
        //     "JSON parsed, but not expected structure. Data:", parsedData,
        //     "\nOriginal string (first 300):", jsonString.substring(0,300),
        //     "\nProcessed string (first 300):", processingString.substring(0,300)
        // );
        console.warn("JSON parsed, but not expected structure. Data:", parsedData);
        console.warn("Original string:", jsonString);
        console.warn("Processed string:", processingString);
        
        return []; // Return empty array for valid JSON but wrong structure
    } catch (error) {
        // console.error(
        //     "Cannot parse AI response as JSON:", error,
        //     "\nProcessed string (first 300 chars):", processingString.substring(0, 300),
        //     "\nOriginal string (first 300 chars):", jsonString.substring(0, 300)
        // );

        console.error("Cannot parse AI response as JSON:", error);
        console.error("Processed string:", processingString);
        console.error("Original string:", jsonString);
        
        return null; // Return null for invalid JSON
    }
}

/**
 * Decodes HTML entities in a string.
 * It uses the browser's DOM parsing capabilities to convert entities like &lt; or &amp;
 * back to their respective characters (< or &).
 * @param {string} str - The string containing HTML entities.
 * @returns {string} The string with HTML entities decoded. If input is not a string, it's returned as is.
 */
export function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str; // Add type check for robustness
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}