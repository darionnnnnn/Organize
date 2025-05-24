// Qrganize/sidepanel-dom.js
import { esc, cleanAI } from "./sidepanel-utils.js";
import { getConfig } from "./sidepanel-config.js";
import { S } from "./sidepanel-state.js";

const $ = id => document.getElementById(id);
export const elements = {
    btnSummary: $("summarize-btn"),
    btnClear: $("clear-btn"),
    btnClose: $("close-btn"),
    hTitle: $("summary-title"),
    divContent: $("summary-content"),
    hrSep: $("qa-separator"),
    qaList: $("qa-list"),
    qaForm: $("qa-form"),
    qaInput: $("qa-input"),
    askBtn: $("ask-btn")
};

function _bindCopyToButton(buttonElement, textToCopy) {
    if (!buttonElement) return;
    const text = String(textToCopy === null || typeof textToCopy === 'undefined' ? "" : textToCopy);
    buttonElement.dataset.textToCopy = text;

    buttonElement.onclick = async (event) => {
        event.stopPropagation();
        if (typeof buttonElement.focus === 'function') {
            buttonElement.focus();
        }
        const oldText = buttonElement.textContent;
        const originalTitle = buttonElement.title; // Store original title

        buttonElement.textContent = "複製中...";
        buttonElement.disabled = true; // Disable button during copy attempt

        try {
            console.log("Requesting copy via background for text:", text.substring(0, 70) + "...");
            const response = await chrome.runtime.sendMessage({
                type: 'copy-data-to-clipboard',
                data: text
            });

            if (response && response.success) {
                buttonElement.textContent = "已複製！";
                console.log("Copy successful (response from background):", response);
            } else {
                buttonElement.textContent = "複製失敗";
                console.error("複製失敗 (來自背景腳本的回應):", response?.error || "未知錯誤");
                const cfg = getConfig();
                if (cfg.showErr) {
                    console.error("Failed to copy. Button ID:", buttonElement.id || "[no id]", "Text (first 100 chars):", text.substring(0,100));
                }
            }
        } catch (err) {
            buttonElement.textContent = "複製失敗";
            console.error("複製請求失敗 (傳送訊息至背景時發生錯誤):", err);
            const cfg = getConfig();
            if (cfg.showErr) {
                console.error("Failed to send copy request. Button ID:", buttonElement.id || "[no id]", "Text (first 100 chars):", text.substring(0,100));
            }
        } finally {
            // Restore button after a short delay
            setTimeout(() => {
                if (buttonElement) {
                    buttonElement.textContent = oldText;
                    buttonElement.title = originalTitle;
                    buttonElement.disabled = false; // Re-enable button
                }
            }, 2000);
        }
    };
}

export function updateTitle(text) {
    elements.hTitle.textContent = text;
}

export function setSummarizeButtonState(isSummarizing) {
    elements.btnSummary.disabled = isSummarizing;
    elements.btnSummary.textContent = isSummarizing ? "摘要中…" : "摘要";
}

export function toggleQAInput(disabled) {
    elements.qaInput.disabled = disabled;
    elements.askBtn.disabled = disabled;
}

export function toggleQASeparator(visible) {
    elements.hrSep.style.display = visible ? "block" : "none";
}

export function showLoadingState(message) {
    if (message === "AI 摘要中…") {
        elements.divContent.innerHTML = `<div class="summary-status"><div class="loading-animation"></div><div>${esc(message)}</div></div>`;
    } else {
        elements.divContent.innerHTML = `<div class="summary-status">${esc(message)}</div>`;
    }
    toggleQASeparator(false);
    toggleQAInput(true);
}

function sanitizeStringForDisplay(str) {
    if (typeof str !== 'string') return "";
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '�');
}

export function renderSummary(structuredSummary, summaryHtmlButtons, originalArticleText) {
    const cfg = getConfig();
    let keyPointsListHTML = '<ul id="key-points-list" class="outline-list">';
    let detailsBlocksHTML = '<div id="key-points-details-container">';

    structuredSummary.forEach((point, index) => {
        const pointId = `kp-detail-${index}`;
        const sanitizedTitle = sanitizeStringForDisplay(point.title);
        const sanitizedDetails = sanitizeStringForDisplay(point.details);
        const sanitizedQuote = point.quote ? sanitizeStringForDisplay(point.quote) : "";

        const cleanTitle = cleanAI(sanitizedTitle).replace(/<\/?p>/g, '').trim();
        const cleanDetails = cleanAI(sanitizedDetails);
        const cleanQuoteContent = point.quote && sanitizedQuote ? cleanAI(sanitizedQuote) : "";

        keyPointsListHTML += `<li><a href="#${pointId}">${esc(cleanTitle || "無標題重點")}</a></li>`;
        detailsBlocksHTML += `
            <div class="key-point-detail-block" id="${pointId}">
                <h3>${esc(cleanTitle || "無標題重點")}</h3>
                ${cleanDetails}
                ${cleanQuoteContent ? `<blockquote class="original-text-quote">${cleanQuoteContent}</blockquote>` : ''}
            </div>`;
    });
    keyPointsListHTML += '</ul>';
    detailsBlocksHTML += '</div>';

    const originalArticleHTML = originalArticleText ? `
        <div class="original-article-container">
            <button id="toggle-original-article" class="original-article-toggle" aria-expanded="false" aria-controls="original-article-content">
                <span class="toggle-icon">▼</span> 原始文章內容
            </button>
            <div id="original-article-content" class="original-article-text" style="display:none;">
                ${cleanAI(sanitizeStringForDisplay(originalArticleText))}
            </div>
        </div>
    ` : "";

    elements.divContent.innerHTML = `
        <div class="summary-card">
            ${summaryHtmlButtons}
            ${keyPointsListHTML}
            <hr class="summary-detail-separator">
            ${detailsBlocksHTML}
        </div>
        ${originalArticleHTML}`;

    if (cfg.showErr) {
        const { lastSummaryPrompt, summaryRawAI, summarySourceText } = S();
        if (lastSummaryPrompt) {
            const btn = elements.divContent.querySelector("#copy-summary-prompt");
            if (btn) _bindCopyToButton(btn, lastSummaryPrompt);
        }
        if (summaryRawAI && summaryRawAI.trim()) {
            const btn = elements.divContent.querySelector("#copy-raw");
            if (btn) _bindCopyToButton(btn, summaryRawAI);
        }
        if (summarySourceText) {
            const btn = elements.divContent.querySelector("#copy-src");
            if (btn) _bindCopyToButton(btn, summarySourceText);
        }
    }

    elements.divContent.querySelectorAll("#key-points-list a").forEach(a => {
        a.onclick = ev => {
            ev.preventDefault();
            const id = a.getAttribute("href").slice(1);
            const targetElement = elements.divContent.querySelector(`#${id}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        };
    });

    if (originalArticleText) {
        const toggleBtn = elements.divContent.querySelector("#toggle-original-article");
        const originalContentDiv = elements.divContent.querySelector("#original-article-content");
        if (toggleBtn && originalContentDiv) {
            toggleBtn.onclick = () => {
                const isExpanded = originalContentDiv.style.display !== "none";
                originalContentDiv.style.display = isExpanded ? "none" : "block";
                toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
                toggleBtn.querySelector(".toggle-icon").textContent = isExpanded ? "▼" : "▲";
            };
        }
    }
    toggleQASeparator(true);
    toggleQAInput(false);
    if (elements.qaInput.parentElement.contains(elements.qaInput)) {
        elements.qaInput.focus();
    }
}

export function renderErrorState(message, onRetryCallback) {
    const cfg = getConfig();
    let retryButtonHTML = '';
    if (onRetryCallback && cfg.showErr) {
        retryButtonHTML = `<button id="summary-retry-action-btn" class="button-retry">重試</button>`;
    }

    elements.divContent.innerHTML = `
        <div class="summary-status">
            ${message} 
            ${retryButtonHTML}
        </div>`;

    if (onRetryCallback && cfg.showErr) {
        const retryBtn = elements.divContent.querySelector("#summary-retry-action-btn");
        if (retryBtn) {
            retryBtn.onclick = (event) => {
                event.stopPropagation();
                onRetryCallback();
            };
        }
    }
    toggleQASeparator(false);
    toggleQAInput(true);
}

export function resetUI() {
    updateTitle("AI 內容摘要");
    elements.divContent.innerHTML = '<div class="summary-status">請按「摘要」開始，或在網頁上選取文字後點擊擴充功能圖示/右鍵選單。</div>';
    elements.qaList.innerHTML = "";
    elements.qaInput.value = "";
    toggleQASeparator(false);
    toggleQAInput(true);
    setSummarizeButtonState(false);
    document.body.className = '';
    const cfg = getConfig();
    if (cfg && cfg.font) {
        document.body.classList.add(`font-${cfg.font}`);
    } else {
        document.body.classList.add(`font-medium`);
    }
}

export function drawQA(qaHistory, onRetryCallback) {
    const cfg = getConfig();
    elements.qaList.innerHTML = qaHistory.map(entry => {
        const { q, a, q_id, qa_prompt, qa_raw_ai_response } = entry;
        let qaActionsHTML = "";

        if (cfg.showErr) {
            qaActionsHTML = `<div class="qa-actions-row">`;
            if (typeof a === 'string' && a.startsWith("❌") && onRetryCallback) {
                qaActionsHTML += `<button class="button-retry qa-retry-btn" data-qid="${q_id}" title="重試此問題">重試</button>`;
            }
            if (qa_prompt) {
                qaActionsHTML += `<button class="copy-btn qa-action-btn qa-copy-prompt-btn" data-qid="${q_id}" title="複製用於生成此回答的Prompt">複製Prompt</button>`;
            }
            if (qa_raw_ai_response) {
                qaActionsHTML += `<button class="copy-btn qa-action-btn qa-copy-raw-btn" data-qid="${q_id}" title="複製此回答的AI原始JSON回應">複製原始回應</button>`;
            }
            qaActionsHTML += `</div>`;
        }

        let answerContent;
        if (a === "正在等待 AI 回覆...") {
            answerContent = '<div class="loading-animation"></div>';
        } else {
            answerContent = (typeof a === 'string') ? cleanAI(a) : esc(String(a));
        }

        return `
            <div class="qa-pair" data-q-id="${q_id}">
                <div class="qa-q">${esc(q)}</div>
                <div class="qa-a">
                    ${answerContent}
                    ${qaActionsHTML}
                </div>
            </div>
        `;
    }).join("");

    elements.qaList.querySelectorAll('.qa-retry-btn').forEach(btn => {
        btn.onclick = (event) => {
            event.stopPropagation();
            const qid = btn.dataset.qid;
            if (onRetryCallback) onRetryCallback(Number(qid));
        };
    });

    elements.qaList.querySelectorAll('.qa-copy-prompt-btn').forEach(btn => {
        const qid = Number(btn.dataset.qid);
        const entry = qaHistory.find(e => e.q_id === qid);
        if (entry && entry.qa_prompt) {
            _bindCopyToButton(btn, entry.qa_prompt);
        } else {
            btn.disabled = true;
            btn.title = "無Prompt可複製";
        }
    });

    elements.qaList.querySelectorAll('.qa-copy-raw-btn').forEach(btn => {
        const qid = Number(btn.dataset.qid);
        const entry = qaHistory.find(e => e.q_id === qid);
        if (entry && entry.qa_raw_ai_response) {
            _bindCopyToButton(btn, entry.qa_raw_ai_response);
        } else {
            btn.disabled = true;
            btn.title = "無原始回應可複製";
        }
    });

    const scrollableParent = elements.qaList.closest('#scrollable-content') || elements.qaList;
    if(scrollableParent) {
        scrollableParent.scrollTop = scrollableParent.scrollHeight;
    }
}