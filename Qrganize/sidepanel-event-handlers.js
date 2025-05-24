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
            runSummarizeFn(S().lastRunSelectionText); // 使用已儲存的選取文字
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
        if (!questionText || S().running) return; // 同時檢查是否有摘要正在執行

        const cfg = getConfig();
        const questionEntry = {
            q: questionText,
            q_id: Date.now(),
            a: "正在等待 AI 回覆...", // 答案的預留位置
            qa_prompt: null,
            qa_raw_ai_response: null
        };
        S().qaHistory.push(questionEntry);

        drawQA(S().qaHistory, handleQARetry); // 傳遞重試回呼函式
        elements.qaInput.value = "";
        toggleQAInput(true); // AI 思考時禁用輸入框

        try {
            const pageTitle = elements.hTitle.textContent;
            const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);

            const aiResult = await askAIQuestion(
                questionText,
                pageTitle,
                S().qaHistory, // 用於 API 建立上下文的完整歷史記錄
                summaryKeyPoints,
                S().summarySourceText
            );
            questionEntry.a = aiResult.answer;
            questionEntry.qa_prompt = aiResult.prompt;
            questionEntry.qa_raw_ai_response = aiResult.rawAnswer;
        } catch (error) {
            console.error("Q&A 過程中發生錯誤:", error);
            // 確保錯誤訊息 (error.message) 在可能包含 HTML 類似字元時進行跳脫處理
            questionEntry.a = `❌ ${esc(error.message || "AI 問答時發生錯誤")}`;
            questionEntry.qa_prompt = null; // 錯誤時也清除提示 (prompt)
            questionEntry.qa_raw_ai_response = null; // 錯誤時也清除原始回應
        } finally {
            drawQA(S().qaHistory, handleQARetry); // 使用實際答案或錯誤訊息重新渲染
            toggleQAInput(false); // 重新啟用輸入框
            if (elements.qaInput.parentElement.contains(elements.qaInput)) {
                elements.qaInput.focus();
            }
        }
    };

    window.addEventListener("message", e => {
        if (e.data?.type === "SUMMARY_SELECTED_TEXT") {
            S().lastRunSelectionText = e.data.text || ""; // 儲存它
            // 如果尚未執行，則自動執行摘要。
            // 這與點擊帶有選取內容的擴充功能圖示的行為一致。
            if (!S().running) {
                runSummarizeFn(S().lastRunSelectionText);
            }
        }
    });
}

async function handleQARetry(questionId) {
    const cfg = getConfig();
    const entryToRetry = S().qaHistory.find(h => h.q_id === questionId);
    if (!entryToRetry || S().running) return; // 如果摘要已在執行中，則不重試

    const originalQuestion = entryToRetry.q;

    entryToRetry.a = "重新嘗試中…"; // 重試時的預留位置
    entryToRetry.qa_prompt = null;
    entryToRetry.qa_raw_ai_response = null;

    drawQA(S().qaHistory, handleQARetry); // 更新 UI 以顯示此問題的載入狀態
    toggleQAInput(true); // 重試期間禁止提新問題

    try {
        const pageTitle = elements.hTitle.textContent;
        const summaryKeyPoints = parseAIJsonResponse(S().summaryRawAI);

        // 建立用於建構提示的歷史記錄：此項目之前的所有項目，加上目前的問題。
        // askAIQuestion 和 buildQAPrompt 將使用傳遞給它的歷史記錄中的最新項目作為目前問題。
        const historyForPrompt = S().qaHistory.filter(h => h.q_id <= questionId);


        const aiResult = await askAIQuestion(
            originalQuestion,
            pageTitle,
            historyForPrompt, // 傳遞包含正在重試的目前問題在內的歷史記錄
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
        drawQA(S().qaHistory, handleQARetry); // 使用新的答案或錯誤訊息重新渲染
        toggleQAInput(false); // 重新啟用輸入框
        if (elements.qaInput.parentElement.contains(elements.qaInput)) {
            elements.qaInput.focus();
        }
    }
}