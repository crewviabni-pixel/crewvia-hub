import React, { useEffect, useState } from "react";
import { ShieldAlert, Bot, AlertTriangle, ExternalLink } from "lucide-react";

interface AntiBotShieldProps {
  children: React.ReactNode;
  onBotDetected?: (reason: string) => void;
}

// Known AI crawlers, scrapers, and headless browser automation signatures
const BOT_USER_AGENT_PATTERNS = [
  /gptbot/i,
  /chatgpt/i,
  /chatgpt-user/i,
  /claudebot/i,
  /claude-web/i,
  /perplexitybot/i,
  /google-extended/i,
  /bytespider/i,
  /ccbot/i,
  /diffbot/i,
  /facebookbot/i,
  /meta-externalagent/i,
  /amazonbot/i,
  /omgilibot/i,
  /youbot/i,
  /cohere-ai/i,
  /applebot-extended/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /webdriver/i,
  /scrapy/i,
  /python-requests/i,
  /aiohttp/i,
  /httpx/i,
  /curl/i,
  /wget/i,
  /node-fetch/i,
  /axios/i,
  /go-http-client/i,
  /postman/i,
];

export function inspectClientEnvironment(): { isBot: boolean; reason: string | null } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isBot: true, reason: "Server or headless execution environment" };
  }

  // Exempt local development and testing environments
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".local")
  ) {
    return { isBot: false, reason: null };
  }

  const ua = navigator.userAgent || "";

  // 1. Check known AI crawler and scraper user agents
  for (const pattern of BOT_USER_AGENT_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `Automated AI Agent / Crawler detected (${ua.slice(0, 45)}...)` };
    }
  }

  // 2. Check for automation flags in browser navigator
  if (navigator.webdriver === true) {
    return { isBot: true, reason: "Automated browser control detected (navigator.webdriver = true)" };
  }

  // 3. Check for document-level automation markers
  if (
    document.documentElement.getAttribute("webdriver") !== null ||
    document.documentElement.getAttribute("selenium") !== null
  ) {
    return { isBot: true, reason: "Headless automation controller detected" };
  }

  // 4. Check for automation global variables injected by Selenium, Phantom, Nightmare
  const win = window as any;
  if (
    win._phantom ||
    win.__nightmare ||
    win.callPhantom ||
    win._selenium ||
    win.__selenium_evaluate ||
    win.__webdriver_evaluate ||
    win.__driver_evaluate ||
    win.__fxdriver_evaluate
  ) {
    return { isBot: true, reason: "Headless automation framework detected" };
  }

  // 5. Zero dimension screen anomalies (typical in non-rendering scrapers)
  if (
    window.screen &&
    (window.screen.width === 0 || window.screen.height === 0 || window.screen.colorDepth === 0)
  ) {
    return { isBot: true, reason: "Invalid screen display metrics detected" };
  }

  // 6. Language and plugins check (typical in basic headless instances)
  if (!navigator.languages || navigator.languages.length === 0) {
    // If not mobile and no languages, suspicious
    if (!/mobile|android|iphone|ipad/i.test(ua)) {
      return { isBot: true, reason: "Suspicious browser environment (no locale languages)" };
    }
  }

  return { isBot: false, reason: null };
}

export function AntiBotShield({ children, onBotDetected }: AntiBotShieldProps) {
  const [botStatus, setBotStatus] = useState<{ isBot: boolean; reason: string | null }>({
    isBot: false,
    reason: null,
  });
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const inspection = inspectClientEnvironment();
    if (inspection.isBot) {
      setBotStatus(inspection);
      onBotDetected?.(inspection.reason || "Automation detected");
    } else {
      setVerified(true);
    }
  }, [onBotDetected]);

  if (botStatus.isBot) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
          
          <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5 text-red-400">
            <ShieldAlert className="size-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 mb-3 uppercase tracking-wider">
            <Bot className="size-3.5" /> Anti-Bot Defense Triggered
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">
            Automated Access Blocked
          </h2>

          <p className="mt-2.5 text-xs text-neutral-400 leading-relaxed">
            Automated scraping, AI extraction, and machine cloning of this client presentation are strictly prohibited under Crewvia Works Intellectual Property policies.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-left">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Security Log
            </p>
            <p className="text-xs text-red-400 font-mono break-words">
              {botStatus.reason || "Automated browsing pattern detected"}
            </p>
          </div>

          <p className="mt-4 text-[11px] text-neutral-500 leading-relaxed">
            If you are a human client viewing this presentation, please open this link directly in a standard browser (such as Safari or Google Chrome) on your mobile or desktop device.
          </p>

          <a
            href="https://wa.me/917223804653?text=Hi%20Crewvia%20team,%20I%20am%20seeing%20an%20anti-bot%20verification%20screen%20on%20my%20presentation%20link."
            target="_blank"
            rel="noreferrer"
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-all border border-neutral-700"
          >
            <span>Contact Crewvia Support</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
