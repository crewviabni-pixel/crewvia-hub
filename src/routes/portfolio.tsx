import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import {
  fetchPublishedPortfolioItems,
  incrementPortfolioViews,
  type PortfolioItem,
} from "@/lib/portfolio-api";
import { PORTFOLIO_CATEGORIES } from "@/lib/portfolio-sample-decks";
import { PresentationLightroomModal } from "@/components/PresentationLightroomModal";
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
  }),
  component: PublicPortfolioShowcasePage,
});

const CATEGORIES = ["All", ...PORTFOLIO_CATEGORIES] as const;
type CategoryType = (typeof CATEGORIES)[number];

const CREWVIA_TEAM_WHATSAPP = "917223804653";

// Default Desktop Tile Geometry fallback constants
// const DEFAULT_CARD_WIDTH = 460;
// const DEFAULT_CARD_HEIGHT = 280;

// Selected Standard Light Skeleton Geometry & Constants
const DEFAULT_CARD_WIDTH = 460;
const DEFAULT_CARD_HEIGHT = 280;

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
  const navigate = useNavigate();

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

  // Responsive Card & Grid Dimensions
  const isMobile = viewport.w < 640;
  const isTablet = viewport.w >= 640 && viewport.w < 1024;
  const cardWidth = isMobile
    ? Math.min(340, Math.max(260, viewport.w - 32))
    : isTablet
    ? 390
    : DEFAULT_CARD_WIDTH;
  const cardHeight = Math.round(cardWidth * (DEFAULT_CARD_HEIGHT / DEFAULT_CARD_WIDTH));
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

  // Fog-of-War Discovery State: revealed on hover and persists for session
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());

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

  // Handle direct deep-link parameter ?deck=<id>
  useEffect(() => {
    if (search.deck && portfolioItems.length > 0) {
      const found = portfolioItems.find((item) => item.id === search.deck);
      if (found) {
        setActiveDeck(found);
        setActiveSlideIndex(0);
        incrementPortfolioViews(found.id);
        setDiscoveredIds((prev) => new Set(prev).add(found.id));
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

  const openDeckModal = useCallback((deck: PortfolioItem, initialSlideIndex = 0) => {
    setActiveDeck(deck);
    setActiveSlideIndex(initialSlideIndex);
    incrementPortfolioViews(deck.id);
    setDiscoveredIds((prev) => new Set(prev).add(deck.id));

    navigate({
      search: (prev) => ({ ...prev, deck: deck.id }),
      replace: true,
    });
  }, [navigate]);

  const closeDeckModal = useCallback(() => {
    setActiveDeck(null);
    navigate({
      search: (prev) => ({ ...prev, deck: undefined }),
      replace: true,
    });
  }, [navigate]);

  const handleDiscover = useCallback((deckId: string) => {
    setDiscoveredIds((prev) => {
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
      search: (prev) => ({
        ...prev,
        cat: category === "All" ? undefined : category.toLowerCase().replace(/\s+/g, "-"),
      }),
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

  // Sync virtual tiling anchor origin only when motion settles or threshold is crossed
  const checkGridOriginSync = useCallback(() => {
    const dx = Math.abs(posRef.current.x - lastGridCenterRef.current.x);
    const dy = Math.abs(posRef.current.y - lastGridCenterRef.current.y);
    if (dx > cellW || dy > cellH) {
      lastGridCenterRef.current = { ...posRef.current };
      setGridOrigin({ ...posRef.current });
    }
  }, [cellW, cellH]);

  // Natural kinetic momentum decay in requestAnimationFrame (0.95 friction for buttery glide)
  const startMomentum = useCallback(() => {
    const friction = 0.95;
    const minVelocity = 0.15;

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

      animFrameRef.current = requestAnimationFrame(step);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  }, [applyTransformDirect, checkGridOriginSync]);

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

      // Continuous long drag safety sync
      const displacementX = Math.abs(nextX - lastGridCenterRef.current.x);
      const displacementY = Math.abs(nextY - lastGridCenterRef.current.y);
      if (displacementX > cellW * 2.5 || displacementY > cellH * 2.5) {
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
      if (timeSinceLastMove > 80 || dragDistanceRef.current < 6) {
        velocityRef.current = { vx: 0, vy: 0 };
        checkGridOriginSync();
      } else {
        const maxVel = 45;
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
  }, [applyTransformDirect, checkGridOriginSync, startMomentum, activeDeck, isBookModalOpen]);

  // High-Performance Native Wheel & Trackpad Listener (Passive: false to prevent gesture collision)
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

      // Debounced anchor sync when wheel stops
      if (wheelDebounceTimerRef.current) clearTimeout(wheelDebounceTimerRef.current);
      wheelDebounceTimerRef.current = setTimeout(() => {
        checkGridOriginSync();
      }, 120);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelDebounceTimerRef.current) clearTimeout(wheelDebounceTimerRef.current);
    };
  }, [applyTransformDirect, checkGridOriginSync]);

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

  // Virtual Tiling: Generates a generous 1.5-tile buffer beyond viewport in all directions
  // Recomputes ONLY when anchor shifts, NOT on every frame or pixel!
  const visibleTiles = useMemo(() => {
    if (filteredItems.length === 0) return [];

    const bufferX = cellW * 1.5;
    const bufferY = cellH * 1.5;

    const minCol = Math.floor((-gridOrigin.x - bufferX) / cellW) - 1;
    const maxCol = Math.ceil((viewport.w - gridOrigin.x + bufferX) / cellW) + 1;
    const minRow = Math.floor((-gridOrigin.y - bufferY) / cellH) - 1;
    const maxRow = Math.ceil((viewport.h - gridOrigin.y + bufferY) / cellH) + 1;

    const tiles = [];
    const total = filteredItems.length;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const positiveMod = (n: number, m: number) => ((n % m) + m) % m;
        const itemIdx = positiveMod(r * 3 + c, total);
        const deck = filteredItems[itemIdx];

        // Alternating row offset for elegant staggered layout
        const rowShift = r % 2 !== 0 ? cellW / 2 : 0;
        const worldX = c * cellW + rowShift;
        const worldY = r * cellH;

        tiles.push({
          key: `tile-${r}-${c}`,
          deck,
          r,
          c,
          worldX,
          worldY,
        });
      }
    }
    return tiles;
  }, [gridOrigin.x, gridOrigin.y, viewport.w, viewport.h, filteredItems, cellW, cellH]);

  const totalWorks = portfolioItems.length;
  const discoveredCount = discoveredIds.size;

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

        {/* Center: Discovery Explorer Counter Pill (Exempt from strict height rule as requested) */}
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
                Discovered <span className="text-slate-950 font-bold">{discoveredCount}</span> of{" "}
                {totalWorks} Works
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal text-[11px] flex items-center gap-1">
                <Compass className="size-3 text-primary" />
                Drag canvas to explore
              </span>
              {discoveredCount >= totalWorks && totalWorks > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  All Unlocked!
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
                <InfinitePresentationCard
                  deck={tile.deck}
                  isDiscovered={isMobile || discoveredIds.has(tile.deck.id)}
                  onDiscover={handleDiscover}
                  onOpen={openDeckModal}
                  onShare={handleShareDeck}
                  onBook={handleOpenBooking}
                  isCopied={copiedDeckId === tile.deck.id}
                  dragDistanceRef={dragDistanceRef}
                />
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

// INFINITE PRESENTATION CARD: MEMOIZED FOR 120 FPS FLUIDITY
const InfinitePresentationCard = memo(function InfinitePresentationCard({
  deck,
  isDiscovered,
  onDiscover,
  onOpen,
  onShare,
  onBook,
  isCopied,
  dragDistanceRef,
}: {
  deck: PortfolioItem;
  isDiscovered: boolean;
  onDiscover: (id: string) => void;
  onOpen: (deck: PortfolioItem, initialSlide: number) => void;
  onShare: (deck: PortfolioItem, e?: React.MouseEvent) => void;
  onBook: (deck?: PortfolioItem | null, e?: React.MouseEvent) => void;
  isCopied: boolean;
  dragDistanceRef: React.RefObject<number>;
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const slides = deck.slides && deck.slides.length > 0 ? deck.slides : [];
  const totalSlides = slides.length || deck.slide_count || 1;

  const currentSlideUrl =
    slides[currentSlideIndex]?.preview_url || deck.cover_image_url;

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsImageLoaded(true);
    } else {
      setIsImageLoaded(false);
    }
  }, [currentSlideUrl]);

  const isSkeleton = deck.id.startsWith("skel-") || !currentSlideUrl;
  const showRealContent = !isSkeleton && isImageLoaded;

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  };

  const handleCardClick = () => {
    if (isSkeleton) return;
    if (!dragDistanceRef.current || dragDistanceRef.current < 6) {
      onOpen(deck, currentSlideIndex);
    }
  };

  return (
    <div
      onMouseEnter={() => {
        if (!isDiscovered && !isSkeleton) onDiscover(deck.id);
      }}
      onClick={handleCardClick}
      style={{
        isolation: "isolate",
        WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        maskImage: "radial-gradient(white, black)",
      }}
      className={`group relative size-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg shadow-slate-900/[0.04] border border-slate-200/90 bg-white transition-all duration-200 select-none ${
        isSkeleton
          ? "cursor-default"
          : "cursor-pointer hover:border-slate-400/60 hover:shadow-xl hover:shadow-slate-900/10"
      }`}
    >
      {/* 1. LAYER 0: SELECTED STANDARD LIGHT SKELETON CANVAS */}
      {/* Uniform, clean, light, and fully responsive across mobile, tablet, and desktop */}
      <div
        className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-50 via-white to-slate-100/90 p-3.5 sm:p-5 md:p-6 flex flex-col justify-between overflow-hidden select-none pointer-events-none transition-all duration-500"
      >
        {/* Soft Radial Ambient Aura Glow */}
        <div className="absolute -top-12 -right-12 size-48 sm:size-64 rounded-full pointer-events-none blur-3xl opacity-40 bg-sky-200/40" />
        <div className="absolute -bottom-12 -left-12 size-48 sm:size-64 rounded-full pointer-events-none blur-3xl opacity-30 bg-indigo-100/50" />

        {/* Ambient Subtle Shimmer (Clean Light Flow) */}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.85)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />

        {/* Top Eyebrow / Slide Header Wireframe */}
        <div className="relative z-0 flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-3 sm:h-3.5 w-14 sm:w-20 rounded-full bg-slate-200/90 animate-pulse" />
            <div className="h-2.5 sm:h-3 w-16 sm:w-24 rounded-full bg-slate-200/60 hidden xs:block sm:block" />
          </div>
          <div className="h-3 sm:h-3.5 w-10 sm:w-14 rounded-full bg-slate-200/70" />
        </div>

        {/* Center Presentation Graphic Composition (Fluid & Responsive without fixed vertical overflow) */}
        <div className="relative z-0 my-auto w-full grid grid-cols-12 gap-2.5 sm:gap-4 items-center">
          {/* Main Visual Slide Hero Card */}
          <div className="col-span-7 space-y-1.5 sm:space-y-2.5">
            <div className="h-3.5 sm:h-5 w-4/5 rounded-md sm:rounded-lg bg-slate-300/80" />
            <div className="h-2 sm:h-3 w-3/5 rounded bg-slate-200/80" />
            <div className="h-2 sm:h-3 w-2/3 rounded bg-slate-200/60" />
            <div className="pt-1 sm:pt-2 flex items-center gap-1.5 sm:gap-2">
              <div className="h-3.5 sm:h-5 w-12 sm:w-16 rounded-full bg-slate-200/80" />
              <div className="h-3.5 sm:h-5 w-14 sm:w-20 rounded-full bg-slate-200/70" />
            </div>
          </div>

          {/* Right Geometric Diagram / Mockup Card */}
          <div className="col-span-5 h-16 sm:h-22 md:h-24 rounded-lg sm:rounded-xl bg-slate-100/90 border border-slate-200/80 p-2 sm:p-2.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <div className="size-2 sm:size-2.5 rounded-full bg-slate-300/80" />
              <div className="h-1.5 sm:h-2 w-6 sm:w-8 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="h-1.5 sm:h-2 w-full rounded bg-slate-200/80" />
              <div className="h-1.5 sm:h-2 w-3/4 rounded bg-slate-200/70" />
            </div>
            <div className="h-3.5 sm:h-4.5 w-full rounded-md bg-slate-200/60 flex items-center justify-center">
              <div className="h-1.5 w-8 sm:w-12 rounded-full bg-slate-300/70" />
            </div>
          </div>
        </div>

        {/* Bottom Slide Footer Line */}
        <div className="relative z-0 flex items-center justify-between w-full pt-1.5 sm:pt-2 border-t border-slate-200/70">
          <div className="h-2 sm:h-2.5 w-16 sm:w-22 rounded-full bg-slate-200/80" />
          <div className="h-2 sm:h-2.5 w-12 sm:w-16 rounded-full bg-slate-200/70" />
        </div>
      </div>

      {/* 2. LAYER 1: HIGH-RESOLUTION PRESENTATION SLIDE COVER IMAGE */}
      {/* Smoothly cross-fades over the light skeleton canvas with 600ms ease-out */}
      {currentSlideUrl ? (
        <img
          ref={imgRef}
          src={currentSlideUrl}
          alt={deck.title}
          decoding="async"
          draggable={false}
          onLoad={() => setIsImageLoaded(true)}
          onError={() => setIsImageLoaded(true)}
          className={`absolute inset-0 size-full rounded-2xl sm:rounded-3xl object-cover transform-gpu pointer-events-none transition-all duration-600 ease-out ${
            isImageLoaded ? "opacity-100" : "opacity-0"
          } ${
            !isDiscovered
              ? "blur-lg scale-105 brightness-95"
              : "blur-0 brightness-100 group-hover:blur-md group-hover:scale-105 group-hover:brightness-[0.45]"
          }`}
          loading="lazy"
        />
      ) : null}

      {/* 3. LAYER 2: UNDISCOVERED FROSTED GLASS & CENTER WATERMARK */}
      {!isSkeleton && !isDiscovered && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-white/60 backdrop-blur-[3px] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none transition-all duration-300 pointer-events-none z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/[0.04] border border-slate-300/50 text-slate-700 text-[11px] font-medium tracking-wide shadow-xs">
            <img src="/logo.png" alt="" className="h-3 w-auto object-contain opacity-75 shrink-0" />
            <span>Hover to discover</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold mt-1.5">
            {deck.category || "Visual"}
          </span>
        </div>
      )}

      {/* STATE 2: DISCOVERED OVERLAY (Visible when resting over loaded presentation image) */}
      {showRealContent && isDiscovered && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl flex flex-col justify-between p-3.5 sm:p-5 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent group-hover:opacity-0 transition-opacity duration-300 pointer-events-none z-10">
          {/* Top Row: Slide Counter Only */}
          <div className="flex items-center justify-end">
            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/60 border border-white/15 text-[9px] sm:text-[10px] font-mono tracking-wider text-white">
              {currentSlideIndex + 1} / {totalSlides}
            </div>
          </div>

          {/* Bottom Bar: Title & Client Info (Left) + Discovered Badge (Right) */}
          <div className="flex items-end justify-between gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[9px] sm:text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-400">
                {deck.category}
              </span>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight line-clamp-1 mt-0.5 drop-shadow-md">
                {deck.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-white/80 line-clamp-1 mt-0.5 drop-shadow">
                {deck.client_name || "Client Presentation"}
              </p>
            </div>

            {/* Discovered Badge */}
            <div className="shrink-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] sm:text-[10px] font-mono font-semibold text-emerald-300 flex items-center gap-1 sm:gap-1.5 shadow-md">
              <Check className="size-2.5 sm:size-3 text-emerald-400" />
              <span>Discovered</span>
            </div>
          </div>
        </div>
      )}

      {/* STATE 3: DISCOVERED HOVER OVERLAY - MODERN LUXURY STUDIO DESIGN */}
      {showRealContent && isDiscovered && (
        <div className="absolute inset-0 size-full rounded-2xl sm:rounded-3xl bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/60 p-3.5 sm:p-5 md:p-6 flex flex-col justify-between text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-20">
          {/* Top Row: Category badge & Unified Sleek Slide Flipper */}
          <div className="flex items-center justify-between">
            <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/15 text-[10px] sm:text-[11px] font-semibold text-white border border-white/20 tracking-wide shadow-sm flex items-center gap-1 sm:gap-1.5">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {deck.category}
            </span>

            {/* Quick in-card slide navigator pill */}
            {totalSlides > 1 ? (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-white shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handlePrevSlide}
                  title="Previous slide"
                  className="size-5 sm:size-6 rounded-full hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors active:scale-90"
                >
                  <ChevronLeft className="size-3 sm:size-3.5" />
                </button>
                <span className="text-[9px] sm:text-[10px] font-mono font-medium px-1 sm:px-1.5 tracking-wider text-slate-200">
                  {currentSlideIndex + 1} / {totalSlides}
                </span>
                <button
                  onClick={handleNextSlide}
                  title="Next slide"
                  className="size-5 sm:size-6 rounded-full hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors active:scale-90"
                >
                  <ChevronRight className="size-3 sm:size-3.5" />
                </button>
              </div>
            ) : (
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/50 text-[9px] sm:text-[10px] font-mono text-slate-300 border border-white/10 shadow-sm">
                1 Slide
              </span>
            )}
          </div>

          {/* Center Section: Clean Typography Hero */}
          <div className="my-auto space-y-1 sm:space-y-1.5">
            {deck.client_name && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-400 px-1.5 sm:px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30">
                  {deck.client_name}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-slate-400">• Presentation</span>
              </div>
            )}

            <h3 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight leading-snug line-clamp-1 drop-shadow-md">
              {deck.title}
            </h3>

            {deck.tagline ? (
              <p className="text-[11px] sm:text-xs text-slate-300 font-normal line-clamp-1 sm:line-clamp-2 leading-relaxed drop-shadow">
                {deck.tagline}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-slate-400 font-normal line-clamp-1">
                Curated high-stakes presentation crafted by Crewvia Studio.
              </p>
            )}

            {deck.metrics && deck.metrics.length > 0 && (
              <div className="pt-0.5 sm:pt-1 flex flex-wrap gap-1 sm:gap-1.5">
                {deck.metrics.slice(0, 3).map((metric, mIdx) => (
                  <span
                    key={mIdx}
                    className="px-2 sm:px-2.5 py-0.5 rounded-full bg-white/10 text-[9px] sm:text-[10px] font-mono font-medium text-slate-200 border border-white/15 shadow-sm"
                  >
                    {metric}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Row: Actions */}
          <div
            className="pt-2 sm:pt-3 border-t border-white/15 flex items-center justify-between gap-1.5 sm:gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={(e) => onShare(deck, e)}
                title="Copy direct presentation link"
                className="size-8 sm:size-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                {isCopied ? <Check className="size-3 sm:size-3.5 text-emerald-400" /> : <Share2 className="size-3 sm:size-3.5" />}
              </button>

              <button
                onClick={(e) => onBook(deck, e)}
                title="Book presentation consultation"
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] sm:text-xs font-semibold tracking-wide transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                Book Style
              </button>
            </div>

            <button
              onClick={() => onOpen(deck, currentSlideIndex)}
              className="group/cta inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 font-bold text-[11px] sm:text-xs tracking-wide shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <span>Review Deck</span>
              <ArrowUpRight className="size-3 sm:size-3.5 text-slate-700 group-hover/cta:text-slate-950 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
