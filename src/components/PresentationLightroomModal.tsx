import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Check,
  X,
  Maximize2,
  Minimize2,
  Download,
  Edit2,
  ArrowUpRight,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Smartphone,
  Eye,
  Heart,
} from "lucide-react";
import type { PortfolioItem, PortfolioSlide } from "@/lib/portfolio-sample-decks";
import { extractSlidesFromPdf } from "@/lib/presentation-uploader";
import {
  updatePortfolioItem,
  togglePortfolioLike,
  getClientLikedDeckIds,
  formatCompactNumber,
} from "@/lib/portfolio-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PresentationLightroomModalProps {
  deck: PortfolioItem;
  initialSlideIndex?: number;
  slideIndex?: number;
  onSlideChange?: (index: number) => void;
  onClose: () => void;
  onShare?: () => void;
  onBook?: () => void;
  onEdit?: () => void;
  isCopied?: boolean;
  isAdmin?: boolean;
}

export function PresentationLightroomModal({
  deck,
  initialSlideIndex = 0,
  slideIndex: controlledIndex,
  onSlideChange,
  onClose,
  onShare,
  onBook,
  onEdit,
  isCopied = false,
  isAdmin = false,
}: PresentationLightroomModalProps) {
  const [internalIndex, setInternalIndex] = useState(initialSlideIndex);
  const activeSlideIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  // Active slides state with auto-recovery for complete slide decks (e.g., 3+ slides)
  const [activeSlides, setActiveSlides] = useState<PortfolioSlide[]>(() => {
    if (deck.slides && deck.slides.length > 0) return deck.slides;
    return [
      {
        id: `slide-cover-${deck.id}`,
        slide_number: 1,
        title: deck.title,
        preview_url: deck.cover_image_url,
      },
    ];
  });

  // Keep slides in sync if parent deck updates
  useEffect(() => {
    if (deck.slides && deck.slides.length > 0) {
      setActiveSlides(deck.slides);
    }
  }, [deck.slides]);

  // Auto-recovery: If deck has a PDF URL and loaded slides count is less than expected (e.g. 3 slides in PDF),
  // extract full slide sequence from PDF and persist back to database/storage so all slides show permanently.
  useEffect(() => {
    const expected = Math.max(deck.slide_count || 1, 3);
    if (deck.pdf_url && activeSlides.length < expected) {
      extractSlidesFromPdf(deck.pdf_url)
        .then((result) => {
          if (result.slides && result.slides.length > activeSlides.length) {
            setActiveSlides(result.slides);
            updatePortfolioItem(deck.id, {
              slides: result.slides,
              slide_count: result.slides.length,
            }).catch(console.warn);
          }
        })
        .catch(console.warn);
    }
  }, [deck.id, deck.pdf_url, deck.slide_count, activeSlides.length]);

  const totalSlides = activeSlides.length;
  const currentSlide = activeSlides[activeSlideIndex] ?? activeSlides[0] ?? {
    id: `slide-${deck.id}`,
    slide_number: 1,
    title: deck.title,
    preview_url: deck.cover_image_url || "",
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [rotation, setRotation] = useState<0 | 90>(0);
  const [localCopied, setLocalCopied] = useState(false);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isNativeLandscape, setIsNativeLandscape] = useState(false);
  const [imgAspectRatio, setImgAspectRatio] = useState<number>(16 / 9);
  const [isSlideLoaded, setIsSlideLoaded] = useState(() => {
    return Boolean(deck.slides?.[0]?.preview_url || deck.cover_image_url);
  });
  const slideImgRef = useRef<HTMLImageElement>(null);

  // Client Like and View tracking state
  const [isLiked, setIsLiked] = useState(() => getClientLikedDeckIds().has(deck.id));
  const [likeCount, setLikeCount] = useState(deck.like_count || 0);
  const [viewCount, setViewCount] = useState(deck.view_count || 0);

  useEffect(() => {
    setIsLiked(getClientLikedDeckIds().has(deck.id));
    setLikeCount(deck.like_count || 0);
    setViewCount(deck.view_count || 0);
  }, [deck.id, deck.like_count, deck.view_count]);

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    await togglePortfolioLike(deck.id, nextLiked);
  };

  useEffect(() => {
    if (slideImgRef.current && (slideImgRef.current.complete || slideImgRef.current.naturalWidth > 0)) {
      setIsSlideLoaded(true);
    }
  }, [currentSlide.preview_url]);

  const [screenSize, setScreenSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 400,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);

  // Monitor physical phone screen size and orientation changes
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScreenSize({ w, h });
      const isLandscape = w > h;
      setIsNativeLandscape(isLandscape);
      // If user physically turns device into landscape, reset virtual rotation to 0 so it doesn't double-rotate
      if (isLandscape) {
        setRotation(0);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Prevent background scrolling / body gestures while presentation modal is active
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    const origTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = origOverflow;
      document.body.style.touchAction = origTouchAction;
    };
  }, []);

  const setIndex = useCallback(
    (newIndex: number) => {
      setIsZoomed(false);
      setTouchOffset(0);
      if (onSlideChange) {
        onSlideChange(newIndex);
      } else {
        setInternalIndex(newIndex);
      }
    },
    [onSlideChange]
  );

  const handleNext = useCallback(() => {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {
      // ignore
    }
    setIndex(activeSlideIndex < totalSlides - 1 ? activeSlideIndex + 1 : 0);
  }, [activeSlideIndex, totalSlides, setIndex]);

  const handlePrev = useCallback(() => {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {
      // ignore
    }
    setIndex(activeSlideIndex > 0 ? activeSlideIndex - 1 : totalSlides - 1);
  }, [activeSlideIndex, totalSlides, setIndex]);

  // Toggle between Normal Portrait View (0°) and Landscape Widescreen Angle View (90°)
  // Prevents upside-down 180° rotation on any device
  const handleToggleOrientation = useCallback(() => {
    setRotation((prev) => (prev === 0 ? 90 : 0));
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch {
      // ignore
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "r" || e.key === "R") {
        handleToggleOrientation();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, handleToggleOrientation, onClose]);

  // Mobile Touch Gestures: Horizontal Swipe & Pull-down to Dismiss (isolated from background)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (touch && e.touches.length === 1) {
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      touchStartTimeRef.current = performance.now();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (isZoomed || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - touchStartYRef.current;

    // Apply interactive drag resistance only when in normal orientation
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && totalSlides > 1 && rotation === 0) {
      setTouchOffset(deltaX * 0.35);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    const elapsedTime = performance.now() - touchStartTimeRef.current;

    setTouchOffset(0);

    // Swipe gestures
    if (!isZoomed) {
      if (rotation === 90) {
        // In 90° rotated mode, horizontal slide navigation corresponds to vertical finger swipe
        if (deltaY < -35) {
          handleNext();
        } else if (deltaY > 35) {
          handlePrev();
        }
      } else {
        // Swipe down to dismiss (strong downward pull when in normal orientation)
        if (rotation === 0 && deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
          onClose();
          return;
        }

        const isFlick = elapsedTime < 250 && Math.abs(deltaX) > 25;
        if ((Math.abs(deltaX) > 38 || isFlick) && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          if (deltaX < 0) {
            handleNext();
          } else {
            handlePrev();
          }
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Double-tap to zoom toggle on mobile/desktop
  const handleSlideTap = (e: React.MouseEvent) => {
    const now = performance.now();
    const timeSinceLast = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (timeSinceLast < 300) {
      e.stopPropagation();
      setIsZoomed((prev) => !prev);
    }
  };

  // Native Web Share API on mobile with clipboard copy fallback
  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.href;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: deck.title,
          text: `Explore presentation: "${deck.title}" by Crewvia Studio`,
          url,
        });
        return;
      } catch {
        // User dismissed native share sheet, ignore
      }
    }

    if (onShare) {
      onShare();
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setLocalCopied(true);
        toast.success("Presentation link copied to clipboard!");
        setTimeout(() => setLocalCopied(false), 2500);
      });
    }
  };

  // Download PDF or Slide Asset
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deck.pdf_url) {
      window.open(deck.pdf_url, "_blank");
      toast.success("Opening presentation PDF...");
      return;
    }

    if (currentSlide.preview_url) {
      try {
        toast.info("Downloading slide image...");
        const response = await fetch(currentSlide.preview_url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        const cleanTitle = (deck.title || "presentation").toLowerCase().replace(/[^a-z0-9]/g, "-");
        a.download = `${cleanTitle}-slide-${activeSlideIndex + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success("Slide image downloaded!");
      } catch {
        window.open(currentSlide.preview_url, "_blank");
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const isShareCopied = isCopied || localCopied;
  const isRotatedLandscape = rotation === 90;
  const isMobile = screenSize.w < 640;
  const isTablet = screenSize.w >= 640 && screenSize.w < 1024;

  // Available viewport space for slide presentation with responsive, dynamic clearance
  const vertClearance = isNativeLandscape
    ? 68
    : isMobile
    ? 116
    : isTablet
    ? 140
    : 160;

  const horizClearance = isNativeLandscape
    ? 24
    : isMobile
    ? 16
    : isTablet
    ? 36
    : 64;

  const availW = Math.max(280, screenSize.w - horizClearance);
  const availH = Math.max(180, screenSize.h - vertClearance);

  // In rotated landscape mode (90° on portrait phone):
  // The slide's long edge (width) is oriented vertically along availH
  // The slide's short edge (height) is oriented horizontally along availW
  const rotW = isRotatedLandscape ? Math.min(availH, availW * imgAspectRatio) : 0;
  const rotH = isRotatedLandscape ? rotW / imgAspectRatio : 0;

  return (
    <div
      ref={containerRef}
      data-modal="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center bg-black/40 backdrop-blur-xl text-slate-900 select-none animate-in fade-in duration-200 overflow-hidden h-[100dvh] w-screen px-2.5 sm:px-6 md:px-8 py-2 sm:py-5 ${
        isNativeLandscape ? "py-1 px-3" : ""
      }`}
    >
      {/* Click Backdrop Outside to Close */}
      <div
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-pointer"
        aria-label="Click outside to close preview"
      />

      {/* TOP BAR: Title Pill, Engagement Stats + Zoom + Close */}
      <header
        className={`w-full max-w-7xl flex items-center justify-between pointer-events-none z-30 shrink-0 pt-[max(env(safe-area-inset-top),6px)] box-border ${
          isNativeLandscape ? "py-0.5" : "py-1"
        }`}
      >
        {/* Left: Deck Title, Category, Views & Like Capsule */}
        <div className="pointer-events-auto min-w-0 max-w-[calc(100vw-96px)] sm:max-w-xl flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/95 hover:bg-white backdrop-blur-xl border border-slate-200/80 text-slate-900 shadow-lg shadow-black/5 transition-all">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold tracking-tight truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[260px]">
            {deck.title}
          </span>
          <span className="text-[10px] font-mono text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 hidden md:inline-block border border-slate-200/70 shrink-0">
            {deck.category}
          </span>

          <div className="h-3.5 w-px bg-slate-200 shrink-0 hidden xs:block" />

          {/* Integrated Views Counter */}
          <div
            className="hidden xs:flex items-center gap-1 text-[11px] font-semibold text-slate-600 select-none shrink-0"
            title={`${viewCount} total client views`}
          >
            <Eye className="size-3.5 text-cyan-600 shrink-0" />
            <span>{formatCompactNumber(viewCount)}</span>
          </div>

          <div className="h-3.5 w-px bg-slate-200/80 shrink-0 hidden xs:block" />

          {/* Integrated Interactive Like Button */}
          <button
            onClick={handleLikeToggle}
            title={isLiked ? "Unlike presentation" : "Like presentation"}
            className={cn(
              "hidden xs:flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold transition-all active:scale-90 select-none shrink-0",
              isLiked
                ? "text-rose-600 bg-rose-50 font-bold"
                : "text-slate-600 hover:text-rose-600 hover:bg-slate-100"
            )}
          >
            <Heart
              className={cn(
                "size-3.5 transition-colors shrink-0",
                isLiked ? "fill-rose-500 text-rose-500 animate-pulse" : "text-slate-500"
              )}
            />
            <span>{formatCompactNumber(likeCount)}</span>
          </button>
        </div>

        {/* Right: Controls Capsule (Zoom and Close with guaranteed margins) */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom Toggle for Fine Detail Inspection */}
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            title={isZoomed ? "Reset Zoom" : "Zoom In (Double-tap slide)"}
            className={`size-8 sm:size-9.5 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all shadow-md active:scale-90 shrink-0 ${
              isZoomed
                ? "bg-primary text-white border-primary shadow-primary/30"
                : "bg-white/90 hover:bg-white border-slate-200/80 text-slate-700 hover:text-slate-950"
            }`}
          >
            {isZoomed ? (
              <ZoomOut className="size-3.5 sm:size-4" />
            ) : (
              <ZoomIn className="size-3.5 sm:size-4" />
            )}
          </button>

          {/* Floating High-Contrast 'X' Close Button */}
          <button
            onClick={onClose}
            title="Close Preview (Esc or Swipe down)"
            className="size-8 sm:size-9.5 rounded-full bg-slate-900/90 hover:bg-slate-950 active:scale-95 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-xl border border-white/20 hover:rotate-90 duration-200 shrink-0"
          >
            <X className="size-4 sm:size-4.5" />
          </button>
        </div>
      </header>

      {/* MAIN PRESENTATION CANVAS ARENA */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="relative group w-full max-w-7xl flex-1 min-h-0 flex items-center justify-center my-auto z-10 px-1 sm:px-4 py-1.5 sm:py-3"
      >
        {isRotatedLandscape ? (
          /* PRECISE BOUNDING CONTAINER FOR ROTATED HORIZONTAL ANGLE MODE (90°) */
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleSlideTap}
            style={{
              width: `${rotH}px`,
              height: `${rotW}px`,
              position: "relative",
            }}
            className="relative flex items-center justify-center select-none max-w-full max-h-full"
          >
            <div
              style={{
                width: `${rotW}px`,
                height: `${rotH}px`,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) rotate(90deg) ${isZoomed ? "scale(1.5)" : ""}`,
                transformOrigin: "center center",
                transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/30"
            >
              {!isSlideLoaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md select-none overflow-hidden min-w-[280px] min-h-[180px]">
                  {/* Subtle ambient light sweep across the background */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(56,189,248,0.08),transparent_70%)] pointer-events-none" />

                  {/* Personalized Crewvia Studio Plaque with Shining Border */}
                  <div className="relative p-[1.5px] rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/40">
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(56,189,248,0.7)_50%,transparent_80%)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />
                    <div className="relative px-5 py-3.5 rounded-[15px] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center gap-2 border border-white/10">
                      <div className="flex items-center gap-2.5">
                        <img
                          src="/logo.png"
                          alt="Crewvia"
                          className="h-5.5 w-auto object-contain drop-shadow"
                        />
                        <span className="font-display font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                          Crewvia
                          <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Visuals
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-white/10 w-full justify-center">
                        <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase font-semibold">
                          Slide {activeSlideIndex + 1} of {totalSlides}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <img
                src={currentSlide.preview_url}
                alt={currentSlide.title || `Slide ${activeSlideIndex + 1}`}
                draggable={false}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    setImgAspectRatio(naturalWidth / naturalHeight);
                  }
                  setIsSlideLoaded(true);
                }}
                onError={() => setIsSlideLoaded(true)}
                className={`block size-full object-contain select-none pointer-events-none transition-opacity duration-300 ${
                  isSlideLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>
        ) : (
          /* STANDARD NORMAL ORIENTATION (0°) */
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleSlideTap}
            style={{
              transform: isZoomed
                ? `scale(1.8)`
                : touchOffset !== 0
                ? `translateX(${touchOffset}px)`
                : undefined,
              maxWidth: `${availW}px`,
              maxHeight: `${availH}px`,
            }}
            className={`relative inline-flex items-center justify-center w-fit h-fit max-w-full max-h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/30 select-none transition-all duration-300 ease-out ${
              isZoomed ? "overflow-auto cursor-zoom-out" : "cursor-zoom-in"
            }`}
          >
            {!isSlideLoaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md select-none overflow-hidden min-w-[280px] min-h-[180px]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(56,189,248,0.08),transparent_70%)] pointer-events-none" />
                <div className="relative p-[1.5px] rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/40">
                  <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(56,189,248,0.7)_50%,transparent_80%)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />
                  <div className="relative px-5 py-3.5 rounded-[15px] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center gap-2 border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="/logo.png"
                        alt="Crewvia"
                        className="h-5.5 w-auto object-contain drop-shadow"
                      />
                      <span className="font-display font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                        Crewvia
                        <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Visuals
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-white/10 w-full justify-center">
                      <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase font-semibold">
                        Slide {activeSlideIndex + 1} of {totalSlides}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <img
              ref={slideImgRef}
              src={currentSlide.preview_url}
              alt={currentSlide.title || `Slide ${activeSlideIndex + 1}`}
              draggable={false}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight) {
                  setImgAspectRatio(naturalWidth / naturalHeight);
                }
                setIsSlideLoaded(true);
              }}
              onError={() => setIsSlideLoaded(true)}
              style={{
                maxWidth: `${availW}px`,
                maxHeight: `${availH}px`,
              }}
              className={`block max-w-full max-h-full w-auto h-auto object-contain rounded-xl sm:rounded-2xl select-none pointer-events-none transition-all duration-300 ease-out ${
                isSlideLoaded ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Active Zoom Indicator */}
            {isZoomed && (
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 text-[10px] font-mono text-cyan-300 shadow-xl pointer-events-none animate-in fade-in duration-200 z-30">
                Zoom Active • Double tap to reset
              </div>
            )}

            {/* Desktop Hover Floating Chevrons (Vertically centered) */}
            {totalSlides > 1 && !isZoomed && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  title="Previous Slide"
                  className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 size-8.5 sm:size-11 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 shadow-xl hidden sm:flex"
                >
                  <ChevronLeft className="size-4.5 sm:size-6" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  title="Next Slide"
                  className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 size-8.5 sm:size-11 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 shadow-xl hidden sm:flex"
                >
                  <ChevronRight className="size-4.5 sm:size-6" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* OPTIONAL SLIDES THUMBNAIL OVERVIEW DRAWER (Triggered via Grid Button) */}
      {showThumbnails && totalSlides > 1 && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[94vw] w-max p-2 sm:p-2.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-200 pointer-events-auto">
          {activeSlides.map((slide, sIdx) => {
            const isActive = sIdx === activeSlideIndex;
            return (
              <button
                key={slide.id || sIdx}
                onClick={() => setIndex(sIdx)}
                className={`relative aspect-[16/9] h-12 sm:h-14 rounded-lg overflow-hidden border transition-all duration-200 shrink-0 ${
                  isActive
                    ? "border-primary ring-2 ring-primary/40 scale-105 shadow-md shadow-primary/20"
                    : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400"
                }`}
              >
                <img
                  src={slide.preview_url}
                  alt={`Slide ${sIdx + 1}`}
                  className="size-full object-cover"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                  {sIdx + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FLOATING ISLAND CONTROL DOCK (BOTTOM CENTER) - Ultra-responsive on all screen widths */}
      <nav
        aria-label="Presentation Controls Dock"
        className={`pointer-events-auto z-30 flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-full bg-white/95 backdrop-blur-2xl border border-black/10 shadow-2xl shadow-black/15 text-neutral-900 max-w-[98vw] shrink-0 mb-[max(env(safe-area-inset-bottom),10px)] transition-all ${
          isNativeLandscape ? "p-1 scale-90" : "px-2 py-1.5 sm:px-3 sm:py-2"
        }`}
      >
        {/* Share Button (Native Mobile Share Sheet or Clipboard Copy) */}
        <button
          onClick={handleNativeShare}
          title="Share presentation"
          className="size-7.5 sm:size-9 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-700 hover:text-black transition-all active:scale-90 shrink-0"
        >
          {isShareCopied ? (
            <Check className="size-3.5 sm:size-4 text-emerald-600" />
          ) : (
            <Share2 className="size-3.5 sm:size-4" />
          )}
        </button>

        {/* Download PDF / Slide Image Button */}
        <button
          onClick={handleDownload}
          title={deck.pdf_url ? "Download presentation PDF" : "Download slide image"}
          className="size-7.5 sm:size-9 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-700 hover:text-black transition-all active:scale-90 shrink-0"
        >
          <Download className="size-3.5 sm:size-4" />
        </button>

        {/* Rotate / Landscape Orientation Toggle Button */}
        <button
          onClick={handleToggleOrientation}
          title={
            rotation === 90
              ? "Return to Portrait View"
              : "Expand to Landscape Widescreen View"
          }
          className={`size-7.5 sm:size-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 ${
            rotation === 90
              ? "bg-neutral-950 text-white font-bold ring-2 ring-primary/40 shadow-sm"
              : "hover:bg-neutral-100 text-neutral-700 hover:text-black"
          }`}
        >
          <RotateCw className={`size-3.5 sm:size-4 transition-transform duration-300 ${rotation === 90 ? "rotate-90 text-cyan-300" : ""}`} />
        </button>

        {/* Fullscreen Toggle Button (Desktop & Tablet) */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          className="size-7.5 sm:size-9 rounded-full hover:bg-neutral-100 hidden sm:flex items-center justify-center text-neutral-700 hover:text-black transition-all active:scale-90 shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="size-3.5 sm:size-4" />
          ) : (
            <Maximize2 className="size-3.5 sm:size-4" />
          )}
        </button>

        {/* Toggle Thumbnail Strip (Only if multiple slides) */}
        {totalSlides > 1 && (
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            title={showThumbnails ? "Hide slide thumbnails" : "View all slides"}
            className={`size-7.5 sm:size-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 ${
              showThumbnails
                ? "bg-neutral-200 text-black font-bold"
                : "hover:bg-neutral-100 text-neutral-700 hover:text-black"
            }`}
          >
            <LayoutGrid className="size-3.5 sm:size-4" />
          </button>
        )}

        {/* Primary Action Button: "Book a call" (Client View) OR "Edit" (Manager View) */}
        {isAdmin ? (
          onEdit && (
            <button
              onClick={onEdit}
              className="h-7.5 sm:h-9 px-3 sm:px-4 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold tracking-wide shadow-md flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <Edit2 className="size-3 sm:size-3.5" />
              <span>Edit</span>
            </button>
          )
        ) : (
          onBook && (
            <button
              onClick={onBook}
              className="h-7.5 sm:h-9 px-2.5 sm:px-4.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold tracking-wide shadow-md flex items-center gap-1 active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <span className="hidden xs:inline">Book a call</span>
              <span className="xs:hidden inline">Book</span>
              <ArrowUpRight className="size-3 sm:size-3.5" />
            </button>
          )
        )}

        {/* Slide Navigation Segment: [ < ]  1 / N  [ > ] */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-neutral-100/90 border border-neutral-200/80 shrink-0">
          <button
            onClick={handlePrev}
            title="Previous Slide"
            className="size-6 sm:size-7.5 rounded-full hover:bg-neutral-200/80 text-neutral-800 flex items-center justify-center transition-all active:scale-90 shrink-0"
          >
            <ChevronLeft className="size-3 sm:size-3.5" />
          </button>

          <span className="text-[10px] sm:text-xs font-mono font-bold px-1 sm:px-1.5 text-neutral-800 whitespace-nowrap min-w-[28px] sm:min-w-[38px] text-center">
            {activeSlideIndex + 1} / {totalSlides}
          </span>

          <button
            onClick={handleNext}
            title="Next Slide"
            className="size-6 sm:size-7.5 rounded-full hover:bg-neutral-200/80 text-neutral-800 flex items-center justify-center transition-all active:scale-90 shrink-0"
          >
            <ChevronRight className="size-3 sm:size-3.5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
