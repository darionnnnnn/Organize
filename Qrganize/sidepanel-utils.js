// sidepanel-utils.js – 共用工具

export const esc = s =>
    s.replace(/[<>&"']/g, c => ({
        "<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"
    }[c]));

export const stripThink = s => s.replace(/<think>[\s\S]*?<\/think>/gi, "");

export function cleanAI(src) {
    /* 去掉 ```html``` 或 ``` 標記 */
    const m = src.match(/```(?:html)?\s*([\s\S]*?)```/i);
    let s = (m ? m[1] : src).trim();

    const out = [];
    let inList = false;

    for (const line of s.split(/\r?\n/)) {
        if (!line.trim()) continue;

        if (line.trim().startsWith("<")) {          // 已是 HTML
            if (inList) { out.push("</ul>"); inList = false; }
            out.push(line.trim());
            continue;
        }

        const bullet = line.match(/^\s*[-+*]\s+(.*)/);
        if (bullet) {
            if (!inList) { out.push("<ul>"); inList = true; }
            out.push(`<li>${esc(bullet[1])}</li>`);
        } else {
            if (inList) { out.push("</ul>"); inList = false; }
            out.push(`<p>${esc(line.trim())}</p>`);
        }
    }
    if (inList) out.push("</ul>");
    return out.join("\n");
}

export function createOutline(html, mainTitle) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    const first = wrap.querySelector("h1,h2,h3,strong,b");
    if (first && first.textContent.trim() === mainTitle.trim()) first.remove();

    const heads = [...wrap.querySelectorAll("h1,h2,h3,strong,b")];
    if (heads.length === 0) return { outline: "", body: wrap.innerHTML };

    heads.forEach((h, i) => (h.id = `sec${i}`));
    const list = heads
        .map((h, i) => `<a href="#sec${i}">${esc(h.textContent)}</a>`)
        .join("");

    return {
        outline: `<div class="outline-list">${list}</div>`,
        body: wrap.innerHTML
    };
}
