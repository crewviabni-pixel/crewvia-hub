// High-fidelity presentation deck models and SVG slide generator for Crewvia Portfolio Showcase
export interface PortfolioSlide {
  id: string;
  slide_number: number;
  title: string;
  subtitle?: string;
  preview_url: string; // SVG Data URI or image URL
  aspect_ratio?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  client_name: string;
  category: "Pitch Decks" | "Sales Decks" | "Company Profiles" | "Keynotes" | "Case Studies";
  tagline: string;
  description: string;
  cover_image_url: string;
  slides: PortfolioSlide[];
  pdf_url?: string;
  metrics: string[];
  slide_count: number;
  featured: boolean;
  published: boolean;
  display_order: number;
  view_count: number;
  work_item_id?: string;
  created_at: string;
  updated_at?: string;
}

// Helper to encode SVG into clean Data URI
function createSvgDataUri(svgContent: string): string {
  const clean = svgContent
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(clean)}`;
}

// Visual themes for presentations
interface DeckTheme {
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  accent: string;
  accentGlow: string;
  secondary: string;
  textMuted: string;
  gridColor: string;
  tagBg: string;
  tagBorder: string;
}

function renderCoverSlide(params: {
  title: string;
  categoryTag: string;
  subtitle: string;
  client: string;
  metric: string;
  theme: DeckTheme;
  meta: string;
}): string {
  const { title, categoryTag, subtitle, client, metric, theme, meta } = params;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStart}"/>
        <stop offset="50%" stop-color="${theme.bgMid}"/>
        <stop offset="100%" stop-color="${theme.bgEnd}"/>
      </linearGradient>
      <radialGradient id="glowG" cx="75%" cy="25%" r="65%">
        <stop offset="0%" stop-color="${theme.accentGlow}" stop-opacity="0.32"/>
        <stop offset="60%" stop-color="${theme.accentGlow}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${theme.bgEnd}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="subtleGlow" cx="20%" cy="85%" r="50%">
        <stop offset="0%" stop-color="${theme.secondary}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${theme.bgEnd}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${theme.gridColor}" stroke-width="1" stroke-opacity="0.25"/>
      </pattern>
    </defs>

    <!-- Canvas Background -->
    <rect width="1920" height="1080" fill="url(#bgGrad)"/>
    <rect width="1920" height="1080" fill="url(#grid)"/>
    <rect width="1920" height="1080" fill="url(#glowG)"/>
    <rect width="1920" height="1080" fill="url(#subtleGlow)"/>

    <!-- Subtle framing border -->
    <rect x="30" y="30" width="1860" height="1020" rx="20" fill="none" stroke="${theme.gridColor}" stroke-width="1.5" stroke-opacity="0.4"/>

    <!-- Header / Brand watermark bar -->
    <g transform="translate(140, 120)">
      <!-- Category & Stage Pill -->
      <rect x="0" y="0" width="220" height="42" rx="21" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
      <circle cx="22" cy="21" r="5" fill="${theme.accent}"/>
      <text x="38" y="27" fill="#ffffff" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="15" font-weight="600" letter-spacing="0.08em">${categoryTag.toUpperCase()}</text>

      <text x="1640" y="26" text-anchor="end" fill="${theme.textMuted}" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="16" font-weight="500" letter-spacing="0.05em">${meta}</text>
    </g>

    <!-- Main Title & Narrative -->
    <g transform="translate(140, 360)">
      <text x="0" y="0" fill="${theme.accent}" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="24" font-weight="700" letter-spacing="0.15em">${client.toUpperCase()}</text>
      
      <!-- Display Title -->
      <text x="0" y="110" fill="#ffffff" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="88" font-weight="700" letter-spacing="-0.03em">${title}</text>
      
      <!-- Subtitle -->
      <text x="0" y="200" fill="${theme.textMuted}" font-family="'DM Sans', -apple-system, sans-serif" font-size="34" font-weight="400" letter-spacing="-0.01em">${subtitle}</text>
    </g>

    <!-- Bottom Feature Cards & Metrics -->
    <g transform="translate(140, 800)">
      <!-- Metric Card 1 -->
      <g>
        <rect x="0" y="0" width="380" height="120" rx="16" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
        <text x="32" y="52" fill="${theme.accent}" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="32" font-weight="700">${metric}</text>
        <text x="32" y="88" fill="${theme.textMuted}" font-family="'DM Sans', -apple-system, sans-serif" font-size="16" font-weight="500">Verified Deal Milestone</text>
      </g>

      <!-- Key Badge 2 -->
      <g transform="translate(420, 0)">
        <rect x="0" y="0" width="380" height="120" rx="16" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
        <text x="32" y="52" fill="#ffffff" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="28" font-weight="700">Crewvia Architecture</text>
        <text x="32" y="88" fill="${theme.textMuted}" font-family="'DM Sans', -apple-system, sans-serif" font-size="16" font-weight="500">Custom Visual Design & Story</text>
      </g>

      <!-- Slide indicator & Confidential Stamp -->
      <g transform="translate(1260, 45)">
        <text x="380" y="0" text-anchor="end" fill="#ffffff" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="18" font-weight="600" letter-spacing="0.06em">SLIDE 01 / COVER</text>
        <text x="380" y="32" text-anchor="end" fill="${theme.textMuted}" font-family="'DM Sans', -apple-system, sans-serif" font-size="14">Confidential Work Sample • Crewvia Studio</text>
      </g>
    </g>
  </svg>`;
  return createSvgDataUri(svg);
}

function renderContentSlide(params: {
  title: string;
  slideNumber: number;
  totalSlides: number;
  categoryTag: string;
  headline: string;
  body: string;
  theme: DeckTheme;
  card1Title: string;
  card1Value: string;
  card2Title: string;
  card2Value: string;
  card3Title: string;
  card3Value: string;
}): string {
  const { title, slideNumber, totalSlides, categoryTag, headline, body, theme, card1Title, card1Value, card2Title, card2Value, card3Title, card3Value } = params;
  const slidePadded = slideNumber < 10 ? `0${slideNumber}` : `${slideNumber}`;
  const totalPadded = totalSlides < 10 ? `0${totalSlides}` : `${totalSlides}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStart}"/>
        <stop offset="100%" stop-color="${theme.bgEnd}"/>
      </linearGradient>
      <radialGradient id="ambient" cx="80%" cy="30%" r="50%">
        <stop offset="0%" stop-color="${theme.accentGlow}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${theme.bgEnd}" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="1920" height="1080" fill="url(#bgGrad)"/>
    <rect width="1920" height="1080" fill="url(#ambient)"/>
    <rect x="30" y="30" width="1860" height="1020" rx="20" fill="none" stroke="${theme.gridColor}" stroke-width="1.5" stroke-opacity="0.35"/>

    <!-- Top Breadcrumb -->
    <g transform="translate(140, 110)">
      <text x="0" y="0" fill="${theme.accent}" font-family="'Space Grotesk', sans-serif" font-size="16" font-weight="700" letter-spacing="0.12em">${categoryTag.toUpperCase()}</text>
      <text x="1640" y="0" text-anchor="end" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-size="18" font-weight="700">SLIDE ${slidePadded} / ${totalPadded}</text>
    </g>

    <!-- Slide Header -->
    <g transform="translate(140, 220)">
      <text x="0" y="0" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-size="58" font-weight="700" letter-spacing="-0.02em">${title}</text>
      <text x="0" y="70" fill="${theme.accent}" font-family="'DM Sans', sans-serif" font-size="26" font-weight="600">${headline}</text>
      <text x="0" y="130" fill="${theme.textMuted}" font-family="'DM Sans', sans-serif" font-size="22" font-weight="400" width="1200">${body}</text>
    </g>

    <!-- 3 Core Columns / Intellectual Architecture -->
    <g transform="translate(140, 480)">
      <!-- Col 1 -->
      <g>
        <rect x="0" y="0" width="510" height="380" rx="20" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
        <circle cx="56" cy="60" r="22" fill="${theme.accent}" fill-opacity="0.15"/>
        <text x="56" y="66" text-anchor="middle" fill="${theme.accent}" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700">01</text>
        <text x="56" y="140" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-size="30" font-weight="700">${card1Title}</text>
        <text x="56" y="190" fill="${theme.textMuted}" font-family="'DM Sans', sans-serif" font-size="20" font-weight="400">${card1Value}</text>
        <rect x="56" y="280" width="398" height="6" rx="3" fill="${theme.accent}" fill-opacity="0.3"/>
        <rect x="56" y="280" width="310" height="6" rx="3" fill="${theme.accent}"/>
      </g>

      <!-- Col 2 -->
      <g transform="translate(565, 0)">
        <rect x="0" y="0" width="510" height="380" rx="20" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
        <circle cx="56" cy="60" r="22" fill="${theme.secondary}" fill-opacity="0.15"/>
        <text x="56" y="66" text-anchor="middle" fill="${theme.secondary}" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700">02</text>
        <text x="56" y="140" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-size="30" font-weight="700">${card2Title}</text>
        <text x="56" y="190" fill="${theme.textMuted}" font-family="'DM Sans', sans-serif" font-size="20" font-weight="400">${card2Value}</text>
        <rect x="56" y="280" width="398" height="6" rx="3" fill="${theme.secondary}" fill-opacity="0.3"/>
        <rect x="56" y="280" width="240" height="6" rx="3" fill="${theme.secondary}"/>
      </g>

      <!-- Col 3 -->
      <g transform="translate(1130, 0)">
        <rect x="0" y="0" width="510" height="380" rx="20" fill="${theme.tagBg}" stroke="${theme.tagBorder}" stroke-width="1.5"/>
        <circle cx="56" cy="60" r="22" fill="#10b981" fill-opacity="0.15"/>
        <text x="56" y="66" text-anchor="middle" fill="#10b981" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700">03</text>
        <text x="56" y="140" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-size="30" font-weight="700">${card3Title}</text>
        <text x="56" y="190" fill="${theme.textMuted}" font-family="'DM Sans', sans-serif" font-size="20" font-weight="400">${card3Value}</text>
        <rect x="56" y="280" width="398" height="6" rx="3" fill="#10b981" fill-opacity="0.3"/>
        <rect x="56" y="280" width="360" height="6" rx="3" fill="#10b981"/>
      </g>
    </g>

    <!-- Bottom Watermark -->
    <g transform="translate(140, 960)">
      <text x="0" y="0" fill="${theme.textMuted}" font-family="'Space Grotesk', sans-serif" font-size="15" font-weight="500">CREWVIA BNI PRESENTATION DESIGN • SAMPLE WORK</text>
      <text x="1640" y="0" text-anchor="end" fill="${theme.textMuted}" font-family="'DM Sans', sans-serif" font-size="14">Proprietary Format & Methodology</text>
    </g>
  </svg>`;
  return createSvgDataUri(svg);
}

// THEMES DEFINITIONS
const indigoTheme: DeckTheme = {
  bgStart: "#070811",
  bgMid: "#0d1024",
  bgEnd: "#05060b",
  accent: "#818cf8",
  accentGlow: "#6366f1",
  secondary: "#38bdf8",
  textMuted: "#94a3b8",
  gridColor: "#312e81",
  tagBg: "rgba(30, 27, 75, 0.6)",
  tagBorder: "rgba(99, 102, 241, 0.4)",
};

const emeraldTheme: DeckTheme = {
  bgStart: "#030e0b",
  bgMid: "#061a15",
  bgEnd: "#020705",
  accent: "#34d399",
  accentGlow: "#10b981",
  secondary: "#38bdf8",
  textMuted: "#9ca3af",
  gridColor: "#064e3b",
  tagBg: "rgba(6, 78, 59, 0.5)",
  tagBorder: "rgba(52, 211, 153, 0.35)",
};

const champagneTheme: DeckTheme = {
  bgStart: "#0d0c0a",
  bgMid: "#181510",
  bgEnd: "#090807",
  accent: "#fbbf24",
  accentGlow: "#f59e0b",
  secondary: "#f97316",
  textMuted: "#a8a29e",
  gridColor: "#451a03",
  tagBg: "rgba(69, 26, 3, 0.55)",
  tagBorder: "rgba(251, 191, 36, 0.4)",
};

const violetTheme: DeckTheme = {
  bgStart: "#0c0514",
  bgMid: "#170a29",
  bgEnd: "#08030e",
  accent: "#c084fc",
  accentGlow: "#a855f7",
  secondary: "#f43f5e",
  textMuted: "#a1a1aa",
  gridColor: "#581c87",
  tagBg: "rgba(88, 28, 135, 0.55)",
  tagBorder: "rgba(192, 132, 252, 0.4)",
};

const cyanTheme: DeckTheme = {
  bgStart: "#040c14",
  bgMid: "#081625",
  bgEnd: "#03080e",
  accent: "#22d3ee",
  accentGlow: "#06b6d4",
  secondary: "#818cf8",
  textMuted: "#94a3b8",
  gridColor: "#164e63",
  tagBg: "rgba(22, 78, 99, 0.55)",
  tagBorder: "rgba(34, 211, 238, 0.4)",
};

const crimsonTheme: DeckTheme = {
  bgStart: "#140407",
  bgMid: "#25080e",
  bgEnd: "#0c0204",
  accent: "#fb7185",
  accentGlow: "#f43f5e",
  secondary: "#fb923c",
  textMuted: "#a1a1aa",
  gridColor: "#881337",
  tagBg: "rgba(136, 19, 55, 0.55)",
  tagBorder: "rgba(251, 113, 133, 0.4)",
};

// INITIAL SEEDED SAMPLE PRESENTATIONS
export const INITIAL_SAMPLE_DECKS: PortfolioItem[] = [
  {
    id: "apex-ai-pitch-deck",
    title: "Apex Intelligence — Autonomous Enterprise",
    client_name: "Apex AI Technologies",
    category: "Pitch Decks",
    tagline: "Series A Investor Presentation Deck",
    description: "16-slide high-stakes investment deck that raised $18.5M from top Tier-1 Silicon Valley VCs. Engineered around autonomous workflow shifts, cognitive orchestration, and defensible unit economics.",
    cover_image_url: renderCoverSlide({
      title: "Apex Intelligence",
      categoryTag: "Series A Pitch Deck",
      subtitle: "The Autonomous Enterprise Orchestration Layer",
      client: "Apex AI Labs",
      metric: "Raised $18.5M Series A",
      theme: indigoTheme,
      meta: "16 Slides • Lead VC Term Sheet",
    }),
    metrics: ["Raised $18.5M Series A", "14 VCs Bid", "16 Slides", "Closed in 3 Weeks"],
    slide_count: 5,
    featured: true,
    published: true,
    display_order: 1,
    view_count: 1420,
    created_at: "2026-09-12T10:00:00Z",
    slides: [
      {
        id: "apex-s1",
        slide_number: 1,
        title: "Cover: Series A Pitch Deck",
        subtitle: "Autonomous enterprise intelligence",
        preview_url: renderCoverSlide({
          title: "Apex Intelligence",
          categoryTag: "Series A Pitch Deck",
          subtitle: "The Autonomous Enterprise Orchestration Layer",
          client: "Apex AI Labs",
          metric: "Raised $18.5M Series A",
          theme: indigoTheme,
          meta: "16 Slides • Lead VC Term Sheet",
        }),
      },
      {
        id: "apex-s2",
        slide_number: 2,
        title: "The Paradigm Shift: From Co-Pilots to Autonomous Agents",
        subtitle: "Enterprise workflows require zero human-in-the-loop for 85% of repetitive operational cycles.",
        preview_url: renderContentSlide({
          title: "The Agentic Shift",
          slideNumber: 2,
          totalSlides: 5,
          categoryTag: "Market Transformation",
          headline: "From Prompt Engineers to Autonomous Systems",
          body: "Enterprises are abandoning fragmented copilot subscriptions in favor of self-healing multi-agent workflows.",
          theme: indigoTheme,
          card1Title: "10x Throughput",
          card1Value: "Sub-second cross-tool execution across ERP & CRM.",
          card2Title: "73% Cost Reduction",
          card2Value: "Eliminates tier-1 manual triage across enterprise ops.",
          card3Title: "Zero Prompt Drift",
          card3Value: "Deterministic evaluation harnesses guarantee compliance.",
        }),
      },
      {
        id: "apex-s3",
        slide_number: 3,
        title: "Proprietary Architecture & Latency Benchmark",
        subtitle: "Dynamic context pruning and routing reduces inference token overhead by 68%.",
        preview_url: renderContentSlide({
          title: "Engineered For Speed",
          slideNumber: 3,
          totalSlides: 5,
          categoryTag: "Proprietary Technology",
          headline: "Sub-120ms Dynamic Reasoning Mesh",
          body: "Proprietary model routing routes lightweight tasks to ultra-fast local LLMs while reserving Frontier models for edge reasoning.",
          theme: indigoTheme,
          card1Title: "Local SLM Swarm",
          card1Value: "Instantaneous parsing of structured data schemas.",
          card2Title: "Hierarchical Memory",
          card2Value: "Vector graph persistent state with zero context rot.",
          card3Title: "Enterprise VPC",
          card3Value: "Single-tenant air-gapped security for Fortune 500.",
        }),
      },
      {
        id: "apex-s4",
        slide_number: 4,
        title: "Traction & Cohort Velocity",
        subtitle: "Net Revenue Retention at 154% with exponential organic enterprise seat growth.",
        preview_url: renderContentSlide({
          title: "Traction & Cohort Expansion",
          slideNumber: 4,
          totalSlides: 5,
          categoryTag: "Growth Economics",
          headline: "$14.2M Contracted ARR (3.8x YoY)",
          body: "Land-and-expand motion with average account expansion jumping from $60k ACV to $340k ACV in Month 6.",
          theme: indigoTheme,
          card1Title: "154% NRR",
          card1Value: "Industry leading net expansion across 48 logos.",
          card2Title: "4.2 Month CAC Payback",
          card2Value: "Exceptional capital efficiency driven by product virality.",
          card3Title: "Zero Churn",
          card3Value: "Mission-critical infrastructure status prevents displacement.",
        }),
      },
      {
        id: "apex-s5",
        slide_number: 5,
        title: "Use of Funds & 24-Month Target",
        subtitle: "Capital allocation dedicated to Enterprise Sales and Deep Inference Research.",
        preview_url: renderContentSlide({
          title: "Series A Capital Deployment",
          slideNumber: 5,
          totalSlides: 5,
          categoryTag: "Capital Strategy",
          headline: "Scaling to $40M ARR & Global Enterprise Leadership",
          body: "Expanding go-to-market footprint across London, New York, and Tokyo while hardening automated compliance.",
          theme: indigoTheme,
          card1Title: "60% GTM Scaling",
          card1Value: "Strategic enterprise AE pods and solution architects.",
          card2Title: "25% R&D Pipeline",
          card2Value: "Next-gen reasoning kernels and on-prem inference chips.",
          card3Title: "15% Runway Buffer",
          card3Value: "36 months default-alive operational trajectory.",
        }),
      },
    ],
  },
  {
    id: "hyperscale-cloud-sales-deck",
    title: "HyperScale Cloud — Zero-Trust Autonomous Mesh",
    client_name: "HyperScale Defense Inc",
    category: "Sales Decks",
    tagline: "Enterprise Security & Infrastructure Sales Deck",
    description: "Custom sales presentation engineered for Fortune 100 CISOs and VP Infrastructure Engineers. Led directly to closing a $4.2M multi-year enterprise contract.",
    cover_image_url: renderCoverSlide({
      title: "HyperScale Cloud",
      categoryTag: "Enterprise Sales Deck",
      subtitle: "Autonomous Zero-Trust Cloud Defense Mesh",
      client: "HyperScale Defense",
      metric: "Closed $4.2M ARR",
      theme: emeraldTheme,
      meta: "14 Slides • Fortune 100 Win",
    }),
    metrics: ["Closed $4.2M Deal", "Fortune 100 Winner", "14 Slides", "Zero-Trust Mesh"],
    slide_count: 4,
    featured: true,
    published: true,
    display_order: 2,
    view_count: 1180,
    created_at: "2026-09-15T11:30:00Z",
    slides: [
      {
        id: "hs-s1",
        slide_number: 1,
        title: "Cover: Enterprise Sales Deck",
        subtitle: "Zero-trust autonomous cloud infrastructure",
        preview_url: renderCoverSlide({
          title: "HyperScale Cloud",
          categoryTag: "Enterprise Sales Deck",
          subtitle: "Autonomous Zero-Trust Cloud Defense Mesh",
          client: "HyperScale Defense",
          metric: "Closed $4.2M ARR",
          theme: emeraldTheme,
          meta: "14 Slides • Fortune 100 Win",
        }),
      },
      {
        id: "hs-s2",
        slide_number: 2,
        title: "The Multi-Cloud Attack Surface",
        subtitle: "Why perimeter security fails in distributed microservices environments.",
        preview_url: renderContentSlide({
          title: "Modern Attack Vectors",
          slideNumber: 2,
          totalSlides: 4,
          categoryTag: "Threat Landscape",
          headline: "Lateral Movement in Under 8 Minutes",
          body: "Legacy firewalls cannot see container-to-container east-west traffic across AWS, Azure, and GCP clusters.",
          theme: emeraldTheme,
          card1Title: "84% Blind Spot",
          card1Value: "East-west traffic bypasses traditional perimeter guards.",
          card2Title: "Credential Sprawl",
          card2Value: "Static IAM keys leak into CI/CD pipelines constantly.",
          card3Title: "Audit Nightmare",
          card3Value: "Weeks spent proving SOC2 and FedRAMP compliance.",
        }),
      },
      {
        id: "hs-s3",
        slide_number: 3,
        title: "Micro-Isolation Architecture",
        subtitle: "Real-time cryptographically verified packet authentication.",
        preview_url: renderContentSlide({
          title: "Autonomous Micro-Isolation",
          slideNumber: 3,
          totalSlides: 4,
          categoryTag: "Product Engine",
          headline: "Sub-4ms Identity Verification",
          body: "Every microservice request is signed with ephemeral cryptographic keys generated at the kernel eBPF level.",
          theme: emeraldTheme,
          card1Title: "eBPF Integration",
          card1Value: "Kernel-level inspection without proxy latency.",
          card2Title: "Zero Config Mesh",
          card2Value: "Auto-discovers Kubernetes topologies in 15 minutes.",
          card3Title: "Instant Quarantine",
          card3Value: "Autonomous isolation of compromised nodes in 120ms.",
        }),
      },
      {
        id: "hs-s4",
        slide_number: 4,
        title: "Enterprise ROI & Deployment Timeline",
        subtitle: "Measurable 65% reduction in Security Operations toil within 30 days.",
        preview_url: renderContentSlide({
          title: "Executive Business Value",
          slideNumber: 4,
          totalSlides: 4,
          categoryTag: "Financial Impact",
          headline: "3.4x ROI in Year 1 Guaranteed",
          body: "Consolidates 6 point solutions into a single unified security control plane with zero downtime rollout.",
          theme: emeraldTheme,
          card1Title: "$2.1M Tool Savings",
          card1Value: "Deprecates legacy agent licensing costs immediately.",
          card2Title: "Day 1 Turnkey",
          card2Value: "Zero agent installation required on target hosts.",
          card3Title: "99.999% SLA",
          card3Value: "Mission-critical financial and healthcare grade uptime.",
        }),
      },
    ],
  },
  {
    id: "aura-biometrics-profile",
    title: "Aura Biometrics — Clinical Luxury Wearables",
    client_name: "Aura Health & Vitality",
    category: "Company Profiles",
    tagline: "Corporate Brand & Capabilities Presentation",
    description: "An intellectual luxury corporate deck presenting breakthrough continuous photonics monitoring, clinical hardware design, and global retail distribution channels.",
    cover_image_url: renderCoverSlide({
      title: "Aura Biometrics",
      categoryTag: "Company Profile",
      subtitle: "Clinical Precision. Timeless Aesthetics.",
      client: "Aura Health AG",
      metric: "Global Brand Profile",
      theme: champagneTheme,
      meta: "18 Slides • Luxury Health Tech",
    }),
    metrics: ["Global Brand Profile", "TechCrunch Featured", "18 Slides", "FDA Designated"],
    slide_count: 4,
    featured: true,
    published: true,
    display_order: 3,
    view_count: 980,
    created_at: "2026-09-18T14:00:00Z",
    slides: [
      {
        id: "aura-s1",
        slide_number: 1,
        title: "Cover: Corporate Brand Presentation",
        subtitle: "Luxury preventative health & longevity",
        preview_url: renderCoverSlide({
          title: "Aura Biometrics",
          categoryTag: "Company Profile",
          subtitle: "Clinical Precision. Timeless Aesthetics.",
          client: "Aura Health AG",
          metric: "Global Brand Profile",
          theme: champagneTheme,
          meta: "18 Slides • Luxury Health Tech",
        }),
      },
      {
        id: "aura-s2",
        slide_number: 2,
        title: "The Longevity Era: Continuous Metabolic Intelligence",
        subtitle: "Moving healthcare from reactive emergency treatment to proactive biological optimization.",
        preview_url: renderContentSlide({
          title: "The Longevity Revolution",
          slideNumber: 2,
          totalSlides: 4,
          categoryTag: "Market Sizing",
          headline: "$120B Proactive Wellness Frontier",
          body: "High-net-worth individuals and corporate executives demand medical-grade biometric feedback seamlessly integrated into their lifestyle.",
          theme: champagneTheme,
          card1Title: "Clinical Grade",
          card1Value: "99.4% correlation with gold-standard laboratory draws.",
          card2Title: "Titanium Ceramic",
          card2Value: "Scratch-resistant casing designed by Swiss horologists.",
          card3Title: "7-Day Battery",
          card3Value: "Micro-harvesting kinetic and ambient thermal energy.",
        }),
      },
      {
        id: "aura-s3",
        slide_number: 3,
        title: "Photonic Spectrometry Sensor Architecture",
        subtitle: "Sub-surface non-invasive blood glucose, lactate, and vascular stiffness tracking.",
        preview_url: renderContentSlide({
          title: "Photonic Innovation",
          slideNumber: 3,
          totalSlides: 4,
          categoryTag: "Hardware IP",
          headline: "Multi-Spectrum Sub-Dermal Analysis",
          body: "14 discrete optical channels measuring deep vascular hemodynamics without painful finger pricks or skin punctures.",
          theme: champagneTheme,
          card1Title: "Glucose Trends",
          card1Value: "Instant real-time glycemic spike detection.",
          card2Title: "Vascular Age",
          card2Value: "Arterial stiffness scoring with predictive cardiac risk.",
          card3Title: "Sleep Architecture",
          card3Value: "Micro-arousal and deep REM stage mapping.",
        }),
      },
      {
        id: "aura-s4",
        slide_number: 4,
        title: "Global Distribution & Direct-to-Consumer Engine",
        subtitle: "Flagship boutiques in Zurich, Tokyo, and New York with 74% direct digital margin.",
        preview_url: renderContentSlide({
          title: "Global Commercial Engine",
          slideNumber: 4,
          totalSlides: 4,
          categoryTag: "Commercialization",
          headline: "Omnichannel Premium Placement",
          body: "Combining high-touch experiential retail with frictionless cloud subscription models generating sticky high-LTV relationships.",
          theme: champagneTheme,
          card1Title: "$850 AOV",
          card1Value: "Premium hardware pricing with high gross margin.",
          card2Title: "$29/mo SaaS",
          card2Value: "AI concierge health analysis and longevity reports.",
          card3Title: "48 Countries",
          card3Value: "Regulatory clearance achieved across EU, US, and APAC.",
        }),
      },
    ],
  },
  {
    id: "cognitive-fund-deck",
    title: "Cognitive Capital — Sovereign Frontier Fund III",
    client_name: "Cognitive Capital Partners",
    category: "Pitch Decks",
    tagline: "$250M Institutional LP Presentation",
    description: "Presentation deck prepared for Sovereign Wealth Funds, Institutional Endowments, and Family Offices. Outlines underwriting models for quantum compute, fusion energy, and bio-silicon infrastructure.",
    cover_image_url: renderCoverSlide({
      title: "Cognitive Capital",
      categoryTag: "LP Pitch Deck",
      subtitle: "Fund III: Deep Tech & Sovereign Frontier Infrastructure",
      client: "Cognitive Capital LP",
      metric: "$250M Target Fund",
      theme: violetTheme,
      meta: "22 Slides • Institutional LP Deck",
    }),
    metrics: ["$250M Target Fund", "3.8x Net DPI", "22 Slides", "Top 5% Quartile"],
    slide_count: 4,
    featured: false,
    published: true,
    display_order: 4,
    view_count: 840,
    created_at: "2026-09-22T09:15:00Z",
    slides: [
      {
        id: "cog-s1",
        slide_number: 1,
        title: "Cover: Institutional LP Deck",
        subtitle: "Sovereign frontier fund III presentation",
        preview_url: renderCoverSlide({
          title: "Cognitive Capital",
          categoryTag: "LP Pitch Deck",
          subtitle: "Fund III: Deep Tech & Sovereign Frontier Infrastructure",
          client: "Cognitive Capital LP",
          metric: "$250M Target Fund",
          theme: violetTheme,
          meta: "22 Slides • Institutional LP Deck",
        }),
      },
      {
        id: "cog-s2",
        slide_number: 2,
        title: "Thesis: The Post-Silicon Infrastructure Moat",
        subtitle: "Why the next generational tech monopolies will be physical, compute-heavy, and sovereign.",
        preview_url: renderContentSlide({
          title: "The Sovereign Horizon",
          slideNumber: 2,
          totalSlides: 4,
          categoryTag: "Investment Thesis",
          headline: "Beyond Commodity SaaS",
          body: "Software without proprietary physical moats is rapidly commoditized. We back companies with deep patent barriers and sovereign-level IP.",
          theme: violetTheme,
          card1Title: "Bio-Silicon Hybrid",
          card1Value: "Synthetic biology accelerating micro-electronics.",
          card2Title: "Grid-Scale Power",
          card2Value: "Dedicated clean energy generation for AI clusters.",
          card3Title: "Space Logistics",
          card3Value: "Orbital manufacturing and high-vacuum metallurgy.",
        }),
      },
      {
        id: "cog-s3",
        slide_number: 3,
        title: "Historical Alpha & Cash-on-Cash Return Realization",
        subtitle: "Funds I and II delivered top 3% global DPI with 38% net IRR over a 7-year cycle.",
        preview_url: renderContentSlide({
          title: "Track Record & Liquidity",
          slideNumber: 3,
          totalSlides: 4,
          categoryTag: "Fund Performance",
          headline: "3.8x Realized Net DPI to LPs",
          body: "Disciplined capital deployment, non-consensus early pricing, and proactive secondary liquidity execution.",
          theme: violetTheme,
          card1Title: "38% Net IRR",
          card1Value: "Audited returns outperforming Cambridge Associates benchmark.",
          card2Title: "6 Unicorn Exits",
          card2Value: "Acquisitions by strategic sovereigns and defense primes.",
          card3Title: "Zero Loss Ratio",
          card3Value: "Structure protection and non-dilutive grant syndication.",
        }),
      },
      {
        id: "cog-s4",
        slide_number: 4,
        title: "Portfolio Synergy & Sovereign Offtake Partners",
        subtitle: "Our institutional ecosystem provides immediate commercial contracts to portfolio companies.",
        preview_url: renderContentSlide({
          title: "The Cognitive Flywheel",
          slideNumber: 4,
          totalSlides: 4,
          categoryTag: "Network Advantage",
          headline: "$1.4B in Offtake Commitments",
          body: "Connecting portfolio founders with sovereign state buyers, telecom consortiums, and national defense agencies on Day 1.",
          theme: violetTheme,
          card1Title: "Pre-Signed Buyers",
          card1Value: "Immediate commercial contracts before Series A.",
          card2Title: "Regulatory Fast-Track",
          card2Value: "Direct corridors through FDA, FAA, and DOD approvals.",
          card3Title: "Global LP Syndicate",
          card3Value: "Co-investment opportunities for lead fund participants.",
        }),
      },
    ],
  },
  {
    id: "nexus-keynote-deck",
    title: "Nexus Robotics — Autonomous Drone Swarms",
    client_name: "Nexus Physical Networks",
    category: "Keynotes",
    tagline: "CES 2026 Opening Keynote Presentation",
    description: "Cinematic widescreen keynote presentation designed for a stadium of 15,000 live attendees and 2M global stream viewers. Bold, graphic storytelling that captivated media and partners.",
    cover_image_url: renderCoverSlide({
      title: "Nexus Robotics",
      categoryTag: "Global Keynote",
      subtitle: "The Physical Internet: Autonomous Swarm Logistics",
      client: "Nexus Physical",
      metric: "15,000 Live Attendees",
      theme: crimsonTheme,
      meta: "24 Slides • CES Opening Keynote",
    }),
    metrics: ["CES 2026 Keynote", "15,000 Live Attendees", "24 Slides", "2M Stream Views"],
    slide_count: 4,
    featured: true,
    published: true,
    display_order: 5,
    view_count: 1750,
    created_at: "2026-09-25T16:00:00Z",
    slides: [
      {
        id: "nex-s1",
        slide_number: 1,
        title: "Cover: CES Global Keynote Presentation",
        subtitle: "Autonomous swarm robotics & urban skies",
        preview_url: renderCoverSlide({
          title: "Nexus Robotics",
          categoryTag: "Global Keynote",
          subtitle: "The Physical Internet: Autonomous Swarm Logistics",
          client: "Nexus Physical",
          metric: "15,000 Live Attendees",
          theme: crimsonTheme,
          meta: "24 Slides • CES Opening Keynote",
        }),
      },
      {
        id: "nex-s2",
        slide_number: 2,
        title: "The Physical Internet: Moving Mass at Light Speed",
        subtitle: "Why 2D road networks are obsolete for metropolitan instant logistics.",
        preview_url: renderContentSlide({
          title: "Unlocking The Third Dimension",
          slideNumber: 2,
          totalSlides: 4,
          categoryTag: "Keynote Story",
          headline: "Sub-15 Minute Metro Deliveries",
          body: "Bypassing traffic bottlenecks completely with autonomous electric micro-aircraft coordinating dynamically in 3D air corridors.",
          theme: crimsonTheme,
          card1Title: "10,000 Swarm Nodes",
          card1Value: "Decentralized mesh with zero collision incidents.",
          card2Title: "55 dBA Noise",
          card2Value: "Quieter than conversational speech on city streets.",
          card3Title: "Zero Emissions",
          card3Value: "100% solar charged battery swap vertiport hubs.",
        }),
      },
      {
        id: "nex-s3",
        slide_number: 3,
        title: "Swarm AI Routing Engine: 10,000 Units/Sec",
        subtitle: "Decentralized collision avoidance algorithms modeled after starlings murmuration.",
        preview_url: renderContentSlide({
          title: "Bio-Inspired Swarm Mesh",
          slideNumber: 3,
          totalSlides: 4,
          categoryTag: "Autonomous Engineering",
          headline: "Microsecond Spatial Rerouting",
          body: "When weather or airspace restrictions shift, the swarm recomputes routes collectively across peer-to-peer optical links.",
          theme: crimsonTheme,
          card1Title: "Optical Comms",
          card1Value: "Laser mesh communication impervious to RF jamming.",
          card2Title: "Edge Inference",
          card2Value: "Dual neural processors on every individual aircraft.",
          card3Title: "Fail-Safe Parachute",
          card3Value: "Pyrotechnic ballistic deployment in <50 milliseconds.",
        }),
      },
      {
        id: "nex-s4",
        slide_number: 4,
        title: "The 2028 Metros Deployment Roadmap",
        subtitle: "Launching in Singapore, Dubai, and Dallas with full civil aviation clearance.",
        preview_url: renderContentSlide({
          title: "Global Airspace Rollout",
          slideNumber: 4,
          totalSlides: 4,
          categoryTag: "Vision & Horizon",
          headline: "Transforming 40 Megacities by 2028",
          body: "Partnering with municipal transportation authorities to establish clean, reliable, whisper-quiet aerial corridors.",
          theme: crimsonTheme,
          card1Title: "Phase 1: Medical",
          card1Value: "Instant organ and blood transport between hospitals.",
          card2Title: "Phase 2: Commerce",
          card2Value: "Direct rooftop fulfillment for high-density districts.",
          card3Title: "Phase 3: Heavy Cargo",
          card3Value: "Industrial 500kg payloads for ports and distribution.",
        }),
      },
    ],
  },
  {
    id: "finflow-case-study",
    title: "FinFlow — Real-Time Settlement Migration",
    client_name: "FinFlow Settlement Network",
    category: "Case Studies",
    tagline: "Enterprise Fintech Modernization Case Study",
    description: "In-depth case study presentation detailing how a legacy 72-hour international correspondent banking pipeline was re-architected into sub-second atomic settlement.",
    cover_image_url: renderCoverSlide({
      title: "FinFlow Settlement",
      categoryTag: "Enterprise Case Study",
      subtitle: "Migrating from 72-Hour Friction to Sub-Second Finality",
      client: "FinFlow Global",
      metric: "340% Conversion Lift",
      theme: cyanTheme,
      meta: "12 Slides • SOC2 Type II",
    }),
    metrics: ["340% Conversion Lift", "SOC2 Type II", "12 Slides", "$1.8B Processed"],
    slide_count: 4,
    featured: false,
    published: true,
    display_order: 6,
    view_count: 760,
    created_at: "2026-09-28T12:00:00Z",
    slides: [
      {
        id: "fin-s1",
        slide_number: 1,
        title: "Cover: Fintech Case Study Presentation",
        subtitle: "Real-time cross-border settlement architecture",
        preview_url: renderCoverSlide({
          title: "FinFlow Settlement",
          categoryTag: "Enterprise Case Study",
          subtitle: "Migrating from 72-Hour Friction to Sub-Second Finality",
          client: "FinFlow Global",
          metric: "340% Conversion Lift",
          theme: cyanTheme,
          meta: "12 Slides • SOC2 Type II",
        }),
      },
      {
        id: "fin-s2",
        slide_number: 2,
        title: "The Legacy Bottleneck: 72-Hour Liquidity Traps",
        subtitle: "How correspondent banking fees and unpredictable float costs were suffocating mid-market exporters.",
        preview_url: renderContentSlide({
          title: "The $40B Float Trap",
          slideNumber: 2,
          totalSlides: 4,
          categoryTag: "Diagnostic Analysis",
          headline: "Fragile Multi-Hop Correspondent Chains",
          body: "Cross-border capital suffered 4.2% slippage, opaque currency spreads, and painful SWIFT rejection rates.",
          theme: cyanTheme,
          card1Title: "72-Hour Delay",
          card1Value: "Capital locked in transit creating massive working capital drag.",
          card2Title: "4.2% Fees",
          card2Value: "Hidden intermediary correspondent cuts on every wire.",
          card3Title: "18% Failure Rate",
          card3Value: "Manual AML investigations halting legitimate corporate payroll.",
        }),
      },
      {
        id: "fin-s3",
        slide_number: 3,
        title: "The Architecture: Sub-200ms Unified Liquidity Pools",
        subtitle: "Replacing correspondent banks with programmatic automated market maker collateral pools.",
        preview_url: renderContentSlide({
          title: "The Atomic Engine",
          slideNumber: 3,
          totalSlides: 4,
          categoryTag: "Solution Engineering",
          headline: "200ms Instant Gross Settlement",
          body: "Direct integration into central bank real-time payment rails across FedNow, SEPA Instant, and Pix.",
          theme: cyanTheme,
          card1Title: "Pre-Funded Vaults",
          card1Value: "Overnight liquidity guaranteed across 32 currencies.",
          card2Title: "Autonomous FX",
          card2Value: "Institutional wholesale mid-market rate execution.",
          card3Title: "Zero Intermediaries",
          card3Value: "Direct ledger-to-ledger finality with immutable audit.",
        }),
      },
      {
        id: "fin-s4",
        slide_number: 4,
        title: "Measurable Results & Client Growth Impact",
        subtitle: "Over $1.8B settled in Q1 with customer transaction volumes surging 340%.",
        preview_url: renderContentSlide({
          title: "Verified Commercial Impact",
          slideNumber: 4,
          totalSlides: 4,
          categoryTag: "Impact Metrics",
          headline: "340% Surge in Merchant Volume",
          body: "Exporters regained control of cash flow, slashing FX overhead by 88% and eliminating payment uncertainty.",
          theme: cyanTheme,
          card1Title: "$1.8B Volume",
          card1Value: "Quarterly run-rate scaling without operational headcount growth.",
          card2Title: "99.98% Success",
          card2Value: "Virtually zero failed or returned international wires.",
          card3Title: "88% Cost Reduction",
          card3Value: "Transferred millions in fees directly back to client bottom lines.",
        }),
      },
    ],
  },
];
