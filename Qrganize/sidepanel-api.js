// Qrganize/sidepanel-api.js
import { stripThink, esc as escapeHTML } from "./sidepanel-utils.js";
import { getConfig, getChatUrl, getLevelText } from "./sidepanel-config.js";
import { S } from "./sidepanel-state.js"; // <--- 新增此行來匯入 S

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
            let errorMsgText = `HTTP ${res.status} ${res.statusText}`;
            if (cfg.showErr && responseBodyText) {
                const htmlErrorMatch = responseBodyText.match(/<center><h1>(.*?)<\/h1>/i);
                const extractedError = htmlErrorMatch && htmlErrorMatch[1] ? escapeHTML(htmlErrorMatch[1]) : escapeHTML(responseBodyText.substring(0,100) + "...");
                errorMsgText += ` - ${extractedError}`;
            }
            throw new Error(errorMsgText);
        }

        const rawResponseText = await res.text();
        const jsonResponse = JSON.parse(rawResponseText);

        if (typeof jsonResponse?.message?.content === 'string') {
            return jsonResponse.message.content;
        } else {
            const errorText = "AI 伺服器回應中缺少 'message.content' 或其非字串";
            let detail = "";
            if (cfg.showErr) { detail = ` (實際回應: ${escapeHTML(JSON.stringify(jsonResponse).substring(0, 200))})`;}
            throw new Error(`${errorText}${detail}`);
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

// buildSummaryPrompt 函式 (使用您先前版本中，我提供的包含詳細JSON轉義說明的版本)
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

// summarizeContent 函式 (現在 S() 應該是定義好的)
export async function summarizeContent(title, content, abortSignal) {
    const prompt = buildSummaryPrompt(title, content);
    S().lastSummaryPrompt = prompt; // Store the prompt in state
    const rawAIResponse = await fetchAI(prompt, abortSignal);
    return stripThink(rawAIResponse);
}

// buildQAPrompt 函式 (保持不變)
export function buildQAPrompt(question, pageTitle, qaHistory, summaryKeyPoints, pageSourceText) {
    const cfg = getConfig();
    let contextString = `關於網頁「${pageTitle || '未知標題'}」的內容。\n`;

    if (summaryKeyPoints && summaryKeyPoints.length > 0) {
        contextString += "該網頁的AI摘要重點如下：\n";
        summaryKeyPoints.forEach(p => {
            const detailSnippet = p.details.length > 100 ? p.details.substring(0, 100) + "..." : p.details;
            contextString += `- ${p.title}: ${detailSnippet}\n`;
            if (p.quote) {
                const quoteSnippet = p.quote.length > 70 ? p.quote.substring(0, 70) + "..." : p.quote;
                contextString += `  (相關原文片段: ${quoteSnippet})\n`;
            }
        });
        contextString += "\n";
    } else if (pageSourceText && pageSourceText.length > 0) {
        contextString += `原始文本的片段如下(約前300字元)：\n${pageSourceText.substring(0,300)}...\n\n`;
    }

    const relevantHistory = qaHistory.slice(0, -1).filter(h => h.a !== "…").slice(-2);
    if (relevantHistory.length > 0) {
        contextString += "我們之前的問答記錄(最近相關的2條)：\n";
        relevantHistory.forEach(h => {
            const answerSnippet = typeof h.a === 'string' && h.a.length > 100 ? h.a.substring(0,100) + "..." : h.a;
            contextString += `使用者提問：${h.q}\n先前回答：${answerSnippet}\n\n`;
        });
    }

    return `請嚴格根據以下提供的「上下文資訊」來回答「使用者的問題」。您的回答應直接針對問題，並僅限於從上下文中獲取的資訊。請勿使用任何上下文以外的知識，也不要進行延伸推測或給出與上下文無關的建議。如果問題無法從上下文中找到答案，請直接表明「根據目前提供的資訊，我無法回答這個問題。」或類似的說法。
請使用 Markdown 語法來排版您的回答，例如使用「#」、「##」、「###」來表示不同層級的標題，使用「-」或「*」開頭表示列表項。
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
                return reject(new Error(cfg.showErr ? `無法連接到內容腳本: ${chrome.runtime.lastError.message}` : "無法取得內容"));
            }
            if (response && typeof response.text === 'string' && typeof response.title === 'string') {
                resolve(response);
            } else if (response && response.error) {
                reject(new Error(cfg.showErr ? `提取內容錯誤: ${response.error}`: "無法取得內容"));
            }
            else {
                reject(new Error(cfg.showErr ? "內容腳本回傳的資料格式不正確或為空" : "無法取得內容"));
            }
        });
    });
}