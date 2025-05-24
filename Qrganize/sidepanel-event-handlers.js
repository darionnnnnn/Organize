// Qrganize/sidepanel-event-handlers.js
// sidepanel-event-handlers.js
import { S, resetState } from "./sidepanel-state.js";
import { getConfig } from "./sidepanel-config.js";
import { elements, updateTitle, setSummarizeButtonState, toggleQAInput, resetUI, drawQA, showLoadingState, renderSummary, renderErrorState } from "./sidepanel-dom.js";
import { getArticleContent, summarizeContent, askAIQuestion, buildSummaryPrompt } from "./sidepanel-api.js";
import { esc, parseAIJsonResponse } from "./sidepanel-utils.js";


export function initEventHandlers(runSummarizeFn) {
    elements.btnClose.onclick = () => {
        parent.postMessage({ type: "CLOSE_PANEL" }, "*");
    };

    elements.btnSummary.onclick = () => {
        if (!S().running) {
            runSummarizeFn(S().lastRunSelectionText); // Use stored selection text
        }
    };

    elements.btnClear.onclick = () => {
        if (S().running && S().currentAbortController) {
            S().currentAbortController.abort();
        } else {
            resetState();
            resetUI();
        }
    };

    elements.qaForm.onsubmit = async (e) => {
        e.preventDefault();
        const questionText = elements.qaInput.value.trim();
        if (!questionText || S().running) return; // Also check if a summary is running

        const cfg = getConfig();
        const questionEntry = {
            q: questionText,
            q_id: Date.now(),
            a: "正在等待 Ollama AI 回覆...", // Placeholder for answer
            qa_prompt: null,
            qa_raw_ai_response: null
        };
        S().qaHistory.push(questionEntry);

        drawQA(S().qaHistory, handleQARetry); // Pass retry callback
        elements.qaInput.value = "";
        toggleQAInput(true); // Disable input while AI is thinking

        try {
            const pageTitle = elements.hTitle.textContent;
            const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);

            const aiResult = await askAIQuestion(
                questionText,
                pageTitle,
                S().qaHistory, // Full history for context building by API
                summaryKeyPoints,
                S().summarySourceText
            );
            questionEntry.a = aiResult.answer;
            questionEntry.qa_prompt = aiResult.prompt;
            questionEntry.qa_raw_ai_response = aiResult.rawAnswer;
        } catch (error) {
            console.error("Q&A 過程中發生錯誤:", error);
            // Ensure error.message is escaped if it might contain HTML-like characters
            questionEntry.a = `❌ ${esc(error.message || "AI 問答時發生錯誤")}`;
            questionEntry.qa_prompt = null; // Clear prompt on error too
            questionEntry.qa_raw_ai_response = null; // Clear raw response on error
        } finally {
            drawQA(S().qaHistory, handleQARetry); // Re-render with actual answer or error
            toggleQAInput(false); // Re-enable input
            if (elements.qaInput.parentElement.contains(elements.qaInput)) {
                elements.qaInput.focus();
            }
        }
    };

    window.addEventListener("message", e => {
        if (e.data?.type === "SUMMARY_SELECTED_TEXT") {
            S().lastRunSelectionText = e.data.text || ""; // Store it
            // Automatically run summarize if not already running.
            // This aligns with behavior of clicking extension icon with selection.
            if (!S().running) {
                runSummarizeFn(S().lastRunSelectionText);
            }
        }
    });
}

async function handleQARetry(questionId) {
    const cfg = getConfig();
    const entryToRetry = S().qaHistory.find(h => h.q_id === questionId);
    if (!entryToRetry || S().running) return; // Do not retry if a summary is already running

    const originalQuestion = entryToRetry.q;

    entryToRetry.a = "…"; // Placeholder while retrying
    entryToRetry.qa_prompt = null;
    entryToRetry.qa_raw_ai_response = null;

    drawQA(S().qaHistory, handleQARetry); // Update UI to show loading state for this Q
    toggleQAInput(true); // Disable new questions during retry

    try {
        const pageTitle = elements.hTitle.textContent;
        const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);

        // Create history for prompt building: all entries *before* this one, plus current question.
        // The askAIQuestion and buildQAPrompt will use the latest entry in the history passed to it as the current question.
        const historyForPrompt = S().qaHistory.filter(h => h.q_id <= questionId);


        const aiResult = await askAIQuestion(
            originalQuestion,
            pageTitle,
            historyForPrompt, // Pass history up to and including the current question being retried
            summaryKeyPoints,
            S().summarySourceText
        );
        entryToRetry.a = aiResult.answer;
        entryToRetry.qa_prompt = aiResult.prompt;
        entryToRetry.qa_raw_ai_response = aiResult.rawAnswer;

    } catch (error) {
        console.error("Q&A 重試失敗:", error);
        entryToRetry.a = `❌ ${esc(error.message || "AI 問答重試失敗")}`;
    } finally {
        drawQA(S().qaHistory, handleQARetry); // Re-render with new answer or error
        toggleQAInput(false); // Re-enable input
        if (elements.qaInput.parentElement.contains(elements.qaInput)) {
            elements.qaInput.focus();
        }
    }
}