// content.js － 抽取網頁主文
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== "EXTRACT_ARTICLE") return;
    try {
        const reader  = new Readability(document.cloneNode(true));
        const article = reader.parse() || {};
        const text    = (article.textContent || article.content || document.body.innerText || "")
            .trim().slice(0, 5000);
        sendResponse({ text, title: article.title || document.title || "網頁內容" });
    } catch {
        sendResponse({
            text: document.body.innerText.slice(0, 2000),
            title: document.title || "網頁內容"
        });
    }
});
