// ─────────────────────────────────────────
// Content Script
// Runs on every webpage — reads page content
// ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Return the visible text of the current page
  if (request.action === "getPageText") {
    sendResponse({ text: document.body.innerText });
  }

});