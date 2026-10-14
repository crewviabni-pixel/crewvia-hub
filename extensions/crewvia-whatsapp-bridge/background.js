/**
 * Crewvia WhatsApp Bridge - Background Service Worker
 * Focuses WhatsApp tab on send for fast foreground execution (NO PAGE RELOAD),
 * and automatically returns to the Crewvia CRM tab upon completion.
 * VERSION: 1.0.8
 */

const messageQueue = [];
let isProcessing = false;
let currentJob = null;
let whatsappTabId = null;

const DEFAULT_SETTINGS = {
  minDelayMs: 2000,
  maxDelayMs: 4000,
  autoPinTab: true,
  dailySentCount: 0,
  lastSentDate: new Date().toDateString(),
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get("settings");
  if (!current.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  console.log("[Crewvia Bridge] Background service worker initialized (v1.0.8 Strict Zero-Reload)");
});

// Helper: Get random jitter delay
async function getJitterDelay() {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || DEFAULT_SETTINGS;
  const min = settings.minDelayMs || 2000;
  const max = settings.maxDelayMs || 4000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Locate or open WhatsApp Web tab
async function getOrOpenWhatsAppTab() {
  // 1. Direct query
  const urlPatterns = ["*://web.whatsapp.com/*", "*://*.whatsapp.com/*"];
  try {
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    if (tabs.length > 0 && tabs[0]?.id) {
      whatsappTabId = tabs[0].id;
      return whatsappTabId;
    }
  } catch (e) {
    console.warn("[Crewvia Bridge] URL query error:", e);
  }

  // 2. Comprehensive search across ALL open tabs
  const allTabs = await chrome.tabs.query({});
  const waTab = allTabs.find((t) => {
    const url = (t.url || t.pendingUrl || "").toLowerCase();
    const title = (t.title || "").toLowerCase();
    return url.includes("web.whatsapp.com") || url.includes("whatsapp.com") || title.includes("whatsapp");
  });

  if (waTab && waTab.id) {
    whatsappTabId = waTab.id;
    return whatsappTabId;
  }

  // 3. Launch if not open
  console.log("[Crewvia Bridge] Launching WhatsApp Web tab...");
  const newTab = await chrome.tabs.create({ url: "https://web.whatsapp.com", active: true });
  whatsappTabId = newTab.id;
  return whatsappTabId;
}

// Ensure content script is active in the WhatsApp tab without duplicates
async function ensureContentScriptInjected(tabId) {
  try {
    const checkResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__crewviaWhatsAppVersion === "1.0.8",
    });

    if (checkResults && checkResults[0] && checkResults[0].result === true) {
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-whatsapp.js"],
    });
    console.log("[Crewvia Bridge] Content script attached (v1.0.8) to tab:", tabId);
  } catch (err) {
    console.warn("[Crewvia Bridge] Script verification check:", err.message);
  }
}

// Queue Processor - Swaps to WhatsApp tab (ZERO RELOAD), executes in-page send, and returns to CRM
async function processQueue() {
  if (isProcessing || messageQueue.length === 0) {
    return;
  }

  isProcessing = true;
  currentJob = messageQueue.shift();

  console.log("[Crewvia Bridge] Processing job:", currentJob.messageId, "To:", currentJob.phone);

  try {
    const cleanPhone = (currentJob.phone || "").replace(/[^\d]/g, "");

    // 35s safety timeout
    const jobTimeout = setTimeout(() => {
      if (currentJob && currentJob.messageId) {
        handleJobFinished({
          messageId: currentJob.messageId,
          success: false,
          error: "Process timed out after 35 seconds.",
          reason: "timeout",
        });
      }
    }, 35000);

    currentJob.timeoutTimer = jobTimeout;

    // Step 1: Get the WhatsApp Web tab (REUSES EXISTING TAB, NEVER RELOADS)
    const tabId = await getOrOpenWhatsAppTab();

    // Step 2: Bring WhatsApp tab to foreground for fast 60fps execution
    await chrome.tabs.update(tabId, { active: true });
    try {
      const tabObj = await chrome.tabs.get(tabId);
      if (tabObj.windowId) {
        await chrome.windows.update(tabObj.windowId, { focused: true });
      }
    } catch (e) {}

    // Small delay to ensure tab focus is registered
    await new Promise((r) => setTimeout(r, 350));

    // Step 3: Ensure content script is attached
    await ensureContentScriptInjected(tabId);

    // Step 4: Dispatch in-page search & send (ABSOLUTELY ZERO RELOAD!)
    dispatchDirect(tabId, cleanPhone, currentJob.text, currentJob.messageId, currentJob.leadName);

  } catch (err) {
    console.error("[Crewvia Bridge] Failed to dispatch job:", err);
    handleJobFinished({
      messageId: currentJob.messageId,
      success: false,
      error: err.message || "Failed to communicate with WhatsApp Web tab",
      reason: "tab_error",
    });
  }
}

// Dispatch directly to content script
function dispatchDirect(tabId, phone, text, messageId, leadName) {
  chrome.tabs.sendMessage(
    tabId,
    {
      type: "DISPATCH_DIRECT_SEND",
      phone,
      text,
      messageId,
      leadName,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[Crewvia Bridge] Content script message warning:", chrome.runtime.lastError.message);
      }
    }
  );
}

// Handle completion of a send action
async function handleJobFinished(result) {
  if (!currentJob) return;

  if (currentJob.timeoutTimer) {
    clearTimeout(currentJob.timeoutTimer);
  }

  const finishedJob = currentJob;
  currentJob = null;

  // Step 5: AUTOMATICALLY RETURN USER BACK TO THEIR CRM TAB!
  if (finishedJob.sourceTabId) {
    setTimeout(async () => {
      try {
        await chrome.tabs.update(finishedJob.sourceTabId, { active: true });
        if (finishedJob.sourceWindowId) {
          await chrome.windows.update(finishedJob.sourceWindowId, { focused: true });
        }
        console.log("[Crewvia Bridge] ✅ Refocused user back to CRM tab:", finishedJob.sourceTabId);
      } catch (e) {
        console.warn("[Crewvia Bridge] Refocus back to CRM tab error:", e);
      }
    }, 400);
  }

  // Broadcast result back to Crewvia CRM tabs
  const crmTabs = await chrome.tabs.query({});
  for (const tab of crmTabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: result.success ? "MESSAGE_DELIVERED" : "MESSAGE_FAILED",
        payload: {
          messageId: finishedJob.messageId,
          leadId: finishedJob.leadId,
          phone: finishedJob.phone,
          status: result.status || (result.success ? "sent" : "failed"),
          error: result.error,
          reason: result.reason,
          timestamp: result.timestamp || new Date().toISOString(),
        },
      }).catch(() => {});
    }
  }

  if (result.success) {
    const data = await chrome.storage.local.get("settings");
    const settings = data.settings || DEFAULT_SETTINGS;
    const today = new Date().toDateString();

    if (settings.lastSentDate === today) {
      settings.dailySentCount = (settings.dailySentCount || 0) + 1;
    } else {
      settings.lastSentDate = today;
      settings.dailySentCount = 1;
    }
    await chrome.storage.local.set({ settings });
  }

  const delay = await getJitterDelay();
  console.log(`[Crewvia Bridge] Jitter pause: ${delay}ms before next job`);

  setTimeout(() => {
    isProcessing = false;
    processQueue();
  }, delay);
}

// Message Listener from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ENQUEUE_MESSAGE") {
    const job = {
      ...request.payload,
      sourceTabId: sender.tab?.id,
      sourceWindowId: sender.tab?.windowId,
      queuedAt: Date.now(),
    };
    messageQueue.push(job);
    processQueue();
    sendResponse({ status: "QUEUED", queueLength: messageQueue.length });
    return true;
  }

  if (request.type === "WA_STATUS_UPDATE") {
    sendResponse({ status: "RECEIVED" });
    return true;
  }

  if (request.type === "AUTOMATION_RESULT") {
    handleJobFinished(request);
    sendResponse({ status: "ACKNOWLEDGED" });
    return true;
  }

  if (request.type === "GET_BRIDGE_STATUS") {
    chrome.storage.local.get("settings").then((data) => {
      sendResponse({
        isProcessing,
        queueLength: messageQueue.length,
        currentJob: currentJob ? { messageId: currentJob.messageId, phone: currentJob.phone } : null,
        stats: data.settings || DEFAULT_SETTINGS,
      });
    });
    return true;
  }

  if (request.type === "CLEAR_QUEUE") {
    messageQueue.length = 0;
    sendResponse({ status: "CLEARED" });
    return true;
  }
});
