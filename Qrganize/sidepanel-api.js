// Qrganize/sidepanel-api.js
import { stripThink, esc as escapeHTML } from "./sidepanel-utils.js";
import { getConfig, getChatUrl, getLevelText } from "./sidepanel-config.js";
import { S } from "./sidepanel-state.js";

// fetchAI 函式 (保持不變)
export async function fetchAI(promptText, userSignal = null) {
    const cfg = getConfig();
    const chatUrl = getChatUrl();
    const abortCtrl = new AbortController();
    const combinedSignal = abortCtrl.signal;
    let timeoutId = null;

    const timeoutMs = cfg.aiTimeout * 1000;

    if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            abortCtrl.abort(new DOMException('TimeoutError', `TimeoutError (${cfg.aiTimeout}s)`));
        }, timeoutMs);
    }

    const handleUserAbort = () => {
        if (timeoutId) clearTimeout(timeoutId);
        abortCtrl.abort(userSignal.reason || new DOMException('AbortError', 'UserAbort'));
    };

    if (userSignal) {
        if (userSignal.aborted) {
            if (timeoutId) clearTimeout(timeoutId);
            throw userSignal.reason || new DOMException('AbortError', 'UserAbort (pre-aborted)');
        }
        userSignal.addEventListener('abort', handleUserAbort, { once: true });
    }

    combinedSignal.addEventListener('abort', () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (userSignal) userSignal.removeEventListener('abort', handleUserAbort);
    }, { once: true });

    const payload = { model: cfg.model, messages: [ { role: "user", content: promptText } ], stream: false };

    try {
        const res = await fetch(chatUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: combinedSignal
        });

        if (timeoutId) clearTimeout(timeoutId);
        if (userSignal) userSignal.removeEventListener('abort', handleUserAbort);

        if (!res.ok) {
            const responseBodyText = await res.text().catch(() => "");
            let errorMsgText; // Declared here
            if (cfg.showErr) {
                const htmlErrorMatch = responseBodyText.match(/<center><h1>(.*?)<\/h1>/i);
                const extractedError = htmlErrorMatch && htmlErrorMatch[1] ? escapeHTML(htmlErrorMatch[1]) : escapeHTML(responseBodyText.substring(0,100) + "...");
                // For showErr, append the extracted error to the basic HTTP status
                errorMsgText = `HTTP ${res.status} ${res.statusText}${extractedError ? ' - ' + extractedError : ''}`;
            } else {
                errorMsgText = `AI 伺服器請求失敗 (HTTP ${res.status} ${res.statusText})。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。`;
            }
            throw new Error(errorMsgText);
        }

        const rawResponseText = await res.text();
        const jsonResponse = JSON.parse(rawResponseText);

        if (typeof jsonResponse?.message?.content === 'string') {
            return jsonResponse.message.content;
        } else {
            let errorToThrow;
            if (cfg.showErr) {
                errorToThrow = `AI 伺服器回應中缺少 'message.content' 或其非字串 (實際回應: ${escapeHTML(JSON.stringify(jsonResponse).substring(0, 200))})`;
            } else {
                errorToThrow = "AI 伺服器回應格式錯誤。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。";
            }
            throw new Error(errorToThrow);
        }
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        if (userSignal) userSignal.removeEventListener('abort', handleUserAbort);

        if (e.name === 'TimeoutError') {
            throw new Error(`請求超時 (超過 ${cfg.aiTimeout} 秒)`);
        }
        throw e;
    }
}

// buildSummaryPrompt 函式 (已修改)
export function buildSummaryPrompt(title, content) {
    const cfg = getConfig();
    const levelText = getLevelText();
    const isDirectOutputMode = cfg.directOutput; // Get the flag from config
    let prompt;

    if (isDirectOutputMode) {
        prompt = `您是一位專業的內容分析師。請將以下提供的「原始內容」整理成一段或數段流暢易讀的摘要。

重要指示：
- 請直接輸出摘要內容，不要使用任何 JSON 格式或任何程式碼區塊。
- 摘要應完全基於「原始內容」，不得推論或延伸原文未提及的資訊。
- 摘要的語言請使用：「${cfg.outputLanguage}」。
- 摘要的詳細程度請參考：「${levelText}」。
- 如果「原始內容」過於簡短或不適合生成摘要，請直接回答「內容過於簡短，無法提供有意義的摘要。」。

原始內容如下：
標題：${title}
內容：${preprocessInputForAI(content)}
`;
    } else {
        // Existing JSON prompt logic
        prompt = `您是一位專業的內容分析師。請將以下內容整理成數個主要重點，並以「${cfg.outputLanguage}」撰寫。

⚠️ 請**僅輸出一個合法的 JSON 物件**，不得包含任何說明。

JSON 物件格式如下：
{
  "keyPoints": [
    {
      "title": "（字串）重點的簡潔標題",
      "details": "（字串）詳細說明，可用 \\n 表示段落換行",
      "quote": "（字串，可選）引用原文中的一句話，如無可省略或留空"
    }
  ]
}

格式規範：
- 僅輸出上述 JSON 物件格式 結構
- 正確轉義所有特殊字元：
  - " → \\\"
  - \\ → \\\\
  - 實體換行符 → \\n
- 禁止未轉義的控制字元（如實體換行、tab、Unicode 控制符）

摘要規範：
- 摘要需扼要且與原文資訊量相符
- 僅依據原文撰寫，不得推論延伸
- 若原文過短無法摘要，請回傳：
{
  "keyPoints": [
    {
      "title": "內容過簡",
      "details": "原始內容過於簡短，無法進行有效摘要。",
      "quote": ""
    }
  ]
}

摘要詳略程度請參考：「${levelText}」

原始內容如下：
標題：${title}
內容：${preprocessInputForAI(content)}
`;
    }
    
    return prompt;
}

function preprocessInputForAI(rawText) {
    if (typeof rawText !== 'string') return '';

    let result = rawText;

    // 清除常見無效分隔符或裝飾符號
    result = result.replace(/[★☆◎▲※◆■▍●◎◆►]|={3,}|-{3,}|\*{3,}|\/{2,}|\.{3,}/g, '');

    // 替換 markdown、網頁常見符號
    result = result
        .replace(/^#+\s*/gm, '') // # 標題移除
        .replace(/^\s*[\-\*+]\s+/gm, '') // 移除列點符號
        .replace(/\r\n|\r/g, '\n') // 統一換行符號

    // 移除多餘空行（3 行以上視為冗餘）
    result = result.replace(/\n{3,}/g, '\n\n');

    // 去除空白行首行尾空白
    result = result
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    // 清理空白 HTML tag / 雜訊
    result = result.replace(/<[^>]*>/g, '');

    // 清除常見無意義短語（可根據需求增補）
    result = result.replace(/(首波工商時間|特別感謝|請見影片|敬請期待|更多資訊請見.*?)/g, '');

    return result.trim();
}

// summarizeContent 函式 (保持不變)
export async function summarizeContent(title, content, abortSignal) {
    const prompt = buildSummaryPrompt(title, content);
    S().lastSummaryPrompt = prompt; // Store the prompt in state
    const rawAIResponse = await fetchAI(prompt, abortSignal);
    return stripThink(rawAIResponse);
}

// buildQAPrompt 函式 (已修改)
export function buildQAPrompt(question, pageTitle, qaHistory, summaryKeyPoints, pageSourceText) {
    const cfg = getConfig();
    let contextString = `關於網頁「${pageTitle || '未知標題'}」的內容。\n`;

    if (summaryKeyPoints && summaryKeyPoints.length > 0) {
        contextString += "該網頁的AI摘要重點如下 (這些摘要是基於下方提供的完整原始內容產生的)：\n";
        summaryKeyPoints.forEach(p => {
            const detailSnippet = p.details.length > 100 ? p.details.substring(0, 100) + "..." : p.details;
            contextString += `- ${p.title}: ${detailSnippet}\n`;
            if (p.quote) {
                const quoteSnippet = p.quote.length > 70 ? p.quote.substring(0, 70) + "..." : p.quote;
                contextString += `  (相關原文片段: ${quoteSnippet})\n`;
            }
        });
        contextString += "\n";
    }

    if (pageSourceText && pageSourceText.length > 0) {
        contextString += `以下是該網頁的完整原始內容，請優先根據此內容來回答問題：\n--- 原始內容開始 ---\n${pageSourceText}\n--- 原始內容結束 ---\n\n`;
    } else if (!summaryKeyPoints || summaryKeyPoints.length === 0) {
        contextString += `(注意：目前沒有提供網頁的詳細原始內容或AI摘要資訊來回答您的問題。)\n\n`;
    }

    const relevantHistory = qaHistory.slice(0, -1).filter(h => h.a !== "…").slice(-2);
    if (relevantHistory.length > 0) {
        contextString += "我們之前的問答記錄(最近相關的2條)：\n";
        relevantHistory.forEach(h => {
            const answerSnippet = typeof h.a === 'string' && h.a.length > 100 ? h.a.substring(0,100) + "..." : h.a;
            contextString += `使用者提問：${h.q}\n先前回答：${answerSnippet}\n\n`;
        });
    }

    return `請你扮演本文的作者，並以第一人稱角度回答使用者的問題。你對問題的回答必須**完全根據下方「上下文資訊」中的內容**，不得引入任何未被提及的知識、推測性資料，或與上下文無關的建議。

但請注意：當使用者的問題沒有被明確提及時，**你可以在上下文內容的基礎上進行合乎邏輯的推論與詮釋**，前提是這些推論**有跡可循**，且**沒有違背原意**。例如：若文章提到「規格不是強項，但設計令人驚艷」，你可以合理理解作者並不認為規格很差，而是將重點放在設計上。

請遵守以下規範：
- 僅根據上下文內容作答，禁止加入未被提及的背景知識或外部資訊
- 若上下文中確實未提及相關內容，也無法進行合理推論，請直接表明無法回答，例如：「這部分我在文章中沒有提及」或「我沒有在內容中說明這個問題」
- 僅使用純文字，請勿使用任何 Markdown 語法（如：#、*、- 等符號）
- 若內容較長，可使用簡單點列，每列以「- 」開頭；若內容簡短，請以自然段落文字回答

請使用「${cfg.outputLanguage}」作答。

---上下文資訊開始---
${contextString}
---上下文資訊結束---

使用者的問題：
${question}`;


}

// askAIQuestion 函式 (保持不變)
export async function askAIQuestion(question, pageTitle, qaHistory, summaryKeyPoints, pageSourceText) {
    const prompt = buildQAPrompt(question, pageTitle, qaHistory, summaryKeyPoints, pageSourceText);
    const rawAiResponse = await fetchAI(prompt, null);
    return {
        answer: stripThink(rawAiResponse),
        rawAnswer: rawAiResponse,
        prompt: prompt
    };
}

// getArticleContent 函式 (保持不變)
export async function getArticleContent() {
    const cfg = getConfig();
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) {
            return reject(new Error(cfg.showErr ? "擴充功能環境無效，無法發送訊息" : "無法取得內容"));
        }
        chrome.runtime.sendMessage({ type: "EXTRACT_ARTICLE" }, response => {
            if (chrome.runtime.lastError) {
                return reject(new Error(cfg.showErr ? `無法連接到內容腳本: ${chrome.runtime.lastError.message}` : "無法取得內容。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。"));
            }
            if (response && typeof response.text === 'string' && typeof response.title === 'string') {
                resolve(response);
            } else if (response && response.error) {
                reject(new Error(cfg.showErr ? `提取內容錯誤: ${response.error}`: "無法取得內容。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。"));
            }
            else {
                reject(new Error(cfg.showErr ? "內容腳本回傳的資料格式不正確或為空" : "無法取得內容。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。"));
            }
        });
    });
}