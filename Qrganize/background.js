// background.js
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ai-summary",
        title: "AI 摘要（全文或選取）",
        contexts: ["all", "selection"]
    });
    chrome.contextMenus.create({
        id: "ai-settings",
        title: "Settings",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ai-settings") {
        chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "ai-summary") {
        openPanel(tab, info.selectionText ?? "");
    }
});

chrome.action.onClicked.addListener(tab => openPanel(tab, ""));

function openPanel(tab, selectionText = "") {
    chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ["toggle-panel.js"] },
        () => chrome.tabs.sendMessage(tab.id, {
            type: "SUMMARY_SELECTED_TEXT",
            text: selectionText    // 可能為空字串，但仍需傳遞
        })
    );
}

/* keep-alive */
setInterval(() => {
    chrome.storage.sync.get({ apiUrl: "https://192.168.68.103/api" }, ({ apiUrl }) => {
        fetch(`${apiUrl}/tags`).catch(() => {});
    });
}, 20000);

/* 文章抽取轉發 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_ARTICLE") {
        chrome.tabs.sendMessage(sender.tab.id, { type: "EXTRACT_ARTICLE" }, sendResponse);
        return true;
    }
});
