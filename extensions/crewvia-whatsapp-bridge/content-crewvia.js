/**
 * Crewvia WhatsApp Bridge - Injected Content Script for Crewvia Hub
 * Facilitates two-way communication between Crewvia CRM and the Chrome Extension
 */

(function () {
  const BRIDGE_SOURCE_EXT = "CREWVIA_WA_BRIDGE";
  const BRIDGE_SOURCE_APP = "CREWVIA_CRM_APP";

  // Mark the page as bridge-enabled
  document.documentElement.setAttribute("data-crewvia-wa-bridge", "ready");

  // Broadcast readiness event for any listeners already waiting
  window.dispatchEvent(
    new CustomEvent("CREWVIA_WA_BRIDGE_READY", {
      detail: { version: "1.0.8", status: "online" },
    })
  );

  // Listen to messages from the Crewvia Hub frontend (window.postMessage)
  window.addEventListener("message", (event) => {
    // Only accept messages intended for the bridge from the active origin
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE_APP) {
      return;
    }

    const { type, payload, messageId } = event.data;

    if (type === "PING") {
      // Respond to ping handshake
      window.postMessage(
        {
          source: BRIDGE_SOURCE_EXT,
          type: "PONG",
          messageId,
          version: "1.0.8",
          status: "connected",
        },
        "*"
      );
      return;
    }

    if (type === "SEND_MESSAGE") {
      if (typeof chrome === "undefined" || !chrome?.runtime?.id) {
        window.postMessage(
          {
            source: BRIDGE_SOURCE_EXT,
            type: "SEND_RESULT",
            messageId,
            leadId: payload?.leadId,
            success: false,
            error: "Extension was updated. Please refresh this tab.",
          },
          "*"
        );
        return;
      }

      // Forward the send request to the background service worker
      try {
        chrome.runtime.sendMessage(
          {
            type: "ENQUEUE_MESSAGE",
            payload: {
              ...payload,
              messageId: messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              window.postMessage(
                {
                  source: BRIDGE_SOURCE_EXT,
                  type: "SEND_RESULT",
                  messageId,
                  leadId: payload?.leadId,
                  success: false,
                  error: chrome.runtime.lastError.message || "Extension connection error",
                },
                "*"
              );
              return;
            }

            // Acknowledge receipt into extension queue
            window.postMessage(
              {
                source: BRIDGE_SOURCE_EXT,
                type: "MESSAGE_QUEUED",
                messageId,
                leadId: payload?.leadId,
                queueLength: response?.queueLength || 1,
              },
              "*"
            );
          }
        );
      } catch (e) {
        window.postMessage(
          {
            source: BRIDGE_SOURCE_EXT,
            type: "SEND_RESULT",
            messageId,
            leadId: payload?.leadId,
            success: false,
            error: "Extension error: " + (e?.message || "Connection lost"),
          },
          "*"
        );
      }
      return;
    }

    if (type === "GET_STATUS") {
      if (typeof chrome === "undefined" || !chrome?.runtime?.id) return;
      try {
        chrome.runtime.sendMessage({ type: "GET_BRIDGE_STATUS" }, (response) => {
          if (chrome.runtime.lastError) return;
          window.postMessage(
            {
              source: BRIDGE_SOURCE_EXT,
              type: "STATUS_REPORT",
              messageId,
              data: response || { connected: true },
            },
            "*"
          );
        });
      } catch (e) {}
    }
  });

  // Listen for messages from background.js to dispatch back to the web window
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (
      message.type === "MESSAGE_DELIVERED" ||
      message.type === "MESSAGE_FAILED" ||
      message.type === "QUEUE_UPDATE"
    ) {
      window.postMessage(
        {
          source: BRIDGE_SOURCE_EXT,
          ...message,
        },
        "*"
      );
    }
  });
})();
