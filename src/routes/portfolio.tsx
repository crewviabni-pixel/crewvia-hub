import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Share2,
  Calendar,
  Check,
  Send,
  MessageCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Layers,
  Compass,
  Copy,
  Heart,
  Eye,
} from "lucide-react";
import {
  fetchPublishedPortfolioItems,
  incrementPortfolioViews,
  togglePortfolioLike,
  getClientLikedDeckIds,
  formatCompactNumber,
  subscribeToPortfolioSync,
  type PortfolioItem,
} from "@/lib/portfolio-api";
import { PORTFOLIO_CATEGORIES } from "@/lib/portfolio-sample-decks";
import { PresentationLightroomModal } from "@/components/PresentationLightroomModal";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/portfolio")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      deck: typeof search["deck"] === "string" ? search["deck"] : undefined,
      cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Crewvia Studio — Presentation Portfolio & Visuals" },
      {
        name: "description",
        content:
          "Explore Crewvia's selected sample presentation decks, pitch decks, enterprise sales decks, and visual narratives in an infinite freehand canvas.",
      },
      { property: "og:title", content: "Crewvia Visual Showcase — Selected Presentations" },
      {
        property: "og:description",
        content:
          "Curated collection of high-stakes pitch decks, enterprise sales presentations, and executive keynotes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "shortcut icon", href: "/favicon.ico" },
    ],
  }),
  component: PublicPortfolioShowcasePage,
});

const CATEGORIES = ["All", ...PORTFOLIO_CATEGORIES] as const;
type CategoryType = (typeof CATEGORIES)[number];

const CREWVIA_TEAM_WHATSAPP = "917223804653";

// Standard 16:9 Widescreen Presentation Card Geometry (Ensures 0% of slide is cropped)
const DEFAULT_CARD_WIDTH = 464;
const DEFAULT_CARD_HEIGHT = 261;

const SKELETON_PLACEHOLDER_DECKS: PortfolioItem[] = [
  {
    id: "skel-1",
    title: "Strategic Vision & Architecture",
    client_name: "Strategic Partners",
    category: "Presentations",
    tagline: "High-Stakes Visual Presentation",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 1,
    view_count: 0,
    created_at: "",
  },
  {
    id: "skel-2",
    title: "Industrial & Production Capabilities",
    client_name: "Apex Engineering",
    category: "Presentations",
    tagline: "Industrial Strength Presentation",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 2,
    view_count: 0,
    created_at: "",
  },
  {
    id: "skel-3",
    title: "Speciality Healthcare Clinic",
    client_name: "Smile Care Centre",
    category: "Pitch Deck",
    tagline: "Clinical Excellence Presentation",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 3,
    view_count: 0,
    created_at: "",
  },
  {
    id: "skel-4",
    title: "Enterprise Facility Services",
    client_name: "Clean Master Services",
    category: "Company Profile",
    tagline: "Operational Capabilities Deck",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 4,
    view_count: 0,
    created_at: "",
  },
  {
    id: "skel-5",
    title: "Executive Business Consultancy",
    client_name: "Miracle Consultancy",
    category: "Roaster",
    tagline: "Deliver Beyond Expectations",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 5,
    view_count: 0,
    created_at: "",
  },
  {
    id: "skel-6",
    title: "Sustainable Agriculture & Green Energy",
    client_name: "Krishnavatar",
    category: "Branding",
    tagline: "Building Greener Futures",
    description: "",
    cover_image_url: "",
    slides: [],
    metrics: [],
    slide_count: 3,
    featured: true,
    published: true,
    display_order: 6,
    view_count: 0,
    created_at: "",
  },
];

function PublicPortfolioShowcasePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/portfolio" });
  const queryClient = useQueryClient();

  // Viewport tracking for responsive virtual tiling
  const [viewport, setViewport] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1400,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Responsive Card & Grid Dimensions (Strict 16:9 widescreen presentation proportion)
  const isMobile = viewport.w < 640;
  const isTablet = viewport.w >= 640 && viewport.w < 1024;
  const cardWidth = isMobile
    ? Math.min(340, Math.max(260, viewport.w - 32))
    : isTablet
    ? 390
    : DEFAULT_CARD_WIDTH;
  const cardHeight = Math.round((cardWidth * 9) / 16);
  const gapX = isMobile ? 16 : isTablet ? 28 : 36;
  const gapY = isMobile ? 16 : isTablet ? 28 : 36;
  const cellW = cardWidth + gapX;
  const cellH = cardHeight + gapY;

  // Active Category filter
  const [activeCategory, setActiveCategory] = useState<CategoryType>(() => {
    if (search.cat) {
      const match = CATEGORIES.find(
        (c) => c.toLowerCase().replace(/\s+/g, "-") === search.cat?.toLowerCase()
      );
      if (match) return match;
    }
    return "All";
  });

  // Reverse Category Dropdown State (Opens Upwards)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  // Close reverse dropdown on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsCategoryMenuOpen(false);
    };

    if (isCategoryMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isCategoryMenuOpen]);

  // Presentation in Full Lightroom Mode
  const [activeDeck, setActiveDeck] = useState<PortfolioItem | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Floating Consultation Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedDeckForBooking, setSelectedDeckForBooking] = useState<PortfolioItem | null>(null);

  // Booking Form State
  const [bookingName, setBookingName] = useState("");
  const [bookingCompany, setBookingCompany] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingType, setBookingType] = useState<string>("Presentations");
  const [bookingNote, setBookingNote] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Link copy feedback
  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);

  // Fog-of-War Seen State: revealed on hover and persists for session
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // Infinite Freehand Canvas State & Direct GPU Hardware Layer Ref
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const lastGridCenterRef = useRef({ x: 0, y: 0 });

  // Virtual Tiling Anchor Origin (Only changes when motion settles or crossing buffer threshold)
  const [gridOrigin, setGridOrigin] = useState({ x: 0, y: 0 });

  // High-Performance Pointer Tracking Refs (ZERO React state updates during drag/scroll)
  const isPointerDownRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });
  const lastPointerTimeRef = useRef(0);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const animFrameRef = useRef<number | null>(null);
  const wheelDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Center initial canvas on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialW =
        window.innerWidth < 640
          ? Math.min(340, Math.max(260, window.innerWidth - 32))
          : window.innerWidth < 1024
          ? 390
          : DEFAULT_CARD_WIDTH;
      const initialH = Math.round(initialW * (DEFAULT_CARD_HEIGHT / DEFAULT_CARD_WIDTH));
      const initial = {
        x: (window.innerWidth - initialW) / 2,
        y: (window.innerHeight - initialH) / 2,
      };
      posRef.current = initial;
      lastGridCenterRef.current = initial;
      setGridOrigin(initial);
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${initial.x}px, ${initial.y}px, 0)`;
      }
    }
  }, []);

  // Fetch Published presentations
  const { data: portfolioItems = [], isLoading } = useQuery({
    queryKey: ["published-portfolio-showcase"],
    queryFn: fetchPublishedPortfolioItems,
    staleTime: 20 * 1000,
  });

  // Real-time cross-tab synchronization: keep public showcase updated when manager adds/edits decks
  useEffect(() => {
    const unsubscribe = subscribeToPortfolioSync(() => {
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Handle direct deep-link parameter ?deck=<id> (strictly once per deep-link change)
  const deepLinkTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (search.deck && portfolioItems.length > 0) {
      if (deepLinkTrackedRef.current === search.deck) return;
      const found = portfolioItems.find((item) => item.id === search.deck);
      if (found) {
        deepLinkTrackedRef.current = search.deck;
        setActiveDeck(found);
        setActiveSlideIndex(0);
        incrementPortfolioViews(found.id).catch(() => {});
        setSeenIds((prev) => new Set(prev).add(found.id));
      }
    }
  }, [search.deck, portfolioItems]);

  // Filter items by category (smoothly falls back to rich placeholder canvas while initial query resolves)
  const filteredItems = useMemo(() => {
    const sourceItems =
      portfolioItems.length > 0
        ? portfolioItems
        : isLoading
        ? SKELETON_PLACEHOLDER_DECKS
        : [];

    if (activeCategory === "All") return sourceItems;
    return sourceItems.filter(
      (item) => item.category?.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [portfolioItems, activeCategory, isLoading]);

  const openDeckModal = useCallback(
    (deck: PortfolioItem, initialSlideIndex = 0) => {
      // Record so the deep-link effect doesn't re-trigger when URL updates
      deepLinkTrackedRef.current = deck.id;

      // 1. FIRST PRIORITY: Instantly open preview modal on the current frame (0ms latency)
      const optimisticDeck = {
        ...deck,
        view_count: (deck.view_count || 0) + 1,
      };
      setActiveDeck(optimisticDeck);
      setActiveSlideIndex(initialSlideIndex);
      setSeenIds((prev) => new Set(prev).add(deck.id));

      // 2. Non-blocking URL parameter sync
      try {
        navigate({
          search: (prev: any) => ({ ...prev, deck: deck.id }),
          replace: true,
        });
      } catch {}

      // 3. Background asynchronous API persistence (runs once in background)
      setTimeout(() => {
        incrementPortfolioViews(deck.id).catch(() => {});
      }, 0);
    },
    [navigate]
  );

  const closeDeckModal = useCallback(() => {
    deepLinkTrackedRef.current = null;
    setActiveDeck(null);
    navigate({
      search: (prev: any) => {
        const { deck, ...rest } = prev || {};
        return rest;
      },
      replace: true,
    });
  }, [navigate]);

  const handleSeen = useCallback((deckId: string) => {
    setSeenIds((prev) => {
      if (prev.has(deckId)) return prev;
      const next = new Set(prev);
      next.add(deckId);
      return next;
    });
  }, []);

  const handleShareDeck = useCallback((deck: PortfolioItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set("deck", deck.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedDeckId(deck.id);
      toast.success("Presentation link copied to clipboard!");
      setTimeout(() => setCopiedDeckId(null), 2500);
    });
  }, []);

  const handleOpenBooking = useCallback((deck?: PortfolioItem | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deck) {
      setSelectedDeckForBooking(deck);
      setBookingType(deck.category || "Presentations");
    } else {
      setSelectedDeckForBooking(null);
    }
    setBookingSuccess(false);
    setIsBookModalOpen(true);
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingPhone.trim() || !bookingName.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    setIsSubmittingBooking(true);
    try {
      const msg = `*New Portfolio Consultation Request*\n*Name:* ${bookingName}\n*Company:* ${bookingCompany || "Not specified"}\n*Phone:* ${bookingPhone}\n*Deck Type:* ${bookingType}\n*Interested In:* ${selectedDeckForBooking ? selectedDeckForBooking.title : "Custom Presentation"}\n*Notes:* ${bookingNote || "None"}`;
      const waUrl = `https://wa.me/${CREWVIA_TEAM_WHATSAPP}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      setBookingSuccess(true);
      toast.success("Connecting you with our Lead Presentation Designer...");
      setTimeout(() => {
        setIsBookModalOpen(false);
        setBookingName("");
        setBookingCompany("");
        setBookingPhone("");
        setBookingNote("");
      }, 2000);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleWhatsAppDirect = (deck?: PortfolioItem | null) => {
    const text = deck
      ? `Hi Crewvia Team! I was browsing your portfolio and loved the "${deck.title}" deck. I'd love to discuss crafting a presentation for my business.`
      : `Hi Crewvia Team! I want to discuss a presentation design project with your creative architects.`;
    window.open(`https://wa.me/${CREWVIA_TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCategorySelect = (category: CategoryType) => {
    setActiveCategory(category);
    navigate({
      search: (prev: any) => {
        const next = { ...prev };
        if (category === "All") {
          delete next.cat;
        } else {
          next.cat = category.toLowerCase().replace(/\s+/g, "-");
        }
        return next;
      },
      replace: true,
    });
  };

  // Direct GPU hardware translation (0ms latency, zero React re-renders)
  const applyTransformDirect = useCallback((x: number, y: number) => {
    posRef.current = { x, y };
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, []);

  // Sync virtual tiling anchor origin when motion crosses threshold
  // Lower threshold = more frequent tile regeneration = fewer blank areas during fast scroll
  const checkGridOriginSync = useCallback(() => {
    const dx = Math.abs(posRef.current.x - lastGridCenterRef.current.x);
    const dy = Math.abs(posRef.current.y - lastGridCenterRef.current.y);
    if (dx > cellW * 0.6 || dy > cellH * 0.6) {
      lastGridCenterRef.current = { ...posRef.current };
      setGridOrigin({ ...posRef.current });
    }
  }, [cellW, cellH]);

  // Natural kinetic momentum decay with continuous grid sync
  // Syncs grid origin every 2 animation frames during momentum to keep tiles populated
  const startMomentum = useCallback(() => {
    const friction = 0.95;
    const minVelocity = 0.15;
    let frameCount = 0;

    const step = () => {
      velocityRef.current.vx *= friction;
      velocityRef.current.vy *= friction;

      if (
        Math.abs(velocityRef.current.vx) < minVelocity &&
        Math.abs(velocityRef.current.vy) < minVelocity
      ) {
        velocityRef.current = { vx: 0, vy: 0 };
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        checkGridOriginSync();
        return;
      }

      const nextX = posRef.current.x + velocityRef.current.vx;
      const nextY = posRef.current.y + velocityRef.current.vy;
      applyTransformDirect(nextX, nextY);

      // Continuous grid sync during momentum: check every 2 frames OR on displacement
      frameCount++;
      const dispX = Math.abs(nextX - lastGridCenterRef.current.x);
      const dispY = Math.abs(nextY - lastGridCenterRef.current.y);
      if (frameCount % 2 === 0 || dispX > cellW * 0.4 || dispY > cellH * 0.4) {
        checkGridOriginSync();
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  }, [applyTransformDirect, checkGridOriginSync, cellW, cellH]);

  // Production-grade unified Pointer Events (Mouse, Trackpad, Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || activeDeck || isBookModalOpen) return;

    // Never interfere with clicks on buttons, links, inputs, or modal/header/nav elements
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, select, textarea, [role='button'], nav, header, [role='dialog'], [data-modal='true']"
      )
    ) {
      return;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    isPointerDownRef.current = true;
    dragDistanceRef.current = 0;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerTimeRef.current = performance.now();
    velocityRef.current = { vx: 0, vy: 0 };
  };

  // Window Pointer Event Listeners for Butter-Smooth Freehand Dragging
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (activeDeck || isBookModalOpen) {
        isPointerDownRef.current = false;
        return;
      }
      if (!isPointerDownRef.current) return;

      const dx = e.clientX - lastPointerPosRef.current.x;
      const dy = e.clientY - lastPointerPosRef.current.y;
      const dist = Math.hypot(dx, dy);
      dragDistanceRef.current += dist;

      const now = performance.now();
      const dt = now - lastPointerTimeRef.current;
      if (dt > 0) {
        const instantVx = (dx / dt) * 16.67;
        const instantVy = (dy / dt) * 16.67;
        velocityRef.current.vx = velocityRef.current.vx * 0.35 + instantVx * 0.65;
        velocityRef.current.vy = velocityRef.current.vy * 0.35 + instantVy * 0.65;
      }
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      lastPointerTimeRef.current = now;

      if (dragDistanceRef.current > 5) {
        if (containerRef.current && !containerRef.current.classList.contains("cursor-grabbing")) {
          containerRef.current.classList.remove("cursor-grab");
          containerRef.current.classList.add("cursor-grabbing");
        }
      }

      const nextX = posRef.current.x + dx;
      const nextY = posRef.current.y + dy;
      applyTransformDirect(nextX, nextY);

      // Continuous long drag safety sync — sync tiles while dragging at 0.5 cell threshold
      const displacementX = Math.abs(nextX - lastGridCenterRef.current.x);
      const displacementY = Math.abs(nextY - lastGridCenterRef.current.y);
      if (displacementX > cellW * 0.5 || displacementY > cellH * 0.5) {
        lastGridCenterRef.current = { x: nextX, y: nextY };
        setGridOrigin({ x: nextX, y: nextY });
      }
    };

    const handleWindowPointerUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      if (containerRef.current) {
        containerRef.current.classList.remove("cursor-grabbing");
        containerRef.current.classList.add("cursor-grab");
      }

      const timeSinceLastMove = performance.now() - lastPointerTimeRef.current;
      if (timeSinceLastMove > 80 || dragDistanceRef.current < 16) {
        velocityRef.current = { vx: 0, vy: 0 };
        checkGridOriginSync();
      } else {
        const maxVel = 50;
        velocityRef.current.vx = Math.max(-maxVel, Math.min(maxVel, velocityRef.current.vx));
        velocityRef.current.vy = Math.max(-maxVel, Math.min(maxVel, velocityRef.current.vy));
        startMomentum();
      }
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [applyTransformDirect, checkGridOriginSync, startMomentum, activeDeck, isBookModalOpen, cellW, cellH]);

  // High-Performance Native Wheel & Trackpad Listener with Zero-Lag Continuous Sync
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (activeDeck || isBookModalOpen) return;
      e.preventDefault();

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      let factor = 1;
      if (e.deltaMode === 1) factor = 24; // Lines mode
      else if (e.deltaMode === 2) factor = window.innerHeight; // Pages mode

      const dx = e.deltaX * factor;
      const dy = e.deltaY * factor;

      const nextX = posRef.current.x - dx;
      const nextY = posRef.current.y - dy;

      applyTransformDirect(nextX, nextY);

      // Track wheel velocity for predictive asymmetric tiling
      velocityRef.current = {
        vx: -dx * 0.6,
        vy: -dy * 0.6,
      };

      // Continuous anchor sync during fast wheel scrolling:
      // When displacement exceeds 0.35 cell, sync gridOrigin immediately
      // This eliminates the blank screen during fast wheel/trackpad scrolling!
      const dispX = Math.abs(nextX - lastGridCenterRef.current.x);
      const dispY = Math.abs(nextY - lastGridCenterRef.current.y);
      if (dispX > cellW * 0.35 || dispY > cellH * 0.35) {
        lastGridCenterRef.current = { x: nextX, y: nextY };
        setGridOrigin({ x: nextX, y: nextY });
      }

      // Trailing settle sync when wheel stops
      if (wheelDebounceTimerRef.current) clearTimeout(wheelDebounceTimerRef.current);
      wheelDebounceTimerRef.current = setTimeout(() => {
        velocityRef.current = { vx: 0, vy: 0 };
        checkGridOriginSync();
      }, 70);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelDebounceTimerRef.current) clearTimeout(wheelDebounceTimerRef.current);
    };
  }, [applyTransformDirect, checkGridOriginSync, cellW, cellH, activeDeck, isBookModalOpen]);

  // Keyboard Arrow Navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      let deltaX = 0;
      let deltaY = 0;
      const step = 140;

      if (e.key === "ArrowLeft") deltaX = step;
      else if (e.key === "ArrowRight") deltaX = -step;
      else if (e.key === "ArrowUp") deltaY = step;
      else if (e.key === "ArrowDown") deltaY = -step;
      else return;

      e.preventDefault();
      const nextX = posRef.current.x + deltaX;
      const nextY = posRef.current.y + deltaY;
      applyTransformDirect(nextX, nextY);
      checkGridOriginSync();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyTransformDirect, checkGridOriginSync]);

  // Virtual Tiling: Directional predictive lookahead with Dual-Zone (Core + Predictive Skeleton) architecture
  // Computes a generous buffer and projects extra columns/rows in the exact trajectory of velocity.
  // Recomputes ONLY when anchor shifts, NOT on every frame.
  const visibleTiles = useMemo(() => {
    if (filteredItems.length === 0) return [];

    // Base buffer of 2.5 cells
    const bufferX = cellW * 2.5;
    const bufferY = cellH * 2.5;

    // Asymmetric predictive envelope based on instantaneous velocity
    // (Project extra columns/rows ahead in the direction of motion to prepare tiles before arrival)
    const vx = velocityRef.current.vx;
    const vy = velocityRef.current.vy;
    const extraColsLeft = vx > 4 ? Math.min(3, Math.ceil(vx / 10)) : 0;
    const extraColsRight = vx < -4 ? Math.min(3, Math.ceil(Math.abs(vx) / 10)) : 0;
    const extraRowsTop = vy > 4 ? Math.min(3, Math.ceil(vy / 10)) : 0;
    const extraRowsBottom = vy < -4 ? Math.min(3, Math.ceil(Math.abs(vy) / 10)) : 0;

    const minCol = Math.floor((-gridOrigin.x - bufferX) / cellW) - 1 - extraColsLeft;
    const maxCol = Math.ceil((viewport.w - gridOrigin.x + bufferX) / cellW) + 1 + extraColsRight;
    const minRow = Math.floor((-gridOrigin.y - bufferY) / cellH) - 1 - extraRowsTop;
    const maxRow = Math.ceil((viewport.h - gridOrigin.y + bufferY) / cellH) + 1 + extraRowsBottom;

    // Core interactive zone boundaries (immediate viewport + generous buffer)
    const viewCenterX = -gridOrigin.x + viewport.w / 2;
    const viewCenterY = -gridOrigin.y + viewport.h / 2;
    const coreColRadius = viewport.w / cellW / 2 + 2.5;
    const coreRowRadius = viewport.h / cellH / 2 + 2.5;

    const tiles = [];
    const total = filteredItems.length;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const positiveMod = (n: number, m: number) => ((n % m) + m) % m;
        const itemIdx = positiveMod(r * 3 + c, total);
        const deck = filteredItems[itemIdx];
        if (!deck) continue;

        // Alternating row offset for elegant staggered layout
        const rowShift = r % 2 !== 0 ? cellW / 2 : 0;
        const worldX = c * cellW + rowShift;
        const worldY = r * cellH;

        // Distance to determine Core vs Predictive Skeleton
        const tileCenterX = worldX + cardWidth / 2;
        const tileCenterY = worldY + cardHeight / 2;
        const distCols = Math.abs(tileCenterX - viewCenterX) / cellW;
        const distRows = Math.abs(tileCenterY - viewCenterY) / cellH;
        const isCore = distCols <= coreColRadius && distRows <= coreRowRadius;

        tiles.push({
          key: `tile-${r}-${c}`,
          deck,
          r,
          c,
          worldX,
          worldY,
          isCore,
        });
      }
    }
    return tiles;
  }, [gridOrigin.x, gridOrigin.y, viewport.w, viewport.h, filteredItems, cellW, cellH, cardWidth, cardHeight]);

  const totalWorks = portfolioItems.length;
  const seenCount = seenIds.size;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "none" }}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#f8fafc] text-slate-900 font-sans cursor-grab"
    >
      {/* Background Ambient Luxury Light Aura & Subtle Dot Matrix */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(59,130,246,0.10),rgba(16,185,129,0.05),rgba(248,250,252,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* FIXED TOP HEADER - THEME LIGHT LUXURY STYLE */}
      <header className="fixed top-0 inset-x-0 z-30 px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-between pointer-events-none">
        {/* Left: Crewvia Logo & Studio Badge (Identical h-11 and rounded-full) */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-4 h-11 rounded-full bg-white/90 hover:bg-white backdrop-blur-2xl border border-slate-200/80 shadow-lg shadow-slate-900/5 transition-all select-none box-border shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Crewvia" className="h-5 sm:h-5.5 w-auto object-contain" />
            <span className="font-display font-bold text-xs sm:text-sm tracking-tight text-slate-900 flex items-center gap-2">
              Crewvia
              <span className="text-[9px] sm:text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Visuals
              </span>
            </span>
          </Link>
        </div>

        {/* Center: Seen Explorer Counter Pill */}
        <div className="pointer-events-auto hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/85 backdrop-blur-2xl border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/5 select-none">
          {isLoading ? (
            <>
              <span className="size-2 rounded-full bg-cyan-500 animate-ping shrink-0" />
              <span className="text-slate-800 font-medium">Curating Presentation Visuals...</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal text-[11px] flex items-center gap-1">
                <Compass className="size-3 text-primary" />
                Drag canvas to explore
              </span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400 shrink-0" />
              <span>
                Seen <span className="text-slate-950 font-bold">{seenCount}</span> of{" "}
                {totalWorks} Works
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal text-[11px] flex items-center gap-1">
                <Compass className="size-3 text-primary" />
                Drag canvas to explore
              </span>
              {seenCount >= totalWorks && totalWorks > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  All Seen!
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: Top Book Call Button (Identical h-11 and rounded-full, text-sm font-semibold) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => handleOpenBooking()}
            className="hidden sm:inline-flex items-center gap-2 px-5.5 h-11 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm tracking-wide active:scale-95 transition-all shadow-xl shadow-slate-900/15 border border-slate-900 select-none box-border shrink-0"
          >
            <Calendar className="size-4 text-cyan-400 shrink-0" />
            <span>Book Call</span>
          </button>
        </div>
      </header>

      {/* INFINITE FREEHAND 2D CANVAS ARENA (GPU-ACCELERATED WORLD CONTAINER - ALWAYS BLENDED & LIVE) */}
      {!isLoading && filteredItems.length === 0 ? (
        <div className="size-full flex flex-col items-center justify-center gap-4 text-center p-6">
          <p className="text-sm text-slate-600 font-medium">No presentations found in this category.</p>
          <button
            onClick={() => setActiveCategory("All")}
            className="px-4 py-2 rounded-full bg-slate-900 text-xs text-white hover:bg-slate-800 transition-colors shadow-md"
          >
            Show All Presentations
          </button>
        </div>
      ) : (
        /* VIRTUAL CONTINUOUS INFINITE TILED PLANE */
        <div className="size-full relative pointer-events-none overflow-hidden">
          {/* SKELETON BACKGROUND LAYER: Always-visible tiled skeleton pattern that shows through
              when real tiles haven't been rendered yet (during fast scroll). Uses CSS repeating
              background to create an infinite grid of card-shaped skeleton placeholders.
              This eliminates blank screen flash completely — the user always sees skeleton cards. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to bottom right, #f1f5f9 0%, #ffffff 40%, #f8fafc 100%)
              `,
              backgroundSize: `${cellW}px ${cellH}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                  linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                `,
                backgroundSize: `${cellW}px ${cellH}px`,
                opacity: 0.3,
              }}
            />
          </div>

          {/* HARDWARE ACCELERATED WORLD LAYER: Translates directly via DOM ref at 120 FPS */}
          <div
            ref={worldRef}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
              willChange: "transform",
            }}
          >
            {visibleTiles.map((tile) => (
              <div
                key={tile.key}
                style={{
                  position: "absolute",
                  left: `${tile.worldX}px`,
                  top: `${tile.worldY}px`,
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  contain: "layout style",
                  contentVisibility: "auto",
                  containIntrinsicSize: `${cardWidth}px ${cardHeight}px`,
                }}
                className="pointer-events-auto rounded-2xl sm:rounded-3xl"
              >
                {tile.isCore ? (
                  <InfinitePresentationCard
                    deck={tile.deck}
                    isSeen={isMobile || seenIds.has(tile.deck.id)}
                    onSeen={handleSeen}
                    onOpen={openDeckModal}
                    onShare={handleShareDeck}
                    onBook={handleOpenBooking}
                    isCopied={copiedDeckId === tile.deck.id}
                    dragDistanceRef={dragDistanceRef}
                  />
                ) : (
                  <PredictiveSkeletonCard deck={tile.deck} onOpen={openDeckModal} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DESKTOP VIEW: CENTER BOTTOM CATEGORY SELECTOR (ZERO SCROLL, NO PROJECT COUNTS) */}
      <div className="hidden sm:flex fixed bottom-5 sm:bottom-6 inset-x-0 justify-center items-center pointer-events-none z-30">
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 px-2 h-11 rounded-full bg-white/90 hover:bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-2xl shadow-slate-900/10 box-border select-none overflow-hidden scrollbar-none [&::-webkit-scrollbar]:hidden shrink-0 transition-all">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`flex items-center justify-center px-3.5 sm:px-4 h-8 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 shrink-0 select-none whitespace-nowrap ${
                  isSelected
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/80"
                }`}
              >
                <span>{cat === "All" ? "All Works" : cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MOBILE VIEW ONLY: REVERSE DROPDOWN (OPENS UPWARD) + BOTTOM "BOOK CALL" CTA DOCK */}
      <div
        ref={categoryMenuRef}
        className="sm:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
      >
        {/* REVERSE DROPDOWN POPOVER (OPENS UPWARDS FROM DOCK TOWARDS TOP) */}
        {isCategoryMenuOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/20 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ring-1 ring-slate-900/5 z-50">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                Filter by Category
              </span>
            </div>

            <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto">
              {CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => {
                      handleCategorySelect(cat);
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`size-1.5 rounded-full shrink-0 ${
                          isSelected ? "bg-cyan-400 animate-pulse" : "bg-slate-300"
                        }`}
                      />
                      <span className="truncate">{cat === "All" ? "All Works" : cat}</span>
                    </div>

                    {isSelected && <Check className="size-3.5 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MOBILE DOCK BAR: Category Reverse Dropdown Button + Book Call CTA Button */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/90 backdrop-blur-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5">
          {/* Category Trigger Button (Opens Reverse Dropdown Upward) */}
          <button
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 select-none ${
              isCategoryMenuOpen
                ? "bg-slate-900 text-white shadow-md ring-1 ring-slate-900"
                : "bg-slate-100/90 hover:bg-slate-200/90 text-slate-800"
            }`}
          >
            <Layers className="size-3.5 text-primary shrink-0" />
            <span className="truncate max-w-[105px]">
              {activeCategory === "All" ? "Categories" : activeCategory}
            </span>
            <ChevronUp
              className={`size-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                isCategoryMenuOpen ? "rotate-180 text-white" : ""
              }`}
            />
          </button>

          <div className="h-5 w-px bg-slate-200" />

          {/* Book Call Button in Bottom Dock (Mobile) */}
          <button
            onClick={() => handleOpenBooking()}
            className="group flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-950 text-white font-semibold text-xs tracking-wide shadow-lg hover:bg-slate-800 active:scale-95 transition-all duration-200 whitespace-nowrap"
          >
            <Calendar className="size-3.5 text-cyan-400 shrink-0" />
            <span>Book Call</span>
            <ArrowUpRight className="size-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </button>
        </div>
      </div>

      {/* FULLSCREEN MINIMAL LIGHTROOM PRESENTATION REVIEWER */}
      {activeDeck && (
        <PresentationLightroomModal
          deck={activeDeck}
          slideIndex={activeSlideIndex}
          onSlideChange={setActiveSlideIndex}
          onClose={closeDeckModal}
          onBook={() => handleOpenBooking(activeDeck)}
          onShare={() => handleShareDeck(activeDeck)}
          isCopied={copiedDeckId === activeDeck.id}
          isAdmin={false}
        />
      )}

      {/* "Book a Call" Consultation Modal */}
      <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
        <DialogContent className="w-[94vw] max-w-md bg-white border border-neutral-200 text-neutral-900 p-5 sm:p-6 shadow-2xl rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-2">
              <img src="/logo.png" alt="Crewvia" className="h-6 w-auto object-contain" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                Crewvia Studio
              </span>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-neutral-950">
              Schedule Presentation Consultation
            </DialogTitle>
            <DialogDescription className="text-neutral-500 text-xs">
              {selectedDeckForBooking
                ? `Discuss crafting a deck inspired by "${selectedDeckForBooking.title}".`
                : "Connect with Crewvia's presentation architects to craft your high-stakes presentation deck."}
            </DialogDescription>
          </DialogHeader>

          {bookingSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                <Check className="size-6" />
              </div>
              <h4 className="text-base font-semibold text-neutral-900">Connecting to WhatsApp...</h4>
              <p className="text-xs text-neutral-500">
                Opening direct line with our Lead Presentation Designer.
              </p>
            </div>
          ) : (
            <form onSubmit={handleBookingSubmit} className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider block mb-1">
                  Your Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider block mb-1">
                    Phone / WhatsApp *
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="+91..."
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider block mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="Brand name"
                    value={bookingCompany}
                    onChange={(e) => setBookingCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider block mb-1">
                  Deck Objective
                </label>
                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                >
                  {PORTFOLIO_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider block mb-1">
                  Notes / Specific Requirements
                </label>
                <textarea
                  rows={2}
                  placeholder="Timeline, number of slides, or key narrative points..."
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  <span>{isSubmittingBooking ? "Connecting..." : "Request Deck Consultation"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleWhatsAppDirect(selectedDeckForBooking)}
                  className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <MessageCircle className="size-3.5 text-emerald-600" />
                  <span>Instant WhatsApp Chat with Designer</span>
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// PREDICTIVE SKELETON CARD: Ultra-lightweight pure placeholder for fast-scroll buffer
// Zero hooks, zero network requests, zero overhead. Eliminates blank screens at 120 FPS.
const PredictiveSkeletonCard = memo(function PredictiveSkeletonCard({
  deck,
  onOpen,
}: {
  deck: PortfolioItem;
  onOpen?: (deck: PortfolioItem, initialSlide: number) => void;
}) {
  return (
    <div
      onClick={() => onOpen?.(deck, 0)}
      style={{
        isolation: "isolate",
      }}
      className={`group relative size-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-md shadow-slate-900/[0.03] border border-slate-200/80 bg-slate-900/90 select-none transition-opacity duration-200 ${
        onOpen ? "cursor-pointer pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Ambient Subtle Shimmer Wave */}
      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.06)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />

      {/* Center Plaque Placeholder */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[11px] font-medium tracking-wide shadow-xs">
          <img src="/logo.png" alt="" className="h-3 w-auto object-contain opacity-75 shrink-0" />
          <span className="truncate max-w-[140px]">{deck.title || "Curating Visuals..."}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 font-semibold mt-1.5">
          {deck.category || "Visual"}
        </span>
      </div>
    </div>
  );
});

// INFINITE PRESENTATION CARD: MEMOIZED FOR 120 FPS FLUIDITY
const InfinitePresentationCard = memo(function InfinitePresentationCard({
  deck,
  isSeen,
  onSeen,
  onOpen,
  onShare,
  onBook,
  isCopied,
  dragDistanceRef,
}: {
  deck: PortfolioItem;
  isSeen: boolean;
  onSeen: (id: string) => void;
  onOpen: (deck: PortfolioItem, initialSlide: number) => void;
  onShare: (deck: PortfolioItem, e?: React.MouseEvent) => void;
  onBook: (deck?: PortfolioItem | null, e?: React.MouseEvent) => void;
  isCopied: boolean;
  dragDistanceRef: React.RefObject<number>;
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize display slides (ensures cover or slide list is always populated)
  const displaySlides = useMemo(() => {
    if (deck.slides && deck.slides.length > 0) {
      return deck.slides;
    }
    if (deck.cover_image_url) {
      return [{ id: "cover", slide_number: 1, preview_url: deck.cover_image_url }];
    }
    return [];
  }, [deck.slides, deck.cover_image_url]);

  const totalSlides = displaySlides.length || deck.slide_count || 1;

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsImageLoaded(true);
    } else {
      setIsImageLoaded(false);
    }
  }, [displaySlides]);

  // On-Demand Hover Preloader: ONLY preload the next slide if user is actively hovering over this card!
  // Never aggressively download all 10-20 slides for inactive background cards (prevents network choke on 30-60MB decks)
  useEffect(() => {
    if (!isHovered || totalSlides <= 1) return;
    const nextIdx = (currentSlideIndex + 1) % totalSlides;
    const nextSlide = displaySlides[nextIdx];
    if (nextSlide?.preview_url) {
      const img = new Image();
      img.decoding = "async";
      img.src = nextSlide.preview_url;
    }
  }, [isHovered, currentSlideIndex, displaySlides, totalSlides]);

  // 1.5-second (1500ms) automatic slide scrubber on hover with smooth sliding animation
  useEffect(() => {
    if (isHovered && totalSlides > 1) {
      autoScrollTimerRef.current = setInterval(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % totalSlides);
      }, 1500);
    } else {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    }

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, [isHovered, totalSlides]);

  // View count state with optimistic live increment
  const [viewCount, setViewCount] = useState(deck.view_count || 0);

  useEffect(() => {
    setViewCount(deck.view_count || 0);
  }, [deck.view_count]);

  // Client likes state with optimistic updates & local tracking
  const [isLiked, setIsLiked] = useState(() => getClientLikedDeckIds().has(deck.id));
  const [likeCount, setLikeCount] = useState(deck.like_count || 0);

  useEffect(() => {
    setLikeCount(deck.like_count || 0);
  }, [deck.like_count]);

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    await togglePortfolioLike(deck.id, nextLiked);
  };

  const isSkeleton = deck.id.startsWith("skel-");
  const showRealContent = !isSkeleton && (displaySlides.length > 0 || Boolean(deck.cover_image_url));

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  };

  // Ultra-Accurate Single-Click & Touch-Tap Mechanism (0ms instant response)
  const pointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastOpenTimeRef = useRef<number>(0);

  const triggerOpen = useCallback(() => {
    if (isSkeleton) return;
    const now = performance.now();
    // Prevent duplicate triggers if pointerup and synthetic click both fire within 350ms
    if (now - lastOpenTimeRef.current < 350) return;
    lastOpenTimeRef.current = now;

    setViewCount((prev) => prev + 1);
    onOpen(deck, currentSlideIndex);
  }, [isSkeleton, deck, currentSlideIndex, onOpen]);

  const handleCardPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerDownPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPosRef.current) return;
    const start = pointerDownPosRef.current;
    pointerDownPosRef.current = null;

    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - start.time;

    // A deliberate single tap or mouse click has < 16px displacement and < 500ms press duration
    if (dist < 16 && dt < 500) {
      triggerOpen();
    }
  };

  // Card Tap / Click: Open the preview modal INSTANTLY (0ms latency)
  const handleCardClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSkeleton) return;
    const dist = dragDistanceRef.current || 0;
    if (dist < 16) {
      triggerOpen();
    }
  };

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        if (!isSeen && !isSkeleton) onSeen(deck.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrentSlideIndex(0);
      }}
      onPointerDown={handleCardPointerDown}
      onPointerUp={handleCardPointerUp}
      onClick={handleCardClick}
      style={{
        isolation: "isolate",
        WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        maskImage: "radial-gradient(white, black)",
      }}
      className={`group relative size-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg shadow-slate-900/[0.04] border border-slate-200/90 bg-slate-950 transition-all duration-200 select-none ${
        isSkeleton
          ? "cursor-default"
          : "cursor-pointer hover:border-slate-400/60 hover:shadow-xl hover:shadow-slate-900/10"
      }`}
    >
      {/* 1. LAYER 0: SKELETON CANVAS (ONLY for skeleton decks while data is loading) */}
      {isSkeleton && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-50 via-white to-slate-100/90 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none pointer-events-none transition-all duration-300 overflow-hidden z-0">
          {/* Ambient Subtle Shimmer (Clean light flow) */}
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.85)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />

          {/* Clean Center Plaque / Watermark */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/[0.04] border border-slate-300/50 text-slate-700 text-[11px] font-medium tracking-wide shadow-xs">
            <img src="/logo.png" alt="" className="h-3 w-auto object-contain opacity-75 shrink-0" />
            <span>Curating Visuals...</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mt-1.5">
            {deck.category || "Visual"}
          </span>
        </div>
      )}

      {/* 2. LAYER 1: HIGH-RESOLUTION SLIDES (RESTING SINGLE-COVER OR ACTIVE HOVER TRACK) */}
      {/* Fitted without cropping (object-contain in 16:9 frame) and smoothly animates across slides */}
      {displaySlides.length > 0 && showRealContent ? (
        <div
          className={`absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-slate-950 overflow-hidden transform-gpu pointer-events-none transition-all duration-300 z-0 ${
            !isSeen ? "blur-lg scale-105 brightness-95" : "blur-0 brightness-100"
          }`}
        >
          {/* SKELETON BASE LAYER: Visible immediately while image is downloading/decoding */}
          {!isImageLoaded && (
            <div className="absolute inset-0 size-full bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none z-0">
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.06)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer" />
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[11px] font-medium tracking-wide">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="truncate max-w-[130px]">{deck.title}</span>
              </div>
            </div>
          )}

          {!isHovered ? (
            /* RESTING STATE: Single high-performance cover slide image (saves 95% DOM & memory for 30-60MB decks) */
            <div className="size-full flex items-center justify-center bg-slate-950 overflow-hidden">
              <img
                ref={imgRef}
                src={displaySlides[0]?.preview_url}
                alt={deck.title}
                decoding="async"
                draggable={false}
                onLoad={() => setIsImageLoaded(true)}
                onError={() => setIsImageLoaded(true)}
                className={`size-full object-contain pointer-events-none select-none transition-opacity duration-300 ${
                  isImageLoaded ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
              />
            </div>
          ) : (
            /* HOVER SCRUBBER: Sliding track mounted on-demand only while actively hovering */
            <div
              className="flex size-full transition-transform duration-700 ease-out will-change-transform"
              style={{
                transform: `translate3d(-${currentSlideIndex * 100}%, 0, 0)`,
              }}
            >
              {displaySlides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className="size-full shrink-0 flex items-center justify-center bg-slate-950 overflow-hidden"
                >
                  <img
                    src={slide.preview_url}
                    alt={`${deck.title} slide ${idx + 1}`}
                    decoding="async"
                    draggable={false}
                    className="size-full object-contain pointer-events-none select-none"
                    loading={Math.abs(idx - currentSlideIndex) <= 1 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 3. LAYER 2: UNSEEN FROSTED GLASS & CENTER WATERMARK */}
      {!isSkeleton && !isSeen && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-white/60 backdrop-blur-[3px] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none transition-all duration-300 pointer-events-none z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/[0.04] border border-slate-300/50 text-slate-700 text-[11px] font-medium tracking-wide shadow-xs">
            <img src="/logo.png" alt="" className="h-3 w-auto object-contain opacity-75 shrink-0" />
            <span>Hover to see</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold mt-1.5">
            {deck.category || "Visual"}
          </span>
        </div>
      )}

      {/* Top-Right Slide Progress Pill (Syncs with 1.5s auto-scroll) */}
      {showRealContent && totalSlides > 1 && (
        <div
          className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/20 text-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handlePrevSlide}
            title="Previous slide"
            className="size-4.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors active:scale-90"
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="text-[10px] font-mono font-medium px-1 tracking-wider text-slate-100">
            {currentSlideIndex + 1} / {totalSlides}
          </span>
          <button
            onClick={handleNextSlide}
            title="Next slide"
            className="size-4.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors active:scale-90"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      )}

      {/* STATE 2: SEEN OVERLAY (Clean resting state with title & category) */}
      {showRealContent && isSeen && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl flex flex-col justify-end p-3.5 sm:p-5 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent group-hover:opacity-0 transition-opacity duration-300 pointer-events-none z-10">
          <div className="w-full min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-400">
              {deck.category}
            </span>
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight line-clamp-1 mt-0.5 drop-shadow-md">
              {deck.title}
            </h3>
          </div>
        </div>
      )}

      {/* STATE 3: DARK FADE BOTTOM DOCK ON HOVER (NO WHITE BLUR, 4 DATA POINTS ONLY) */}
      {showRealContent && isSeen && (
        <div
          className="absolute bottom-0 inset-x-0 z-20 pt-12 pb-3 px-3 sm:px-4 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            triggerOpen();
          }}
        >
          {/* Left Group: Copy link, Views count, Likes count */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 1. Copy Link Icon Button */}
            <button
              onClick={(e) => onShare(deck, e)}
              title={isCopied ? "Link copied!" : "Copy presentation link"}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md backdrop-blur-sm"
            >
              {isCopied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5 text-white/90" />
              )}
            </button>

            {/* 2. View Count Pill */}
            <div
              title={`${viewCount} total client views`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold text-white select-none shadow-md backdrop-blur-sm"
            >
              <Eye className="size-3.5 text-cyan-400 shrink-0" />
              <span>{formatCompactNumber(viewCount)}</span>
            </div>

            {/* 3. Like Button & Count Pill */}
            <button
              onClick={handleLikeToggle}
              title={isLiked ? "Unlike presentation" : "Like presentation"}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-md backdrop-blur-sm select-none",
                isLiked
                  ? "bg-rose-500/25 border-rose-500/50 text-rose-300"
                  : "bg-white/10 hover:bg-rose-500/15 border-white/20 hover:border-rose-400/40 text-white hover:text-rose-300"
              )}
            >
              <Heart
                className={cn(
                  "size-3.5 transition-colors shrink-0",
                  isLiked ? "fill-rose-500 text-rose-500 animate-pulse" : "text-white/80"
                )}
              />
              <span>{formatCompactNumber(likeCount)}</span>
            </button>
          </div>

          {/* Right Group: Circular Open Deck Button with Upward Arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerOpen();
            }}
            title="Open presentation deck"
            className="size-8 sm:size-8.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all shrink-0"
          >
            <ArrowUpRight className="size-4 text-slate-950 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
});
