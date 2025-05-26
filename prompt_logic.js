if (actualIsDirectOutputMode) {
    const system_prompt = `您是一位專業的內容分析師。請將以下提供的「原始內容」整理成一段或數段流暢易讀的摘要。

重要指示：
- 請直接輸出摘要內容，不要使用任何 JSON 格式或任何程式碼區塊。
- 摘要應完全基於「原始內容」，不得推論或延伸原文未提及的資訊。
- 摘要的語言請使用：「${cfg.outputLanguage}」。
- 摘要的詳細程度請參考：「${levelText}」。
- 如果「原始內容」過於簡短或不適合生成摘要，請直接回答「內容過於簡短，無法提供有意義的摘要。」。`;

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
    const system_prompt_false = `您是一位專業的內容分析師。請將以下內容整理成數個主要重點，並以「${cfg.outputLanguage}」撰寫。

⚠️ 請**僅輸出一個合法的 JSON 物件**，不得包含任何說明。

JSON 物件格式如下：
{
  "keyPoints": [
    {
      "title": "（字串）重點的簡潔標題",
      "details": "（字串）詳細說明，可用 \n 表示段落換行",
      "quote": "（字串，可選）引用原文中的一句話，如無可省略或留空"
    }
  ]
}

格式規範：
- 僅輸出上述 JSON 物件格式 結構
- 正確轉義所有特殊字元：
  - " → \"
  - \ → \\
  - 實體換行符 → \n
- 禁止未轉義的控制字元（如實體換行、tab、Unicode 控制符）

摘要規範：
- 摘要需扼要且與原文資訊量相符
- 僅依據原文撰寫，不得推論延伸
- 若原文過短無法摘要，請回傳：
{
  "keyPoints": [
    {
      "title": "內容過簡",
      "details": "原始內容過於簡短，無法進行有效摘要。",
      "quote": ""
    }
  ]
}

摘要詳略程度請參考：「${levelText}」`;

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
