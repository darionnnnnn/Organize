// Qrganize/sidepanel-main.js
import { esc, parseAIJsonResponse } from "./sidepanel-utils.js";
import { loadConfig, getConfig } from "./sidepanel-config.js";
import { S as StateAccessor, resetState } from "./sidepanel-state.js"; // Renamed S to StateAccessor for clarity in logs
import {
    elements,
    updateTitle,
    setSummarizeButtonState,
    toggleQAInput,
    resetUI,
    drawQA,
    showLoadingState,
    // renderSummary, // Replaced by finalizeSummaryDisplay
    renderErrorState,
    toggleQASeparator,
    initializeSummaryDisplay,
    appendSummaryChunk,
    finalizeSummaryDisplay
} from "./sidepanel-dom.js";
import {
    getArticleContent,
    summarizeContent,
    buildSummaryPrompt
} from "./sidepanel-api.js";
import { initEventHandlers } from "./sidepanel-event-handlers.js";

console.log("[Sidepanel Main] Module loaded. Type of StateAccessor:", typeof StateAccessor, StateAccessor);
if (typeof StateAccessor !== 'function') {
    alert("CRITICAL ERROR: StateAccessor (S) is not loaded correctly in sidepanel-main.js! Please check imports and sidepanel-state.js.");
    console.error("CRITICAL ERROR: StateAccessor (S) is not a function at module load time in sidepanel-main.js!");
}

async function runSummarize(selectionText = "") {
    console.log("[Sidepanel Main] runSummarize called. Type of StateAccessor at start:", typeof StateAccessor);
    if (typeof StateAccessor !== 'function') {
        console.error("[Sidepanel Main] ERROR in runSummarize: StateAccessor is not a function!");
        // Fallback or display critical error to user
        renderErrorState("❗嚴重錯誤：內部狀態函式遺失(S1)", null);
        return;
    }

    if (StateAccessor().running) {
        console.log("[Sidepanel Main] Summary already running, returning.");
        return;
    }

    StateAccessor().running = true;
    StateAccessor().lastRunSelectionText = selectionText;
    StateAccessor().currentAbortController = new AbortController();

    setSummarizeButtonState(true);
    elements.qaList.innerHTML = "";
    StateAccessor().qaHistory = [];

    showLoadingState("截取文章中…");

    try {
        console.log("[Sidepanel Main] runSummarize: In try block. Type of StateAccessor:", typeof StateAccessor);
        if (typeof StateAccessor !== 'function') console.error("CRITICAL: StateAccessor became undefined before API calls in try block!");


        const article = selectionText
            ? { title: "選取文字", text: selectionText }
            : await getArticleContent();

        StateAccessor().summarySourceText = article.text.trim();
        updateTitle(article.title);
        // showLoadingState("AI 摘要中…"); // Replaced by initializeSummaryDisplay
        const summaryStreamContainer = initializeSummaryDisplay("AI 正在產生摘要...");


        StateAccessor().lastSummaryPrompt = buildSummaryPrompt(article.title, StateAccessor().summarySourceText);
        // Call summarizeContent with onChunkCallback
        StateAccessor().summaryRawAI = await summarizeContent(
            article.title,
            StateAccessor().summarySourceText,
            StateAccessor().currentAbortController.signal,
            (chunk) => { // This is the onChunkCallback
                if (chunk) {
                    appendSummaryChunk(summaryStreamContainer, chunk);
                }
            }
        );

        const structuredSummary = parseAIJsonResponse(StateAccessor().summaryRawAI);
        const cfg = getConfig();

        let summaryButtonsHTML = "";
        if (cfg.showErr) {
            summaryButtonsHTML = `<div class="action-buttons-summary">
                ${StateAccessor().lastSummaryPrompt ? `<button id="copy-summary-prompt" class="copy-btn">複製摘要Prompt</button>` : ''}
                ${StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim() ? `<button id="copy-raw" class="copy-btn">複製原始回應</button>` : ''}
                ${StateAccessor().summarySourceText ? `<button id="copy-src" class="copy-btn">複製原始內容</button>` : ''}
            </div>`;
        }

        if (structuredSummary === null) {
            let errorMsg = "⚠️ AI 回應的 JSON 格式無效。";
            if (cfg.showErr) {
                errorMsg = `⚠️ AI 回應的 JSON 格式無效 (可能因內容過長被截斷或結構不完整)。${StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim() ? '詳情請見主控台。' : 'AI 未回傳任何內容。'}`;
            }
            console.log("[Sidepanel Main] Rendering error state for invalid JSON. Type of StateAccessor before renderErrorState:", typeof StateAccessor);
            renderErrorState(errorMsg, () => {
                console.log("[Sidepanel Main] Retry (invalid JSON) callback executing. Type of StateAccessor:", typeof StateAccessor);
                if (typeof StateAccessor !== 'function') {
                    console.error("CRITICAL: StateAccessor undefined in retry (invalid JSON) callback!");
                    alert("Retry failed: StateAccessor (S) is undefined in retry callback (E1)!");
                    renderErrorState("❗重試失敗：內部狀態函式遺失(S2)", null);
                    return;
                }
                runSummarize(StateAccessor().lastRunSelectionText);
            });
        } else if (structuredSummary.length > 0) {
            // Use finalizeSummaryDisplay instead of renderSummary
            finalizeSummaryDisplay(structuredSummary, summaryButtonsHTML, StateAccessor().summarySourceText);
        } else {
            let noPointsMessage = "AI 未能從內容中提取結構化重點。";
            if (!StateAccessor().summaryRawAI || !StateAccessor().summaryRawAI.trim()){ noPointsMessage = "AI 未回傳任何內容。"; }
            else if (StateAccessor().summaryRawAI.trim() === "{}") { noPointsMessage = "AI 回應了空的 JSON 物件。"; }
            else if (StateAccessor().summaryRawAI.trim().match(/^\{\s*("keyPoints"\s*:\s*\[\s*\])\s*\}$/)) { noPointsMessage = "AI 回應了 JSON 但未包含任何重點。"; }

            console.log("[Sidepanel Main] Rendering error state for no key points. Type of StateAccessor before renderErrorState:", typeof StateAccessor);
            renderErrorState(
                noPointsMessage + (cfg.showErr && StateAccessor().summaryRawAI && StateAccessor().summaryRawAI.trim() ? " (原始回應已記錄於主控台)" : ""),
                () => {
                    console.log("[Sidepanel Main] Retry (no key points) callback executing. Type of StateAccessor:", typeof StateAccessor);
                    if (typeof StateAccessor !== 'function') {
                        console.error("CRITICAL: StateAccessor undefined in retry (no key points) callback!");
                        alert("Retry failed: StateAccessor (S) is undefined in retry callback (E2)!");
                        renderErrorState("❗重試失敗：內部狀態函式遺失(S3)", null);
                        return;
                    }
                    runSummarize(StateAccessor().lastRunSelectionText);
                }
            );
        }
    } catch (error) {
        console.error("摘要執行期間錯誤 (Caught in runSummarize):", error);
        console.log("[Sidepanel Main] In catch block. Type of StateAccessor:", typeof StateAccessor);
        if (typeof StateAccessor !== 'function') {
            console.error("CRITICAL: StateAccessor undefined in catch block itself!");
            alert("Catch block error: StateAccessor (S) is undefined (E3)!");
        }

        const cfg = getConfig();
        let displayMessage;
        if (error.name === "AbortError") {
            displayMessage = "❌ 已取消摘要";
        } else {
            displayMessage = cfg.showErr ? `❗ ${esc(error.message || "未知摘要錯誤")}` : "⚠️ 處理摘要時發生錯誤";
        }

        // This is line 87 from your original error trace
        renderErrorState(displayMessage, () => {
            console.log("[Sidepanel Main] Retry (general error) callback executing. Type of StateAccessor:", typeof StateAccessor, "Error that led here:", error); // Log S here
            if (typeof StateAccessor !== 'function') {
                console.error("CRITICAL: StateAccessor IS UNDEFINED in the retry callback for general error (line 87 context)!");
                alert("Retry failed: StateAccessor (S) is undefined in retry callback (E4)!");
                // If S is gone, we can't even get lastRunSelectionText. We might need to pass it explicitly.
                renderErrorState("❗重試失敗：內部狀態函式遺失(S4)", null);
                return;
            }
            runSummarize(StateAccessor().lastRunSelectionText);
        });
    } finally {
        console.log("[Sidepanel Main] In finally block. Type of StateAccessor:", typeof StateAccessor);
        if (typeof StateAccessor === 'function') { // Check before using
            StateAccessor().running = false;
            StateAccessor().currentAbortController = null;
        } else {
            console.error("[Sidepanel Main] StateAccessor is undefined in finally block, cannot reset state.running");
        }
        setSummarizeButtonState(false);
    }
}

async function initialize() {
    console.log("[Sidepanel Main] Initializing. Type of StateAccessor at init:", typeof StateAccessor);
    await loadConfig();
    resetUI();
    initEventHandlers(runSummarize);
    console.log("[Sidepanel Main] Side panel initialized with config:", getConfig());
    parent.postMessage({ type: "PANEL_READY" }, "*");
}

initialize();