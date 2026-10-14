import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  MessageCircle,
  Share2,
  Check,
  X,
  ArrowUpRight,
  Layers,
  Maximize2,
  Minimize2,
  Eye,
  Flame,
  CheckCircle2,
  Compass,
  Building2,
  Phone,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { fetchPublishedPortfolioItems, incrementPortfolioViews, type PortfolioItem, type PortfolioSlide } from "@/lib/portfolio-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

interface PortfolioSearchParams {
  deck?: string | undefined;
  cat?: string | undefined;
}

export const Route = createFileRoute("/portfolio")({
  validateSearch: (search: Record<string, unknown>): PortfolioSearchParams => {
    return {
      deck: typeof search["deck"] === "string" ? search["deck"] : undefined,
      cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Crewvia Studio — Presentation Portfolio & Visual Showcase" },
      {
        name: "description",
        content:
          "Explore our curated presentation decks, pitch decks, enterprise sales decks, and visual narratives. First slides preloaded in high-definition canvas.",
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

const CATEGORIES = [
  "All",
  "Pitch Decks",
  "Sales Decks",
  "Company Profiles",
  "Keynotes",
  "Case Studies",
] as const;

type CategoryType = (typeof CATEGORIES)[number];

const CREWVIA_TEAM_WHATSAPP = "917223804653";

function PublicPortfolioShowcasePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

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

  // Presentation in Full Lightroom Mode
  const [activeDeck, setActiveDeck] = useState<PortfolioItem | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Floating "Book a call" Consultation Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedDeckForBooking, setSelectedDeckForBooking] = useState<PortfolioItem | null>(null);

  // Booking Form State
  const [bookingName, setBookingName] = useState("");
  const [bookingCompany, setBookingCompany] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingType, setBookingType] = useState<string>("Pitch Deck");
  const [bookingNote, setBookingNote] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Link copy feedback
  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);

  // Fetch Published presentations
  const { data: portfolioItems = [], isLoading } = useQuery({
    queryKey: ["published-portfolio-showcase"],
    queryFn: fetchPublishedPortfolioItems,
    staleTime: 60 * 1000,
  });

  // Handle direct deep-link parameter ?deck=<id>
  useEffect(() => {
    if (search.deck && portfolioItems.length > 0) {
      const found = portfolioItems.find((item) => item.id === search.deck);
      if (found) {
        setActiveDeck(found);
        setActiveSlideIndex(0);
        incrementPortfolioViews(found.id);
      }
    }
  }, [search.deck, portfolioItems]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (activeCategory === "All") return portfolioItems;
    return portfolioItems.filter((item) => item.category === activeCategory);
  }, [portfolioItems, activeCategory]);

  // Keyboard navigation for Lightroom Modal
  useEffect(() => {
    if (!activeDeck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDeckModal();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setActiveSlideIndex((prev) => {
          const total = activeDeck.slides?.length || 1;
          return prev < total - 1 ? prev + 1 : 0;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveSlideIndex((prev) => {
          const total = activeDeck.slides?.length || 1;
          return prev > 0 ? prev - 1 : total - 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDeck]);

  const openDeckModal = (deck: PortfolioItem, initialSlideIndex = 0) => {
    setActiveDeck(deck);
    setActiveSlideIndex(initialSlideIndex);
    incrementPortfolioViews(deck.id);

    // Sync URL without full reload
    navigate({
      search: (prev) => ({ ...prev, deck: deck.id }),
      replace: true,
    });
  };

  const closeDeckModal = () => {
    setActiveDeck(null);
    setActiveSlideIndex(0);
    navigate({
      search: (prev) => {
        const copy = { ...prev };
        delete copy.deck;
        return copy;
      },
      replace: true,
    });
  };

  const handleCategorySelect = (cat: CategoryType) => {
    setActiveCategory(cat);
    navigate({
      search: (prev) => {
        if (cat === "All") {
          const copy = { ...prev };
          delete copy.cat;
          return copy;
        }
        return { ...prev, cat: cat.toLowerCase().replace(/\s+/g, "-") };
      },
      replace: true,
    });
  };

  const handleShareDeck = (deck: PortfolioItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = `${window.location.origin}/portfolio?deck=${deck.id}`;
    navigator.clipboard.writeText(url);
    setCopiedDeckId(deck.id);
    toast.success(`Direct presentation link copied! Share this with your clients.`);
    setTimeout(() => setCopiedDeckId(null), 2500);
  };

  const handleOpenBooking = (deck?: PortfolioItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDeckForBooking(deck || null);
    if (deck) {
      setBookingType(deck.category.replace(/s$/, ""));
      setBookingNote(`Inquiring about presentation style similar to "${deck.title}".`);
    } else {
      setBookingType("Pitch Deck");
      setBookingNote("");
    }
    setBookingSuccess(false);
    setIsBookModalOpen(true);
  };

  const handleWhatsAppDirect = (deck?: PortfolioItem | null) => {
    const text = deck
      ? `Hi Crewvia team, I'm reviewing your presentation portfolio ("${deck.title}" - ${deck.category}) and would like to schedule a call to craft a deck for my company.`
      : `Hi Crewvia team, I'm reviewing your presentation showcase and would like to discuss building a high-impact presentation deck for my business.`;
    const waUrl = `https://wa.me/${CREWVIA_TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingPhone.trim()) {
      toast.error("Please provide your WhatsApp or Phone number.");
      return;
    }
    setIsSubmittingBooking(true);
    try {
      // Send directly via WhatsApp link or trigger lead creation
      const summary = `Client Inquiry from Showcase: ${bookingName || "Client"} (${bookingCompany || "Company"}), Phone: ${bookingPhone}, Deck Type: ${bookingType}, Note: ${bookingNote}`;
      console.log("Inquiry logged:", summary);
      setBookingSuccess(true);
      toast.success("Consultation request received! Redirecting to WhatsApp for instant confirmation...");
      setTimeout(() => {
        handleWhatsAppDirect(selectedDeckForBooking);
        setIsBookModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#07080c] text-white selection:bg-rose-500 selection:text-white font-sans overflow-x-hidden">
      {/* Background Ambient Mesh Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] left-1/4 w-[650px] h-[650px] rounded-full bg-rose-600/10 blur-[140px] transform -translate-x-1/2" />
        <div className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[160px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[700px] h-[700px] rounded-full bg-cyan-600/10 blur-[180px]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Ultra-Minimal Top Header */}
      <header className="relative z-20 w-full px-6 md:px-12 pt-7 pb-4 flex items-center justify-between border-b border-white/[0.05] bg-[#07080c]/60 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="size-8 rounded-lg bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 p-[1px] flex items-center justify-center shadow-lg shadow-rose-950/40">
            <div className="size-full bg-[#0a0c14] rounded-[7px] flex items-center justify-center">
              <span className="text-white font-black tracking-tighter text-xs">CV</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-semibold tracking-tight text-white flex items-center gap-2">
                Crewvia Studio
                <span className="text-[10px] tracking-wider uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  Visuals
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide hidden sm:block">
              Intellectual Presentation Decks & Visual Artifacts
            </p>
          </div>
        </div>

        {/* Right Info & Live Counter */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{portfolioItems.length} Verified Decks</span>
          </div>

          <button
            onClick={() => handleOpenBooking()}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#0a0c14] font-medium text-xs tracking-wide hover:bg-white/90 active:scale-95 transition-all shadow-md shadow-white/10"
          >
            <Calendar className="size-3.5 text-rose-600" />
            <span>Book Consultation</span>
          </button>
        </div>
      </header>

      {/* Main Spatial Showcase Canvas */}
      <main className="relative z-10 w-full px-4 sm:px-8 md:px-12 py-8 pb-36 max-w-[1720px] mx-auto">
        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
            <div className="size-10 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
            <p className="text-sm font-mono tracking-wider uppercase text-white/50">
              Loading Presentation Canvases...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8 border border-white/[0.06] rounded-3xl bg-white/[0.02]">
            <Compass className="size-12 text-white/20 mb-3" />
            <h3 className="text-lg font-medium text-white/80">No decks found in this category</h3>
            <p className="text-sm text-white/40 mt-1 max-w-sm">
              Try switching back to "All" to browse our complete collection of presentation works.
            </p>
            <button
              onClick={() => handleCategorySelect("All")}
              className="mt-5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-all"
            >
              Reset to All
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 auto-rows-fr">
            {filteredItems.map((deck, idx) => (
              <PresentationCard
                key={deck.id}
                deck={deck}
                index={idx}
                onOpen={(initialSlide) => openDeckModal(deck, initialSlide)}
                onShare={(e) => handleShareDeck(deck, e)}
                onBook={(e) => handleOpenBooking(deck, e)}
                isCopied={copiedDeckId === deck.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Pill Filter Dock (Bottom Center) - Hexcode Design Pattern */}
      <nav
        aria-label="Category Filter Dock"
        className="fixed bottom-7 left-1/2 transform -translate-x-1/2 z-40 max-w-[94vw] sm:max-w-max"
      >
        <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-[#12141e]/85 backdrop-blur-2xl border border-white/[0.14] shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            const count =
              category === "All"
                ? portfolioItems.length
                : portfolioItems.filter((i) => i.category === category).length;

            return (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`relative px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-200 select-none flex items-center gap-1.5 ${
                  isActive
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40 font-semibold"
                    : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                <span>{category}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-black/30 text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Pill (Bottom Right) - Reference Match: "Book a call" */}
      <div className="fixed bottom-7 right-5 sm:right-8 z-40">
        <button
          onClick={() => handleOpenBooking()}
          className="group flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#11131a] text-white font-medium text-xs tracking-wide shadow-2xl shadow-black/90 border border-white/[0.16] hover:border-white/40 hover:bg-[#1a1d28] active:scale-95 transition-all duration-200"
        >
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-rose-500"></span>
          </span>
          <span className="font-semibold tracking-wide">Book a call</span>
          <ArrowUpRight className="size-3.5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* FULLSCREEN LIGHTROOM PRESENTATION REVIEWER */}
      {activeDeck && (
        <PresentationLightroomModal
          deck={activeDeck}
          slideIndex={activeSlideIndex}
          onSlideChange={setActiveSlideIndex}
          onClose={closeDeckModal}
          onBook={() => handleOpenBooking(activeDeck)}
          onShare={() => handleShareDeck(activeDeck)}
          isCopied={copiedDeckId === activeDeck.id}
        />
      )}

      {/* "Book a Call" Consultation Modal */}
      <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f111a] border border-white/[0.12] text-white p-6 shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="size-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2">
              <Calendar className="size-5 text-rose-400" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Schedule Deck Consultation
            </DialogTitle>
            <DialogDescription className="text-white/60 text-xs">
              {selectedDeckForBooking
                ? `Discuss crafting a deck inspired by "${selectedDeckForBooking.title}".`
                : "Connect with Crewvia's presentation architects to craft your high-stakes deck."}
            </DialogDescription>
          </DialogHeader>

          {bookingSuccess ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Redirecting to WhatsApp...</h4>
              <p className="text-xs text-white/60">
                Opening direct line with our Lead Presentation Designer.
              </p>
            </div>
          ) : (
            <form onSubmit={handleBookingSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-[11px] font-medium text-white/70 uppercase tracking-wider block mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Vance"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-white/70 uppercase tracking-wider block mb-1">
                  Company / Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quantum AI Labs"
                  value={bookingCompany}
                  onChange={(e) => setBookingCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500/80 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-white/70 uppercase tracking-wider block mb-1">
                    WhatsApp / Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+1 or +91..."
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500/80 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/70 uppercase tracking-wider block mb-1">
                    Deck Objective
                  </label>
                  <select
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#171a26] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-rose-500/80 transition-colors"
                  >
                    <option value="Pitch Deck">Pitch Deck (Fundraising)</option>
                    <option value="Sales Deck">Enterprise Sales Deck</option>
                    <option value="Company Profile">Company Profile</option>
                    <option value="Keynote">Keynote Presentation</option>
                    <option value="Case Study">Case Study Deck</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-white/70 uppercase tracking-wider block mb-1">
                  Notes / Specific Requirements
                </label>
                <textarea
                  rows={2}
                  placeholder="Timeline, number of slides, or key narrative points..."
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500/80 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs tracking-wide shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  <span>{isSubmittingBooking ? "Connecting..." : "Request Deck Consultation"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleWhatsAppDirect(selectedDeckForBooking)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/80 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <MessageCircle className="size-3.5 text-emerald-400" />
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

// PRESENTATION CARD COMPONENT (First Slide Preloaded + In-Card Quick Skimmer)
function PresentationCard({
  deck,
  index,
  onOpen,
  onShare,
  onBook,
  isCopied,
}: {
  deck: PortfolioItem;
  index: number;
  onOpen: (initialSlide: number) => void;
  onShare: (e: React.MouseEvent) => void;
  onBook: (e: React.MouseEvent) => void;
  isCopied: boolean;
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const slides = deck.slides && deck.slides.length > 0 ? deck.slides : [];
  const totalSlides = slides.length || deck.slide_count || 1;

  // Active slide image URL
  const currentSlideUrl =
    slides[currentSlideIndex]?.preview_url || deck.cover_image_url;

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  };

  return (
    <div
      onClick={() => onOpen(currentSlideIndex)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative cursor-pointer flex flex-col rounded-2xl sm:rounded-3xl bg-[#0e1017] border border-white/[0.08] hover:border-white/25 transition-all duration-300 hover:shadow-2xl hover:shadow-rose-950/20 overflow-hidden"
    >
      {/* 16:9 Slide Canvas Display (First Slide Preloaded!) */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#090b12]">
        {/* The Slide Image */}
        <img
          src={currentSlideUrl}
          alt={`${deck.title} - Slide ${currentSlideIndex + 1}`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="eager"
        />

        {/* Subtle Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Top Floating Badge Bar */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-medium tracking-wide text-white">
              {deck.category}
            </span>
            {deck.metrics && deck.metrics[0] && (
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-rose-500/20 backdrop-blur-md border border-rose-500/40 text-[10px] font-semibold text-rose-300">
                {deck.metrics[0]}
              </span>
            )}
          </div>

          {/* Interactive Slide Counter Pill */}
          <div className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono tracking-wider text-white/90">
            {currentSlideIndex + 1} / {totalSlides}
          </div>
        </div>

        {/* Quick In-Card Skimmer Controls (Revealed on Hover) */}
        {totalSlides > 1 && (
          <div
            className={`absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={handlePrevSlide}
              title="Previous slide"
              className="pointer-events-auto size-8 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={handleNextSlide}
              title="Next slide"
              className="pointer-events-auto size-8 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {/* Center Hover Pill: "Review Presentation ↗" */}
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="px-4 py-2 rounded-full bg-white/95 text-black font-semibold text-xs tracking-wide shadow-2xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <span>Review Deck</span>
            <ArrowUpRight className="size-3.5 text-black" />
          </div>
        </div>
      </div>

      {/* Card Metadata Footer */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 bg-[#0e1017]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-white group-hover:text-rose-400 transition-colors line-clamp-1">
              {deck.title}
            </h3>
          </div>
          <p className="text-xs text-white/50 tracking-wide mt-1 line-clamp-2">
            {deck.tagline || deck.description}
          </p>
        </div>

        {/* Quick Action Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.06] text-xs">
          <div className="flex items-center gap-2 text-white/40 text-[11px] font-mono">
            <span>{deck.client_name || "Confidential Client"}</span>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onShare}
              title="Copy direct presentation link"
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
            >
              {isCopied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Share2 className="size-3.5" />
              )}
            </button>
            <button
              onClick={onBook}
              title="Book presentation consultation"
              className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 text-white/70 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 text-[11px] font-medium transition-all"
            >
              Book Style
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// FULLSCREEN INTELLECTUAL LIGHTROOM MODAL
function PresentationLightroomModal({
  deck,
  slideIndex,
  onSlideChange,
  onClose,
  onBook,
  onShare,
  isCopied,
}: {
  deck: PortfolioItem;
  slideIndex: number;
  onSlideChange: (idx: number) => void;
  onClose: () => void;
  onBook: () => void;
  onShare: () => void;
  isCopied: boolean;
}) {
  const slides = deck.slides && deck.slides.length > 0 ? deck.slides : [];
  const totalSlides = slides.length || 1;
  const currentSlide = slides[slideIndex] || {
    id: "cover",
    slide_number: 1,
    title: deck.title,
    preview_url: deck.cover_image_url,
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#050609]/95 backdrop-blur-2xl text-white select-none animate-in fade-in duration-200"
    >
      {/* Top Controller Bar */}
      <div className="w-full h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/[0.08] bg-[#07080e]/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-bold tracking-tight text-white line-clamp-1">
                {deck.title}
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                {deck.category}
              </span>
            </div>
            <p className="text-[11px] text-white/40 hidden sm:block">
              {currentSlide.title || `Slide ${slideIndex + 1} of ${totalSlides}`}
            </p>
          </div>
        </div>

        {/* Center Slide Indicator */}
        <div className="px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono font-medium tracking-wider">
          Slide <span className="text-white font-bold">{slideIndex + 1}</span> / {totalSlides}
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white/80 hover:text-white transition-colors"
          >
            {isCopied ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5" />}
            <span className="hidden md:inline">{isCopied ? "Copied" : "Share"}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-colors hidden sm:inline-flex"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>

          <button
            onClick={onBook}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-rose-950/50 transition-all active:scale-95"
          >
            <Calendar className="size-3.5" />
            <span>Book This Deck</span>
          </button>
        </div>
      </div>

      {/* Main Slide Viewer Arena */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-8 overflow-hidden">
        {/* Navigation Arrow Left */}
        <button
          onClick={() =>
            onSlideChange(slideIndex > 0 ? slideIndex - 1 : totalSlides - 1)
          }
          className="absolute left-4 md:left-8 z-20 size-11 md:size-14 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
          title="Previous slide (Left Arrow)"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* The 16:9 Presentation Slide Canvas */}
        <div className="relative max-w-[1400px] w-full max-h-[78vh] aspect-[16/9] flex items-center justify-center rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-black border border-white/[0.1] bg-[#0c0e17]">
          <img
            src={currentSlide.preview_url}
            alt={currentSlide.title || `Slide ${slideIndex + 1}`}
            className="size-full object-contain pointer-events-none"
          />
        </div>

        {/* Navigation Arrow Right */}
        <button
          onClick={() =>
            onSlideChange(slideIndex < totalSlides - 1 ? slideIndex + 1 : 0)
          }
          className="absolute right-4 md:right-8 z-20 size-11 md:size-14 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
          title="Next slide (Right Arrow / Space)"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      {/* Bottom Thumbnail Scrubber Rail */}
      <div className="w-full h-24 px-6 md:px-12 py-3 border-t border-white/[0.08] bg-[#07080e]/90 flex items-center justify-center">
        <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-1 no-scrollbar">
          {slides.map((slide, sIdx) => {
            const isActive = sIdx === slideIndex;
            return (
              <button
                key={slide.id || sIdx}
                onClick={() => onSlideChange(sIdx)}
                className={`relative aspect-[16/9] h-14 rounded-lg overflow-hidden border transition-all duration-200 shrink-0 ${
                  isActive
                    ? "border-rose-500 ring-2 ring-rose-500/40 scale-105 shadow-lg shadow-rose-950/40"
                    : "border-white/15 opacity-60 hover:opacity-100 hover:border-white/40"
                }`}
              >
                <img
                  src={slide.preview_url}
                  alt={`Thumb ${sIdx + 1}`}
                  className="size-full object-cover"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                  {sIdx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
