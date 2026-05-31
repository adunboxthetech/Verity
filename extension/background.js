// Map to store the last detected theme for each tab
const tabThemes = {};
const DEFAULT_API_BASE = "https://veritycheck.vercel.app";

// Helper function to update the icon for a tab and globally
function updateIcon(tabId, isDark) {
  const suffix = isDark ? "" : "-black"; // White logo on dark background, Black logo on light background
  const iconPaths = {
    "16": `icons/icon16${suffix}.png`,
    "32": `icons/icon32${suffix}.png`,
    "48": `icons/icon48${suffix}.png`,
    "128": `icons/icon128${suffix}.png`
  };

  // Set tab-specific icon
  chrome.action.setIcon({
    tabId: tabId,
    path: iconPaths
  }, () => {
    if (chrome.runtime.lastError) {
      // ignore
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "PAGE_THEME_DETECTED") {
    const tabId = sender.tab?.id;
    if (tabId) {
      tabThemes[tabId] = message.isDark;
      updateIcon(tabId, message.isDark);
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "verity-check-selection",
    title: "Fact-check selected text with Verity",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "verity-check-selection") return;
  const selectedText = (info.selectionText || "").trim();
  if (!selectedText) return;

  chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE }, ({ apiBase }) => {
    const base = normalizeApiBase(apiBase) || DEFAULT_API_BASE;
    const target = `${base}/?text=${encodeURIComponent(selectedText.slice(0, 4000))}`;
    chrome.tabs.create({ url: target });
  });
});

function normalizeApiBase(value) {
  try {
    const url = new URL((value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch (_) {
    return "";
  }
}

// Re-apply the icon when tab updates (to override Chrome's automatic resets during navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If the status is loading or complete, and we have a saved theme, re-apply it
  if (tabThemes[tabId] !== undefined) {
    updateIcon(tabId, tabThemes[tabId]);
  }
  
  // If the URL changed, clear the saved theme so we don't carry over old page theme
  if (changeInfo.url) {
    delete tabThemes[tabId];
  }
});

// Clean up stored theme when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabThemes[tabId];
});
