# AI 網頁重點摘要 (Ollama Local AI Web Page Summarizer)

「AI 網頁重點摘要」是一款 Chrome 瀏覽器擴充功能，能提取網頁主要內容，利用您本地部署的 Ollama/LMStudio AI 服務（如 Llama 3, Qwen2, Gemma 2 等模型）產生重點摘要，並支援針對網頁內容進行問答。所有處理均在本地完成，確保資料隱私。

## 主要功能 (Key Features)

*   **智能內文擷取：** 自動識別網頁核心內容。
*   **本地 AI 處理：** 與您的本地 Ollama/LMStudio 服務整合，確保隱私。
*   **外部 AI 服務：** 目前已支援Google, Grok, Chatgpt, Deppseek。
*   **結構化摘要：** 清晰呈現重點標題與詳細說明。
*   **選取文字摘要：** 可對網頁上選取的文字片段進行摘要。
*   **互動式問答 (Q&A)：** 基於網頁內容、摘要及對話歷史提問。
*   **高度可自訂：** 調整 API、模型、語言、詳細度、外觀等。
*   **除錯模式：** 提供詳細錯誤資訊及重試功能。

## 先決條件 (Prerequisites)

1.  **已安裝 Ollama/LMStudio：** 您需要在您的電腦上安裝並運行 Ollama/LMStudio 服務。請參考 [Ollama 官方網站](https://ollama.com/)/[LMStudio](https://lmstudio.ai/)。
2.  **已下載 AI 模型：** 請確保您希望使用的 AI 模型已經透過 Ollama/LMStudio 下載。例如，執行 `ollama pull qwen2:7b-instruct`。

或

1.  **已申請 Api key：** 程式目前已支援Google, Grok, Chatgpt, Deppseek。

## 安裝教學 (Installation)

1.  **下載/Clone 儲存庫：** 將此專案的檔案下載到您的電腦。
2.  **開啟 Chrome 擴充功能頁面：** 在 Chrome 瀏覽器網址列輸入 `chrome://extensions` 並前往。
3.  **啟用開發人員模式：** 在擴充功能頁面的右上角，開啟「開發人員模式 (Developer mode)」的開關。
4.  **載入未封裝的擴充功能：**
    *   點擊「載入未封裝項目 (Load unpacked)」按鈕。
    *   選擇您在本機存放此專案的 `Qrganize` 資料夾 (注意：是包含 `manifest.json` 的那個資料夾)。
5.  **完成：** 擴充功能圖示應會出現在您的 Chrome 工具列上。

## 基本使用 (Basic Usage)

1.  **設定 Ollama/LMStudio API (首次使用)：**
    *   在擴充功能圖示上按右鍵，選擇「設定 (Settings)」。
    *   確保「Ollama/LMStudio API 位址」已正確填寫並儲存。
    *   若使用外部 AI 服務請確實填入 Api key 且正確填寫「模型名稱」並儲存。
2.  **開啟側邊面板與摘要：**
    *   瀏覽到您想摘要的網頁。
    *   點擊瀏覽器工具列上的擴充功能圖示，或在頁面右鍵選擇「AI 摘要（全文或選取）」。
    *   若要摘要特定文字，請先選取文字，然後再點擊圖示或使用右鍵選單。
3.  **互動：** 閱讀摘要，使用問答功能，或調整設定。

## 簡易故障排除 (Basic Troubleshooting)

*   **摘要失敗：**
    *   請檢查您的 Ollama/LMStudio 服務是否正在本機運行。
    *   確認設定中的「Ollama/LMStudio API 位址」是否正確 (Ollama預設通常是 `http://localhost:11434/api`)。
    *   若使用外部 AI api 請確認是否正確填寫「模型名稱」。
    *   嘗試在設定中開啟「顯示詳細錯誤訊息」以獲取更多錯誤細節。
*   **面板未載入或行為異常：** 嘗試在 `chrome://extensions` 頁面重新載入擴充功能 (點擊更新按鈕或關閉再開啟)。

## 授權 (License)

本專案採用 MIT 授權。詳見 LICENSE 文件 (如果專案中有)。
