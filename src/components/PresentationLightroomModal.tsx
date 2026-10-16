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

/**
 * ScreenRotateIcon
 * Orientation action icon with a device frame that dynamically
 * rotates with orbital orientation arrows (clearly conveys screen rotation, never refresh).
 */
function ScreenRotateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Curved rotation track arrows indicating 90° orientation change */}
      <path d="M21 8.5 A 8.5 8.5 0 0 0 12.5 3.5" />
      <polyline points="21 4 21 8.5 16.5 8.5" />
      <path d="M3 15.5 A 8.5 8.5 0 0 0 11.5 20.5" />
      <polyline points="3 20 3 15.5 7.5 15.5" />
      {/* Smartphone frame in center */}
      <rect x="8.5" y="6" width="7" height="12" rx="1.5" />
    </svg>
  );
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
  const slideAspectRatios = useRef<Map<string, number>>(new Map());
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
    try {
      if (navigator.vibrate) navigator.vibrate(15);
    } catch {
      // ignore
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    if (nextLiked) {
      toast.success("Added to your liked presentations!", { duration: 1800 });
    }
    await togglePortfolioLike(deck.id, nextLiked);
  };

  useEffect(() => {
    const cached = slideAspectRatios.current.get(currentSlide.preview_url);
    if (cached && cached > 0) {
      setImgAspectRatio(cached);
      setIsSlideLoaded(true);
    } else if (slideImgRef.current && (slideImgRef.current.complete || slideImgRef.current.naturalWidth > 0)) {
      setIsSlideLoaded(true);
      if (slideImgRef.current.naturalWidth && slideImgRef.current.naturalHeight) {
        const r = slideImgRef.current.naturalWidth / slideImgRef.current.naturalHeight;
        setImgAspectRatio(r);
        slideAspectRatios.current.set(currentSlide.preview_url, r);
      }
    }
  }, [currentSlide.preview_url]);

  const [screenSize, setScreenSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 400,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  const [zoomScale, setZoomScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const lastGyroOrientationRef = useRef<0 | 90>(0);
  const manualOverrideCooldownRef = useRef<number>(0);

  // Realtime Gyroscope Sensor & Physical Orientation Detection
  // Automatically detects when the mobile phone is physically turned into landscape or portrait
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      // Respect manual user clicks for 3.5 seconds before auto-overriding
      if (Date.now() < manualOverrideCooldownRef.current) return;

      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      // When the phone is lying flat on a surface (e.g. table), keep current orientation
      if (Math.abs(beta) < 20 && Math.abs(gamma) < 20) return;

      // Phone physically held sideways in landscape:
      // (gamma tilts beyond ±48° while beta is relatively horizontal < 48°)
      if (Math.abs(gamma) > 48 && Math.abs(beta) < 48) {
        if (lastGyroOrientationRef.current !== 90) {
          lastGyroOrientationRef.current = 90;
          setRotation(90);
        }
        return;
      }

      // Phone physically held upright in portrait:
      // (gamma is centered < 25° and beta is upright > 30°)
      if (Math.abs(gamma) < 25 && beta > 30) {
        if (lastGyroOrientationRef.current !== 0) {
          lastGyroOrientationRef.current = 0;
          setRotation(0);
        }
        return;
      }
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, []);

  // Monitor physical phone screen size, orientation, and browser page zoom level
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
        lastGyroOrientationRef.current = 0;
      }

      // Detect browser page zoom level on desktop (e.g. when user zooms out to 50% or 75%)
      // and dynamically counter-scale the controls so they maintain their exact physical size on screen.
      // On mobile / small viewports, zoom compensation MUST NOT apply (scale remains 1) to guarantee responsive sizing.
      if (w < 640 || (w < 900 && h < 500)) {
        setZoomScale(1);
      } else {
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        if (outerW && innerW) {
          const detectedZoom = outerW / innerW;
          if (detectedZoom > 0.15 && detectedZoom < 4.0) {
            const comp = 1 / detectedZoom;
            // When browser is zoomed out (e.g. 50% or 75%), comp > 1.
            // Clamp compensation between 1.0 (never shrink controls below standard) and 2.5
            setZoomScale(Math.max(1, Math.min(2.5, comp)));
          }
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
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
  // Prevents upside-down 180° rotation on any device and respects user manual toggle
  const handleToggleOrientation = useCallback(() => {
    manualOverrideCooldownRef.current = Date.now() + 3500;
    setRotation((prev) => {
      const next = prev === 0 ? 90 : 0;
      lastGyroOrientationRef.current = next;
      return next;
    });
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
  const isThinMobile = screenSize.w < 380;
  const isShortScreen = screenSize.h < 550;

  // Fixed chrome vertical budget scaled by zoom compensation factor (only on desktop):
  const vertChrome = isThinMobile ? 96 : isMobile || isShortScreen ? 112 : Math.round(170 * zoomScale);
  const maxAvailableH = Math.max(140, screenSize.h - vertChrome);

  // Balanced target proportions (slide occupies ~96% width on thin mobile, ~94% on mobile, ~82% on tablet, ~65% on desktop):
  const maxCardWidth = Math.round(
    screenSize.w * (isThinMobile ? 0.96 : isMobile ? 0.94 : isTablet ? 0.82 : 0.65)
  );
  // Cap height so slide never encroaches or pushes against header or bottom dock
  const maxCardHeight = Math.round(
    Math.min(screenSize.h * (isMobile ? 0.82 : 0.72), maxAvailableH)
  );

  const availW = Math.max(180, Math.min(screenSize.w - (isThinMobile ? 12 : 16), maxCardWidth));
  const availH = Math.max(140, maxCardHeight);

  // Exact slide aspect ratio (defaults to standard 16:9 widescreen: 1.7778)
  const ratio = imgAspectRatio > 0 ? imgAspectRatio : 16 / 9;

  // Best-fit 2D containment bounding box for ANY aspect ratio (widescreen, square, or portrait):
  // Mathematical guarantee: fits 100% within available viewport budget while strictly matching slide ratio with 0px empty letterbox
  let targetCardW = availW;
  let targetCardH = Math.round(targetCardW / ratio);
  if (targetCardH > availH) {
    targetCardH = availH;
    targetCardW = Math.round(targetCardH * ratio);
  }

  // In rotated landscape mode (90° on portrait phone):
  // The phone is portrait, so the slide width runs along phone vertical axis (availH),
  // and the slide height runs along phone horizontal axis (availW).
  let rotCardW = isRotatedLandscape ? availH : 0;
  let rotCardH = isRotatedLandscape ? Math.round(rotCardW / ratio) : 0;
  if (isRotatedLandscape && rotCardH > availW) {
    rotCardH = availW;
    rotCardW = Math.round(rotCardH * ratio);
  }

  // Intelligent Lookahead Preloader for 30-60MB Multi-Slide Decks
  // Pre-caches Next (+1) and Prev (-1) slides in a sliding window so slide transitions are instantaneous
  useEffect(() => {
    if (activeSlides.length <= 1) return;

    const nextIdx = (activeSlideIndex + 1) % activeSlides.length;
    const prevIdx = (activeSlideIndex - 1 + activeSlides.length) % activeSlides.length;

    const urlsToPreload = [
      activeSlides[nextIdx]?.preview_url,
      activeSlides[prevIdx]?.preview_url,
    ].filter((u): u is string => Boolean(u));

    urlsToPreload.forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          slideAspectRatios.current.set(url, img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = url;
    });
  }, [activeSlideIndex, activeSlides]);

  return (
    <div
      ref={containerRef}
      data-modal="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
      className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-black/60 backdrop-blur-xl text-slate-900 select-none animate-in fade-in duration-200 overflow-hidden h-[100dvh] w-screen px-3 sm:px-8 md:px-[42px] pt-3 sm:pt-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4"
    >
      {/* Click Backdrop Outside to Close */}
      <div
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-pointer"
        aria-label="Click outside to close preview"
      />

      {/* TOP BAR: Title Pill + Controls (Likes/Views Capsule + Zoom + Close) */}
      <header
        style={{
          height: isThinMobile ? "36px" : isMobile ? "40px" : `${Math.round(48 * zoomScale)}px`,
        }}
        className="w-full flex items-center justify-between pointer-events-none z-30 shrink-0 box-border gap-1.5 sm:gap-3"
      >
        {/* Left: Sleek Top Pill (snug fit to content, no unnecessary stretching) */}
        <div
          style={{
            transform: !isMobile && zoomScale > 1.05 ? `scale(${zoomScale})` : undefined,
            transformOrigin: "top left",
          }}
          className={cn(
            "pointer-events-auto inline-flex items-center rounded-full bg-white shadow-xl shadow-black/5 border border-slate-200/90 text-slate-900 transition-all select-none min-w-0 w-fit shrink",
            isThinMobile
              ? "h-[36px] gap-1.5 px-2.5 max-w-[calc(100vw-145px)]"
              : "h-[40px] sm:h-[48px] gap-2 sm:gap-2.5 px-3 sm:px-4 max-w-[calc(100vw-180px)] sm:max-w-md"
          )}
        >
          <span className="size-2 sm:size-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400 shrink-0 animate-pulse" />
          <span className={cn(
            "font-semibold tracking-tight text-slate-800 truncate min-w-0 leading-none",
            isThinMobile ? "text-[12px]" : "text-[13px] sm:text-[14px]"
          )}>
            {deck.title}
          </span>
          {deck.category && (
            <span className="hidden md:inline-flex text-[11px] font-medium text-slate-600 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 shrink-0 leading-none select-none">
              {deck.category}
            </span>
          )}
        </div>

        {/* Right: Controls Capsule (Like/View Pill + Zoom on desktop + Close Button) */}
        <div
          style={{
            transform: !isMobile && zoomScale > 1.05 ? `scale(${zoomScale})` : undefined,
            transformOrigin: "top right",
          }}
          className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0"
        >
          {/* Social Engagement Capsule: Like Button & View Counter */}
          <div className={cn(
            "flex items-center rounded-full bg-white shadow-xl shadow-black/5 border border-slate-200/90 text-slate-800 select-none shrink-0 transition-all",
            isThinMobile
              ? "h-[36px] gap-1 px-2"
              : "h-[40px] sm:h-[48px] gap-1.5 sm:gap-2 px-2.5 sm:px-3.5"
          )}>
            {/* Interactive Like Button */}
            <button
              onClick={handleLikeToggle}
              title={isLiked ? "Unlike presentation" : "Like presentation"}
              className="flex items-center gap-1 sm:gap-1.5 group/like active:scale-90 transition-transform cursor-pointer"
            >
              <Heart
                className={cn(
                  "transition-all duration-200",
                  isThinMobile ? "size-3" : "size-3.5 sm:size-4",
                  isLiked
                    ? "fill-rose-500 text-rose-500 scale-110 drop-shadow-sm"
                    : "text-slate-500 group-hover/like:text-rose-500 group-hover/like:scale-105"
                )}
              />
              <span
                className={cn(
                  "font-bold tracking-tight transition-colors",
                  isThinMobile ? "text-[11px]" : "text-[12px] sm:text-[13px]",
                  isLiked ? "text-rose-600" : "text-slate-700 group-hover/like:text-rose-600"
                )}
              >
                {formatCompactNumber(likeCount)}
              </span>
            </button>

            {/* Divider */}
            <span className="h-3 w-[1px] bg-slate-200 mx-0.5" />

            {/* View Counter */}
            <div
              title={`${viewCount} total presentation views`}
              className="flex items-center gap-1 text-slate-500 select-none"
            >
              <Eye className={cn("text-slate-400 shrink-0", isThinMobile ? "size-3" : "size-3.5")} />
              <span className={cn(
                "font-medium text-slate-600 font-mono",
                isThinMobile ? "text-[11px]" : "text-[12px] sm:text-[13px]"
              )}>
                {formatCompactNumber(viewCount)}
              </span>
            </div>
          </div>

          {/* Zoom Toggle (Desktop only - mobile uses native double-tap to zoom) */}
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            title={isZoomed ? "Reset Zoom" : "Zoom In (Double-tap slide)"}
            className={cn(
              "hidden sm:flex size-[48px] rounded-full items-center justify-center transition-all shadow-md active:scale-95 shrink-0 border",
              isZoomed
                ? "bg-primary text-white border-primary shadow-primary/30"
                : "bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 hover:text-black"
            )}
          >
            {isZoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            title="Close Preview (Esc or Swipe down)"
            className={cn(
              "rounded-full bg-[#0f172a] hover:bg-black active:scale-95 text-white flex items-center justify-center transition-all shadow-xl border border-white/10 shrink-0",
              isThinMobile ? "size-[36px]" : "size-[40px] sm:size-[48px]"
            )}
          >
            <X className={cn(isThinMobile ? "size-4" : "size-4.5 sm:size-5")} />
          </button>
        </div>
      </header>

      {/* MAIN PRESENTATION CANVAS ARENA */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="relative group w-full flex-1 min-h-0 flex items-center justify-center my-auto z-10 px-2 sm:px-4 md:px-6"
      >
        {isRotatedLandscape ? (
          /* PRECISE BOUNDING CONTAINER FOR ROTATED HORIZONTAL ANGLE MODE (90°) */
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleSlideTap}
            style={{
              width: `${rotCardH}px`,
              height: `${rotCardW}px`,
              position: "relative",
            }}
            className="relative flex items-center justify-center select-none max-w-full max-h-full"
          >
            <div
              style={{
                width: `${rotCardW}px`,
                height: `${rotCardH}px`,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) rotate(90deg) ${isZoomed ? "scale(1.5)" : ""}`,
                transformOrigin: "center center",
                transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="rounded-[16px] sm:rounded-[22px] md:rounded-[26px] overflow-hidden shadow-2xl shadow-black/50 border border-white/25 flex items-center justify-center bg-black/40"
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
                src={currentSlide.preview_url}
                alt={currentSlide.title || `Slide ${activeSlideIndex + 1}`}
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    const r = naturalWidth / naturalHeight;
                    setImgAspectRatio(r);
                    slideAspectRatios.current.set(currentSlide.preview_url, r);
                  }
                  setIsSlideLoaded(true);
                }}
                onError={() => setIsSlideLoaded(true)}
                className={`block size-full object-contain rounded-[16px] sm:rounded-[22px] md:rounded-[26px] select-none pointer-events-none transition-opacity duration-300 ${
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
              width: `${targetCardW}px`,
              height: `${targetCardH}px`,
              maxWidth: "100%",
              maxHeight: `${availH}px`,
              transform: isZoomed
                ? `scale(1.8)`
                : touchOffset !== 0
                ? `translateX(${touchOffset}px)`
                : undefined,
            }}
            className={cn(
              "relative flex items-center justify-center rounded-[16px] sm:rounded-[22px] md:rounded-[26px] overflow-hidden shadow-2xl shadow-black/50 border border-white/20 select-none transition-all duration-300 ease-out bg-black/40",
              isZoomed ? "overflow-auto cursor-zoom-out" : "cursor-zoom-in"
            )}
          >
            {!isSlideLoaded && (
              <div
                style={{
                  width: `${targetCardW}px`,
                  height: `${targetCardH}px`,
                }}
                className="flex flex-col items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md select-none overflow-hidden rounded-[16px] sm:rounded-[22px] md:rounded-[26px]"
              >
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
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight) {
                  const r = naturalWidth / naturalHeight;
                  setImgAspectRatio(r);
                  slideAspectRatios.current.set(currentSlide.preview_url, r);
                }
                setIsSlideLoaded(true);
              }}
              onError={() => setIsSlideLoaded(true)}
              className={cn(
                "size-full object-contain rounded-[16px] sm:rounded-[22px] md:rounded-[26px] select-none pointer-events-none transition-opacity duration-300",
                isSlideLoaded ? "opacity-100" : "opacity-0 absolute"
              )}
            />

            {/* Active Zoom Indicator */}
            {isZoomed && (
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 text-[10px] font-mono text-cyan-300 shadow-xl pointer-events-none animate-in fade-in duration-200 z-30">
                Zoom Active • Double tap to reset
              </div>
            )}

            {/* Desktop Hover Floating Chevrons (Vertically centered) */}
            {totalSlides > 1 && !isZoomed && isSlideLoaded && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  title="Previous Slide"
                  className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 size-8.5 sm:size-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 shadow-xl hidden sm:flex"
                >
                  <ChevronLeft className="size-4.5 sm:size-5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  title="Next Slide"
                  className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 size-8.5 sm:size-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 shadow-xl hidden sm:flex"
                >
                  <ChevronRight className="size-4.5 sm:size-5" />
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
                  className="size-full object-contain"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                  {sIdx + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FLOATING ISLAND CONTROL DOCK (BOTTOM CENTER) - Compensated for browser zoom on desktop */}
      <nav
        aria-label="Presentation Controls Dock"
        style={{
          transform: !isMobile && zoomScale > 1.05 ? `scale(${zoomScale})` : undefined,
          transformOrigin: "bottom center",
        }}
        className={cn(
          "pointer-events-auto z-30 flex items-center rounded-full bg-white shadow-2xl shadow-black/25 border border-slate-200/90 text-slate-800 shrink-0 mb-0 transition-all select-none max-w-[calc(100vw-12px)] sm:max-w-none",
          isThinMobile
            ? "h-[42px] px-2 gap-1"
            : isMobile
            ? "h-[48px] px-2.5 gap-1.5"
            : "h-[58px] px-4 gap-2.5"
        )}
      >
        {/* Share Button (Native Mobile Share Sheet or Clipboard Copy) */}
        <button
          onClick={handleNativeShare}
          title="Share presentation"
          className={cn(
            "rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 shrink-0",
            isThinMobile ? "size-[28px]" : isMobile ? "size-[34px]" : "size-[42px]"
          )}
        >
          {isShareCopied ? (
            <Check className={cn(isThinMobile ? "size-3.5" : isMobile ? "size-4" : "size-5", "text-emerald-600")} />
          ) : (
            <Share2 className={cn(isThinMobile ? "size-3.5" : isMobile ? "size-4" : "size-5")} />
          )}
        </button>

        {/* Download PDF / Slide Image Button */}
        <button
          onClick={handleDownload}
          title={deck.pdf_url ? "Download presentation PDF" : "Download slide image"}
          className={cn(
            "rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 shrink-0",
            isThinMobile ? "size-[28px]" : isMobile ? "size-[34px]" : "size-[42px]"
          )}
        >
          <Download className={cn(isThinMobile ? "size-3.5" : isMobile ? "size-4" : "size-5")} />
        </button>

        {/* Rotate / Landscape Orientation Toggle Button */}
        <button
          onClick={handleToggleOrientation}
          title={
            rotation === 90
              ? "Return to Portrait View"
              : "Expand to Landscape Widescreen View"
          }
          className={cn(
            "rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0",
            isThinMobile ? "size-[28px]" : isMobile ? "size-[34px]" : "size-[42px]",
            rotation === 90
              ? "bg-slate-900 text-white font-bold ring-2 ring-primary/40 shadow-sm"
              : "hover:bg-slate-100 text-slate-700 hover:text-black"
          )}
        >
          <ScreenRotateIcon
            className={cn(
              "transition-transform duration-300",
              isThinMobile ? "size-3.5" : isMobile ? "size-4" : "size-5",
              rotation === 90 ? "rotate-90 text-cyan-300" : ""
            )}
          />
        </button>

        {/* Fullscreen Toggle Button - Tablet/Desktop only */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          className="hidden sm:flex size-[42px] rounded-full hover:bg-slate-100 items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="size-5" />
          ) : (
            <Maximize2 className="size-5" />
          )}
        </button>

        {/* Toggle Thumbnail Strip (Only if multiple slides and on tablet/desktop) */}
        {totalSlides > 1 && (
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            title={showThumbnails ? "Hide slide thumbnails" : "View all slides"}
            className={cn(
              "hidden sm:flex size-[42px] rounded-full items-center justify-center transition-all active:scale-95 shrink-0",
              showThumbnails
                ? "bg-slate-200 text-black font-bold"
                : "hover:bg-slate-100 text-slate-700 hover:text-black"
            )}
          >
            <LayoutGrid className="size-5" />
          </button>
        )}

        {/* Primary Action Button: "Book a call" (Client View) OR "Edit" (Manager View) */}
        {isAdmin ? (
          onEdit && (
            <button
              onClick={onEdit}
              className={cn(
                "rounded-full bg-[#0f172a] hover:bg-black text-white font-semibold tracking-wide shadow-md flex items-center active:scale-95 transition-all whitespace-nowrap shrink-0",
                isThinMobile
                  ? "h-[28px] px-2.5 text-[11px] gap-1"
                  : isMobile
                  ? "h-[34px] px-3.5 text-[12px] gap-1.5"
                  : "h-[42px] px-5 text-[14px] gap-2"
              )}
            >
              <Edit2 className={cn(isThinMobile ? "size-3" : isMobile ? "size-3.5" : "size-4")} />
              <span>Edit</span>
            </button>
          )
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onBook) onBook();
            }}
            className={cn(
              "rounded-full bg-[#0f172a] hover:bg-black text-white font-semibold tracking-wide shadow-md flex items-center active:scale-95 transition-all whitespace-nowrap shrink-0",
              isThinMobile
                ? "h-[28px] px-2.5 text-[11px] gap-1"
                : isMobile
                ? "h-[34px] px-3.5 text-[12.5px] gap-1.5"
                : "h-[42px] px-5 text-[14px] gap-2"
            )}
          >
            <span>{isThinMobile ? "Book" : "Book a call"}</span>
            <ArrowUpRight className={cn(isThinMobile ? "size-3" : isMobile ? "size-3.5" : "size-4.5")} />
          </button>
        )}

        {/* Slide Navigation Segment: < 1 / N > */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 pl-0 sm:pl-1.5">
          <button
            onClick={handlePrev}
            title="Previous Slide"
            className={cn(
              "rounded-full hover:bg-slate-100 text-slate-700 hover:text-black flex items-center justify-center transition-all active:scale-95 shrink-0",
              isThinMobile ? "size-[24px]" : isMobile ? "size-[28px]" : "size-[34px]"
            )}
          >
            <ChevronLeft className={cn(isThinMobile ? "size-3" : isMobile ? "size-3.5" : "size-4.5")} />
          </button>

          <span
            className={cn(
              "font-mono font-bold text-slate-800 whitespace-nowrap text-center select-none",
              isThinMobile
                ? "text-[11px] px-0.5 min-w-[24px]"
                : isMobile
                ? "text-[12px] px-1 min-w-[32px]"
                : "text-[14px] px-2 min-w-[42px]"
            )}
          >
            {activeSlideIndex + 1} / {totalSlides}
          </span>

          <button
            onClick={handleNext}
            title="Next Slide"
            className={cn(
              "rounded-full hover:bg-slate-100 text-slate-700 hover:text-black flex items-center justify-center transition-all active:scale-95 shrink-0",
              isThinMobile ? "size-[24px]" : isMobile ? "size-[28px]" : "size-[34px]"
            )}
          >
            <ChevronRight className={cn(isThinMobile ? "size-3" : isMobile ? "size-3.5" : "size-4.5")} />
          </button>
        </div>
      </nav>
    </div>
  );
}
