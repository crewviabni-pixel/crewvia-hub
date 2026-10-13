import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DisableDevtool from "disable-devtool";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Loader2,
  Eye,
  Sparkles,
  LayoutGrid,
  X,
  SlidersHorizontal,
  Expand,
  FoldHorizontal,
  Smartphone,
} from "lucide-react";

// Configure pdf.js worker to match the installed version
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface DocumentCanvasViewerProps {
  fileUrl: string;
  leadName?: string | undefined;
  companyName?: string | null | undefined;
  title?: string | undefined;
  isPublicClientView?: boolean | undefined;
}

export function DocumentCanvasViewer({
  fileUrl,
  leadName = "Client",
  companyName,
  title,
  isPublicClientView = false,
}: DocumentCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"pdf" | "image">("pdf");

  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);

  // Rotation State (0, 90, 180, 270 degrees)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  // Responsive Layout State
  const [nativeDimensions, setNativeDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 900,
    height: 600,
  });

  // User zoom multiplier relative to Auto-Fit (1.0 = 100% Fit)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [devToolsDetected, setDevToolsDetected] = useState(false);

  // Mobile Slide Selector Sheet State
  const [showSlideSheet, setShowSlideSheet] = useState(false);

  // Touch Gesture Refs (Pinch, Double Tap, Pan)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1.0);
  const lastTapTimeRef = useRef<number>(0);

  // 1. Determine file type
  useEffect(() => {
    const cleanUrl = (fileUrl.split("?")[0] || "").toLowerCase();
    if (
      cleanUrl.endsWith(".png") ||
      cleanUrl.endsWith(".jpg") ||
      cleanUrl.endsWith(".jpeg") ||
      cleanUrl.endsWith(".webp")
    ) {
      setFileType("image");
    } else {
      setFileType("pdf");
    }
  }, [fileUrl]);

  // 2. Measure container responsive size with ResizeObserver
  useEffect(() => {
    const wrapper = viewportWrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.floor(rect.width || wrapper.clientWidth);
      const h = Math.floor(rect.height || wrapper.clientHeight);

      if (w > 0 && h > 0) {
        setContainerSize((prev) => {
          if (prev.width === w && Math.abs(prev.height - h) < 2) return prev;
          return { width: w, height: h };
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(wrapper);
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, [isFullscreen]);

  // 3. DevTools protection for public client preview
  useEffect(() => {
    if (!isPublicClientView) return;

    // Do not block localhost / local testing environments
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.endsWith(".local"))
    ) {
      return;
    }

    try {
      DisableDevtool({
        ondevtoolopen() {
          setDevToolsDetected(true);
        },
        disableMenu: true,
        disableSelect: true,
        disableCopy: true,
        disableCut: true,
        disablePaste: true,
        clearLog: true,
      });
    } catch {
      // Graceful fallback
    }

    const handleProtectedKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "p" || e.key === "s" || e.key === "u" || e.key === "P" || e.key === "S" || e.key === "U")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleProtectedKeys);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleProtectedKeys);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isPublicClientView]);

  // 4. Slide Navigation Helpers
  const goToNextPage = useCallback(() => {
    if (numPages > 1) {
      setCurrentPage((prev) => Math.min(numPages, prev + 1));
    }
  }, [numPages]);

  const goToPrevPage = useCallback(() => {
    if (numPages > 1) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [numPages]);

  // Rotate Clockwise (0° -> 90° -> 180° -> 270° -> 0°)
  const handleRotateClockwise = useCallback(() => {
    setRotation((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270));
  }, []);

  // Reset Rotation to 0
  const handleResetRotation = useCallback(() => {
    setRotation(0);
  }, []);

  // Fullscreen Toggle (with optional mobile orientation lock)
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            try {
              if ((screen as any)?.orientation?.lock) {
                (screen as any).orientation.lock("landscape").catch(() => {});
              }
            } catch {}
          })
          .catch(() => setIsFullscreen(true)); // Fallback to CSS fullscreen
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
            try {
              if ((screen as any)?.orientation?.unlock) {
                (screen as any).orientation.unlock();
              }
            } catch {}
          })
          .catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  // 5. Keyboard Navigation (Arrow keys, Space, R for rotate, F for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        if (numPages > 1) {
          e.preventDefault();
          goToNextPage();
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        if (numPages > 1) {
          e.preventDefault();
          goToPrevPage();
        }
      } else if (e.key === "Home") {
        if (numPages > 1) {
          e.preventDefault();
          setCurrentPage(1);
        }
      } else if (e.key === "End") {
        if (numPages > 1) {
          e.preventDefault();
          setCurrentPage(numPages);
        }
      } else if (e.key === "f" || e.key === "F") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleFullscreen();
        }
      } else if (e.key === "r" || e.key === "R") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleRotateClockwise();
        }
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoomLevel(1.0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, goToNextPage, goToPrevPage, toggleFullscreen, handleRotateClockwise]);

  // 6. Fullscreen Change Event Sync & Body Scroll Lock
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setZoomLevel(1.0);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isFullscreen]);

  // 7. Forensic Watermark Drawing Function
  const drawWatermark = useCallback((displayW: number, displayH: number, dpr: number) => {
    const wmCanvas = watermarkCanvasRef.current;
    if (!wmCanvas) return;

    wmCanvas.width = Math.floor(displayW * dpr);
    wmCanvas.height = Math.floor(displayH * dpr);
    wmCanvas.style.width = `${displayW}px`;
    wmCanvas.style.height = `${displayH}px`;

    const ctx = wmCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.rotate((-26 * Math.PI) / 180);

    const text1 = "PREVIEW ONLY • CREWVIA BNI";
    const text2 = leadName ? `PREPARED FOR ${leadName.toUpperCase()}` : "CONFIDENTIAL CLIENT DRAFT";

    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
    ctx.textAlign = "center";

    const stepX = 260;
    const stepY = 140;

    for (let x = -displayW * 1.5; x < displayW * 2.5; x += stepX) {
      for (let y = -displayH * 1.5; y < displayH * 2.5; y += stepY) {
        ctx.fillText(text1, x, y);
        ctx.fillText(text2, x, y + 16);
      }
    }
    ctx.restore();
  }, [leadName]);

  // 8. Load PDF Document
  useEffect(() => {
    if (fileType !== "pdf" || !fileUrl) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadTask = pdfjsLib.getDocument({
      url: fileUrl,
      withCredentials: false,
    });

    loadTask.promise
      .then((loadedDoc) => {
        if (!isMounted) return;
        setPdfDoc(loadedDoc);
        setNumPages(loadedDoc.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("PDF load error:", err);
        setError("Unable to render PDF presentation. Please check your network connection.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
      loadTask.destroy().catch(() => {});
    };
  }, [fileUrl, fileType]);

  // 9. Production-Grade Canvas Rendering (Aspect-Ratio Preserved Auto-Fit with Rotation)
  useEffect(() => {
    if (devToolsDetected) return;

    let isCancelled = false;

    // Helper: Calculate Auto-Fit Dimensions (Contain scale with rotation accounted)
    const computeFit = (nativeW: number, nativeH: number, currentRotation: number) => {
      // If rotated 90° or 270°, swap effective native width and height
      const isRotated90or270 = currentRotation === 90 || currentRotation === 270;
      const effectiveNativeW = isRotated90or270 ? nativeH : nativeW;
      const effectiveNativeH = isRotated90or270 ? nativeW : nativeH;

      // Safe breathing padding (12px per side on mobile, 16px on desktop/fullscreen)
      const padding = isFullscreen ? 16 : containerSize.width < 768 ? 12 : 16;
      const availW = Math.max(containerSize.width - padding * 2, 120);
      const availH = Math.max(containerSize.height - padding * 2, 120);

      // Strict 100% contain fit across BOTH axes so slide NEVER overflows container box:
      const scaleX = availW / effectiveNativeW;
      const scaleY = availH / effectiveNativeH;
      const baseFitScale = Math.min(scaleX, scaleY);

      const displayW = Math.floor(effectiveNativeW * baseFitScale * zoomLevel);
      const displayH = Math.floor(effectiveNativeH * baseFitScale * zoomLevel);

      return { baseFitScale, displayW, displayH, effectiveNativeW, effectiveNativeH };
    };

    if (fileType === "pdf" && pdfDoc) {
      setLoading(true);

      // Cancel any ongoing render task before starting a new page render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }

      pdfDoc.getPage(currentPage).then((page: any) => {
        if (isCancelled) return;

        // 1. Get native unscaled dimensions
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const nativeW = unscaledViewport.width;
        const nativeH = unscaledViewport.height;
        setNativeDimensions({ width: nativeW, height: nativeH });

        // 2. Compute exact fit with current zoom & rotation
        const { baseFitScale, displayW, displayH } = computeFit(nativeW, nativeH, rotation);

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 3. Sharp rendering using devicePixelRatio
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const renderScale = baseFitScale * zoomLevel * dpr;

        // PDF.js native rotation support
        const pdfRotation = (page.rotate + rotation) % 360;
        const renderViewport = page.getViewport({ scale: renderScale, rotation: pdfRotation });

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        // White backdrop for clean presentation slide look
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: renderViewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        task.promise
          .then(() => {
            if (!isCancelled) {
              drawWatermark(displayW, displayH, dpr);
              setLoading(false);
            }
          })
          .catch((err: any) => {
            if (err?.name !== "RenderingCancelledException") {
              console.error("Render task error:", err);
            }
            if (!isCancelled) setLoading(false);
          });
      });
    } else if (fileType === "image" && fileUrl) {
      setLoading(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (isCancelled) return;
        const nativeW = img.naturalWidth || 1920;
        const nativeH = img.naturalHeight || 1080;
        setNativeDimensions({ width: nativeW, height: nativeH });

        const { displayW, displayH } = computeFit(nativeW, nativeH, rotation);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const canvasW = Math.floor(displayW * dpr);
        const canvasH = Math.floor(displayH * dpr);
        canvas.width = canvasW;
        canvas.height = canvasH;
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          const isRotated90or270 = rotation === 90 || rotation === 270;
          ctx.save();
          ctx.translate(canvasW / 2, canvasH / 2);
          ctx.rotate((rotation * Math.PI) / 180);

          if (isRotated90or270) {
            ctx.drawImage(img, -canvasH / 2, -canvasW / 2, canvasH, canvasW);
          } else {
            ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
          }
          ctx.restore();

          drawWatermark(displayW, displayH, dpr);
        }
        setLoading(false);
      };
      img.onerror = () => {
        if (!isCancelled) {
          setError("Failed to load design preview.");
          setLoading(false);
        }
      };
      img.src = fileUrl;
    }

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [
    fileType,
    pdfDoc,
    currentPage,
    zoomLevel,
    rotation,
    containerSize,
    fileUrl,
    drawWatermark,
    devToolsDetected,
    isFullscreen,
  ]);

  // 10. Advanced Mobile Touch Gestures (Pinch-to-Zoom, Double-Tap, Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: Pinch to zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDistRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartZoomRef.current = zoomLevel;
      touchStartX.current = null;
    } else if (e.touches.length === 1) {
      // 1 finger: record start for swipe or double tap
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = dist / pinchStartDistRef.current;
      const targetZoom = Math.min(3.5, Math.max(0.6, +(pinchStartZoomRef.current * factor).toFixed(2)));
      setZoomLevel(targetZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }

    const now = Date.now();
    // Double tap toggle: zoom to 2.0x or reset to 1.0x
    if (e.changedTouches.length === 1 && now - lastTapTimeRef.current < 320) {
      e.preventDefault();
      setZoomLevel((prev) => (prev > 1.2 ? 1.0 : 2.0));
      lastTapTimeRef.current = 0;
      touchStartX.current = null;
      return;
    }
    lastTapTimeRef.current = now;

    // Single finger swipe between slides (only when not zoomed in)
    if (zoomLevel <= 1.15 && touchStartX.current !== null && e.changedTouches[0]) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = touchStartY.current !== null ? Math.abs(e.changedTouches[0].clientY - touchStartY.current) : 0;
      // Ensure horizontal swipe is dominant (not vertical page scroll)
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > deltaY) {
        if (deltaX < 0) {
          goToNextPage();
        } else {
          goToPrevPage();
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // 11. Inspection Blocked Screen
  if (devToolsDetected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center bg-background rounded-2xl border border-destructive/30">
        <ShieldAlert className="size-16 text-destructive mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-foreground">Inspection Blocked</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Developer tools and inspection have been disabled for security and copyright protection. Please close developer tools to resume previewing.
        </p>
      </div>
    );
  }

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center w-full select-none transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-neutral-950 p-1.5 sm:p-3 h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col justify-between"
          : "bg-transparent md:bg-neutral-900/90 rounded-none md:rounded-2xl p-0 md:p-4 shadow-none md:shadow-2xl border-0 md:border md:border-border/40"
      }`}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onContextMenu={(e) => isPublicClientView && e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Desktop / Tablet Top Controls Toolbar */}
      <div className="sticky top-0 z-30 hidden md:flex items-center justify-between gap-2 w-full max-w-4xl px-3 sm:px-4 py-2 mb-3 bg-neutral-900/85 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-xl">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 truncate max-w-xs">
          <Eye className="size-3.5 text-accent shrink-0" />
          <span className="truncate">{title || (leadName ? `${leadName}'s Review` : "Presentation Review")}</span>
        </div>

        {/* Center: Slide Pagination */}
        {fileType === "pdf" && numPages > 1 ? (
          <div className="flex items-center gap-1.5 bg-neutral-800/90 rounded-lg px-2 py-1 text-xs font-semibold shadow-inner border border-neutral-700/60">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-25 transition-colors"
              title="Previous Slide (← Left Arrow)"
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              onClick={() => setShowSlideSheet(true)}
              className="px-1 text-white font-mono text-xs tracking-tight hover:text-accent transition-colors flex items-center gap-1"
              title="Click to view all slides"
            >
              <span>{currentPage}</span>
              <span className="text-neutral-500 font-normal">/</span>
              <span>{numPages}</span>
              <LayoutGrid className="size-3 text-neutral-400 ml-0.5" />
            </button>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-25 transition-colors"
              title="Next Slide (→ Right Arrow)"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-neutral-400">
            <Sparkles className="size-3 text-accent" />
            <span>Responsive Auto-Fit Active</span>
          </div>
        )}

        {/* Right: Rotate, Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1">
          {/* Rotate 90° Clockwise */}
          <button
            onClick={handleRotateClockwise}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              rotation !== 0
                ? "bg-accent/20 text-accent border border-accent/30 font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
            title={`Rotate 90° Clockwise (R key) • Currently: ${rotation}°`}
          >
            <RotateCw className="size-4" />
            {rotation !== 0 && <span className="text-[10px] font-mono">{rotation}°</span>}
          </button>

          {/* Reset Rotation if rotated */}
          {rotation !== 0 && (
            <button
              onClick={handleResetRotation}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Reset rotation to 0°"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}

          <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

          {/* Zoom Out */}
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </button>

          {/* Zoom Level Reset */}
          <button
            onClick={() => setZoomLevel(1.0)}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono text-neutral-300 hover:text-accent hover:bg-neutral-800/80 transition-colors min-w-[42px] text-center"
            title="Click to reset to 100% Auto-Fit"
          >
            {zoomPercent === 100 ? "Fit" : `${zoomPercent}%`}
          </button>

          {/* Zoom In */}
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </button>

          <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg transition-all ${
              isFullscreen
                ? "bg-accent text-accent-foreground shadow-md"
                : "text-neutral-300 hover:text-white hover:bg-neutral-800"
            }`}
            title={isFullscreen ? "Exit Fullscreen (Esc or F)" : "Fullscreen Mode (F)"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Main Responsive Viewport Wrapper */}
      <div
        ref={viewportWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex items-center justify-center w-full transition-all ${
          isFullscreen
            ? "flex-1 min-h-0 w-full"
            : rotation === 90 || rotation === 270
            ? "h-[54vh] min-h-[300px] max-h-[580px]"
            : "h-[50vh] min-h-[220px] max-h-[580px] md:h-[64vh] md:min-h-[420px] md:max-h-[640px]"
        }`}
        style={{
          overflow: zoomLevel > 1.05 ? "auto" : "hidden",
          touchAction: zoomLevel > 1.05 ? "pan-x pan-y" : "pan-y",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin",
        }}
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-neutral-950/60 backdrop-blur-sm rounded-xl">
            <Loader2 className="size-8 sm:size-9 text-accent animate-spin mb-2" />
            <span className="text-xs text-white/90 font-medium tracking-tight">
              Rendering slide {currentPage}...
            </span>
          </div>
        )}

        {/* Error Fallback */}
        {error ? (
          <div className="p-6 text-center text-rose-300 text-xs sm:text-sm max-w-md bg-rose-950/40 rounded-xl border border-rose-800/40">
            {error}
          </div>
        ) : (
          <div className="relative transition-transform duration-100 ease-out m-auto flex items-center justify-center shrink-0">
            {/* Slide Frame with Layered Protection */}
            <div
              className="relative rounded-xl shadow-2xl overflow-hidden border border-white/10 bg-white"
              style={{
                maxWidth: "none",
                maxHeight: "none",
              }}
            >
              {/* Main Pure HTML5 Canvas Layer */}
              <canvas
                ref={canvasRef}
                className="block pointer-events-none"
                style={{
                  display: "block",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
              />

              {/* Forensic Watermark Canvas Layer (Overlay) */}
              <canvas
                ref={watermarkCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{
                  mixBlendMode: "multiply",
                  display: "block",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
              />

              {/* Transparent Shield (Blocks touch callout, drag, save, inspect) */}
              <div
                className="absolute inset-0 z-10 cursor-default"
                style={{
                  background: "transparent",
                  WebkitTouchCallout: "none",
                  userSelect: "none",
                }}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>

            {/* Desktop Floating Left Arrow (Previous Slide) */}
            {fileType === "pdf" && numPages > 1 && currentPage > 1 && (
              <button
                type="button"
                onClick={goToPrevPage}
                className="hidden md:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 size-9 sm:size-11 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-white/20 text-white items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95"
                title="Previous slide (← Left Arrow)"
              >
                <ChevronLeft className="size-5 sm:size-6" />
              </button>
            )}

            {/* Desktop Floating Right Arrow (Next Slide) */}
            {fileType === "pdf" && numPages > 1 && currentPage < numPages && (
              <button
                type="button"
                onClick={goToNextPage}
                className="hidden md:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 size-9 sm:size-11 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-white/20 text-white items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95"
                title="Next slide (→ Right Arrow)"
              >
                <ChevronRight className="size-5 sm:size-6" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Slide Progress Line for Mobile */}
      {fileType === "pdf" && numPages > 1 && (
        <div className="flex md:hidden w-full max-w-sm px-1 mt-1.5 h-1 bg-neutral-800/80 rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentPage / numPages) * 100}%` }}
          />
        </div>
      )}

      {/* Mobile Floating Action & Navigation Capsule */}
      <div className="flex md:hidden items-center justify-between gap-1.5 w-full max-w-sm mx-auto mt-2 px-2.5 py-1.5 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-xl">
        {/* Left: Slide Navigation Pill */}
        {fileType === "pdf" && numPages > 1 ? (
          <div className="flex items-center bg-neutral-800/90 rounded-xl p-0.5 border border-white/5 shadow-inner">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="size-8.5 rounded-lg flex items-center justify-center text-white disabled:opacity-20 active:scale-95 transition-all hover:bg-neutral-700/60"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="size-4.5" />
            </button>

            {/* Slide Pill: Tapping opens thumbnail drawer */}
            <button
              onClick={() => setShowSlideSheet(true)}
              className="px-2 py-1 text-[11px] font-mono font-bold text-white flex items-center gap-1 active:scale-95 transition-all hover:text-accent"
              title="Tap to browse all slides"
            >
              <span>{currentPage}</span>
              <span className="text-neutral-500 font-normal">/</span>
              <span>{numPages}</span>
              <LayoutGrid className="size-3 text-accent shrink-0 ml-0.5" />
            </button>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className="size-8.5 rounded-lg flex items-center justify-center text-white disabled:opacity-20 active:scale-95 transition-all hover:bg-neutral-700/60"
              aria-label="Next Slide"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium px-2">
            <Eye className="size-3.5 text-accent" />
            <span>Document Preview</span>
          </div>
        )}

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Rotate 90° Clockwise */}
          <button
            onClick={handleRotateClockwise}
            className={`h-9 px-2.5 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 border ${
              rotation !== 0
                ? "bg-accent text-accent-foreground font-bold border-accent shadow-md shadow-accent/25"
                : "bg-neutral-800/90 text-neutral-200 border-white/5 hover:bg-neutral-700/70"
            }`}
            title={`Rotate 90° (Current: ${rotation}°)`}
            aria-label="Rotate slide"
          >
            <RotateCw className="size-3.5" />
            <span className="text-[10px] font-mono font-bold">{rotation !== 0 ? `${rotation}°` : "90°"}</span>
          </button>

          {/* Reset rotation if rotated */}
          {rotation !== 0 && (
            <button
              onClick={handleResetRotation}
              className="size-9 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 active:scale-95 text-neutral-300 flex items-center justify-center border border-white/5 transition-all"
              title="Reset rotation to 0°"
              aria-label="Reset rotation to 0"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}

          {/* Zoom Toggle */}
          <button
            onClick={() => {
              setZoomLevel((prev) => (prev < 1.3 ? 1.6 : prev < 2.0 ? 2.2 : 1.0));
            }}
            className="h-9 px-2.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 active:scale-95 text-neutral-200 text-[11px] font-mono font-semibold flex items-center justify-center border border-white/5 transition-all"
            title="Tap to cycle zoom"
          >
            {zoomLevel > 1.8 ? "2.2x" : zoomLevel > 1.2 ? "1.6x" : "Fit"}
          </button>

          {/* Fullscreen / Expand Mode */}
          <button
            onClick={toggleFullscreen}
            className={`size-9 rounded-xl flex items-center justify-center transition-all active:scale-95 border ${
              isFullscreen
                ? "bg-accent text-accent-foreground border-accent shadow-md"
                : "bg-neutral-800/90 text-neutral-200 border-white/5 hover:bg-neutral-700/70"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen presentation"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Confidentiality & Gesture Footers (Hidden during fullscreen presentation mode) */}
      {!isFullscreen && (
        <>
          {/* Mobile Subtle Security & Gesture Footer */}
          <div className="flex md:hidden mt-2 items-center justify-center gap-1.5 text-[10px] text-neutral-400 px-2 text-center">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Protected Sandbox • Pinch to Zoom • Swipe Slides</span>
          </div>

          {/* Desktop Confidentiality Footer */}
          <div className="hidden md:flex mt-2.5 flex-wrap items-center justify-between w-full max-w-4xl text-[11px] text-neutral-400 px-2 gap-1.5">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Protected Sandbox • Swipe / Double-Tap / Pinch to Zoom</span>
            </span>
            <div className="flex items-center gap-2">
              {rotation !== 0 && (
                <span className="text-accent font-semibold flex items-center gap-1">
                  <RotateCw className="size-3" />
                  <span>Rotated {rotation}°</span>
                </span>
              )}
              {companyName && <span className="font-medium text-neutral-300 truncate max-w-[150px]">{companyName}</span>}
            </div>
          </div>
        </>
      )}

      {/* Slide Thumbnails & Quick Scrubber Bottom Sheet Modal */}
      {showSlideSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowSlideSheet(false)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Pull Handle for mobile */}
            <div className="w-10 h-1 bg-neutral-700/80 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-accent" />
                <h3 className="text-sm font-bold text-white">Jump to Slide</h3>
                <span className="text-[11px] text-neutral-400 font-mono">({numPages} slides)</span>
              </div>
              <button
                onClick={() => setShowSlideSheet(false)}
                className="size-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Close slide sheet"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Slider Scrubber */}
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Slide Scrubber</span>
                <span className="font-mono text-white font-bold">{currentPage} of {numPages}</span>
              </div>
              <input
                type="range"
                min="1"
                max={numPages}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer h-2 bg-neutral-800 rounded-lg appearance-none"
              />
            </div>

            {/* Slide Grid Buttons */}
            <div
              className="flex-1 overflow-y-auto max-h-60 grid grid-cols-4 sm:grid-cols-5 gap-2 pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setCurrentPage(pageNum);
                      setShowSlideSheet(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      isActive
                        ? "bg-accent text-accent-foreground border-accent shadow-md shadow-accent/25 scale-105"
                        : "bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border-neutral-700/60"
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400">Slide</span>
                    <span className="text-base font-bold font-mono mt-0.5">{pageNum}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowSlideSheet(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
