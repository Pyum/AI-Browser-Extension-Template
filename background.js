// ─────────────────────────────────────────
// Background Script
// Handles tab actions requested by popup.js
// ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Open a new tab
  if (request.action === "openTab") {
    chrome.tabs.create({ url: request.url }).then(tab => {
      sendResponse({ tab });
    });
    return true;
  }

  // Close a tab by ID
  if (request.action === "closeTab") {
    chrome.tabs.remove(request.tabId).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Get all open tabs
  if (request.action === "getAllTabs") {
    chrome.tabs.query({}).then(tabs => {
      sendResponse({ tabs });
    });
    return true;
  }

});