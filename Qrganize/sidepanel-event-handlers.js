// Qrganize/sidepanel-event-handlers.js
// sidepanel-event-handlers.js
import { S, resetState } from "./sidepanel-state.js";
import { getConfig } from "./sidepanel-config.js";
import { 
    elements, 
    updateTitle, 
    setSummarizeButtonState, 
    toggleQAInput, 
    resetUI, 
    drawQA, 
    showLoadingState, 
    // renderSummary, // Not used directly here, summary uses finalizeSummaryDisplay
    renderErrorState,
    appendAnswerChunk,
    finalizeAnswerDisplay
} from "./sidepanel-dom.js";
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
            a: "AI正在輸入...", // Placeholder for streaming answer
            qa_prompt: null,
            qa_raw_ai_response: null
        };
        S().qaHistory.push(questionEntry);

        drawQA(S().qaHistory, handleQARetry); // Initial draw with loading state
        elements.qaInput.value = "";
        toggleQAInput(true); // Disable input while AI is thinking

        let accumulatedAnswer = "";
        try {
            const pageTitle = elements.hTitle.textContent;
            const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);

            const aiResult = await askAIQuestion(
                questionText,
                pageTitle,
                S().qaHistory, 
                summaryKeyPoints,
                S().summarySourceText,
                (chunk) => { // onChunkCallback
                    if (chunk) {
                        appendAnswerChunk(`qa-answer-${questionEntry.q_id}`, chunk);
                        accumulatedAnswer += chunk; 
                    }
                }
            );
            questionEntry.a = accumulatedAnswer; // Store full stripped answer
            questionEntry.qa_prompt = aiResult.prompt;
            // Ensure rawAnswerAccumulated is used from aiResult
            questionEntry.qa_raw_ai_response = aiResult.rawAnswerAccumulated; 
        } catch (error) {
            console.error("Q&A 過程中發生錯誤:", error);
            accumulatedAnswer = `❌ ${esc(error.message || "AI 問答時發生錯誤")}`;
            questionEntry.a = accumulatedAnswer; // Set error message to entry
            questionEntry.qa_prompt = null; 
            questionEntry.qa_raw_ai_response = null;
        } finally {
            // Finalize display for this specific answer, whether success or error
            finalizeAnswerDisplay(`qa-answer-${questionEntry.q_id}`, questionEntry.a, questionEntry, handleQARetry);
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
    if (!entryToRetry || S().running) return; 

    const originalQuestion = entryToRetry.q;

    entryToRetry.a = "AI正在輸入..."; // Placeholder for streaming
    entryToRetry.qa_prompt = null;
    entryToRetry.qa_raw_ai_response = null;

    drawQA(S().qaHistory, handleQARetry); // Update UI to show loading state
    toggleQAInput(true); // Disable new questions

    let accumulatedAnswer = "";
    try {
        const pageTitle = elements.hTitle.textContent;
        const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);
        const historyForPrompt = S().qaHistory.filter(h => h.q_id <= questionId);

        const aiResult = await askAIQuestion(
            originalQuestion,
            pageTitle,
            historyForPrompt, 
            summaryKeyPoints,
            S().summarySourceText,
            (chunk) => { // onChunkCallback
                if (chunk) {
                    appendAnswerChunk(`qa-answer-${entryToRetry.q_id}`, chunk);
                    accumulatedAnswer += chunk;
                }
            }
        );
        entryToRetry.a = accumulatedAnswer;
        entryToRetry.qa_prompt = aiResult.prompt;
        entryToRetry.qa_raw_ai_response = aiResult.rawAnswerAccumulated;

    } catch (error) {
        console.error("Q&A 重試失敗:", error);
        accumulatedAnswer = `❌ ${esc(error.message || "AI 問答重試失敗")}`;
        entryToRetry.a = accumulatedAnswer;
    } finally {
        finalizeAnswerDisplay(`qa-answer-${entryToRetry.q_id}`, entryToRetry.a, entryToRetry, handleQARetry);
        toggleQAInput(false); // Re-enable input
        if (elements.qaInput.parentElement.contains(elements.qaInput)) {
            elements.qaInput.focus();
        }
    }
}