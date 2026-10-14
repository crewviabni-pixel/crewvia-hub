import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { waNumber } from "./crm";

export interface WhatsAppSendPayload {
  leadId: string;
  phone: string;
  text: string;
  leadName?: string | null | undefined;
}

export interface WhatsAppSendResult {
  success: boolean;
  status: "sent" | "failed" | "invalid_phone" | "timeout";
  error?: string;
  timestamp: string;
}

const BRIDGE_SOURCE_EXT = "CREWVIA_WA_BRIDGE";
const BRIDGE_SOURCE_APP = "CREWVIA_CRM_APP";

/**
 * Hook to interface Crewvia Hub with the Crewvia WhatsApp Bridge Chrome Extension.
 * Provides live connection detection, status monitoring, and 1-click dispatch.
 */
export function useWhatsAppBridge() {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-crewvia-wa-bridge") === "ready";
    }
    return false;
  });

  const [isSending, setIsSending] = useState<boolean>(false);
  const [queueLength, setQueueLength] = useState<number>(0);
  const pendingRequestsRef = useRef<Map<string, { resolve: (r: WhatsAppSendResult) => void; reject: (err: any) => void; timeout: any }>>(new Map());

  // Check bridge status on mount and listen to extension signals
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.source !== BRIDGE_SOURCE_EXT) return;

      const { type, messageId, payload, queueLength: qLen } = event.data;

      if (type === "PONG") {
        setIsInstalled(true);
      }

      if (type === "MESSAGE_QUEUED") {
        if (typeof qLen === "number") setQueueLength(qLen);
      }

      if (type === "MESSAGE_DELIVERED") {
        const p = payload || event.data;
        const mid = p.messageId || messageId;
        const pending = pendingRequestsRef.current.get(mid);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequestsRef.current.delete(mid);
          pending.resolve({
            success: true,
            status: "sent",
            timestamp: p.timestamp || new Date().toISOString(),
          });
        }
        setIsSending(false);
      }

      if (type === "MESSAGE_FAILED" || type === "SEND_RESULT") {
        const p = payload || event.data;
        const mid = p.messageId || messageId;
        const pending = pendingRequestsRef.current.get(mid);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequestsRef.current.delete(mid);
          pending.resolve({
            success: false,
            status: p.reason === "invalid_phone" ? "invalid_phone" : "failed",
            error: p.error || "Message delivery failed",
            timestamp: new Date().toISOString(),
          });
        }
        setIsSending(false);
      }
    }

    function handleBridgeReady() {
      setIsInstalled(true);
    }

    window.addEventListener("message", handleMessage);
    window.addEventListener("CREWVIA_WA_BRIDGE_READY", handleBridgeReady);

    // Initial Ping Handshake & retries
    window.postMessage({ source: BRIDGE_SOURCE_APP, type: "PING" }, "*");
    const i1 = setTimeout(() => window.postMessage({ source: BRIDGE_SOURCE_APP, type: "PING" }, "*"), 300);
    const i2 = setTimeout(() => window.postMessage({ source: BRIDGE_SOURCE_APP, type: "PING" }, "*"), 1000);
    const i3 = setTimeout(() => window.postMessage({ source: BRIDGE_SOURCE_APP, type: "PING" }, "*"), 2500);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("CREWVIA_WA_BRIDGE_READY", handleBridgeReady);
      clearTimeout(i1);
      clearTimeout(i2);
      clearTimeout(i3);
    };
  }, [isInstalled]);

  /**
   * Dispatch a message via the extension bridge.
   * Returns a promise resolving when the message is confirmed sent by WhatsApp Web.
   */
  const sendDirect = useCallback(
    async (payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> => {
      const active = isInstalled || (typeof document !== "undefined" && document.documentElement.getAttribute("data-crewvia-wa-bridge") === "ready");
      if (!active) {
        return {
          success: false,
          status: "failed",
          error: "Crewvia WhatsApp Bridge extension is not detected. Please make sure the extension is enabled in chrome://extensions/.",
          timestamp: new Date().toISOString(),
        };
      }

      const formattedPhone = waNumber(payload.phone);
      if (!formattedPhone || formattedPhone.length < 10) {
        toast.error("Invalid phone number format");
        return {
          success: false,
          status: "invalid_phone",
          error: "Phone number is invalid",
          timestamp: new Date().toISOString(),
        };
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setIsSending(true);

      return new Promise<WhatsAppSendResult>((resolve, reject) => {
        // 45s safety timeout
        const timeout = setTimeout(() => {
          pendingRequestsRef.current.delete(messageId);
          setIsSending(false);
          resolve({
            success: false,
            status: "timeout",
            error: "WhatsApp delivery timed out. Please check your WhatsApp Web tab.",
            timestamp: new Date().toISOString(),
          });
        }, 45000);

        pendingRequestsRef.current.set(messageId, { resolve, reject, timeout });

        // Forward send request to extension content script
        window.postMessage(
          {
            source: BRIDGE_SOURCE_APP,
            type: "SEND_MESSAGE",
            messageId,
            payload: {
              ...payload,
              phone: formattedPhone,
            },
          },
          "*"
        );
      });
    },
    [isInstalled]
  );

  return {
    isInstalled,
    isSending,
    queueLength,
    sendDirect,
  };
}
