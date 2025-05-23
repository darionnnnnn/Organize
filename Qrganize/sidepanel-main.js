// sidepanel-main.js – 主流程 (ES Module)
import { esc, stripThink, cleanAI, createOutline } from "./sidepanel-utils.js";

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);

const btnSummary = $("summarize-btn");
const btnClear   = $("clear-btn");
const btnClose   = $("close-btn");

const hTitle     = $("summary-title");
const divContent = $("summary-content");
const hrSep      = $("qa-separator");

const qaList  = $("qa-list");
const qaInput = $("qa-input");
const askBtn  = $("ask-btn");

/* ---------- 設定 ---------- */
let cfg = {
    detail:  "medium",
    apiUrl:  "https://192.168.68.103/api",
    model:   "qwen3",
    font:    "small",
    showErr: false
};
await new Promise(r => chrome.storage.sync.get(cfg, v => { cfg = {...cfg, ...v}; r(); }));
document.body.classList.add(`font-${cfg.font}`);

/* ---------- 變數 ---------- */
const chatUrl = /(\/chat|completions)\s*$/i.test(cfg.apiUrl)
    ? cfg.apiUrl
    : cfg.apiUrl.replace(/\/+$/,"") + "/chat";

let running=false, ctrl=null, history=[];
let rawAI="", summaryHTML="", srcText="";

/* ---------- 工具 ---------- */
const disableQA = d => { qaInput.disabled = d; askBtn.disabled = d; };
const levelTxt  = () => ({high:"詳細",medium:"中等",low:"精簡"}[cfg.detail]||"中等");
const errMsg    = e => cfg.showErr ? `❗ ${e.message}` : "⚠️ 無法取得 AI 回應";

/* ---------- 事件 ---------- */
btnClose.onclick = () => parent.postMessage({type:"CLOSE_PANEL"},"*");
btnSummary.onclick = () => { if(!running) run(); };
btnClear.onclick = () => running && ctrl ? (ctrl.abort(), finish(false,"❌ 已取消")) : reset();

$("qa-form").onsubmit = async e => {
    e.preventDefault();
    const q = qaInput.value.trim();
    if(!q) return;
    history.push({ q, a:"…" }); drawQA(); qaInput.value="";
    disableQA(true);
    try   { history.at(-1).a = stripThink(await askAI(q)); }
    catch (er){ history.at(-1).a = "❌ "+er.message; }
    finally{ drawQA(); disableQA(false); }
};

window.addEventListener("message",e=>{
    if(e.data?.type==="SUMMARY_SELECTED_TEXT" && !running) run(e.data.text);
});

/* ---------- 主流程 ---------- */
async function run(sel=""){
    running=true; btnSummary.disabled=true; btnSummary.textContent="摘要中…";
    disableQA(true); hrSep.style.display="none";
    divContent.innerHTML='<div class="summary-status">截取文章中…</div>';
    ctrl=new AbortController();

    try{
        const art = sel ? {title:document.title||"選取文字", text:sel}
            : await getArticle();
        srcText = art.text;                // 保存原始內容

        hTitle.textContent=art.title;
        divContent.innerHTML='<div class="summary-status">AI 摘要中…</div>';

        rawAI = stripThink(await summarize(art.title, art.text));
        summaryHTML = cleanAI(rawAI);

        const { outline, body } = createOutline(summaryHTML, art.title);

        const buttons = cfg.showErr
            ? `<button id="copy-raw" class="copy-btn">複製原始回應</button>
         <button id="copy-src" class="copy-btn">複製原始內容</button>`
            : "";

        divContent.innerHTML = `<div class="summary-card">${buttons}${outline}${body}</div>`;

        if(cfg.showErr){
            bindCopy("#copy-raw", rawAI);
            bindCopy("#copy-src", srcText);
        }

        divContent.querySelectorAll(".outline-list a").forEach(a=>{
            a.onclick = ev => {
                ev.preventDefault();
                const id = a.getAttribute("href").slice(1);
                $(id)?.scrollIntoView({behavior:"smooth"});
            };
        });

        hrSep.style.display="block"; disableQA(false);
        finish(true);
    }catch(e){
        if(e.name!=="AbortError") finish(false, errMsg(e));
    }
}

function bindCopy(sel, data){
    const btn = divContent.querySelector(sel);
    if(!btn) return;
    btn.onclick = async () =>{
        await navigator.clipboard.writeText(data);
        const old = btn.textContent;
        btn.textContent="已複製！";
        setTimeout(()=>btn.textContent=old,2000);
    };
}

function finish(ok,msg=""){
    running=false; btnSummary.disabled=false; btnSummary.textContent="摘要"; ctrl=null;
    if(!ok) divContent.innerHTML=`<div class="summary-status">${msg}</div>`;
}

function reset(){
    hTitle.textContent=""; divContent.innerHTML=""; hrSep.style.display="none";
    history=[]; drawQA();
    divContent.innerHTML='<div class="summary-status">請按「摘要」開始</div>';
    disableQA(true);
}

/* ---------- QA 畫面 ---------- */
function drawQA(){
    qaList.innerHTML = history.map(h=>`
    <div class="qa-pair">
      <div class="qa-q">Q：${esc(h.q)}</div>
      <div class="qa-a">A：${h.a}</div>
    </div>`).join("");
}

/* ---------- AI ---------- */
async function summarize(t,c){
    const prompt=`請以${levelTxt()}層級繁體中文摘要以下內容，使用 HTML 條列：\n標題：${t}\n內容：${c}`;
    return callAI(prompt);
}
function askAI(q){
    const prompt=`根據下列摘要以繁體中文回答，使用 HTML：\n${summaryHTML}\n問題：${q}`;
    return callAI(prompt);
}
async function callAI(prompt){
    const res=await fetch(chatUrl,{
        method:"POST",headers:{ "Content-Type":"application/json" },signal:ctrl?.signal,
        body:JSON.stringify({
            model:cfg.model,
            messages:[
                {role:"system",content:"請繁體中文回答並使用 HTML 排版。"},
                {role:"user",content:prompt}
            ],
            stream:false
        })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const d=await res.json(); return d.message?.content?.trim()||"";
}

/* ---------- 文章抽取 ---------- */
function getArticle(){
    return new Promise(res=>{
        chrome.runtime.sendMessage({type:"EXTRACT_ARTICLE"},r=>{
            res(r||{title:document.title,text:document.body.innerText.slice(0,2000)});
        });
    });
}

/* ---------- Init & Ready ---------- */
reset();
window.parent.postMessage({type:"PANEL_READY"},"*");
