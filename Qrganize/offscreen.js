// Qrganize/offscreen.js
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
    // 確保訊息是針對Offscreen的
    if (message.target !== 'offscreen') {
        return false; // 表示我們不處理此訊息
    }

    switch (message.type) {
        case 'copy-to-clipboard':
            const success = await handleCopyToClipboard(message.data);
            sendResponse({ success: success, copiedText: message.data }); // 回傳成功狀態
            break;
        default:
            console.warn(`Offscreen：收到未預期的訊息類型：'${message.type}'。`);
            sendResponse({ success: false, error: `未知的訊息類型：${message.type}` });
    }
    return true; // 表示 sendResponse 將會非同步呼叫
}

async function handleCopyToClipboard(text) {
    const textarea = document.getElementById('text-to-copy');
    if (!textarea) {
        console.error("Offscreen：找不到 Textarea 元素。");
        return false;
    }
    textarea.value = text;
    textarea.select();
    // 可選：嘗試聚焦 textarea，這可能有助於 document.execCommand
    // textarea.focus();

    try {
        // 首先嘗試使用現代的剪貼簿 API (Clipboard API)
        await navigator.clipboard.writeText(text);
        console.log("Offscreen：已透過 navigator.clipboard.writeText 成功複製文字到剪貼簿。");
        return true;
    } catch (err) {
        // 記錄 navigator.clipboard.writeText 的詳細錯誤資訊
        console.error(
            "Offscreen：navigator.clipboard.writeText 執行失敗。",
            "錯誤名稱:", err.name,
            "錯誤訊息:", err.message,
            "錯誤物件:", err
        );

        // 如果 navigator.clipboard.writeText 不可用或失敗，則降級使用 document.execCommand('copy')
        console.log("Offscreen：嘗試降級使用 document.execCommand('copy')。");
        try {
            // 對於某些瀏覽器/版本，在執行 execCommand 前確保 textarea 已聚焦
            textarea.focus();
            textarea.select(); // 重新選取以防焦點改變了選取範圍

            if (document.execCommand('copy')) {
                console.log("Offscreen：已透過 document.execCommand('copy') 成功複製文字。");
                return true;
            } else {
                console.error("Offscreen：document.execCommand('copy') 回傳 false。這可能表示該指令在此上下文中未啟用或不受支援。");
                return false;
            }
        } catch (execErr) {
            console.error(
                "Offscreen：document.execCommand('copy') 拋出錯誤。",
                "錯誤名稱:", execErr.name,
                "錯誤訊息:", execErr.message,
                "錯誤物件:", execErr
            );
            return false;
        }
    }
}