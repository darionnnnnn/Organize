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

// buildSummaryPrompt 函式 (保持不變)
export function buildSummaryPrompt(title, content) {
    const cfg = getConfig();
    const levelText = getLevelText();
    return `您是一位專業的內容分析師。請將以下內容整理成數個主要重點，並確保所有文字都使用「${cfg.outputLanguage}」。
請以一個 JSON 物件的格式輸出您的回應。JSON 物件應包含一個名為 "keyPoints" 的陣列，其中每個元素都是一個物件，代表一個重點。
每個重點物件應有以下三個鍵：
1. "title": (字串) 代表重點的簡潔標題。
2. "details": (字串) 代表重點的詳細說明。詳細說明中可以使用換行符號 "\\n" 來表示段落分隔。
3. "quote": (字串，可選) 如果您的摘要或詳細說明中直接引用了原始文章的片段來支持觀點，請將該引用的原文片段（建議50-150字元，不宜過長）放在此欄位。如果沒有直接引用，則省略此 "quote" 欄位或將其值設為空字串。

請確保所有輸出的文字內容均為 UTF-8 編碼的「${cfg.outputLanguage}」。

JSON 輸出範例如下（請嚴格遵守此結構，不要添加額外註解或文字）：
{
  "keyPoints": [
    {
      "title": "重點標題一",
      "details": "這是重點一的詳細說明第一段話。\\n這是重點一的詳細說明第二段話。",
      "quote": "這是從原文中引用的一段相關文字，它可能包含一些 \\"引號\\" 或特殊符號 \\\\ 需被正確轉義。"
    },
    {
      "title": "重點標題二",
      "details": "這是重點二的詳細說明，只有一段。"
    }
  ]
}

重要指示：
- 摘要應簡潔扼要，長度與原始內容的複雜度和長度成正比。
- 請專注於原始文本中明確提到的信息，避免不必要的延伸解釋或添加文本中未包含的外部知識。
- 如果原始文本非常簡短，摘要也應同樣簡短，可能只包含一到兩個重點。若內容過於簡短無法有效摘要，請在 "keyPoints" 陣列中提供一個說明情況的重點，例如 {"title": "內容過簡", "details": "原始內容過於簡短，無法進行有效摘要。", "quote": ""}。
- 重點的數量應根據內容的實際信息量決定，而非強制固定數量。
- **請特別注意：在 "title", "details", 和 "quote" 欄位的字串值中，任何特殊字元（例如雙引號 \\"，反斜線 \\\\，以及其他如換行符 \\n（代表真實換行，而非文字 '\\n'）、定位符 \\t 等控制字元）都必須依照 JSON 字串的標準進行正確轉義。例如，若 'quote' 的內容是 '他說: "引言內容"'，則在 JSON 中應表示為 '\"quote\": \"他說: \\\\\\"引言內容\\\\\"\"'。確保字串值本身不包含未轉義的真實換行符，除非它們是 \\n 形式。**

請確保您的輸出是一個符合上述描述且語法正確的 JSON 物件。不要在 JSON 物件前後添加任何額外的文字、解釋或 markdown 的 code block 符號。
摘要的詳細程度請參考：「${levelText}」。

原始內容如下：
標題：${title}
內容：${content}
`;
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

    // 修改點: 調整 AI 回覆時的措辭
    return `請直接回答「使用者的問題」。您的回答應僅限於從以下提供的「上下文資訊」中獲取的內容。請勿使用任何上下文以外的知識，也不要進行延伸推測或給出與上下文無關的建議。
如果問題的答案在「上下文資訊」中未提及，請直接表明無法回答，例如說「我找不到相關資訊來回答這個問題。」或類似的說法。
您的回答必須是純文字，請勿使用任何 Markdown 標記語言 (例如：井號標題、星號或減號列表、粗體、斜體等)。
如果回答的內容較長，您可以考慮使用簡單的點列方式來呈現，例如每個點列項獨立一行並以 "-" (減號加一個空格) 開頭。如果回答不長，則直接以段落文字呈現即可，無需特別排版。
請用「${cfg.outputLanguage}」回答。

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