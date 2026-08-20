const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ═════════════════════════════════════════════════════════════
// SECTION 1 — TAB SWITCHING
// Already set up. Do not edit.
// ═════════════════════════════════════════════════════════════

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`page-${tab.dataset.tab}`).classList.add("active");
  });
});

// ═════════════════════════════════════════════════════════════
// SECTION 2 — API KEY
// Already set up. Do not edit.
// ═════════════════════════════════════════════════════════════

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get("groqApiKey", (result) => {
      resolve(result.groqApiKey || null);
    });
  });
}

document.getElementById("saveKey").addEventListener("click", () => {
  const key = document.getElementById("apiKey").value.trim();
  const statusEl = document.getElementById("key-status");

  if (!key) {
    statusEl.textContent = "No key entered. Please paste your Groq API key.";
    statusEl.className = "status error-text";
    return;
  }

  chrome.storage.local.set({ groqApiKey: key }, () => {
    statusEl.textContent = "API key saved!";
    statusEl.className = "status success";
    document.getElementById("apiKey").value = "";
  });
});

async function initKeyStatus() {
  const key = await getApiKey();
  const statusEl = document.getElementById("key-status");
  const inputEl = document.getElementById("apiKey");

  if (key) {
    statusEl.textContent = "API key is saved.";
    statusEl.className = "status success";
    inputEl.placeholder = "Key saved — paste a new one to replace it";
  } else {
    statusEl.textContent = "No API key saved yet.";
    statusEl.className = "status error-text";
  }
}

// ═════════════════════════════════════════════════════════════
// SECTION 3 — HELPER FUNCTIONS
// Already set up. Do not edit.
// Call these anywhere in Section 4 to perform actions.
//
//   await getPageText()            — reads the current webpage
//   await openTab("https://...")   — opens a new tab
//   await closeCurrentTab()        — closes the active tab
//   await closeTabByName("youtube")— closes a tab by URL or title
//   await askAI("your prompt")     — sends a prompt, returns JSON
// ═════════════════════════════════════════════════════════════

// Reads all the visible text on the current webpage
async function getPageText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || tab.url.startsWith("chrome://")) {
    throw new Error("Please navigate to a real webpage first.");
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageText" });
    return response.text;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageText" });
    return response.text;
  }
}

// Opens a new tab to the given URL
async function openTab(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "openTab", url: url }, (response) => {
      resolve(response.tab);
    });
  });
}

// Closes the tab the user is currently on
async function closeCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ action: "closeTab", tabId: tab.id });
}

// Closes a tab by searching for a word in its URL or title
// Example: closeTabByName("youtube") closes any tab with "youtube" in the URL or title
async function closeTabByName(searchTerm) {
  const tabs = await chrome.tabs.query({});

  const match = tabs.find(tab =>
    tab.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tab.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (match) {
    chrome.runtime.sendMessage({ action: "closeTab", tabId: match.id });
  } else {
    throw new Error(`No tab found matching: "${searchTerm}"`);
  }
}

// Sends a prompt to Groq AI and returns a parsed JSON response.
//
// IMPORTANT: Your prompt MUST tell the AI to return ONLY a JSON object
// with an "action" field. The action field tells your code what to do.
//
// Example prompt:
//   "The user said: open YouTube.
//    Reply ONLY with a JSON object like:
//    { action: 'open_tab', url: 'https://...' }
//    Possible actions: open_tab, close_tab, close_tab_by_name, summarize"
//
// The AI will return something like:
//   { action: "open_tab", url: "https://www.youtube.com" }
//   { action: "summarize", summary: "This page is about..." }
//   { action: "close_tab" }
//   { action: "close_tab_by_name", name: "youtube" }

async function askAI(prompt) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error("No API key found. Please add one in the API Key tab.");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: "You are a browser assistant. Always respond ONLY with a valid raw JSON object. No markdown, no backticks, no explanation."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Groq error: ${data.error.message}`);
  }

  const rawText = data.choices[0].message.content;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON: " + rawText);
  }

  return JSON.parse(jsonMatch[0]);
}

// ═════════════════════════════════════════════════════════════
// SECTION 4 — YOUR CODE GOES HERE
//
// This is where you build your extension's features.
//
// HOW IT WORKS:
//   1. Get the user's input (from a button click, text field, etc.)
//   2. Call askAI() with a prompt describing what the user wants
//   3. Check aiResponse.action to decide what to do
//   4. Call the matching helper function
//
// EXAMPLE — wire up a button with id="myButton":
//
  document.getElementById("myButton").addEventListener("click", async () => {
    try {
      const userInput = document.getElementById("myInput").value;
      const pageText  = await getPageText();

      const aiResponse = await askAI(`
        Page content: ${pageText.slice(0, 3000)}
        User request: ${userInput}
        Reply ONLY with a JSON object.
        Possible actions: open_tab, close_tab, close_tab_by_name, summarize
        - open_tab:          { action: "open_tab", url: "https://..." }
        - close_tab:         { action: "close_tab" }
        - close_tab_by_name: { action: "close_tab_by_name", name: "..." }
        - summarize:         { action: "summarize", summary: "..." }
      `);

      if (aiResponse.action === "open_tab") {
        await openTab(aiResponse.url);

      } else if (aiResponse.action === "close_tab") {
        await closeCurrentTab();

      } else if (aiResponse.action === "close_tab_by_name") {
        await closeTabByName(aiResponse.name);

      } else if (aiResponse.action === "summarize") {
        document.getElementById("myOutput").textContent = aiResponse.summary;
      }

    } catch (err) {
      console.error(err);
      document.getElementById("myOutput").textContent = "Error: " + err.message;
    }
  });
//
// ═════════════════════════════════════════════════════════════

// YOUR CODE HERE


// ═════════════════════════════════════════════════════════════
// SECTION 5 — INIT
// Runs once when the popup opens. Do not edit.
// ═════════════════════════════════════════════════════════════

initKeyStatus();