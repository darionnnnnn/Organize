// toggle-panel.js – flush queue & resend after PANEL_READY
(() => {
    if (window._AI_PANEL_INJECTED) return;
    window._AI_PANEL_INJECTED = true;

    const ID_IFRAME = "ollama-ai-panel";
    const ID_RESIZE = "ollama-ai-resizer";
    const MIN = 320, MAX = 800, DEF = 420;

    const pending = [];
    let lastMsg = null;       // 儲存最後一次 SUMMARY_SELECTED_TEXT

    chrome.storage.sync.get({ panelWidth: DEF }, ({ panelWidth }) => build(panelWidth));

    function build(width) {
        if (document.getElementById(ID_IFRAME)) return;

        /* === iframe === */
        const frame = document.createElement("iframe");
        frame.id  = ID_IFRAME;
        frame.src = chrome.runtime.getURL("sidepanel.html");
        frame.allow = "clipboard-write";
        Object.assign(frame.style, {
            position:"fixed", top:0, right:0, height:"100%",
            width: width + "px", border:"none", background:"#fff",
            zIndex: 9_999_999, boxShadow:"0 0 6px rgba(0,0,0,.18)"
        });
        document.body.appendChild(frame);

        /* === resizer === */
        const bar = document.createElement("div");
        bar.id = ID_RESIZE;
        Object.assign(bar.style, {
            position:"fixed", top:0, right:width + "px", width:"8px", height:"100%",
            cursor:"col-resize", zIndex:9_999_999, background:"transparent"
        });
        document.body.appendChild(bar);

        bar.addEventListener("pointerdown", e => {
            if (e.button !== 0) return;
            bar.setPointerCapture(e.pointerId);
            const move = ev => {
                if (ev.buttons === 0) return up();
                const w = Math.min(Math.max(window.innerWidth - ev.clientX, MIN), MAX);
                frame.style.width = w + "px";
                bar.style.right   = w + "px";
            };
            const up = () => {
                bar.releasePointerCapture(e.pointerId);
                document.removeEventListener("pointermove", move);
                document.removeEventListener("pointerup",   up);
                chrome.storage.sync.set({ panelWidth: parseInt(frame.style.width, 10) });
            };
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup",   up);
        });

        /* === iframe ready → flush queue === */
        frame.addEventListener("load", () => {
            while (pending.length) frame.contentWindow.postMessage(pending.shift(), "*");
            if (lastMsg) frame.contentWindow.postMessage(lastMsg, "*");
        });

        /* ===  message bridge  === */
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.type === "SUMMARY_SELECTED_TEXT") {
                lastMsg = msg;
                if (frame.contentWindow) frame.contentWindow.postMessage(msg, "*");
                else pending.push(msg);
            }
        });

        window.addEventListener("message", e => {
            if (e.data?.type === "CLOSE_PANEL") {
                frame.remove(); bar.remove();
            }
            if (e.data?.type === "PANEL_READY" && lastMsg) {
                frame.contentWindow.postMessage(lastMsg, "*");
            }
        });
    }
})();
