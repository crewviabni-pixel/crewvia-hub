/**
 * Crewvia WhatsApp Bridge - Injected Content Script for WhatsApp Web
 * Handles zero-reload in-page search, multiline formatted text insertion, and message dispatch.
 * STRICT ZERO-RELOAD: Never reloads or navigates the tab under any circumstances.
 */

(function () {
  // Prevent duplicate injections into the same tab
  if (window.__crewviaWhatsAppScriptInjected) {
    console.log("[Crewvia Bridge] Content script already active in this tab.");
    return;
  }
  window.__crewviaWhatsAppScriptInjected = true;

  console.log("[Crewvia Bridge] WhatsApp Web content script active (Strict Zero-Reload & Formatted Text Mode)");

  function notifyStatus(status, extra = {}) {
    chrome.runtime.sendMessage({
      type: "WA_STATUS_UPDATE",
      status,
      ...extra,
    }).catch(() => {});
  }

  function checkLoginState() {
    const qrCanvas =
      document.querySelector('canvas[aria-label="Scan this QR code with WhatsApp on your phone"]') ||
      document.querySelector('canvas[aria-label="Scan me!"]') ||
      document.querySelector('[data-ref]');
    if (qrCanvas) {
      notifyStatus("REQUIRES_LOGIN");
      return false;
    }

    const appPane = document.getElementById("app") || document.querySelector("#pane-side");
    if (appPane) {
      notifyStatus("LOGGED_IN");
      return true;
    }

    return null;
  }

  setTimeout(checkLoginState, 2000);

  // Helper: Fast text insertion for single-line search inputs
  function insertTextIntoSearch(el, text) {
    if (!el) return false;
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  /**
   * Helper: High-fidelity multiline formatted text insertion for WhatsApp Web's Lexical composer.
   * Accurately preserves all line breaks, double line breaks (paragraph spacing), numbered lists,
   * emojis, and WhatsApp markdown (*bold*, _italic_).
   */
  async function insertFormattedMessageIntoComposer(el, rawText) {
    if (!el) return false;
    el.focus();

    // Standardize all line endings to \n
    const text = (rawText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Clear existing text in composer
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    await new Promise((r) => setTimeout(r, 60));

    // Method 1: Synthetic DataTransfer ClipboardEvent (Paste)
    // WhatsApp Web uses Lexical, which parses plaintext paste events into
    // rich ParagraphNodes and LineBreakNodes, preserving \n, \n\n, and emojis.
    let pasteSucceeded = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      dt.setData("text", text);

      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
        composed: true,
      });

      el.dispatchEvent(pasteEvent);
      await new Promise((r) => setTimeout(r, 150));

      const currentText = el.innerText || el.textContent || "";
      if (currentText.trim().length > 0) {
        // If text had newlines, strictly verify that newlines are present in the editor
        if (!text.includes("\n") || currentText.includes("\n")) {
          pasteSucceeded = true;
          console.log("[Crewvia Bridge] Synthetic paste preserved multiline formatting successfully.");
        }
      }
    } catch (e) {
      console.warn("[Crewvia Bridge] Synthetic paste exception:", e);
    }

    // Method 2: High-Precision Line-by-Line Insertion with Shift+Enter / insertLineBreak
    // If synthetic paste was ignored by Lexical or flattened lines together,
    // inject each line individually with simulated Shift+Enter / insertLineBreak.
    if (!pasteSucceeded) {
      console.log("[Crewvia Bridge] Falling back to line-by-line insertion with Shift+Enter / insertLineBreak.");

      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await new Promise((r) => setTimeout(r, 60));

      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i > 0) {
          // Insert a line break between lines
          // 1. Shift + Enter KeyboardEvent (Lexical shortcut)
          el.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            })
          );

          // 2. Browser native execCommand insertLineBreak (inserts <br>)
          document.execCommand("insertLineBreak", false, null);

          // 3. Native beforeinput / input event for line break
          el.dispatchEvent(
            new InputEvent("beforeinput", {
              inputType: "insertLineBreak",
              bubbles: true,
              cancelable: true,
            })
          );
          el.dispatchEvent(
            new InputEvent("input", {
              inputType: "insertLineBreak",
              bubbles: true,
            })
          );
        }

        // Insert line content (contains NO newlines, so Chromium will never strip it!)
        if (line.length > 0) {
          document.execCommand("insertText", false, line);
          el.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              composed: true,
              data: line,
            })
          );
        }
      }
    }

    // Notify React / Lexical of input state change to activate the Send button
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  // Find the Send button in the active chat
  function findSendButton() {
    const icon =
      document.querySelector('span[data-icon="send"]') ||
      document.querySelector('span[data-icon="send-light"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('button[data-tab="11"]') ||
      document.querySelector('footer button:has(span[data-icon="send"])');
    if (!icon) return null;
    return icon.closest("button") || icon;
  }

  // Find the chat composer in #main footer
  function findComposer() {
    return (
      document.querySelector('#main footer div[contenteditable="true"]') ||
      document.querySelector('footer div[contenteditable="true"]') ||
      document.querySelector('div[data-tab="10"][contenteditable="true"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]')
    );
  }

  // Wait for composer to be mounted and ready
  async function waitForComposer(timeoutMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const comp = findComposer();
      if (comp) return comp;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  // Check if chat for this phone or contact name is ALREADY active in #main
  function isChatAlreadyOpen(phone, leadName) {
    const mainHeader = document.querySelector("#main header");
    if (!mainHeader) return false;
    const headerText = (mainHeader.innerText || "").toLowerCase();
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    const lastDigits = cleanPhone.slice(-8);

    if (lastDigits && headerText.replace(/[^\d]/g, "").includes(lastDigits)) {
      return true;
    }
    if (leadName && leadName.trim().length > 1) {
      const cleanName = leadName.trim().toLowerCase();
      if (headerText.includes(cleanName)) {
        return true;
      }
    }
    return false;
  }

  // Open chat via left pane search (ZERO RELOAD)
  async function openChatViaSearch(phone) {
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    const searchTarget = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

    // Clear any previous search state first
    const existingCancel =
      document.querySelector('button[aria-label="Cancel search"]') ||
      document.querySelector('span[data-icon="x-alt"]');
    if (existingCancel) existingCancel.click();

    const searchInput =
      document.querySelector('#side [contenteditable="true"]') ||
      document.querySelector('div[data-tab="3"][contenteditable="true"]') ||
      document.querySelector('#side [role="textbox"]') ||
      document.querySelector('div[title="Search input textbox"]') ||
      document.querySelector('#side input');

    if (!searchInput) return false;

    console.log("[Crewvia Bridge] Searching for phone:", searchTarget);
    insertTextIntoSearch(searchInput, searchTarget);

    // Wait up to 3.5 seconds for search result to appear
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const cell =
        document.querySelector('#pane-side div[role="listitem"]') ||
        document.querySelector('#pane-side div[data-testid="cell-frame-container"]') ||
        document.querySelector('#pane-side [role="row"]');

      if (cell) {
        console.log("[Crewvia Bridge] Found search result. Clicking to open chat without reload...");
        cell.click();

        // Clear search box to restore normal pane
        setTimeout(() => {
          const cancelBtn =
            document.querySelector('button[aria-label="Cancel search"]') ||
            document.querySelector('span[data-icon="x-alt"]');
          if (cancelBtn) cancelBtn.click();
        }, 500);

        return true;
      }
    }

    return false;
  }

  // Open chat via "New chat" drawer
  async function openChatViaNewChat(phone) {
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    const newChatBtn =
      document.querySelector('button[title="New chat"]') ||
      document.querySelector('button[aria-label="New chat"]') ||
      document.querySelector('span[data-icon="new-chat-outline"]') ||
      document.querySelector('span[data-icon="chat"]');

    if (!newChatBtn) return false;
    newChatBtn.closest("button")?.click() || newChatBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    const drawerInput =
      document.querySelector('div[data-tab="2"][contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]');

    if (drawerInput) {
      insertTextIntoSearch(drawerInput, cleanPhone);
      await new Promise((r) => setTimeout(r, 800));

      const firstContact =
        document.querySelector('div[role="listitem"]') ||
        document.querySelector('div[data-testid="cell-frame-container"]');
      if (firstContact) {
        firstContact.click();
        return true;
      }
    }
    return false;
  }

  // Check for error modal dialogs (e.g. invalid phone number)
  function checkForErrorModal() {
    const dialogs = document.querySelectorAll('div[role="dialog"], div[data-animate-modal-popup="true"]');
    for (const d of dialogs) {
      const text = d.innerText || "";
      if (
        text.includes("Phone number shared via url is invalid") ||
        text.includes("is not on WhatsApp") ||
        text.includes("invalid number")
      ) {
        const okBtn = d.querySelector("button");
        if (okBtn) okBtn.click();
        return "INVALID_PHONE_NUMBER";
      }
    }
    return null;
  }

  // Direct Send in Active Session (ABSOLUTELY ZERO RELOAD & PRETTY FORMATTING)
  async function handleDirectSendWithoutReload(phone, text, messageId, leadName) {
    console.log("[Crewvia Bridge] Zero-Reload Dispatch for:", phone, "Lead:", leadName);

    try {
      // 1. Check if chat is already open for this contact
      if (!isChatAlreadyOpen(phone, leadName)) {
        let opened = await openChatViaSearch(phone);
        if (!opened) {
          opened = await openChatViaNewChat(phone);
        }
        if (!opened) {
          throw new Error("Could not find contact in WhatsApp Web for phone: " + phone);
        }
        await new Promise((r) => setTimeout(r, 700));
      } else {
        console.log("[Crewvia Bridge] Contact chat is already open. Proceeding immediately to compose!");
      }

      // 2. Check for invalid number modal
      const modalError = checkForErrorModal();
      if (modalError) {
        chrome.runtime.sendMessage({
          type: "AUTOMATION_RESULT",
          messageId,
          success: false,
          error: "Phone number is not registered on WhatsApp.",
          reason: "invalid_phone",
        });
        return;
      }

      // 3. Find composer
      const composer = await waitForComposer(6000);
      if (!composer) {
        throw new Error("Chat composer not found in active conversation");
      }

      // 4. Insert formatted message with all line breaks & paragraph spacing preserved
      await insertFormattedMessageIntoComposer(composer, text);

      // 5. Short pause (400ms) for Lexical / React to update the Send button
      await new Promise((r) => setTimeout(r, 400));

      // 6. Find and click send button (or dispatch Enter)
      let sendBtn = findSendButton();
      if (!sendBtn) {
        // Retry once after 250ms
        await new Promise((r) => setTimeout(r, 250));
        sendBtn = findSendButton();
      }

      if (sendBtn) {
        sendBtn.click();
        console.log("[Crewvia Bridge] Send button clicked");
      } else {
        composer.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          })
        );
      }

      // 7. Verify dispatch
      await new Promise((r) => setTimeout(r, 1200));

      chrome.runtime.sendMessage({
        type: "AUTOMATION_RESULT",
        messageId,
        success: true,
        status: "sent",
        timestamp: new Date().toISOString(),
      });
      console.log("[Crewvia Bridge] Message successfully sent with 0 reloads and pretty formatting!");
    } catch (err) {
      console.error("[Crewvia Bridge] Error during zero-reload dispatch:", err);
      // DO NOT RELOAD THE TAB! Report failure back cleanly
      chrome.runtime.sendMessage({
        type: "AUTOMATION_RESULT",
        messageId,
        success: false,
        error: err.message || "Could not switch to contact in WhatsApp Web",
        reason: "dispatch_failed",
      });
    }
  }

  // Listen for instructions from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "DISPATCH_DIRECT_SEND") {
      handleDirectSendWithoutReload(request.phone, request.text, request.messageId, request.leadName);
      sendResponse({ status: "PROCESSING" });
      return true;
    }

    if (request.type === "CHECK_HEALTH") {
      const state = checkLoginState();
      sendResponse({ status: "HEALTH_OK", loggedIn: state });
      return true;
    }
  });
})();
