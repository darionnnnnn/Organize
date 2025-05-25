// Qrganize/sidepanel-main.js
import { esc, parseAIJsonResponse } from "./sidepanel-utils.js";
import { loadConfig, getConfig } from "./sidepanel-config.js";
import { S as StateAccessor, resetState } from "./sidepanel-state.js"; // 為了日誌清晰度，將 S 重命名為 StateAccessor
import {
    elements,
    updateTitle,
    setSummarizeButtonState,
    toggleQAInput,
    resetUI,
    drawQA,
    showLoadingState,
    renderSummary,
    renderErrorState,
    toggleQASeparator
} from "./sidepanel-dom.js";
import {
    getArticleContent,
    summarizeContent,
    buildSummaryPrompt
} from "./sidepanel-api.js";
import { initEventHandlers } from "./sidepanel-event-handlers.js";

console.log("[Sidepanel Main] 模組已載入。 StateAccessor 的類型：", typeof StateAccessor, StateAccessor);
if (typeof StateAccessor !== 'function') {
    alert("嚴重錯誤：StateAccessor (S) 未在 sidepanel-main.js 中正確載入！請檢查匯入和 sidepanel-state.js。");
    console.error("嚴重錯誤：在 sidepanel-main.js 模組載入時，StateAccessor (S) 不是一個函式！");
}

async function runSummarize(selectionText = "") {
    console.log("[Sidepanel Main] runSummarize 已呼叫。開始時 StateAccessor 的類型：", typeof StateAccessor);
    if (typeof StateAccessor !== 'function') {
        console.error("[Sidepanel Main] runSummarize 中發生錯誤：StateAccessor 不是一個函式！");
        // 後備或向使用者顯示嚴重錯誤
        renderErrorState("❗嚴重錯誤：內部狀態函式遺失(S1)", null);
        return;
    }

    if (StateAccessor().running) {
        console.log("[Sidepanel Main] 摘要已在執行中，正在返回。");
        return;
    }

    StateAccessor().running = true;
    StateAccessor().lastRunSelectionText = selectionText;
    StateAccessor().currentAbortController = new AbortController();

    setSummarizeButtonState(true);
    elements.qaList.innerHTML = "";
    StateAccessor().qaHistory = [];
    // Hide the entire Q&A section wrapper
    if (elements.qaSectionWrapper) {
        elements.qaSectionWrapper.style.display = 'none';
    }

    // showLoadingState will take care of:
    // - Setting loading message in divContent
    // - Calling toggleQASeparator(false)
    // - Calling toggleQAInput(true)
    showLoadingState("截取文章中…");

    try {
        console.log("[Sidepanel Main] runSummarize: 位於 try 區塊。 StateAccessor 的類型：", typeof StateAccessor);
        if (typeof StateAccessor !== 'function') console.error("嚴重：在 try 區塊中 API 呼叫之前 StateAccessor 變為 undefined！");


        const article = selectionText
            ? { title: "選取文字", text: selectionText }
            : await getArticleContent();

        StateAccessor().summarySourceText = article.text.trim();
        updateTitle(article.title);
        showLoadingState("AI 摘要中…");

        StateAccessor().lastSummaryPrompt = buildSummaryPrompt(article.title, StateAccessor().summarySourceText);
        StateAccessor().summaryRawAI = await summarizeContent(article.title, StateAccessor().summarySourceText, StateAccessor().currentAbortController.signal);

        const cfg = getConfig(); // Renamed from currentSettings for consistency
        let summaryButtonsHTML = "";
        if (cfg.showErr) {
            summaryButtonsHTML = `<div class="action-buttons-summary">
                ${StateAccessor().lastSummaryPrompt ? `<button id="copy-summary-prompt" class="copy-btn">複製摘要Prompt</button>` : ''}
                ${StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim() ? `<button id="copy-raw" class="copy-btn">複製原始回應</button>` : ''}
                ${StateAccessor().summarySourceText ? `<button id="copy-src" class="copy-btn">複製原始內容</button>` : ''}
            </div>`;
        }

        if (cfg.directOutput) {
            // Direct Output Mode
            // summaryRawAI is displayed directly.
            // The new last argument 'true' indicates direct output mode.
            renderSummary(StateAccessor().summaryRawAI, summaryButtonsHTML, StateAccessor().summarySourceText, true);
        } else {
            // Normal JSON Processing Mode
            const structuredSummary = parseAIJsonResponse(StateAccessor().summaryRawAI);

            if (structuredSummary === null) {
                let errorMsgToShow;
                if (cfg.showErr) {
                    errorMsgToShow = `⚠️ AI 回應的 JSON 格式無效 (可能因內容過長被截斷或結構不完整)。${StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim() ? '詳情請見主控台。' : 'AI 未回傳任何內容。'}`;
                    
                    // Add copy buttons for prompt and raw response ONLY if cfg.showErr is true
                    let copyPromptButtonHTML = "";
                    if (StateAccessor().lastSummaryPrompt) {
                        copyPromptButtonHTML = `<button id="json-fail-copy-summary-prompt" class="copy-btn-inline" title="複製摘要Prompt">複製Prompt</button>`;
                    }
                    let copyRawResponseButtonHTML = "";
                    if (StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim()) {
                        copyRawResponseButtonHTML = `<button id="json-fail-copy-raw" class="copy-btn-inline" title="複製AI原始回應">複製AI原始回應</button>`;
                    }

                    if (copyPromptButtonHTML || copyRawResponseButtonHTML) {
                        let actionsHTML = "";
                        if (copyPromptButtonHTML) actionsHTML += copyPromptButtonHTML;
                        if (copyRawResponseButtonHTML) actionsHTML += (actionsHTML ? " " : "") + copyRawResponseButtonHTML; // Add space if both buttons are present and a gap is desired by CSS
                        errorMsgToShow += `<div class="json-fail-copy-actions">${actionsHTML}</div>`;
                    }
                } else {
                    // cfg.showErr is false
                    errorMsgToShow = "⚠️ AI 回應的 JSON 格式無效。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。";
                    // No buttons are appended here
                }
                console.log("[Sidepanel Main] 正在為無效的 JSON 呈現錯誤狀態。在 renderErrorState 之前 StateAccessor 的類型：", typeof StateAccessor);
                renderErrorState(errorMsgToShow, () => {
                    // ... (其餘的回呼函式保持不變)
                    if (typeof StateAccessor !== 'function') {
                        console.error("嚴重：在重試 (無效 JSON) 的回呼函式中 StateAccessor 為 undefined！");
                        alert("重試失敗：StateAccessor (S) 在重試回呼 (E1) 中未定義！");
                        renderErrorState("❗重試失敗：內部狀態函式遺失(S2)", null);
                        return;
                    }
                    runSummarize(StateAccessor().lastRunSelectionText);
                });
            } else if (structuredSummary.length > 0) {
                // 為摘要特定的重試傳遞重試回呼建立器。
                // The new last argument 'false' indicates normal (non-direct) output mode.
                renderSummary(structuredSummary, summaryButtonsHTML, StateAccessor().summarySourceText, false);
            } else {
                let noPointsMessage = "AI 未能從內容中提取結構化重點。";
                if (!StateAccessor().summaryRawAI || !StateAccessor().summaryRawAI.trim()){ noPointsMessage = "AI 未回傳任何內容。"; }
                else if (StateAccessor().summaryRawAI.trim() === "{}") { noPointsMessage = "AI 回應了空的 JSON 物件。"; }
                else if (StateAccessor().summaryRawAI.trim().match(/^\{\s*("keyPoints"\s*:\s*\[\s*\])\s*\}$/)) { noPointsMessage = "AI 回應了 JSON 但未包含任何重點。"; }

                console.log("[Sidepanel Main] 正在為沒有重點的情況呈現錯誤狀態。在 renderErrorState 之前 StateAccessor 的類型：", typeof StateAccessor);
                let noPointsFullMessage = noPointsMessage;
                if (!cfg.showErr) {
                    noPointsFullMessage += " 開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。";
                } else if (StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim()) {
                    noPointsFullMessage += " (原始回應已記錄於主控台)";
                }
                renderErrorState(
                    noPointsFullMessage,
                    // ... 重試回呼 (確保回呼已正確傳遞)
                    () => {
                        console.log("[Sidepanel Main] 重試 (無重點) 回呼執行中。 StateAccessor 的類型：", typeof StateAccessor);
                        if (typeof StateAccessor !== 'function') {
                            console.error("嚴重：在重試 (無重點) 的回呼函式中 StateAccessor 為 undefined！");
                            alert("重試失敗：StateAccessor (S) 在重試回呼 (E2) 中未定義！");
                            renderErrorState("❗重試失敗：內部狀態函式遺失(S3)", null);
                            return;
                        }
                        runSummarize(StateAccessor().lastRunSelectionText);
                    }
                );
            }
        }
    } catch (error) {
        console.error("摘要執行期間錯誤 (在 runSummarize 中捕獲)：", error);
        console.log("[Sidepanel Main] 位於 catch 區塊。 StateAccessor 的類型：", typeof StateAccessor);
        if (typeof StateAccessor !== 'function') {
            console.error("嚴重：在 catch 區塊本身 StateAccessor 為 undefined！");
            alert("Catch 區塊錯誤：StateAccessor (S) 未定義 (E3)！");
        }

        const cfg = getConfig();
        let displayMessage;
        if (error.name === "AbortError") {
            displayMessage = "❌ 已取消摘要";
        } else {
            displayMessage = cfg.showErr ? `❗ ${esc(error.message || "未知摘要錯誤")}` : "⚠️ 處理摘要時發生錯誤。開啟設定中的「顯示詳細錯誤訊息」以獲取更多資訊。";
        }

        // 這是您原始錯誤追蹤中的第 87 行
        renderErrorState(displayMessage, () => {
            console.log("[Sidepanel Main] 重試 (一般錯誤) 回呼執行中。 StateAccessor 的類型：", typeof StateAccessor, "導致此處的錯誤：", error); // 在此記錄 S
            if (typeof StateAccessor !== 'function') {
                console.error("嚴重：在一般錯誤的重試回呼中 (第 87 行上下文)，StateAccessor 未定義！");
                alert("重試失敗：StateAccessor (S) 在重試回呼 (E4) 中未定義！");
                // 如果 S 消失了，我們甚至無法獲取 lastRunSelectionText。我們可能需要明確傳遞它。
                renderErrorState("❗重試失敗：內部狀態函式遺失(S4)", null);
                return;
            }
            runSummarize(StateAccessor().lastRunSelectionText);
        });
    } finally {
        console.log("[Sidepanel Main] 位於 finally 區塊。 StateAccessor 的類型：", typeof StateAccessor);
        if (typeof StateAccessor === 'function') { // 使用前檢查
            StateAccessor().running = false;
            StateAccessor().currentAbortController = null;
        } else {
            console.error("[Sidepanel Main] StateAccessor 在 finally 區塊中為 undefined，無法重設 state.running");
        }
        setSummarizeButtonState(false);
    }
}

async function initialize() {
    console.log("[Sidepanel Main] 初始化中。初始時 StateAccessor 的類型：", typeof StateAccessor);
    await loadConfig();
    resetUI();
    initEventHandlers(runSummarize);
    console.log("[Sidepanel Main] 側邊面板已使用設定初始化：", getConfig());
    parent.postMessage({ type: "PANEL_READY" }, "*");
}

initialize();