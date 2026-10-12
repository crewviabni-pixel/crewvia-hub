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
  ShieldAlert,
  Loader2,
  Eye,
  Sparkles,
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

  // Responsive Layout State
  // Unscaled native dimensions of the current slide / page
  const [nativeDimensions, setNativeDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  // Measured container dimensions available for the slide
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 900,
    height: 600,
  });

  // User zoom multiplier relative to Auto-Fit (1.0 = 100% Fit)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [devToolsDetected, setDevToolsDetected] = useState(false);

  // Touch Swipe tracking
  const touchStartX = useRef<number | null>(null);

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
      const w = Math.floor(rect.width);
      // In fullscreen, utilize available height minus padding; inline use measured height
      const h = Math.floor(rect.height || (isFullscreen ? window.innerHeight - 130 : Math.min(window.innerHeight * 0.72, 680)));
      if (w > 0 && h > 0) {
        setContainerSize({ width: w, height: h });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(wrapper);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [isFullscreen]);

  // 3. DevTools protection for public client preview
  useEffect(() => {
    if (!isPublicClientView) return;

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

  // Fullscreen Toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // 5. Keyboard Navigation (Arrow Keys, Fullscreen F, PageUp/PageDown, Space)
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
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoomLevel(1.0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, goToNextPage, goToPrevPage, toggleFullscreen]);

  // 6. Fullscreen Change Event Sync
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Reset zoom to auto-fit on fullscreen toggle for crisp presentation view
      setZoomLevel(1.0);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

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

    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(100, 116, 139, 0.13)";
    ctx.textAlign = "center";

    const stepX = 280;
    const stepY = 150;

    for (let x = -displayW * 1.5; x < displayW * 2.5; x += stepX) {
      for (let y = -displayH * 1.5; y < displayH * 2.5; y += stepY) {
        ctx.fillText(text1, x, y);
        ctx.fillText(text2, x, y + 18);
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

  // 9. Production-Grade Canvas Rendering (Aspect-Ratio Preserved Auto-Fit)
  useEffect(() => {
    if (devToolsDetected) return;

    let isCancelled = false;

    // Helper: Calculate Auto-Fit Dimensions (Contain scale)
    const computeFit = (nativeW: number, nativeH: number) => {
      // Safe padding so the document breathes inside container
      const horizontalPadding = isFullscreen ? 32 : 24;
      const verticalPadding = isFullscreen ? 32 : 20;

      const availW = Math.max(containerSize.width - horizontalPadding, 260);
      const availH = Math.max(containerSize.height - verticalPadding, 240);

      const scaleX = availW / nativeW;
      const scaleY = availH / nativeH;
      // "contain" scale: slide fills as much space as possible without stretching or cropping
      const baseFitScale = Math.min(scaleX, scaleY);

      const displayW = Math.round(nativeW * baseFitScale * zoomLevel);
      const displayH = Math.round(nativeH * baseFitScale * zoomLevel);

      return { baseFitScale, displayW, displayH };
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

        // 2. Compute exact fit with current zoom
        const { baseFitScale, displayW, displayH } = computeFit(nativeW, nativeH);

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 3. Sharp rendering using devicePixelRatio
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const renderScale = baseFitScale * zoomLevel * dpr;
        const renderViewport = page.getViewport({ scale: renderScale });

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
            // Ignore cancelled render tasks
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

        const { displayW, displayH } = computeFit(nativeW, nativeH);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(displayW * dpr);
        canvas.height = Math.floor(displayH * dpr);
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    containerSize,
    fileUrl,
    drawWatermark,
    devToolsDetected,
    isFullscreen,
  ]);

  // Touch Swipe Handlers for mobile review
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const deltaX = touch.clientX - touchStartX.current;
      if (Math.abs(deltaX) > 45) {
        if (deltaX < 0) {
          goToNextPage();
        } else {
          goToPrevPage();
        }
      }
    }
    touchStartX.current = null;
  };

  // 10. Inspection Blocked Screen
  if (devToolsDetected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center bg-background rounded-2xl border border-destructive/30">
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
          ? "fixed inset-0 z-50 bg-neutral-950 p-2 sm:p-4 h-screen w-screen overflow-hidden"
          : "bg-neutral-900/90 rounded-2xl p-2.5 sm:p-4 shadow-2xl border border-border/40"
      }`}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onContextMenu={(e) => isPublicClientView && e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Top Floating Controls Toolbar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 w-full max-w-4xl px-3 sm:px-4 py-2 mb-3 bg-neutral-900/85 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-xl">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 truncate max-w-[160px] sm:max-w-xs">
          <Eye className="size-3.5 text-accent shrink-0" />
          <span className="truncate">{title || (leadName ? `${leadName}'s Review` : "Presentation Review")}</span>
        </div>

        {/* Center: Interactive Slide Pagination */}
        {fileType === "pdf" && numPages > 1 ? (
          <div className="flex items-center gap-1 sm:gap-1.5 bg-neutral-800/90 rounded-lg px-2 py-1 text-xs font-semibold shadow-inner border border-neutral-700/60">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-25 transition-colors"
              title="Previous Slide (← Left Arrow)"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-1 text-white font-mono text-[11px] sm:text-xs tracking-tight">
              {currentPage} <span className="text-neutral-500 font-normal">/</span> {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-25 transition-colors"
              title="Next Slide (→ Right Arrow)"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="hidden md:inline-block ml-1 text-[10px] text-neutral-400 font-normal border-l border-neutral-700 pl-2">
              Keys: <kbd className="px-1 py-0.5 rounded bg-neutral-950 font-mono text-neutral-300">←</kbd> <kbd className="px-1 py-0.5 rounded bg-neutral-950 font-mono text-neutral-300">→</kbd>
            </span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400">
            <Sparkles className="size-3 text-accent" />
            <span>Responsive Auto-Fit Active</span>
          </div>
        )}

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </button>

          <button
            onClick={() => setZoomLevel(1.0)}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono text-neutral-300 hover:text-accent hover:bg-neutral-800/80 transition-colors min-w-[42px] text-center"
            title="Click to reset to 100% Auto-Fit"
          >
            {zoomPercent === 100 ? "Fit" : `${zoomPercent}%`}
          </button>

          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </button>

          <button
            onClick={() => setZoomLevel(1.0)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Fit to Screen"
          >
            <RotateCcw className="size-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

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
        onTouchEnd={handleTouchEnd}
        className={`relative flex items-center justify-center w-full overflow-auto transition-all ${
          isFullscreen
            ? "flex-1 min-h-0 w-full"
            : "min-h-[380px] sm:min-h-[480px] max-h-[78vh] h-[64vh] sm:h-[72vh]"
        }`}
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-neutral-950/60 backdrop-blur-sm rounded-xl">
            <Loader2 className="size-9 text-accent animate-spin mb-2" />
            <span className="text-xs text-white/90 font-medium tracking-tight">
              Rendering slide {currentPage}...
            </span>
          </div>
        )}

        {/* Error Fallback */}
        {error ? (
          <div className="p-8 text-center text-rose-300 text-sm max-w-md bg-rose-950/40 rounded-xl border border-rose-800/40">
            {error}
          </div>
        ) : (
          <div className="relative flex items-center justify-center my-auto transition-transform duration-100 ease-out">
            {/* Slide Frame with Layered Protection */}
            <div
              className="relative rounded-lg shadow-2xl overflow-hidden border border-white/10 bg-white"
              style={{
                // Enforce exact display dimensions to prevent any CSS stretching or distortion
                maxWidth: "none",
                maxHeight: "none",
              }}
            >
              {/* Main Pure HTML5 Canvas Layer (Decoded pixels only, NO <img> or <iframe>) */}
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

            {/* Floating Left Arrow (Previous Slide) */}
            {fileType === "pdf" && numPages > 1 && currentPage > 1 && (
              <button
                type="button"
                onClick={goToPrevPage}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 size-9 sm:size-11 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95"
                title="Previous slide (← Left Arrow)"
              >
                <ChevronLeft className="size-5 sm:size-6" />
              </button>
            )}

            {/* Floating Right Arrow (Next Slide) */}
            {fileType === "pdf" && numPages > 1 && currentPage < numPages && (
              <button
                type="button"
                onClick={goToNextPage}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 size-9 sm:size-11 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95"
                title="Next slide (→ Right Arrow)"
              >
                <ChevronRight className="size-5 sm:size-6" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Confidentiality Footer & Keyboard Help */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between w-full max-w-4xl text-[11px] text-neutral-400 px-2 gap-2">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>Protected Sandbox • Download & Extraction Disabled</span>
        </span>
        <div className="flex items-center gap-3">
          {numPages > 1 && (
            <span className="hidden sm:inline text-neutral-500">
              Navigate: <kbd className="px-1 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">←</kbd> <kbd className="px-1 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">→</kbd> keys
            </span>
          )}
          {companyName && <span className="font-medium text-neutral-300">{companyName}</span>}
        </div>
      </div>
    </div>
  );
}
