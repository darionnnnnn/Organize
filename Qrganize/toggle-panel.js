// toggle-panel.js – 修復關閉後無法重開的問題，並優化邏輯
(() => {
    const ID_IFRAME = "ollama-ai-summary-panel-iframe"; // 使用更具描述性的 ID
    const ID_RESIZER = "ollama-ai-summary-panel-resizer"; // 使用更具描述性的 ID
    const MIN_WIDTH = 320;
    const MAX_WIDTH = 800;
    const DEFAULT_WIDTH = 420;

    // 用於儲存因 iframe 未載入而延遲發送的訊息
    const pendingMessages = [];
    let lastSummarySelectedTextMessage = null; // 儲存最後一次 SUMMARY_SELECTED_TEXT 訊息

    // 追蹤目前頁面上的 iframe 和 resizer 實例
    let currentFrameInstance = document.getElementById(ID_IFRAME);
    let currentResizerInstance = document.getElementById(ID_RESIZER);

    // --- 核心切換邏輯 ---
    function togglePanel() {
        currentFrameInstance = document.getElementById(ID_IFRAME); // 每次都重新獲取，以防萬一
        currentResizerInstance = document.getElementById(ID_RESIZER);

        if (currentFrameInstance && currentResizerInstance) {
            // 如果面板已存在，則切換其可見性
            if (currentFrameInstance.style.display === "none") {
                currentFrameInstance.style.display = "block";
                currentResizerInstance.style.display = "block"; // 或者恢復其原始 display 狀態
                // 面板重新顯示時，嘗試重新傳送最後的選取文字訊息
                if (currentFrameInstance.contentWindow && lastSummarySelectedTextMessage) {
                    try {
                        currentFrameInstance.contentWindow.postMessage(lastSummarySelectedTextMessage, "*");
                    } catch (e) {
                        console.warn("AI Panel: 重新顯示面板時傳送 lastMsg 失敗", e);
                    }
                }
            } else {
                // 如果面板已可見，點擊圖示的行為可以是隱藏它 (真正的 toggle)
                // currentFrameInstance.style.display = "none";
                // currentResizerInstance.style.display = "none";
                // 目前的設計是，點擊擴充圖示總是嘗試開啟或確保開啟。關閉由面板內部按鈕觸發。
            }
        } else {
            // 如果面板不存在 (例如已被關閉移除)，則重新建立
            chrome.storage.sync.get({ panelWidth: DEFAULT_WIDTH }, ({ panelWidth }) => {
                buildAndShowPanel(panelWidth < MIN_WIDTH ? DEFAULT_WIDTH : panelWidth);
            });
        }
    }

    function buildAndShowPanel(initialWidth) {
        // 再次檢查，以防極端情況下 build 被重複呼叫
        if (document.getElementById(ID_IFRAME)) {
            console.warn("AI Panel: buildAndShowPanel 被呼叫，但面板已存在。");
            currentFrameInstance = document.getElementById(ID_IFRAME);
            currentResizerInstance = document.getElementById(ID_RESIZER);
            if (currentFrameInstance) currentFrameInstance.style.display = "block";
            if (currentResizerInstance) currentResizerInstance.style.display = "block";
            return;
        }

        const frame = document.createElement("iframe");
        frame.id = ID_IFRAME;
        frame.src = chrome.runtime.getURL("sidepanel.html");
        frame.allow = "clipboard-write"; // 允許寫入剪貼簿
        Object.assign(frame.style, {
            position: "fixed", top: "0px", right: "0px", height: "100%",
            width: initialWidth + "px", border: "none", background: "#fff",
            zIndex: "2147483647", // 盡可能高的 z-index
            boxShadow: "0 0 10px rgba(0,0,0,0.15)"
        });
        document.body.appendChild(frame);
        currentFrameInstance = frame;

        const resizer = document.createElement("div");
        resizer.id = ID_RESIZER;
        Object.assign(resizer.style, {
            position: "fixed", top: "0px", right: initialWidth + "px", // resizer 在 iframe 左側
            width: "8px", height: "100%", cursor: "ew-resize", // ew-resize 更適合左右拖動
            zIndex: "2147483647", background: "transparent" // 可設為 #f0f0f0 在開發時調試
        });
        document.body.appendChild(resizer);
        currentResizerInstance = resizer;

        // --- Resizer 事件監聽 ---
        resizer.onpointerdown = (e) => {
            if (e.button !== 0) return; // 只回應滑鼠左鍵
            resizer.setPointerCapture(e.pointerId);
            const initialMouseX = e.clientX;
            const initialFrameWidth = parseInt(frame.style.width, 10);

            const onPointerMove = (ev) => {
                if (ev.buttons !== 1) return onPointerUp(); // 如果滑鼠按鍵已釋放
                const deltaX = initialMouseX - ev.clientX; // 滑鼠向左移動為正
                let newWidth = initialFrameWidth + deltaX;
                newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
                frame.style.width = newWidth + "px";
                resizer.style.right = newWidth + "px";
            };

            const onPointerUp = () => {
                resizer.releasePointerCapture(e.pointerId);
                document.removeEventListener("pointermove", onPointerMove);
                document.removeEventListener("pointerup", onPointerUp);
                chrome.storage.sync.set({ panelWidth: parseInt(frame.style.width, 10) });
            };

            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
        };

        // --- Iframe 載入完成後處理佇列中的訊息 ---
        frame.onload = () => {
            if (frame.contentWindow) {
                // 標記 panel 已準備好（可選，如果 sidepanel.js 發送 PANEL_READY）
                // frame.contentWindow.postMessage({ type: "PANEL_DOM_READY" }, "*");

                while (pendingMessages.length > 0) {
                    try {
                        frame.contentWindow.postMessage(pendingMessages.shift(), "*");
                    } catch (err) { console.warn("AI Panel: iframe.load 清空佇列訊息時發生錯誤:", err); }
                }
                if (lastSummarySelectedTextMessage) {
                    try {
                        frame.contentWindow.postMessage(lastSummarySelectedTextMessage, "*");
                    } catch (err) { console.warn("AI Panel: iframe.load 傳送 lastMsg 時發生錯誤:", err); }
                }
            }
        };
    }

    // --- 訊息處理常式 ---
    // 監聽來自 background.js 的訊息 (例如：選取的文字)
    // 使用具名函式方便移除監聽器 (雖然在此 IIFE 腳本中，通常只執行一次)
    function handleRuntimeMessage(msg, sender, sendResponse) {
        if (msg.type === "SUMMARY_SELECTED_TEXT") {
            lastSummarySelectedTextMessage = msg; // 總是更新最後的文字訊息
            if (currentFrameInstance && currentFrameInstance.contentWindow) {
                try {
                    currentFrameInstance.contentWindow.postMessage(msg, "*");
                } catch (e) {
                    // contentWindow 可能因為跨域或尚未完全初始化而無法存取
                    console.warn("AI Panel: runtimeMessageHandler 傳送訊息至 iframe 失敗，加入佇列。錯誤:", e);
                    pendingMessages.push(msg);
                }
            } else {
                pendingMessages.push(msg); // iframe 尚未建立或準備好
            }
        }
        // 此監聽器不處理非同步 sendResponse，可以不返回 true
        return false;
    }

    // 監聽來自 iframe (sidepanel.html) 的訊息 (例如：關閉面板、面板已準備好)
    function handleWindowMessage(event) {
        // 確認訊息來源是我們的 iframe
        if (currentFrameInstance && event.source === currentFrameInstance.contentWindow && event.data) {
            if (event.data.type === "CLOSE_PANEL") {
                if (currentFrameInstance) {
                    currentFrameInstance.style.display = "none"; // 改為隱藏
                }
                if (currentResizerInstance) {
                    currentResizerInstance.style.display = "none"; // 同時隱藏 resizer
                }
                // 如果是隱藏而非移除，則不需要重設 _AI_PANEL_TOGGLE_INJECTED 標記
                // 若要移除DOM並允許下次重建，則需重設標記：
                // if (currentFrameInstance) currentFrameInstance.remove();
                // if (currentResizerInstance) currentResizerInstance.remove();
                // currentFrameInstance = null;
                // currentResizerInstance = null;
                // window._AI_PANEL_TOGGLE_INJECTED = false; // ★★★ 如果是移除 DOM，則這行是關鍵
            }
            if (event.data.type === "PANEL_READY") { // 由 sidepanel.js 在其初始化完成後發送
                if (currentFrameInstance && currentFrameInstance.contentWindow) {
                    while (pendingMessages.length > 0) {
                        try {
                            currentFrameInstance.contentWindow.postMessage(pendingMessages.shift(), "*");
                        } catch (err) { console.warn("AI Panel: PANEL_READY 清空佇列訊息時發生錯誤:", err); }
                    }
                    if (lastSummarySelectedTextMessage) {
                        try {
                            currentFrameInstance.contentWindow.postMessage(lastSummarySelectedTextMessage, "*");
                        } catch (err) { console.warn("AI Panel: PANEL_READY 傳送 lastMsg 時發生錯誤:", err); }
                    }
                }
            }
        }
    }

    // --- 初始化訊息監聽 ---
    // 確保這些監聽器只被加入一次，即使 toggle-panel.js 被意外執行多次
    if (!window._AI_PANEL_LISTENERS_ATTACHED) {
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
        window.addEventListener("message", handleWindowMessage);
        window._AI_PANEL_LISTENERS_ATTACHED = true;
    }

    // --- 執行面板切換 ---
    // 檢查 window._AI_PANEL_SHOULD_CLOSE 標記 (由 CLOSE_PANEL 設定)
    // 這是另一種思路：如果 panel 關閉時設定了這個 flag，則此次不開啟
    // 但更簡單的是，讓 background.js 每次都執行 togglePanel()，由 togglePanel 判斷是創建還是顯示

    // 執行主要切換/建立邏輯
    // 移除原先的 window._AI_PANEL_INJECTED 守衛，讓腳本每次都能執行判斷
    togglePanel();

})();