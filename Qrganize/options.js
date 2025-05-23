// options.js
const $ = s => document.querySelector(s);

const defaults = {
    detail: "medium",
    apiUrl: "https://192.168.68.103/api",
    model:  "qwen3",
    font:   "small",
    panelWidth: 420,
    showErr: false
};

chrome.storage.sync.get(defaults, loadUI);

function loadUI(cfg) {
    // radio
    $(`[name=detail][value=${cfg.detail}]`).checked = true;
    $(`[name=font][value=${cfg.font}]`).checked     = true;
    // text / number
    $("#apiUrl").value     = cfg.apiUrl;
    $("#model").value      = cfg.model;
    $("#panelWidth").value = cfg.panelWidth;
    // switch
    $("#showErr").checked  = cfg.showErr;
}

$("#save").onclick = () => {
    const data = {
        detail: $("[name=detail]:checked").value,
        font:   $("[name=font]:checked").value,
        apiUrl: $("#apiUrl").value.trim() || defaults.apiUrl,
        model:  $("#model").value.trim()  || defaults.model,
        panelWidth: Math.min(
            Math.max(parseInt($("#panelWidth").value, 10) || defaults.panelWidth, 320),
            800
        ),
        showErr: $("#showErr").checked
    };
    chrome.storage.sync.set(data, () => alert("✅ 已儲存！"));
};

$("#reset").onclick = () => chrome.storage.sync.set(defaults, () => loadUI(defaults));
