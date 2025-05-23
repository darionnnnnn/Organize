// sidepanel-state.js

export const state = {
    running: false,
    currentAbortController: null,
    qaHistory: [],
    summaryRawAI: "", // For summary's raw AI response
    summarySourceText: "",
    lastSummaryPrompt: "",
    lastRunSelectionText: "" // Text selected by user for summary
};

export function S() { // Shorthand to access state
    return state;
}

export function resetState() {
    state.running = false;
    state.currentAbortController = null;
    state.qaHistory = [];
    state.summaryRawAI = "";
    state.summarySourceText = "";
    state.lastSummaryPrompt = "";
    state.lastRunSelectionText = "";
}