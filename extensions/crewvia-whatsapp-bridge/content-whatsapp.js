/**
 * Crewvia WhatsApp Bridge - Injected Content Script for WhatsApp Web
 * STRICT ZERO-RELOAD: Never reloads or navigates the tab.
 * IN-PAGE SEARCH: Searches recipient phone via New Chat drawer, opens chat, and sends.
 * SINGLE-DISPATCH: Strictly prevents duplicate message sends.
 * VERSION: 1.0.8
 */

(function () {
  const SCRIPT_VERSION = "1.0.8";

  // Prevent duplicate script injections of the SAME version into the same tab
  if (window.__crewviaWhatsAppVersion === SCRIPT_VERSION) {
    console.log("[Crewvia Bridge] Content script v" + SCRIPT_VERSION + " already active in this tab.");
    return;
  }
  window.__crewviaWhatsAppScriptInjected = true;
  window.__crewviaWhatsAppVersion = SCRIPT_VERSION;

  // Idempotency tracking to strictly prevent duplicate sends
  const processedMessageIds = new Set();
  let isSendingInProgress = false;

  console.log("[Crewvia Bridge] WhatsApp Web content script active v" + SCRIPT_VERSION + " (Strict Zero-Reload In-Page Mode)");

  function safeSendMessage(message, callback) {
    if (typeof chrome === "undefined" || !chrome?.runtime?.id) {
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime.lastError;
        if (callback && !err) {
          callback(res);
        }
      });
    } catch (e) {
      // Extension context invalidated
    }
  }

  function notifyStatus(status, extra = {}) {
    safeSendMessage({
      type: "WA_STATUS_UPDATE",
      status,
      ...extra,
    });
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

    const appPane = document.getElementById("app") || document.querySelector("#pane-side") || document.querySelector("#side");
    if (appPane) {
      notifyStatus("LOGGED_IN");
      return true;
    }

    return null;
  }

  setTimeout(checkLoginState, 1500);

  /**
   * Helper: Dispatch a clean pointer and mouse event cascade.
   * Single click dispatch only (never double-clicks!).
   */
  function clickElement(el) {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + Math.max(rect.width / 2, 2);
      const y = rect.top + Math.max(rect.height / 2, 2);

      const pointerOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: 1,
      };

      const mouseOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1,
      };

      el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
      el.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
      if (typeof el.focus === "function") el.focus();
      el.dispatchEvent(new PointerEvent("pointerup", { ...pointerOpts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("mouseup", { ...mouseOpts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("click", { ...mouseOpts, buttons: 0 }));
      return true;
    } catch (e) {
      try {
        el.click();
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /**
   * Helper: High-fidelity multiline formatted text insertion for WhatsApp Web's Lexical composer.
   * Accurately preserves all line breaks, double line breaks, emojis, and WhatsApp markdown.
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
        if (!text.includes("\n") || currentText.includes("\n")) {
          pasteSucceeded = true;
        }
      }
    } catch (e) {}

    // Method 2: High-Precision Line-by-Line Insertion with Shift+Enter / insertLineBreak
    if (!pasteSucceeded) {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await new Promise((r) => setTimeout(r, 60));

      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i > 0) {
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

          document.execCommand("insertLineBreak", false, null);

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

    // Notify React / Lexical of input state change to activate Send button
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  // Find the Send button in the active chat (strictly inside #main)
  function findSendButton() {
    const mainPane = document.getElementById("main") || document.querySelector("#main");
    if (!mainPane) return null;

    const selectors = [
      '#main footer button:has(span[data-icon="send"])',
      '#main footer button[data-testid="compose-btn-send"]',
      '#main button[data-testid="compose-btn-send"]',
      '#main span[data-icon="send"]',
      '#main span[data-icon="send-light"]',
      '#main footer button[aria-label="Send" i]',
      '#main footer button[aria-label*="Send" i]',
      '#main footer button[data-tab="11"]',
      '#main footer button:has(svg)',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el.closest("button") || el;
      } catch (e) {}
    }
    return null;
  }

  // Find the chat composer strictly inside #main
  function findComposer() {
    const mainPane = document.getElementById("main") || document.querySelector("#main");
    if (!mainPane) return null;

    const selectors = [
      '#main footer div[contenteditable="true"]',
      '#main footer [contenteditable="true"]',
      '#main div[data-testid="conversation-compose-box-input"]',
      '#main div[data-tab="10"][contenteditable="true"]',
      '#main div[data-lexical-editor="true"][contenteditable="true"]',
      '#main div[role="textbox"][contenteditable="true"]',
      '#main footer div[role="textbox"]',
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  // Wait for composer to be mounted in #main and ready
  async function waitForComposer(timeoutMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const comp = findComposer();
      if (comp) return comp;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  // Check if target contact chat is ALREADY open in #main
  function isTargetChatAlreadyOpen(phone, leadName) {
    const mainHeader = document.querySelector('#main header');
    if (!mainHeader) return false;
    const headerText = (mainHeader.innerText || "").toLowerCase();
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    const tenDigit = cleanPhone.slice(-10);

    if (tenDigit && headerText.includes(tenDigit)) return true;
    if (leadName && leadName.length >= 3 && headerText.includes(leadName.toLowerCase())) return true;
    return false;
  }

  // Close any open drawer or leftover search state cleanly
  async function closeAnyOpenDrawer() {
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    } catch (e) {}

    const backBtn =
      document.querySelector('button[aria-label*="Back" i]') ||
      document.querySelector('span[data-icon="back"]') ||
      document.querySelector('span[data-icon="arrow-left"]');
    if (backBtn && !backBtn.closest("#main")) {
      clickElement(backBtn.closest("button") || backBtn.closest('div[role="button"]') || backBtn);
      await new Promise((r) => setTimeout(r, 200));
    }

    const cancelBtn =
      document.querySelector('button[aria-label="Cancel search"]') ||
      document.querySelector('button[aria-label*="Cancel" i]') ||
      document.querySelector('span[data-icon="x-alt"]') ||
      document.querySelector('span[data-icon="x"]');
    if (cancelBtn && !cancelBtn.closest("#main")) {
      clickElement(cancelBtn.closest("button") || cancelBtn.closest('div[role="button"]') || cancelBtn);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Locate the "New Chat" button on WhatsApp Web
  function findNewChatButton() {
    const directSelectors = [
      'button[aria-label="New chat" i]',
      'button[aria-label*="new chat" i]',
      'div[role="button"][aria-label*="new chat" i]',
      'button[title="New chat" i]',
      'button[title*="new chat" i]',
      'div[role="button"][title*="new chat" i]',
      '[data-testid="chatlist-header-new-chat-action"]',
      '[data-testid="menu-bar-chat-new"]',
      '[data-testid="new-chat-button"]',
      'span[data-icon="new-chat-outline"]',
      'span[data-icon="chat-new"]',
      'span[data-icon="plus"]',
      'span[data-icon="plus-large"]',
      'span[data-icon="add"]',
    ];

    for (const sel of directSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const btn = el.closest("button") || el.closest('div[role="button"]') || el;
          if (!btn.closest("#main")) return btn;
        }
      } catch (e) {}
    }

    const headers = document.querySelectorAll(
      '#side header, div[data-testid="chatlist-header"], #side > div:first-child header, header'
    );
    for (const hdr of headers) {
      if (hdr.closest("#main")) continue;
      const clickableItems = Array.from(hdr.querySelectorAll('button, div[role="button"]'));

      for (const item of clickableItems) {
        const label = (item.getAttribute("aria-label") || item.getAttribute("title") || item.innerText || "").toLowerCase();
        if (label.includes("menu") || label.includes("more") || label.includes("status") || label.includes("channel") || label.includes("community")) {
          continue;
        }
        if (label.includes("chat") || label.includes("new") || label.includes("plus") || label.includes("start")) {
          return item;
        }
      }

      const nonMenuButtons = clickableItems.filter((item) => {
        const label = (item.getAttribute("aria-label") || item.getAttribute("title") || "").toLowerCase();
        const hasMenuIcon = !!item.querySelector('span[data-icon="menu"], span[data-icon*="more"], span[data-icon*="dots"]');
        return !label.includes("menu") && !label.includes("more") && !hasMenuIcon;
      });

      if (nonMenuButtons.length > 0) {
        return nonMenuButtons[nonMenuButtons.length - 1];
      }
    }

    return null;
  }

  // Ensure New Chat drawer is open
  async function ensureNewChatDrawerOpen(maxAttempts = 4) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const backBtn =
        document.querySelector('button[aria-label*="Back" i]') ||
        document.querySelector('span[data-icon="back"]') ||
        document.querySelector('span[data-icon="arrow-left"]') ||
        document.querySelector('button[aria-label="Back"]');

      if (backBtn && !backBtn.closest("#main")) {
        console.log("[Crewvia Bridge] ✅ New Chat drawer is open!");
        return true;
      }

      console.log(`[Crewvia Bridge] Clicking New Chat button (attempt ${attempt}/${maxAttempts})...`);
      const newChatBtn = findNewChatButton();
      if (newChatBtn) {
        clickElement(newChatBtn);
      }

      await new Promise((r) => setTimeout(r, 450));

      const backBtnAfter =
        document.querySelector('button[aria-label*="Back" i]') ||
        document.querySelector('span[data-icon="back"]') ||
        document.querySelector('span[data-icon="arrow-left"]') ||
        document.querySelector('button[aria-label="Back"]');

      if (backBtnAfter && !backBtnAfter.closest("#main")) {
        console.log("[Crewvia Bridge] ✅ New Chat drawer opened!");
        return true;
      }
    }
    return false;
  }

  // Find search input in drawer
  async function waitForDrawerSearchInput(timeoutMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const backBtn =
        document.querySelector('button[aria-label*="Back" i]') ||
        document.querySelector('span[data-icon="back"]') ||
        document.querySelector('span[data-icon="arrow-left"]') ||
        document.querySelector('button[aria-label="Back"]');

      if (backBtn && !backBtn.closest("#main")) {
        const drawerContainer =
          backBtn.closest('#side') ||
          backBtn.closest('div[tabindex="-1"]') ||
          document.querySelector('#side');

        if (drawerContainer) {
          const input = drawerContainer.querySelector(
            'div[contenteditable="true"], input[type="text"], input[type="search"]'
          );
          if (input && !input.closest("#main")) {
            return input;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  // Type into search input
  function typeIntoSearch(inputEl, text) {
    if (!inputEl) return;
    inputEl.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    inputEl.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: text.slice(-1) || "0", bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent("keyup", { key: text.slice(-1) || "0", bubbles: true }));
  }

  // Exclude drawer action buttons
  function isDrawerActionButton(item) {
    if (!item) return false;
    const text = (item.innerText || item.textContent || "").trim().toLowerCase();
    if (
      text.includes("new contact") ||
      text.includes("add contact") ||
      text.includes("new group") ||
      text.includes("new community") ||
      text.includes("new broadcast") ||
      text === "new chat"
    ) {
      return true;
    }
    if (
      item.querySelector(
        'span[data-icon="new-group"], span[data-icon="community"], span[data-icon="add-contact"], span[data-icon="contact-add"], span[data-icon="person-add"]'
      )
    ) {
      return true;
    }
    return false;
  }

  function isFilterPill(item) {
    const text = (item.innerText || item.textContent || "").trim().toLowerCase();
    if (text === "all" || text.startsWith("unread") || text === "favorites" || text.startsWith("groups")) return true;
    if (item.getAttribute("role") === "tab") return true;
    return false;
  }

  function isSectionHeader(item) {
    const text = (item.innerText || item.textContent || "").trim().toLowerCase();
    if (
      text === "chats" ||
      text === "messages" ||
      text === "contacts on whatsapp" ||
      text === "not in your contacts" ||
      text === "contacts" ||
      text === "frequently contacted"
    ) {
      return true;
    }
    return false;
  }

  // Find contact result item in drawer
  function findContactSearchResultItemInDrawer(phone, leadName) {
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    const tenDigit = cleanPhone.slice(-10);
    const sevenDigit = cleanPhone.slice(-7);
    const cleanLeadName = (leadName || "").trim().toLowerCase();

    const leftPane = document.querySelector('#side') || document.body;

    const candidates = leftPane.querySelectorAll(
      'div[role="button"], div[role="listitem"], div[role="row"], div[data-testid="cell-frame-container"], div[data-testid="chat-list-item"], div[data-testid*="contact"], div[tabindex="-1"]'
    );

    let fallbackMatch = null;

    for (const item of candidates) {
      if (item.closest("#main")) continue;
      if (item.closest("header")) continue;
      if (item.querySelector('div[contenteditable="true"], input')) continue;

      if (isDrawerActionButton(item)) continue;
      if (isFilterPill(item)) continue;
      if (isSectionHeader(item)) continue;

      const rawText = item.innerText || item.textContent || "";
      const text = rawText.trim().toLowerCase();
      if (!text) continue;

      const rect = item.getBoundingClientRect();
      if (rect.height < 20 || rect.width < 40) continue;

      const digitsOnly = rawText.replace(/[^\d]/g, "");

      // 1. Exact 10-digit phone match (HIGHEST PRIORITY)
      if (tenDigit && digitsOnly.includes(tenDigit)) {
        return item;
      }

      // 2. Lead name match (3+ characters)
      if (cleanLeadName && cleanLeadName.length >= 3 && text.includes(cleanLeadName)) {
        return item;
      }

      // 3. 7-digit phone match
      if (sevenDigit && digitsOnly.includes(sevenDigit)) {
        return item;
      }

      // 4. "Not in your contacts" section item
      if (text.includes("not in your contacts") || text.includes("chat with") || text.startsWith("+")) {
        fallbackMatch = item;
      }
    }

    // Direct DOM text search fallback
    if (tenDigit) {
      const allSpans = leftPane.querySelectorAll('span, div, p');
      for (const el of allSpans) {
        if (el.closest('#main') || el.closest('header')) continue;
        if (el.matches('input, [contenteditable="true"]') || el.querySelector('[contenteditable="true"]')) continue;
        const text = (el.innerText || el.textContent || "").replace(/[^\d]/g, "");
        if (text.includes(tenDigit)) {
          const row =
            el.closest('div[role="button"]') ||
            el.closest('div[role="listitem"]') ||
            el.closest('div[role="row"]') ||
            el.closest('div[tabindex="-1"]') ||
            el.closest('div[data-testid="cell-frame-container"]') ||
            el;
          if (row && !row.closest('#main') && !row.closest('header')) {
            return row;
          }
        }
      }
    }

    return fallbackMatch;
  }

  // Open contact conversation
  async function openContactChat(resultItem, searchInput) {
    if (searchInput && typeof searchInput.blur === "function") {
      try { searchInput.blur(); } catch (e) {}
    }

    if (resultItem) {
      const row =
        resultItem.closest('div[role="button"], div[role="listitem"], div[role="row"], div[tabindex="-1"]') ||
        resultItem;

      const innerTitle =
        resultItem.querySelector('span[title], span[dir="auto"], div[data-testid="cell-frame-title"], span') ||
        resultItem;

      clickElement(row);

      if (innerTitle && innerTitle !== row) {
        clickElement(innerTitle);
      }
    }

    if (searchInput) {
      try {
        const enterOpts = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        };
        searchInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        searchInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
      } catch (e) {}
    }
  }

  // Poll for contact result item with generous debounce window
  async function pollForContactResult(phone, leadName, timeoutMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const match = findContactSearchResultItemInDrawer(phone, leadName);
      if (match) {
        return match;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  // Open chat for phone number using STRICT in-page search (ZERO RELOAD!)
  async function openChatForPhone(phone, leadName) {
    const cleanPhone = (phone || "").replace(/[^\d]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Invalid phone number: " + phone);
    }

    // Step 0: Check if target chat is ALREADY open in #main
    if (isTargetChatAlreadyOpen(phone, leadName)) {
      console.log("[Crewvia Bridge] Target chat is already open in #main!");
      const existingComp = await waitForComposer(2000);
      if (existingComp) return existingComp;
    }

    const tenDigit = cleanPhone.slice(-10);
    const intlFormat = cleanPhone.startsWith("91") ? "+" + cleanPhone : "+91" + tenDigit;
    console.log("[Crewvia Bridge] In-page search for phone:", tenDigit, "(Intl:", intlFormat, ")");

    // Step 1: Clean any open drawer or leftover search state
    await closeAnyOpenDrawer();
    await new Promise((r) => setTimeout(r, 200));

    // Step 2: Open New Chat drawer
    const drawerOpened = await ensureNewChatDrawerOpen(4);
    if (!drawerOpened) {
      throw new Error("Could not open 'New chat' drawer on WhatsApp Web. Please check WhatsApp Web tab.");
    }

    // Step 3: Wait for search input in drawer
    const searchInput = await waitForDrawerSearchInput(4000);
    if (!searchInput) {
      await closeAnyOpenDrawer();
      throw new Error("Could not find search input in 'New chat' drawer.");
    }

    // Step 4: Search for number in drawer
    // Try 1: 10 digits
    console.log("[Crewvia Bridge] Searching drawer for 10 digits:", tenDigit);
    typeIntoSearch(searchInput, tenDigit);
    await new Promise((r) => setTimeout(r, 400));
    let resultItem = await pollForContactResult(phone, leadName, 4000);

    // Try 2: International format (+91...)
    if (!resultItem) {
      console.log("[Crewvia Bridge] Retrying drawer search with:", intlFormat);
      typeIntoSearch(searchInput, intlFormat);
      await new Promise((r) => setTimeout(r, 400));
      resultItem = await pollForContactResult(phone, leadName, 4500);
    }

    // Try 3: Full clean digits
    if (!resultItem && cleanPhone !== tenDigit) {
      console.log("[Crewvia Bridge] Retrying drawer search with full digits:", cleanPhone);
      typeIntoSearch(searchInput, cleanPhone);
      await new Promise((r) => setTimeout(r, 400));
      resultItem = await pollForContactResult(phone, leadName, 3500);
    }

    if (!resultItem) {
      await closeAnyOpenDrawer();
      throw new Error(`Contact with phone ${cleanPhone} was not found on WhatsApp Web.`);
    }

    // Step 5: Click contact result
    console.log("[Crewvia Bridge] Clicking contact result to open chat...");
    await openContactChat(resultItem, searchInput);

    // Step 6: Wait for composer in #main
    let composer = await waitForComposer(3500);
    if (!composer) {
      console.log("[Crewvia Bridge] Retrying contact click...");
      await openContactChat(resultItem, searchInput);
      composer = await waitForComposer(4000);
    }

    if (!composer) {
      await closeAnyOpenDrawer();
      throw new Error("Chat did not open after selecting contact. Please check your WhatsApp Web tab.");
    }

    console.log("[Crewvia Bridge] ✅ Chat opened successfully in #main!");
    return composer;
  }

  // =====================================================================
  // MAIN DISPATCH: In-Page Search → Compose → Send (ZERO RELOAD & ZERO DUPLICATE)
  // =====================================================================
  async function handleDirectSend(phone, text, messageId, leadName) {
    // Idempotency: Strictly block sending the same message twice!
    if (processedMessageIds.has(messageId)) {
      console.log("[Crewvia Bridge] Message already processed, ignoring duplicate dispatch:", messageId);
      return;
    }
    if (isSendingInProgress) {
      console.log("[Crewvia Bridge] Send already in progress, waiting...");
      return;
    }
    isSendingInProgress = true;
    processedMessageIds.add(messageId);

    console.log("[Crewvia Bridge] Dispatch for:", phone, "Lead:", leadName, "MessageId:", messageId);

    try {
      // 1. Open chat via in-page search (ZERO RELOAD!)
      const composer = await openChatForPhone(phone, leadName);

      // 2. Small settle delay
      await new Promise((r) => setTimeout(r, 400));

      // 3. Insert formatted message
      await insertFormattedMessageIntoComposer(composer, text);

      // 4. Wait for Send button to activate
      await new Promise((r) => setTimeout(r, 400));

      // 5. Click Send button ONCE
      let sendBtn = findSendButton();
      if (!sendBtn) {
        await new Promise((r) => setTimeout(r, 300));
        sendBtn = findSendButton();
      }

      if (sendBtn) {
        clickElement(sendBtn);
        console.log("[Crewvia Bridge] Send button clicked!");
      } else {
        // Fallback: Enter key
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

      // 6. Confirmation settle
      await new Promise((r) => setTimeout(r, 1200));

      // 7. Report success to background service worker (which automatically refocuses CRM tab!)
      safeSendMessage({
        type: "AUTOMATION_RESULT",
        messageId,
        success: true,
        status: "sent",
        timestamp: new Date().toISOString(),
      });
      console.log("[Crewvia Bridge] ✅ Message successfully sent to:", phone);

    } catch (err) {
      console.error("[Crewvia Bridge] ❌ Dispatch failed:", err);
      processedMessageIds.delete(messageId); // allow retry on error
      safeSendMessage({
        type: "AUTOMATION_RESULT",
        messageId,
        success: false,
        error: err.message || "Failed to send message via WhatsApp Web",
        reason: "dispatch_failed",
      });
    } finally {
      isSendingInProgress = false;
    }
  }

  // Listen for instructions from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "DISPATCH_DIRECT_SEND") {
      handleDirectSend(request.phone, request.text, request.messageId, request.leadName);
      sendResponse({ status: "PROCESSING" });
      return true;
    }

    if (request.type === "CHECK_HEALTH") {
      const state = checkLoginState();
      sendResponse({ status: "HEALTH_OK", loggedIn: state, version: SCRIPT_VERSION });
      return true;
    }
  });
})();
