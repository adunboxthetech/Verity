chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "PAGE_THEME_DETECTED") {
    const tabId = sender.tab?.id;
    if (tabId) {
      const suffix = message.isDark ? "" : "-black"; // White logo on dark background, Black logo on light background
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": `icons/icon16${suffix}.png`,
          "32": `icons/icon32${suffix}.png`,
          "48": `icons/icon48${suffix}.png`,
          "128": `icons/icon128${suffix}.png`
        }
      }, () => {
        // Suppress errors (e.g. if the tab was closed before setIcon completed)
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    }
    return false;
  }

  if (message && message.type === "CAPTURE_VISIBLE_TAB") {
    chrome.tabs.captureVisibleTab(
      undefined,
      { format: "jpeg", quality: 72 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ ok: true, dataUrl });
      }
    );
    return true;
  }

  return false;
});
