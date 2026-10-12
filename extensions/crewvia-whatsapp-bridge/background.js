/**
 * Crewvia WhatsApp Bridge - Background Service Worker
 * Manages FIFO queue, zero-reload tab reuse, dynamic script injection, and status dispatch.
 * STRICT ZERO-RELOAD ARCHITECTURE.
 */

const messageQueue = [];
let isProcessing = false;
let currentJob = null;
let whatsappTabId = null;

const DEFAULT_SETTINGS = {
  minDelayMs: 2500,
  maxDelayMs: 5000,
  autoPinTab: true,
  dailySentCount: 0,
  lastSentDate: new Date().toDateString(),
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get("settings");
  if (!current.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  console.log("[Crewvia Bridge] Background service worker initialized (Zero-Reload Architecture)");
});

// Helper: Get random jitter delay
async function getJitterDelay() {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || DEFAULT_SETTINGS;
  const min = settings.minDelayMs || 2500;
  const max = settings.maxDelayMs || 5000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Locate or launch WhatsApp Web tab (NEVER RELOADS EXISTING TAB)
async function getOrOpenWhatsAppTab() {
  // 1. Direct query
  const tabs = await chrome.tabs.query({ url: "*://web.whatsapp.com/*" });
  if (tabs.length > 0 && tabs[0]?.id) {
    whatsappTabId = tabs[0].id;
    return { tabId: whatsappTabId, isNew: false };
  }

  // 2. Fallback search across all open tabs
  const allTabs = await chrome.tabs.query({});
  const waTab = allTabs.find((t) => t.url && t.url.includes("web.whatsapp.com"));
  if (waTab && waTab.id) {
    whatsappTabId = waTab.id;
    return { tabId: whatsappTabId, isNew: false };
  }

  // 3. Only create if no tab is currently open anywhere in the browser
  console.log("[Crewvia Bridge] Opening WhatsApp Web tab for the first time...");
  const newTab = await chrome.tabs.create({ url: "https://web.whatsapp.com", active: false });
  whatsappTabId = newTab.id;
  return { tabId: whatsappTabId, isNew: true };
}

// Ensure content script is active in the WhatsApp tab without reloading and without duplicates
async function ensureContentScriptInjected(tabId) {
  try {
    // Check if script is already running in this tab
    const checkResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__crewviaWhatsAppScriptInjected,
    });

    if (checkResults && checkResults[0] && checkResults[0].result === true) {
      // Script is already active! Do NOT inject again.
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-whatsapp.js"],
    });
    console.log("[Crewvia Bridge] Content script dynamically attached to tab:", tabId);
  } catch (err) {
    console.warn("[Crewvia Bridge] Script verification check:", err.message);
  }
}

// Queue Processor - ABSOLUTELY ZERO RELOADS
async function processQueue() {
  if (isProcessing || messageQueue.length === 0) {
    return;
  }

  isProcessing = true;
  currentJob = messageQueue.shift();

  console.log("[Crewvia Bridge] Processing job:", currentJob.messageId, "To:", currentJob.phone);

  try {
    const cleanPhone = (currentJob.phone || "").replace(/[^\d]/g, "");
    const { tabId, isNew } = await getOrOpenWhatsAppTab();

    // 45s safety timeout
    const jobTimeout = setTimeout(() => {
      if (currentJob && currentJob.messageId) {
        handleJobFinished({
          messageId: currentJob.messageId,
          success: false,
          error: "Process timed out after 45 seconds.",
          reason: "timeout",
        });
      }
    }, 45000);

    currentJob.timeoutTimer = jobTimeout;

    if (isNew) {
      // First time WhatsApp Web is ever opened: wait for page load
      console.log("[Crewvia Bridge] Waiting for initial load of WhatsApp Web...");
      const listener = (tid, changeInfo) => {
        if (tid === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(async () => {
            await ensureContentScriptInjected(tabId);
            dispatchDirect(tabId, cleanPhone, currentJob.text, currentJob.messageId, currentJob.leadName);
          }, 3500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    } else {
      // Tab is ALREADY OPEN: Ensure script is attached & dispatch IMMEDIATELY without reload!
      await ensureContentScriptInjected(tabId);
      dispatchDirect(tabId, cleanPhone, currentJob.text, currentJob.messageId, currentJob.leadName);
    }
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

// Dispatch directly to content script (NEVER EVER RELOADS)
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
        console.warn("[Crewvia Bridge] Content script error:", chrome.runtime.lastError.message);
        // Do NOT reload the tab! Report retry or failure instead.
        handleJobFinished({
          messageId,
          success: false,
          error: "Could not send to WhatsApp Web tab. Please ensure WhatsApp Web is logged in.",
          reason: "script_error",
        });
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
      queuedAt: Date.now(),
    };
    messageQueue.push(job);
    processQueue();
    sendResponse({ status: "QUEUED", queueLength: messageQueue.length });
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
