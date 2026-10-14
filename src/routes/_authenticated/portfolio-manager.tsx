import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
  Layers,
  Calendar,
  CheckCircle2,
  Share2,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Filter,
  Image as ImageIcon,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  fetchAllPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  togglePortfolioPublish,
  togglePortfolioFeatured,
  resetPortfolioToDefault,
  type PortfolioItem,
  type PortfolioSlide,
} from "@/lib/portfolio-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portfolio-manager")({
  component: AdminPortfolioPage,
});

const CATEGORIES = [
  "Pitch Decks",
  "Sales Decks",
  "Company Profiles",
  "Keynotes",
  "Case Studies",
] as const;

function AdminPortfolioPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PortfolioItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formCategory, setFormCategory] = useState<PortfolioItem["category"]>("Pitch Decks");
  const [formTagline, setFormTagline] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCoverUrl, setFormCoverUrl] = useState("");
  const [formMetrics, setFormMetrics] = useState<string>("");
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formPublished, setFormPublished] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formSlides, setFormSlides] = useState<PortfolioSlide[]>([]);

  // Slide input helper in modal
  const [newSlideTitle, setNewSlideTitle] = useState("");
  const [newSlideUrl, setNewSlideUrl] = useState("");

  // Fetch Items
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-portfolio-items"],
    queryFn: fetchAllPortfolioItems,
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormClient("");
    setFormCategory("Pitch Decks");
    setFormTagline("");
    setFormDescription("");
    setFormCoverUrl("");
    setFormMetrics("Raised $10M, 16 Slides");
    setFormDisplayOrder(items.length + 1);
    setFormPublished(true);
    setFormFeatured(false);
    setFormSlides([]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormClient(item.client_name);
    setFormCategory(item.category);
    setFormTagline(item.tagline || "");
    setFormDescription(item.description || "");
    setFormCoverUrl(item.cover_image_url);
    setFormMetrics((item.metrics || []).join(", "));
    setFormDisplayOrder(item.display_order || 0);
    setFormPublished(item.published);
    setFormFeatured(item.featured);
    setFormSlides(item.slides || []);
    setIsModalOpen(true);
  };

  // Save Item
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formCoverUrl.trim()) {
      toast.error("Cover image URL (first slide) is required");
      return;
    }

    const metricsArray = formMetrics
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Ensure slides array has at least the cover slide
    let updatedSlides = [...formSlides];
    if (updatedSlides.length === 0) {
      updatedSlides = [
        {
          id: `slide-1-${Date.now()}`,
          slide_number: 1,
          title: "Cover Slide",
          preview_url: formCoverUrl.trim(),
        },
      ];
    }

    try {
      if (editingItem) {
        await updatePortfolioItem(editingItem.id, {
          title: formTitle.trim(),
          client_name: formClient.trim(),
          category: formCategory,
          tagline: formTagline.trim(),
          description: formDescription.trim(),
          cover_image_url: formCoverUrl.trim(),
          metrics: metricsArray,
          display_order: Number(formDisplayOrder) || 0,
          published: formPublished,
          featured: formFeatured,
          slides: updatedSlides,
          slide_count: updatedSlides.length,
        });
        toast.success("Presentation deck updated successfully!");
      } else {
        await createPortfolioItem({
          title: formTitle.trim(),
          client_name: formClient.trim(),
          category: formCategory,
          tagline: formTagline.trim(),
          description: formDescription.trim(),
          cover_image_url: formCoverUrl.trim(),
          metrics: metricsArray,
          display_order: Number(formDisplayOrder) || 0,
          published: formPublished,
          featured: formFeatured,
          slides: updatedSlides,
          slide_count: updatedSlides.length,
        });
        toast.success("New presentation deck added to portfolio!");
      }

      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save portfolio item");
    }
  };

  // Delete Item
  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deletePortfolioItem(deleteConfirmItem.id);
      toast.success("Presentation removed from portfolio.");
      setDeleteConfirmItem(null);
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete item");
    }
  };

  // Toggle Publish
  const handleTogglePublish = async (item: PortfolioItem, val: boolean) => {
    try {
      await togglePortfolioPublish(item.id, val);
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
      toast.success(val ? "Published live on client showcase!" : "Moved to private drafts.");
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (item: PortfolioItem, val: boolean) => {
    try {
      await togglePortfolioFeatured(item.id, val);
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
      toast.success(val ? "Pinned as featured presentation!" : "Removed from featured.");
    } catch (err) {
      toast.error("Failed to update featured flag");
    }
  };

  // Copy Public Client URL
  const handleCopyShowcaseUrl = (deckId?: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = deckId ? `${origin}/portfolio?deck=${deckId}` : `${origin}/portfolio`;
    navigator.clipboard.writeText(url);
    setCopiedId(deckId || "general");
    toast.success(deckId ? "Direct presentation link copied for client!" : "Showcase landing page link copied!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Add Slide to list in Modal
  const handleAddSlideToModal = () => {
    if (!newSlideUrl.trim()) {
      toast.error("Please enter a slide image URL or data URI");
      return;
    }
    const nextNum = formSlides.length + 1;
    setFormSlides([
      ...formSlides,
      {
        id: `slide-${nextNum}-${Date.now()}`,
        slide_number: nextNum,
        title: newSlideTitle.trim() || `Slide ${nextNum}`,
        preview_url: newSlideUrl.trim(),
      },
    ]);
    setNewSlideTitle("");
    setNewSlideUrl("");
  };

  // Remove slide
  const handleRemoveSlideFromModal = (indexToRemove: number) => {
    const filtered = formSlides.filter((_, idx) => idx !== indexToRemove);
    const renumbered = filtered.map((s, idx) => ({ ...s, slide_number: idx + 1 }));
    setFormSlides(renumbered);
  };

  // Filtered Items
  const filteredList = items.filter((item) => {
    const matchCat = categoryFilter === "All" || item.category === categoryFilter;
    const matchSearch =
      !searchTerm.trim() ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  // Calculate overview metrics
  const totalDecks = items.length;
  const publishedDecks = items.filter((i) => i.published).length;
  const totalViews = items.reduce((acc, curr) => acc + (curr.view_count || 0), 0);
  const featuredCount = items.filter((i) => i.featured).length;

  return (
    <AppShell
      title="Portfolio Showcase Manager"
      subtitle="Manage sample presentations, client links, and public showcase cards"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/portfolio"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8.5 rounded-lg border border-border/80 bg-background/60 px-3 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <span>Live Showcase</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>

          <button
            onClick={() => handleCopyShowcaseUrl()}
            className="inline-flex items-center gap-1.5 h-8.5 rounded-lg border border-border/80 bg-background/60 px-3 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            {copiedId === "general" ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5 text-muted-foreground" />
            )}
            <span>Copy Client Link</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 h-8.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Plus className="size-3.5" />
            <span>New Presentation</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Decks</span>
              <Layers className="size-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{totalDecks}</span>
              <span className="text-xs text-muted-foreground">Showcase items</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Live Published</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{publishedDecks}</span>
              <span className="text-xs text-emerald-600 font-medium">Visible to clients</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Featured</span>
              <Sparkles className="size-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{featuredCount}</span>
              <span className="text-xs text-muted-foreground">Pinned top</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Client Views</span>
              <TrendingUp className="size-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{totalViews.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Impressions</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search presentations by title, client, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategoryFilter("All")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === "All"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Presentation List Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-7 animate-spin" />
            <p className="mt-2 text-xs">Loading presentations...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center border rounded-xl bg-card">
            <ImageIcon className="mx-auto size-10 text-muted-foreground/40 mb-2" />
            <h4 className="text-sm font-semibold">No presentations found</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search or category filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* 16:9 Thumbnail (First Slide Preloaded!) */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={item.cover_image_url}
                    alt={item.title}
                    className="size-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-medium text-white border border-white/10">
                      {item.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.published
                          ? "bg-emerald-500/90 text-white"
                          : "bg-amber-500/90 text-white"
                      }`}
                    >
                      {item.published ? "Live" : "Draft"}
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-white/90">
                    {item.slide_count || item.slides?.length || 1} slides
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.client_name || "Confidential Client"}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2">
                      {item.tagline || item.description}
                    </p>

                    {/* Metric Pills */}
                    {item.metrics && item.metrics.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {item.metrics.slice(0, 3).map((metric, mIdx) => (
                          <span
                            key={mIdx}
                            className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Toggles Bar */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Live:</span>
                        <Switch
                          checked={item.published}
                          onCheckedChange={(val) => handleTogglePublish(item, val)}
                          className="scale-75 origin-left"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Featured:</span>
                        <Switch
                          checked={item.featured}
                          onCheckedChange={(val) => handleToggleFeatured(item, val)}
                          className="scale-75 origin-left"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyShowcaseUrl(item.id)}
                        title="Copy direct presentation link for client"
                        className="p-1.5 rounded-lg border border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === item.id ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>

                      <a
                        href={`/portfolio?deck=${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in client view"
                        className="p-1.5 rounded-lg border border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Edit presentation"
                        className="p-1.5 rounded-lg border border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="size-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmItem(item)}
                        title="Delete presentation"
                        className="p-1.5 rounded-lg border border-border/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingItem ? "Edit Presentation Deck" : "Add Presentation to Showcase"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the presentation metadata, first slide cover, and slide deck sequence.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Presentation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex AI — Series A Pitch Deck"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Client / Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Technologies Inc."
                  value={formClient}
                  onChange={(e) => setFormClient(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Tagline / Highlight Summary
              </label>
              <input
                type="text"
                placeholder="e.g. 16-slide high-stakes investor pitch deck that closed a $18.5M Series A."
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                First Slide Cover Image URL * (Preloaded Image)
              </label>
              <input
                type="text"
                required
                placeholder="https://... or data:image/svg+xml;..."
                value={formCoverUrl}
                onChange={(e) => setFormCoverUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                This image is loaded immediately when clients open the portfolio page.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Highlight Metrics (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="Raised $18.5M, 14 VCs Bid, 16 Slides"
                value={formMetrics}
                onChange={(e) => setFormMetrics(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Slide Deck Images Section */}
            <div className="pt-2 border-t border-border space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Slide Deck Sequence ({formSlides.length} slides)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Flip through in review mode
                </span>
              </label>

              {/* Add Slide Sub-form */}
              <div className="flex gap-2 items-center bg-secondary/50 p-2.5 rounded-lg border">
                <input
                  type="text"
                  placeholder="Slide Title (e.g. Market Traction)"
                  value={newSlideTitle}
                  onChange={(e) => setNewSlideTitle(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded border bg-background"
                />
                <input
                  type="text"
                  placeholder="Slide Image URL / SVG URI"
                  value={newSlideUrl}
                  onChange={(e) => setNewSlideUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded border bg-background"
                />
                <button
                  type="button"
                  onClick={handleAddSlideToModal}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium shrink-0"
                >
                  + Add Slide
                </button>
              </div>

              {/* Existing slides preview strip */}
              {formSlides.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 max-h-48 overflow-y-auto p-1">
                  {formSlides.map((slide, sIdx) => (
                    <div
                      key={slide.id || sIdx}
                      className="group relative rounded-lg border overflow-hidden bg-card aspect-[16/9]"
                    >
                      <img
                        src={slide.preview_url}
                        alt={`Slide ${sIdx + 1}`}
                        className="size-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-between px-2 transition-opacity">
                        <span className="text-[10px] text-white font-mono font-bold">
                          #{sIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSlideFromModal(sIdx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={formPublished} onCheckedChange={setFormPublished} />
                  <span>Publish to Showcase</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={formFeatured} onCheckedChange={setFormFeatured} />
                  <span>Featured Deck</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  {editingItem ? "Update Presentation" : "Save Presentation"}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => !open && setDeleteConfirmItem(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete Presentation?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove "{deleteConfirmItem?.title}" from the portfolio? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <button
              onClick={() => setDeleteConfirmItem(null)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90"
            >
              Confirm Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
