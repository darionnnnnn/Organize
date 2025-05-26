if (actualIsDirectOutputMode) {
    const system_prompt = `您是一位專業的內容分析師。您的任務是將「原始內容」整理成流暢易讀的摘要。

**嚴格遵守以下所有指示：**

1.  **輸出語言：** **必須**使用**繁體中文（例如：這是一段繁體中文）**。請確保您的回覆完全是繁體中文。語言設定為：「${cfg.outputLanguage}」。
2.  **輸出格式：** **絕對只能**直接輸出純文字摘要。**禁止**使用任何 JSON、Markdown、程式碼區塊 (例如 \`\`\`) 或任何其他特殊格式。
3.  **內容依據：** 摘要必須**完全**基於「原始內容」，不得包含任何原文未提及的推論或延伸資訊。
4.  **詳細程度：** 摘要的詳細程度請參考：「${levelText}」。
5.  **內容過短處理：** 若「原始內容」不足以生成有意義的摘要，請**僅**回答：「內容過於簡短，無法提供有意義的摘要。」，不得添加任何其他文字。

請開始處理「原始內容」。`;

    const user_prompt = `原始內容如下：
標題：${title}
內容：${preprocessInputForAI(content)}`;

    // The user will need to modify their Ollama API call here.
    // For now, we can represent this with a comment or a placeholder.
    // For example:
    // ollamaApiCall({
    //   messages: [
    //     { role: 'system', content: system_prompt },
    //     { role: 'user', content: user_prompt }
    //   ]
    // });
    // To avoid breaking existing code, we can temporarily assign to the old 'prompt'
    // variable or just comment out the old assignment if the user confirms they will
    // update the API call logic immediately.
    // For safety, let's create a placeholder for the new API call structure.
    // And ensure the old 'prompt' variable is not used in this branch.

    // Placeholder for the new API call structure
    const messagesForOllama = [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
    ];
    console.log("Ollama messages for direct output mode:", messagesForOllama); // Placeholder
    // The original 'prompt' variable is no longer set in this branch.
    // The user is responsible for updating the Ollama call to use 'messagesForOllama'.

} else {
    const system_prompt_false = `您是一位專業的內容分析師。您的任務是將「原始內容」整理成數個主要重點。

**嚴格遵守以下所有指示：**

1.  **輸出語言：** **必須**使用**繁體中文（例如：這是一段繁體中文的標題）**。所有 JSON 字串值都必須是繁體中文。語言設定為：「${cfg.outputLanguage}」。
2.  **輸出格式：** **必須且僅能**輸出一個**單獨的、完全合法的 JSON 物件**。輸出內容**必須**以 \`{\` 開始，並以 \`}\` 結束。**禁止**在 JSON 物件前後包含任何文字、說明、Markdown、程式碼區塊或任何其他非 JSON 內容。
3.  **JSON 結構：** 請使用以下指定的 JSON 結構：
    \`\`\`json
    {
      "keyPoints": [
        {
          "title": "（字串，繁體中文）重點的簡潔標題",
          "details": "（字串，繁體中文）詳細說明，可用 \n 表示段落換行",
          "quote": "（字串，繁體中文，可選）引用原文中的一句話，如無可省略或留空"
        }
      ]
    }
    \`\`\`
4.  **格式規範：**
    *   嚴格遵守上述 JSON 結構。
    *   正確轉義所有 JSON 字串內的特殊字元，例如：\`"\` 應轉義為 \`\"\`，\`\\` 應轉義為 \`\\\`，實際換行符應表示為 \`\n\`。
    *   JSON 中禁止出現未轉義的控制字元。
5.  **內容依據：** 重點必須**完全**基於「原始內容」，不得包含任何原文未提及的推論或延伸資訊。
6.  **內容過短處理：** 若「原始內容」不足以生成有效摘要，請**僅**回傳以下 JSON 物件：
    \`\`\`json
    {
      "keyPoints": [
        {
          "title": "內容過簡",
          "details": "原始內容過於簡短，無法進行有效摘要。",
          "quote": ""
        }
      ]
    }
    \`\`\`
7.  **詳細程度：** 摘要詳略程度請參考：「${levelText}」。

請開始處理「原始內容」並生成所要求的 JSON 物件。`;

    const user_prompt_false = `原始內容如下：
標題：${title}
內容：${preprocessInputForAI(content)}`;

    // Placeholder for the new API call structure
    const messagesForOllama = [
        { role: 'system', content: system_prompt_false },
        { role: 'user', content: user_prompt_false }
    ];
    console.log("Ollama messages for JSON output mode:", messagesForOllama); // Placeholder
    // The original 'prompt' variable is no longer set in this branch.
    // The user is responsible for updating the Ollama call to use 'messagesForOllama'.
}
