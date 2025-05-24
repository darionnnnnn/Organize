// Qrganize/offscreen.js
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
    // Ensure the message is intended for the offscreen document
    if (message.target !== 'offscreen') {
        return false; // Indicate that we are not handling this message
    }

    switch (message.type) {
        case 'copy-to-clipboard':
            const success = await handleCopyToClipboard(message.data);
            sendResponse({ success: success, copiedText: message.data }); // Send success status back
            break;
        default:
            console.warn(`Offscreen: Unexpected message type received: '${message.type}'.`);
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    }
    return true; // Indicate that sendResponse will be called asynchronously
}

async function handleCopyToClipboard(text) {
    const textarea = document.getElementById('text-to-copy');
    if (!textarea) {
        console.error("Offscreen: Textarea element not found.");
        return false;
    }
    textarea.value = text;
    textarea.select();
    // Optionally, try to focus the textarea, which might help document.execCommand
    // textarea.focus(); 

    try {
        // Attempt to use the modern Clipboard API first
        await navigator.clipboard.writeText(text);
        console.log("Offscreen: Text copied to clipboard successfully via navigator.clipboard.writeText.");
        return true;
    } catch (err) {
        // Log detailed error information for navigator.clipboard.writeText
        console.error(
            "Offscreen: navigator.clipboard.writeText failed.",
            "ErrorName:", err.name,
            "ErrorMessage:", err.message,
            "ErrorObject:", err
        );

        // Fallback to document.execCommand('copy') if navigator.clipboard.writeText is unavailable or fails
        console.log("Offscreen: Attempting fallback to document.execCommand('copy').");
        try {
            // Ensure the textarea is focused before execCommand for some browsers/versions
            textarea.focus();
            textarea.select(); // Re-select just in case focus changed selection

            if (document.execCommand('copy')) {
                console.log("Offscreen: Text copied successfully via document.execCommand('copy').");
                return true;
            } else {
                console.error("Offscreen: document.execCommand('copy') returned false. This might indicate the command is not enabled or supported in this context.");
                return false;
            }
        } catch (execErr) {
            console.error(
                "Offscreen: document.execCommand('copy') threw an error.",
                "ErrorName:", execErr.name,
                "ErrorMessage:", execErr.message,
                "ErrorObject:", execErr
            );
            return false;
        }
    }
}