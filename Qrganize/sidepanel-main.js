// sidepanel-main.js - 整合「複製Prompt」、重試按鈕及其他調整
import { esc, stripThink, cleanAI } from "./sidepanel-utils.js";

const $ = id => document.getElementById(id);

// DOM 元素快取
const elements = {
    btnSummary: $("summarize-btn"),
    btnClear: $("clear-btn"),
    btnClose: $("close-btn"),
    hTitle: $("summary-title"),        // 顯示網頁標題或 "選取文字"
    divContent: $("summary-content"),  // 主要注入摘要卡片或狀態訊息的地方
    hrSep: $("qa-separator"),          // Q&A 區塊上方的分隔線
    qaList: $("qa-list"),              // Q&A 對話歷史列表
    qaInput: $("qa-input"),            // Q&A 問題輸入框
    askBtn: $("ask-btn")               // Q&A 送出按鈕
};

// 預設設定
let cfg = {
    detail: "medium",
    apiUrl: "https://192.168.68.103/api/chat", // 使用者應在設定頁修改此項
    model: "qwen3",                           // 預設使用的 Ollama 模型
    font: "medium",                           // 側邊欄預設字體大小 (small, medium, large)
    outputLanguage: "繁體中文",               // AI 輸出的預設語言
    panelWidth: 420,                          // 側邊欄預設寬度 (未使用，需在 manifest 或 toggle-panel.js 控制)
    showErr: false                            // 是否顯示詳細錯誤訊息
};

// 從 Chrome Storage 同步設定
await new Promise(r => chrome.storage.sync.get(cfg, v => { cfg = { ...cfg, ...v }; r(); }));
document.body.classList.add(`font-${cfg.font}`); // 應用字體大小 class

// API 端點路徑處理
let chatEndpoint = cfg.apiUrl.trim();
const lowerApiUrl = chatEndpoint.toLowerCase();
if (!lowerApiUrl.endsWith('/chat') && !lowerApiUrl.endsWith('/chat/')) {
    chatEndpoint = chatEndpoint.replace(/\/+$/, '') + '/chat';
} else {
    chatEndpoint = chatEndpoint.replace(/\/+$/, '');
}
const chatUrl = chatEndpoint;

// 狀態變數
let running = false;            // 標記 AI 是否正在處理主要摘要請求
let ctrl = null;                // AbortController 用於取消 fetch 請求
let history = [];               // Q&A 對話歷史
let rawAI = "";                 // AI 回傳的原始字串 (通常是 JSON)
let srcText = "";               // 從網頁擷取的原始文本
let lastSummaryPrompt = "";     // 上一次摘要使用的 Prompt
let lastRunSelection = "";      // 上一次 run 函式的 sel 參數，用於重試

// --- 輔助函式 ---
const disableQA = d => { elements.qaInput.disabled = d; elements.askBtn.disabled = d; };
const levelTxt = () => ({ high: "詳細", medium: "中等", low: "精簡" }[cfg.detail] || "中等");

const errMsg = e => {
    console.error("側邊欄執行時發生錯誤:", e);
    return cfg.showErr ? `❗ ${e.message}` : "⚠️ 處理過程中發生錯誤";
}

// 基本的字串清理，移除一些可能導致顯示問題的控制字元
function sanitizeStringForDisplay(str) {
    if (typeof str !== 'string') return "";
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '�');
}

// 解析 AI 回傳的 JSON 字串
function parseAIJsonResponse(jsonString) {
    let parsedData;
    try {
        parsedData = JSON.parse(jsonString);
    } catch (error) {
        console.error("無法解析 AI 回應為 JSON:", error, "\n原始字串 (前300字元):", jsonString.substring(0, 300));
        return null; // 表示 JSON 解析嚴重失敗
    }

    if (parsedData && Array.isArray(parsedData.keyPoints)) {
        // 過濾確保每個重點都有 title 和 details 字串，且 quote (如果存在) 也是字串
        return parsedData.keyPoints.filter(p =>
            p && typeof p.title === 'string' && typeof p.details === 'string' &&
            (typeof p.quote === 'string' || typeof p.quote === 'undefined') // quote 是可選的
        );
    }

    console.warn("已解析的 JSON 有效，但不符合預期結構 (例如缺少 'keyPoints' 陣列，或陣列元素格式不對)。解析後的資料:", parsedData);
    return []; // JSON 有效但結構不對或 keyPoints 為空
}

// --- 事件監聽器 ---
elements.btnClose.onclick = () => parent.postMessage({ type: "CLOSE_PANEL" }, "*");
elements.btnSummary.onclick = () => { if (!running) run(lastRunSelection); };
elements.btnClear.onclick = () => {
    if (running && ctrl) {
        ctrl.abort();
    } else {
        reset();
    }
};

$("qa-form").onsubmit = async e => {
    e.preventDefault();
    const q = elements.qaInput.value.trim();
    if (!q) return;

    const questionEntry = { q, q_id: Date.now(), a: "…" }; // 使用 q_id
    history.push(questionEntry);
    drawQA();
    elements.qaInput.value = "";
    disableQA(true);

    try {
        const aiAnswer = await askAI(q);
        questionEntry.a = stripThink(aiAnswer);
    } catch (er) {
        console.error("Q&A 過程中發生錯誤:", er);
        questionEntry.a = "❌ " + (er.message || "AI 問答時發生錯誤");
    } finally {
        drawQA();
        disableQA(false);
        elements.qaInput.focus();
    }
};

window.addEventListener("message", e => {
    if (e.data?.type === "SUMMARY_SELECTED_TEXT" && !running) {
        run(e.data.text);
    }
});

// --- 主要執行函式 ---
async function run(sel = "") {
    lastRunSelection = sel;
    running = true;
    elements.btnSummary.disabled = true;
    elements.btnSummary.textContent = "摘要中…";
    disableQA(true);
    elements.hrSep.style.display = "none";
    elements.qaList.innerHTML = "";
    history = [];
    lastSummaryPrompt = "";
    elements.divContent.innerHTML = '<div class="summary-status">截取文章中…</div>';
    ctrl = new AbortController();

    try {
        const art = sel ? { title: "選取文字", text: sel } : await getArticle();
        srcText = art.text.trim();
        elements.hTitle.textContent = art.title;
        elements.divContent.innerHTML = '<div class="summary-status">AI 摘要中…</div>';

        rawAI = stripThink(await summarize(art.title, srcText));
        const structuredSummary = parseAIJsonResponse(rawAI);

        let buttons = "";
        if (cfg.showErr) {
            buttons = `
            <div class="action-buttons-summary">
                ${lastSummaryPrompt ? `<button id="copy-summary-prompt" class="copy-btn">複製摘要Prompt</button>` : ''}
                ${rawAI.trim() ? `<button id="copy-raw" class="copy-btn">複製原始回應</button>` : ''}
                ${srcText ? `<button id="copy-src" class="copy-btn">複製原始內容</button>` : ''}
            </div>`;
        }

        if (structuredSummary === null) {
            let errorDisplayHTML = `⚠️ AI 回應的 JSON 格式無效。`;
            if (cfg.showErr) {
                errorDisplayHTML = `⚠️ AI 回應的 JSON 格式無效。${rawAI.trim() ? '請檢查主控台以獲取詳細資訊。' : 'AI 未回傳任何內容。'}`;
            }
            finish(false, errorDisplayHTML, () => run(lastRunSelection)); // 傳遞重試函式

        } else if (structuredSummary.length > 0) {
            let keyPointsListHTML = '<ul id="key-points-list" class="outline-list">';
            let detailsBlocksHTML = '<div id="key-points-details-container">';
            structuredSummary.forEach((point, index) => {
                const pointId = `kp-detail-${index}`;
                const sanitizedTitle = sanitizeStringForDisplay(point.title);
                const sanitizedDetails = sanitizeStringForDisplay(point.details);
                const sanitizedQuote = point.quote ? sanitizeStringForDisplay(point.quote) : "";
                const cleanTitle = cleanAI(sanitizedTitle).replace(/<\/?p>/g, '').trim();
                const cleanDetails = cleanAI(sanitizedDetails);
                const cleanQuote = point.quote && sanitizedQuote ? cleanAI(sanitizedQuote) : "";

                keyPointsListHTML += `<li><a href="#${pointId}">${esc(cleanTitle || "無標題重點")}</a></li>`;
                detailsBlocksHTML += `
                    <div class="key-point-detail-block" id="${pointId}">
                        <h3>${esc(cleanTitle || "無標題重點")}</h3>
                        ${cleanDetails}
                        ${cleanQuote ? `<blockquote class="original-text-quote">${cleanQuote}</blockquote>` : ''}
                    </div>`;
            });
            keyPointsListHTML += '</ul>';
            detailsBlocksHTML += '</div>';

            const originalArticleHTML = srcText ? `
                <div class="original-article-container">
                    <button id="toggle-original-article" class="original-article-toggle" aria-expanded="false" aria-controls="original-article-content">
                        <span class="toggle-icon">▼</span> 原始文章內容
                    </button>
                    <div id="original-article-content" class="original-article-text" style="display:none;">
                        ${cleanAI(sanitizeStringForDisplay(srcText))}
                    </div>
                </div>
            ` : "";

            elements.divContent.innerHTML = `
                <div class="summary-card">
                    ${buttons}
                    ${keyPointsListHTML}
                    <hr class="summary-detail-separator"> 
                    ${detailsBlocksHTML}
                </div>
                ${originalArticleHTML}`;

            if (cfg.showErr) {
                if (lastSummaryPrompt) bindCopy("#copy-summary-prompt", lastSummaryPrompt);
                if (rawAI.trim()) bindCopy("#copy-raw", rawAI);
                if (srcText) bindCopy("#copy-src", srcText);
            }

            elements.divContent.querySelectorAll("#key-points-list a").forEach(a => {
                a.onclick = ev => {
                    ev.preventDefault();
                    const id = a.getAttribute("href").slice(1);
                    const targetElement = elements.divContent.querySelector(`#${id}`);
                    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
                };
            });
            if (srcText) {
                const toggleBtn = elements.divContent.querySelector("#toggle-original-article");
                const originalContent = elements.divContent.querySelector("#original-article-content");
                if (toggleBtn && originalContent) {
                    toggleBtn.onclick = () => {
                        const isExpanded = originalContent.style.display !== "none";
                        originalContent.style.display = isExpanded ? "none" : "block";
                        toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
                        toggleBtn.querySelector(".toggle-icon").textContent = isExpanded ? "▼" : "▲";
                    };
                }
            }
            elements.hrSep.style.display = "block";
            disableQA(false);
            elements.qaInput.focus();
            finish(true);

        } else {
            let noPointsMessage = "AI 未能從內容中提取結構化重點。";
            if (!rawAI.trim()){ noPointsMessage = "AI 未回傳任何內容。"; }
            else if (rawAI.trim() === "{}") { noPointsMessage = "AI 回應了空的 JSON 物件。"; }
            else if (rawAI.trim().match(/^\{\s*("keyPoints"\s*:\s*\[\s*\])\s*\}$/)) { noPointsMessage = "AI 回應了 JSON 但未包含任何重點。"; }

            finish(false, noPointsMessage + (cfg.showErr && rawAI.trim() ? " (原始回應已記錄於主控台)" : ""), () => run(lastRunSelection));
        }

    } catch (e) {
        if (e.name === "AbortError") {
            finish(false, "❌ 已取消摘要");
        } else {
            finish(false, errMsg(e), () => run(lastRunSelection)); // 傳遞重試函式
        }
    }
}

function bindCopy(sel, data) {
    const btn = elements.divContent.querySelector(sel) || document.querySelector(sel);
    if (!btn) {
        return;
    }
    btn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(data);
            const oldText = btn.textContent;
            btn.textContent = "已複製！";
            setTimeout(() => { btn.textContent = oldText; }, 2000);
        } catch (err) {
            console.error("複製文字失敗: ", err);
            const oldText = btn.textContent;
            btn.textContent = "複製失敗";
            setTimeout(() => { btn.textContent = oldText; }, 2000);
        }
    };
}

function finish(ok, msg = "", retryCallback = null) {
    running = false;
    elements.btnSummary.disabled = false;
    elements.btnSummary.textContent = "摘要";
    ctrl = null;
    if (!ok && msg) {
        let retryButtonHTML = '';
        if (retryCallback && cfg.showErr) { // 只有在 cfg.showErr 為 true 且有重試函式時才顯示
            retryButtonHTML = ` <button id="generic-retry-btn" class="button-retry">重試</button>`;
        }
        elements.divContent.innerHTML = `<div class="summary-status">${msg}${retryButtonHTML}</div>`;
        if (retryButtonHTML && retryCallback) { // 確認按鈕存在才綁定事件
            const btn = document.getElementById("generic-retry-btn");
            if (btn) btn.onclick = () => {
                elements.divContent.innerHTML = '<div class="summary-status">正在重試...</div>';
                retryCallback();
            };
        }
        elements.hrSep.style.display = "none";
    } else if (!ok) { // 其他未預期的 !ok 情況
        elements.divContent.innerHTML = `<div class="summary-status">處理摘要時發生未知錯誤。</div>`;
        elements.hrSep.style.display = "none";
    }
    // 成功時 (ok=true), hrSep 和 QA 區域保持 run() 中設定的顯示狀態
}

function reset() {
    elements.hTitle.textContent = "AI 內容摘要";
    elements.divContent.innerHTML = '<div class="summary-status">請按「摘要」開始，或在網頁上選取文字後點擊擴充功能圖示/右鍵選單。</div>';
    elements.hrSep.style.display = "none";
    history = [];
    drawQA();
    disableQA(true);
    rawAI = "";
    srcText = "";
    lastSummaryPrompt = "";
    lastRunSelection = "";
}

function drawQA() {
    elements.qaList.innerHTML = history.map(h => {
        const sanitizedAnswer = sanitizeStringForDisplay(h.a);
        let formattedAnswer = h.a === "…" ? h.a : cleanAI(sanitizedAnswer);
        let retryButtonForQA = '';

        if (h.a.startsWith("❌ ") && cfg.showErr) {
            retryButtonForQA = ` <button class="button-retry qa-retry-btn" data-question-id="${h.q_id}" data-question-text="${esc(h.q)}">重試</button>`;
        }
        return `
            <div class="qa-pair">
              <div class="qa-q">Q：${esc(h.q)}</div>
              <div class="qa-a">${formattedAnswer}${retryButtonForQA}</div>
            </div>`;
    }).join("");

    elements.qaList.querySelectorAll(".qa-retry-btn").forEach(btn => {
        if (!btn.dataset.listenerAttached) {
            btn.onclick = async (event) => {
                const questionId = parseInt(event.currentTarget.dataset.questionId);
                const questionToRetry = event.currentTarget.dataset.questionText;

                const erroredEntry = history.find(entry => entry.q_id === questionId);
                if (erroredEntry) {
                    erroredEntry.a = "…";
                    drawQA();
                    disableQA(true);
                    try {
                        const aiAnswer = await askAI(questionToRetry);
                        erroredEntry.a = stripThink(aiAnswer);
                    } catch (er) {
                        console.error("Q&A 重試失敗:", er);
                        erroredEntry.a = "❌ " + (er.message || "AI 問答重試失敗");
                    } finally {
                        drawQA();
                        disableQA(false);
                        elements.qaInput.focus(); // 重試後焦點回到輸入框
                    }
                }
            };
            btn.dataset.listenerAttached = "true";
        }
    });

    if (elements.qaList.children.length > 0) {
        elements.qaList.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
    }
}

async function fetchAI(promptText, signal = null) {
    const payload = { model: cfg.model, messages: [ { role: "user", content: promptText } ], stream: false };
    const res = await fetch(chatUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: signal });
    if (!res.ok) {
        const responseBodyText = await res.text().catch(() => "");
        let errorMsg = `HTTP ${res.status} ${res.statusText}`;
        if (cfg.showErr && responseBodyText) { errorMsg += ` - ${responseBodyText.substring(0, 200)}`; }
        throw new Error(errorMsg);
    }
    let jsonResponse; let rawResponseText = "";
    try {
        rawResponseText = await res.text(); jsonResponse = JSON.parse(rawResponseText);
    } catch (e) {
        const errorText = "無法解析 AI 伺服器回應的外部 JSON 結構"; let detail = "";
        if (cfg.showErr) { detail = ` 狀態: ${res.status} ${res.statusText}. 原始回應片段: ${rawResponseText.substring(0, 100)}`;}
        throw new Error(`${errorText}${detail}`);
    }
    if (typeof jsonResponse?.message?.content === 'string') { return jsonResponse.message.content; }
    else {
        const errorText = "AI 伺服器回應中缺少 'message.content' 或其非字串"; let detail = "";
        if (cfg.showErr) { detail = ` (實際回應: ${JSON.stringify(jsonResponse).substring(0, 200)})`;}
        throw new Error(`${errorText}${detail}`);
    }
}

async function summarize(t, c) {
    // 將 promptContent 賦值給 lastSummaryPrompt 以便複製
    lastSummaryPrompt = `您是一位專業的內容分析師。請將以下內容整理成數個主要重點，並確保所有文字都使用「${cfg.outputLanguage}」。
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
      "quote": "這是從原文中引用的一段相關文字。"
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

請確保您的輸出是一個符合上述描述且語法正確的 JSON 物件。不要在 JSON 物件前後添加任何額外的文字、解釋或 markdown 的 code block 符號。
摘要的詳細程度請參考：「${levelTxt()}」。

原始內容如下：
標題：${t}
內容：${c}
`;
    return await fetchAI(lastSummaryPrompt, ctrl?.signal);
}

async function askAI(q) {
    let contextString = `關於網頁「${elements.hTitle.textContent || '未知標題'}」的內容。`;
    const currentSummaryPoints = parseAIJsonResponse(rawAI);

    if (currentSummaryPoints && currentSummaryPoints.length > 0) {
        contextString += "該網頁的AI摘要重點如下：\n";
        currentSummaryPoints.forEach(p => {
            const detailSnippet = p.details.length > 100 ? p.details.substring(0, 100) + "..." : p.details;
            contextString += `- ${p.title}: ${detailSnippet}\n`;
            if (p.quote) {
                const quoteSnippet = p.quote.length > 70 ? p.quote.substring(0, 70) + "..." : p.quote;
                contextString += `  (相關原文片段: ${quoteSnippet})\n`;
            }
        });
        contextString += "\n";
    } else if (srcText && srcText.length > 0) { // 如果沒有結構化摘要，但有原始文本
        contextString += `原始文本的片段如下(約前300字元)：\n${srcText.substring(0,300)}...\n\n`;
    }


    if (history.length > 1) { // 至少要有一次完整的問答(不含當前正在問的"…")才加入歷史記錄
        contextString += "我們之前的問答記錄(最近2條)：\n";
        const relevantHistory = history.filter(h => h.a !== "…").slice(-2);
        relevantHistory.forEach(h => {
            const answerSnippet = h.a.length > 100 ? h.a.substring(0,100) + "..." : h.a;
            contextString += `使用者提問：${h.q}\n先前回答：${answerSnippet}\n\n`;
        });
    }

    const qaPrompt = `請嚴格根據以下提供的「上下文資訊」來回答「使用者的問題」。您的回答應直接針對問題，並僅限於從上下文中獲取的資訊。請勿使用任何上下文以外的知識，也不要進行延伸推測或給出與上下文無關的建議。如果問題無法從上下文中找到答案，請直接表明「根據目前提供的資訊，我無法回答這個問題。」或類似的說法。
請使用 Markdown 語法來排版您的回答，例如使用「#」、「##」、「###」來表示不同層級的標題，使用「-」或「*」開頭表示列表項。
請用「${cfg.outputLanguage}」回答。

---上下文資訊開始---
${contextString}
---上下文資訊結束---

使用者的問題：
${q}`;
    return await fetchAI(qaPrompt, null);
}

async function getArticle() {
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) {
            return reject(new Error(cfg.showErr ? "擴充功能環境無效，無法發送訊息" : "無法取得內容"));
        }
        chrome.runtime.sendMessage({ type: "EXTRACT_ARTICLE" }, res => {
            if (chrome.runtime.lastError) {
                return reject(new Error(cfg.showErr ? `無法連接到內容腳本: ${chrome.runtime.lastError.message}` : "無法取得內容"));
            }
            if (res && typeof res.text === 'string' && typeof res.title === 'string') {
                resolve(res);
            } else {
                reject(new Error(cfg.showErr ? "內容腳本回傳的資料格式不正確或為空" : "無法取得內容"));
            }
        });
    });
}

// 初始化面板狀態
reset();
disableQA(true);