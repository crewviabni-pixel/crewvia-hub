import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
  Layers,
  CheckCircle2,
  Search,
  TrendingUp,
  Loader2,
  UploadCloud,
  FileCheck2,
  Files,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Bookmark,
  FolderGit2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAllPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  clearAllPortfolioData,
  togglePortfolioPublish,
  togglePortfolioFeatured,
  generateFallbackCover,
  syncPortfolioToPublicCloud,
  subscribeToPortfolioSync,
  type PortfolioItem,
  type PortfolioSlide,
} from "@/lib/portfolio-api";
import { PORTFOLIO_CATEGORIES } from "@/lib/portfolio-sample-decks";
import {
  uploadPresentationCloudFile,
  extractSlidesFromPdf,
  processImageFilesAsSlides,
} from "@/lib/presentation-uploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PresentationLightroomModal } from "@/components/PresentationLightroomModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portfolio-manager")({
  component: AdminPortfolioPage,
});

const CATEGORIES = PORTFOLIO_CATEGORIES;

function AdminPortfolioPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // In-Manager Presentation Preview State (Direct modal preview without opening page)
  const [previewDeck, setPreviewDeck] = useState<PortfolioItem | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PortfolioItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showCrmSelect, setShowCrmSelect] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formCategory, setFormCategory] = useState<PortfolioItem["category"]>("Presentations");
  const [formTagline, setFormTagline] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCoverUrl, setFormCoverUrl] = useState("");
  const [formPdfUrl, setFormPdfUrl] = useState("");
  const [formMetrics, setFormMetrics] = useState<string>("");
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formPublished, setFormPublished] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formSlides, setFormSlides] = useState<PortfolioSlide[]>([]);
  const [selectedCrmWorkId, setSelectedCrmWorkId] = useState<string>("");

  // Direct File Upload State
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const batchImageInputRef = useRef<HTMLInputElement>(null);

  // Fetch Items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-portfolio-items"],
    queryFn: fetchAllPortfolioItems,
  });

  // Real-time cross-tab synchronization: keep all tabs updated without wiping or reloads
  useEffect(() => {
    const unsubscribe = subscribeToPortfolioSync(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Safe auto-sync: only syncs when items is populated (never wipes on empty initial state)
  useEffect(() => {
    if (items && items.length > 0) {
      syncPortfolioToPublicCloud(items).catch(() => {});
    }
  }, [items]);

  // Fetch All Work Items & Leads from CRM for 1-click import with Star ⭐ indicator
  const { data: crmWorkItems = [] } = useQuery({
    queryKey: ["crm-work-items-for-portfolio"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("work_items")
          .select("id, type, status, file_url, created_at, lead_id, leads(id, name, company, phone)")
          .order("created_at", { ascending: false });
        if (error) {
          console.error("Error fetching CRM work items:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error("Failed to query CRM work items:", err);
        return [];
      }
    },
  });

  // Sort and deduplicate CRM work items:
  // Automatically EXCLUDES any CRM project that is already added to the portfolio (until it is deleted)
  const sortedCrmWorkItems = useMemo(() => {
    // Collect all work_item_ids and client/title references already added to portfolio
    const existingWorkItemIds = new Set<string>();
    const existingTitles = new Set<string>();

    for (const item of items) {
      // If we are currently editing an item, don't block its own work_item_id
      if (editingItem && item.id === editingItem.id) continue;

      if (item.work_item_id) {
        existingWorkItemIds.add(item.work_item_id);
      }
      if (item.title) {
        existingTitles.add(item.title.trim().toLowerCase());
      }
      if (item.client_name) {
        existingTitles.add(item.client_name.trim().toLowerCase());
      }
    }

    // Filter CRM projects: exclude any that are already live/added in the portfolio
    const available = crmWorkItems.filter((work: any) => {
      // 1. Direct work_item_id check
      if (existingWorkItemIds.has(work.id)) {
        return false;
      }

      // 2. Lead name / company matching check
      const leadName = (work.leads?.name || work.leads?.company || "").trim().toLowerCase();
      if (leadName && existingTitles.has(leadName)) {
        return false;
      }

      // 3. Lead title pattern check (e.g. "ATAMJEET SINGH — Design Draft")
      const typeLabel = work.type === "presentation" ? "Presentation Deck" : "Design Draft";
      const expectedTitle = `${leadName} — ${typeLabel}`.toLowerCase();
      if (existingTitles.has(expectedTitle)) {
        return false;
      }

      return true;
    });

    return available.sort((a, b) => {
      const aHasFile = Boolean(a.file_url);
      const bHasFile = Boolean(b.file_url);
      if (aHasFile && !bHasFile) return -1;
      if (!aHasFile && bHasFile) return 1;
      const nameA = a.leads?.name || a.leads?.company || "";
      const nameB = b.leads?.name || b.leads?.company || "";
      return nameA.localeCompare(nameB);
    });
  }, [crmWorkItems, items, editingItem]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormClient("");
    setFormCategory("Presentations");
    setFormTagline("");
    setFormDescription("");
    setFormCoverUrl("");
    setFormPdfUrl("");
    setFormMetrics("");
    setFormDisplayOrder(items.length + 1);
    setFormPublished(true);
    setFormFeatured(false);
    setFormSlides([]);
    setSelectedCrmWorkId("");
    setShowCrmSelect(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormClient(item.client_name);
    setFormCategory(item.category || "Presentations");
    setFormTagline(item.tagline || "");
    setFormDescription(item.description || "");
    setFormCoverUrl(item.cover_image_url);
    setFormPdfUrl(item.pdf_url || "");
    setFormMetrics((item.metrics || []).join(", "));
    setFormDisplayOrder(item.display_order || 0);
    setFormPublished(item.published);
    setFormFeatured(item.featured);
    setFormSlides(item.slides || []);
    setSelectedCrmWorkId(item.work_item_id || "");
    setShowCrmSelect(Boolean(item.work_item_id));
    setIsModalOpen(true);
  };

  // Process uploaded presentation file (PDF or Image)
  const processUploadedFile = async (file: File) => {
    if (!file) return;

    setIsProcessingFile(true);
    setUploadStatusText("Uploading presentation to cloud storage...");
    try {
      const cloudUrl = await uploadPresentationCloudFile(file);
      setFormPdfUrl(cloudUrl);

      // Auto-suggest title if empty
      if (!formTitle.trim()) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setFormTitle(cleanName);
      }

      // If PDF, extract slides automatically in high-resolution
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setUploadStatusText("Extracting high-resolution slides from PDF...");
        const result = await extractSlidesFromPdf(file);
        if (result.coverUrl) {
          setFormCoverUrl(result.coverUrl);
        }
        if (result.slides && result.slides.length > 0) {
          setFormSlides(result.slides);
        }
        const slideCountTag = `${result.pageCount} Slides`;
        setFormMetrics((prev) => (prev ? `${prev}, ${slideCountTag}` : slideCountTag));
        toast.success(`Extracted ${result.slides.length} slides from PDF successfully!`);
      } else if (file.type.startsWith("image/")) {
        setFormCoverUrl(cloudUrl);
        if (formSlides.length === 0) {
          setFormSlides([
            {
              id: `slide-1-${Date.now()}`,
              slide_number: 1,
              title: "Cover Slide",
              preview_url: cloudUrl,
            },
          ]);
        }
        toast.success("Cover slide uploaded successfully!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process presentation file");
    } finally {
      setIsProcessingFile(false);
      setUploadStatusText("");
      if (singleFileInputRef.current) singleFileInputRef.current.value = "";
    }
  };

  // Direct File Upload (via input file)
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  // Batch Image Processing
  const processBatchImages = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessingFile(true);
    setUploadStatusText(`Uploading ${files.length} slide images...`);
    try {
      const { coverUrl, slides } = await processImageFilesAsSlides(files);
      if (!formCoverUrl && coverUrl) {
        setFormCoverUrl(coverUrl);
      }
      setFormSlides((prev) => {
        const combined = [...prev, ...slides];
        return combined.map((s, idx) => ({ ...s, slide_number: idx + 1 }));
      });
      toast.success(`Added ${slides.length} slides to presentation sequence!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload slide images");
    } finally {
      setIsProcessingFile(false);
      setUploadStatusText("");
      if (batchImageInputRef.current) batchImageInputRef.current.value = "";
    }
  };

  // Batch Image Upload for Multiple Slides
  const handleBatchImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await processBatchImages(files);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    if (files[0].type === "application/pdf" || files[0].name.toLowerCase().endsWith(".pdf")) {
      await processUploadedFile(files[0]);
    } else if (files.length > 1) {
      await processBatchImages(files);
    } else {
      await processUploadedFile(files[0]);
    }
  };

  // 1-Click Import from CRM Work item with Auto-Import of Stored Draft / Presentation File
  const handleSelectCrmWork = async (workId: string) => {
    setSelectedCrmWorkId(workId);
    if (!workId) return;
    const work = crmWorkItems.find((w: any) => w.id === workId);
    if (!work) return;

    const leadName = work.leads?.name || work.leads?.company || "Client Project";
    const typeLabel = work.type === "presentation" ? "Presentation Deck" : "Design Draft";

    // Auto-fill Title and Client if not customized
    if (!formTitle.trim() || formTitle.includes("—")) {
      setFormTitle(`${leadName} — ${typeLabel}`);
    }
    if (!formClient.trim()) {
      setFormClient(leadName);
    }

    // Auto-import file link if stored in database
    if (work.file_url) {
      const fileUrl = work.file_url.trim();
      setFormPdfUrl(fileUrl);

      const isPdf = fileUrl.toLowerCase().includes(".pdf");

      if (isPdf) {
        setIsProcessingFile(true);
        setUploadStatusText(`Extracting presentation slides from stored draft for ${leadName}...`);
        try {
          const result = await extractSlidesFromPdf(fileUrl);
          if (result.coverUrl) {
            setFormCoverUrl(result.coverUrl);
          }
          if (result.slides && result.slides.length > 0) {
            setFormSlides(result.slides);
          }
          const slideCountTag = `${result.pageCount} Slides`;
          setFormMetrics((prev) => (prev ? `${prev}, ${slideCountTag}` : slideCountTag));
          toast.success(`⭐ Imported stored draft & extracted ${result.slides.length} slides for ${leadName}!`);
        } catch (err: any) {
          console.warn("Could not parse PDF slides from URL, using direct file link reference:", err);
          setFormCoverUrl(fileUrl);
          if (formSlides.length === 0) {
            setFormSlides([
              {
                id: `slide-1-${Date.now()}`,
                slide_number: 1,
                title: "Cover Slide",
                preview_url: fileUrl,
              },
            ]);
          }
          toast.success(`⭐ Imported stored draft file link for ${leadName}!`);
        } finally {
          setIsProcessingFile(false);
          setUploadStatusText("");
        }
      } else {
        // Image or other media format
        setFormCoverUrl(fileUrl);
        if (formSlides.length === 0) {
          setFormSlides([
            {
              id: `slide-1-${Date.now()}`,
              slide_number: 1,
              title: "Cover Slide",
              preview_url: fileUrl,
            },
          ]);
        }
        toast.success(`⭐ Imported stored presentation image for ${leadName}!`);
      }
    } else {
      toast.info(`Selected ${leadName}. No draft/presentation file is saved yet for this work item.`);
    }
  };

  // Save Item
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    // Deduplication check: prevent adding the same project twice
    if (!editingItem) {
      if (selectedCrmWorkId) {
        const existingByWork = items.find((it: any) => it.work_item_id === selectedCrmWorkId);
        if (existingByWork) {
          toast.error(`"${existingByWork.title}" is already in your portfolio.`);
          return;
        }
      }

      const duplicateTitle = items.find(
        (it: any) =>
          it.title?.trim().toLowerCase() === formTitle.trim().toLowerCase() &&
          it.client_name?.trim().toLowerCase() === formClient.trim().toLowerCase()
      );
      if (duplicateTitle) {
        toast.error(`A presentation titled "${formTitle.trim()}" is already present in your portfolio.`);
        return;
      }
    }

    const metricsArray = formMetrics
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let updatedSlides = [...formSlides];

    // Determine clean cover URL (guarantees saving never fails on empty or raw PDF cover)
    let finalCoverUrl = formCoverUrl.trim();
    if (!finalCoverUrl || finalCoverUrl.toLowerCase().endsWith(".pdf")) {
      if (
        updatedSlides.length > 0 &&
        updatedSlides[0].preview_url &&
        !updatedSlides[0].preview_url.toLowerCase().endsWith(".pdf")
      ) {
        finalCoverUrl = updatedSlides[0].preview_url;
      } else if (formPdfUrl.trim() && !formPdfUrl.trim().toLowerCase().endsWith(".pdf")) {
        finalCoverUrl = formPdfUrl.trim();
      } else {
        finalCoverUrl = generateFallbackCover(formTitle, formCategory, formClient);
      }
    }

    if (updatedSlides.length === 0) {
      updatedSlides = [
        {
          id: `slide-1-${Date.now()}`,
          slide_number: 1,
          title: "Cover Slide",
          preview_url: finalCoverUrl,
        },
      ];
    }

    try {
      if (editingItem) {
        const updated = await updatePortfolioItem(editingItem.id, {
          title: formTitle.trim(),
          client_name: formClient.trim(),
          category: formCategory,
          tagline: formTagline.trim(),
          description: formDescription.trim(),
          cover_image_url: finalCoverUrl,
          pdf_url: formPdfUrl.trim() || undefined,
          metrics: metricsArray,
          display_order: Number(formDisplayOrder) || 0,
          published: formPublished,
          featured: formFeatured,
          slides: updatedSlides,
          slide_count: updatedSlides.length,
          work_item_id: selectedCrmWorkId || undefined,
        });

        // Instant UI cache update (0ms latency)
        queryClient.setQueryData(["admin-portfolio-items"], (prev: any) => {
          if (!prev) return [updated];
          return prev.map((item: any) => (item.id === updated.id ? updated : item));
        });
        queryClient.setQueryData(["published-portfolio-showcase"], (prev: any) => {
          if (!prev) return [updated];
          return prev.map((item: any) => (item.id === updated.id ? updated : item));
        });

        toast.success("Presentation updated successfully!");
      } else {
        const created = await createPortfolioItem({
          title: formTitle.trim(),
          client_name: formClient.trim(),
          category: formCategory,
          tagline: formTagline.trim(),
          description: formDescription.trim(),
          cover_image_url: finalCoverUrl,
          pdf_url: formPdfUrl.trim() || undefined,
          metrics: metricsArray,
          display_order: Number(formDisplayOrder) || 0,
          published: formPublished,
          featured: formFeatured,
          slides: updatedSlides,
          slide_count: updatedSlides.length,
          work_item_id: selectedCrmWorkId || undefined,
        });

        // Instant UI cache update (0ms latency)
        queryClient.setQueryData(["admin-portfolio-items"], (prev: any) => [created, ...(prev || [])]);
        queryClient.setQueryData(["published-portfolio-showcase"], (prev: any) => [created, ...(prev || [])]);

        toast.success("Presentation published to portfolio!");
      }

      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save presentation");
    }
  };

  // Delete Item
  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      setIsDeleting(true);
      const deletedId = deleteConfirmItem.id;
      await deletePortfolioItem(deletedId);

      // Instant UI cache update
      queryClient.setQueryData(["admin-portfolio-items"], (prev: any) =>
        (prev || []).filter((item: any) => item.id !== deletedId)
      );
      queryClient.setQueryData(["published-portfolio-showcase"], (prev: any) =>
        (prev || []).filter((item: any) => item.id !== deletedId)
      );

      toast.success("Presentation deleted successfully.");
      setDeleteConfirmItem(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      await queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete presentation");
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear All Projects Handler
  const handleClearAllProjects = async () => {
    try {
      setIsClearingAll(true);
      await clearAllPortfolioData();

      // Instant UI cache reset
      queryClient.setQueryData(["admin-portfolio-items"], []);
      queryClient.setQueryData(["published-portfolio-showcase"], []);

      toast.success("All portfolio presentations removed. Clean slate active.");
      setIsClearAllDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      await queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to clear portfolio projects");
    } finally {
      setIsClearingAll(false);
    }
  };

  // Toggle Publish
  const handleTogglePublish = async (item: PortfolioItem, val: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await togglePortfolioPublish(item.id, val);
      queryClient.setQueryData(["admin-portfolio-items"], (prev: any) =>
        (prev || []).map((i: any) => (i.id === item.id ? { ...i, published: val } : i))
      );
      queryClient.setQueryData(["published-portfolio-showcase"], (prev: any) =>
        (prev || []).map((i: any) => (i.id === item.id ? { ...i, published: val } : i))
      );
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
      toast.success(val ? "Published live on client showcase!" : "Moved to private drafts.");
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (item: PortfolioItem, val: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await togglePortfolioFeatured(item.id, val);
      queryClient.setQueryData(["admin-portfolio-items"], (prev: any) =>
        (prev || []).map((i: any) => (i.id === item.id ? { ...i, featured: val } : i))
      );
      queryClient.setQueryData(["published-portfolio-showcase"], (prev: any) =>
        (prev || []).map((i: any) => (i.id === item.id ? { ...i, featured: val } : i))
      );
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-items"] });
      queryClient.invalidateQueries({ queryKey: ["published-portfolio-showcase"] });
      toast.success(val ? "Pinned as featured presentation!" : "Unpinned.");
    } catch (err) {
      toast.error("Failed to update featured flag");
    }
  };

  // Copy Public Client URL
  const handleCopyShowcaseUrl = (deckId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = deckId ? `${origin}/portfolio?deck=${deckId}` : `${origin}/portfolio`;
    navigator.clipboard.writeText(url);
    setCopiedId(deckId || "general");
    toast.success(deckId ? "Direct presentation link copied for client!" : "Showcase landing page link copied!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Remove slide in modal
  const handleRemoveSlideFromModal = (indexToRemove: number) => {
    const filtered = formSlides.filter((_, idx) => idx !== indexToRemove);
    const renumbered = filtered.map((s, idx) => ({ ...s, slide_number: idx + 1 }));
    setFormSlides(renumbered);
  };

  // Filtered Items
  const filteredList = items.filter((item) => {
    const matchCat =
      categoryFilter === "All" ||
      item.category?.toLowerCase() === categoryFilter.toLowerCase();
    const matchSearch =
      !searchTerm.trim() ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalDecks = items.length;
  const publishedDecks = items.filter((i) => i.published).length;
  const totalViews = items.reduce((acc, curr) => acc + (curr.view_count || 0), 0);
  const featuredCount = items.filter((i) => i.featured).length;

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Manual 1-click cloud sync (pushes all current presentations to Supabase storage registry)
  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      const success = await syncPortfolioToPublicCloud(items);
      if (success) {
        toast.success(`⭐ Synced ${items.length} presentations to live cloud showcase!`);
      } else {
        toast.info("Cloud sync attempted. Ensure your admin session is active.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to sync to cloud");
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <AppShell
      title="Portfolio Showcase"
      subtitle="Manage your presentation portfolio and directly upload presentations with automatic slide extraction"
      actions={
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleManualCloudSync}
            disabled={isSyncingCloud}
            className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 sm:px-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-all shadow-xs flex-1 sm:flex-initial"
            title="Sync all current presentation decks to live cloud showcase"
          >
            {isSyncingCloud ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UploadCloud className="size-3.5" />
            )}
            <span>Sync Cloud</span>
          </button>

          <a
            href="/portfolio"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl border border-border/80 bg-card hover:bg-secondary px-3 sm:px-4 text-xs font-semibold text-foreground transition-all shadow-xs hover:border-foreground/20 flex-1 sm:flex-initial"
          >
            <span>Live Showcase</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>

          <button
            onClick={() => handleCopyShowcaseUrl()}
            className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl border border-border/80 bg-card hover:bg-secondary px-3 sm:px-4 text-xs font-semibold text-foreground transition-all shadow-xs hover:border-foreground/20 flex-1 sm:flex-initial"
          >
            {copiedId === "general" ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5 text-muted-foreground" />
            )}
            <span className="hidden xs:inline">Copy Client Link</span>
            <span className="xs:hidden">Copy Link</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 h-9 sm:h-10 rounded-xl bg-primary hover:bg-primary/90 px-3.5 sm:px-4 text-xs font-semibold text-primary-foreground transition-all shadow-md active:scale-95 w-full sm:w-auto"
          >
            <Plus className="size-4" />
            <span>Upload Presentation</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Total Decks</span>
              <div className="size-7 sm:size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{totalDecks}</span>
              <span className="text-[11px] sm:text-xs text-muted-foreground">Projects</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Live Published</span>
              <div className="size-7 sm:size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{publishedDecks}</span>
              <span className="text-[11px] sm:text-xs text-emerald-600 font-semibold">Live client</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Featured</span>
              <div className="size-7 sm:size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Bookmark className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{featuredCount}</span>
              <span className="text-[11px] sm:text-xs text-muted-foreground">Pinned</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Client Views</span>
              <div className="size-7 sm:size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <TrendingUp className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{totalViews.toLocaleString()}</span>
              <span className="text-[11px] sm:text-xs text-muted-foreground">Impressions</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar with the requested Categories */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-card p-2.5 sm:p-3 rounded-2xl border border-border/80 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search presentations by title, client, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 h-9 sm:h-10 text-xs sm:text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
            <button
              onClick={() => setCategoryFilter("All")}
              className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                categoryFilter === "All"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Presentation Cards Grid - LARGER CARD SIZING & VIBRANT BALANCED HOVER */}
        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-3 text-xs sm:text-sm">Loading presentations...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-20 px-6 text-center border-2 border-dashed border-border/80 rounded-3xl bg-card max-w-xl mx-auto space-y-4">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <img src="/logo.png" alt="Crewvia" className="size-9 object-contain" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">No Presentations Yet</h4>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Directly upload your presentation deck (PDF or images). Slides and cover previews will be extracted automatically!
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-95"
              >
                <UploadCloud className="size-4" />
                <span>Upload Presentation</span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD RESPONSIVE MANAGER GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-black/20 transition-all duration-300 border border-border/80 bg-card"
              >
                {/* Presentation Thumbnail Stage */}
                <div
                  onClick={() => {
                    setPreviewDeck(item);
                    setPreviewSlideIndex(0);
                  }}
                  className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-neutral-950 cursor-pointer"
                >
                  {/* Full-Bleed High-Res Slide Cover Image */}
                  <img
                    src={item.cover_image_url}
                    alt={item.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Top Badges (Category & Slide count) */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] sm:text-[11px] font-semibold text-white border border-white/20 shadow-sm">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/20">
                      <span
                        className={`size-1.5 rounded-full ${
                          item.published ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      <span>{item.slide_count || item.slides?.length || 1} slides</span>
                    </div>
                  </div>

                  {/* Bottom Title Bar (Visible on mobile and desktop resting state) */}
                  <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 bg-gradient-to-t from-black/85 via-black/30 to-transparent sm:group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1 drop-shadow">
                      {item.title}
                    </h3>
                    <p className="text-xs text-white/75 line-clamp-1 mt-0.5">
                      {item.client_name || "Confidential Client"}
                    </p>
                  </div>

                  {/* DESKTOP HOVER OVERLAY (Hidden on mobile < sm, revealed on desktop hover) */}
                  <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 backdrop-blur-[2px] p-4 sm:p-5 flex-col justify-between text-white opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {/* Top Row: Category tag, slide count, and live toggle */}
                    <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] sm:text-[11px] font-semibold text-white border border-white/25">
                        {item.category}
                      </span>

                      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                        <span className="text-[10px] sm:text-[11px] font-medium text-white/80">
                          {item.published ? "Live" : "Draft"}
                        </span>
                        <Switch
                          checked={item.published}
                          onCheckedChange={(val) => handleTogglePublish(item, val)}
                          className="scale-75"
                        />
                      </div>
                    </div>

                    {/* Bottom Section: Details, Tagline & Action Buttons */}
                    <div className="space-y-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-white/70 line-clamp-1">
                          {item.client_name || "Client Presentation"}
                        </p>
                      </div>

                      {item.tagline && (
                        <p className="text-xs text-white/85 line-clamp-2 leading-relaxed">
                          {item.tagline}
                        </p>
                      )}

                      {/* Bottom Row: Featured Switch & Action Buttons */}
                      <div
                        className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                          <span className="text-[10px] sm:text-[11px] text-white/70">Featured:</span>
                          <Switch
                            checked={item.featured}
                            onCheckedChange={(val) => handleToggleFeatured(item, val)}
                            className="scale-75"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleCopyShowcaseUrl(item.id, e)}
                            title="Copy direct presentation link for client"
                            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                          >
                            {copiedId === item.id ? (
                              <Check className="size-4 text-emerald-400" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewDeck(item);
                              setPreviewSlideIndex(0);
                            }}
                            title="Preview presentation modal"
                            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                          >
                            <Eye className="size-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                            title="Edit presentation details"
                            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                          >
                            <Edit2 className="size-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmItem(item);
                            }}
                            title="Delete presentation"
                            className="p-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MOBILE DEDICATED ACTION BAR (Touch-Friendly, Always Visible on < sm) */}
                <div className="sm:hidden p-3 bg-card border-t border-border/70 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {/* Live/Draft Switch */}
                    <div className="flex items-center gap-2 bg-secondary/70 px-2.5 py-1 rounded-lg border border-border/60">
                      <span className="text-[11px] font-semibold text-foreground">
                        {item.published ? "Live" : "Draft"}
                      </span>
                      <Switch
                        checked={item.published}
                        onCheckedChange={(val) => handleTogglePublish(item, val)}
                        className="scale-75"
                      />
                    </div>

                    {/* Featured Switch */}
                    <div className="flex items-center gap-1.5 bg-secondary/70 px-2.5 py-1 rounded-lg border border-border/60">
                      <span className="text-[11px] text-muted-foreground font-medium">Featured</span>
                      <Switch
                        checked={item.featured}
                        onCheckedChange={(val) => handleToggleFeatured(item, val)}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  {/* Quick Action Touch Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-border/50">
                    <button
                      onClick={() => {
                        setPreviewDeck(item);
                        setPreviewSlideIndex(0);
                      }}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                    >
                      <Eye className="size-3.5 text-primary" />
                      <span>View</span>
                    </button>

                    <button
                      onClick={(e) => handleCopyShowcaseUrl(item.id, e)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                    >
                      {copiedId === item.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                      <span>Link</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold"
                    >
                      <Edit2 className="size-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IN-APP PRESENTATION LIGHTROOM PREVIEW MODAL (NO SEPARATE PAGE OPENED) */}
      {previewDeck && (
        <PresentationLightroomModal
          deck={previewDeck}
          slideIndex={previewSlideIndex}
          onSlideChange={setPreviewSlideIndex}
          onClose={() => setPreviewDeck(null)}
          isAdmin={true}
          onEdit={() => {
            const d = previewDeck;
            setPreviewDeck(null);
            handleOpenEdit(d);
          }}
          onShare={() => handleCopyShowcaseUrl(previewDeck.id)}
          isCopied={copiedId === previewDeck.id}
        />
      )}

      {/* REDESIGNED PRESENTATION UPLOAD MODAL: SPACIOUS, INTUITIVE, EASY TO INSERT & UNDERSTAND */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[96vw] max-w-3xl md:max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl border-border/80 shadow-2xl bg-card">
          {/* Modal Header */}
          <DialogHeader className="p-4 sm:p-6 md:p-7 border-b border-border/70 bg-secondary/20 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="size-9 sm:size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Crewvia" className="size-5 sm:size-6 object-contain" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-display truncate">
                  {editingItem ? "Edit Presentation Deck" : "Upload Presentation Deck"}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                  Directly upload PDF or images. Cover slide and slide sequence are extracted automatically.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={singleFileInputRef}
            onChange={handleDirectFileUpload}
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
          />
          <input
            type="file"
            ref={batchImageInputRef}
            onChange={handleBatchImageUpload}
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
          />

          {/* Modal Body Form */}
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1 min-h-0">
              {/* SECTION 1: PROMINENT DRAG & DROP FILE UPLOAD ZONE */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessingFile && singleFileInputRef.current?.click()}
                className={`relative p-5 sm:p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer select-none ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : isProcessingFile
                    ? "border-primary/60 bg-primary/5 cursor-wait"
                    : formPdfUrl || formCoverUrl
                    ? "border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-500"
                    : "border-primary/30 hover:border-primary bg-primary/[0.02] hover:bg-primary/[0.05]"
                }`}
              >
                {isProcessingFile ? (
                  <div className="space-y-3 py-2 text-center">
                    <Loader2 className="size-9 sm:size-10 text-primary animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{uploadStatusText}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Extracting high-resolution presentation slides and generating previews...
                      </p>
                    </div>
                  </div>
                ) : formPdfUrl || formCoverUrl ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                    <div className="size-12 sm:size-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="size-7 sm:size-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Presentation Deck Uploaded & Processed
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formSlides.length} slide{formSlides.length === 1 ? "" : "s"} ready in showcase sequence
                      </p>
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                        Click or drop a new file anytime to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3 py-2 sm:py-3">
                    <div className="size-12 sm:size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                      <UploadCloud className="size-6 sm:size-7" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold text-foreground">
                        Click to browse or drag & drop presentation file
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        Supports PDF presentation decks (all slides auto-extracted) or slide images (JPG, PNG)
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-[11px] font-mono text-muted-foreground border">
                      <span>Cloud Storage & High-Res Slide Extraction Enabled</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: PROMINENT SELECT CRM PROJECT / STORED DRAFT (1-CLICK AUTO-IMPORT) */}
              {!editingItem && (
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <FolderGit2 className="size-4 text-cyan-500" />
                      <span>Select CRM Project (Auto-Import Stored Drafts & Files)</span>
                    </label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {sortedCrmWorkItems.length} available to import • ⭐ = Stored Draft Ready
                    </span>
                  </div>

                  <select
                    value={selectedCrmWorkId}
                    onChange={(e) => handleSelectCrmWork(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground font-medium focus:ring-2 focus:ring-primary/25 shadow-xs"
                  >
                    <option value="">
                      {sortedCrmWorkItems.length === 0
                        ? "-- All CRM projects are already added to your portfolio --"
                        : "-- Choose project (e.g. ATAMJEET SINGH) to auto-import stored draft --"}
                    </option>
                    {sortedCrmWorkItems.map((work: any) => {
                      const leadName = work.leads?.name || work.leads?.company || "Unnamed Client";
                      const company = work.leads?.company && work.leads?.company !== leadName ? ` (${work.leads?.company})` : "";
                      const typeLabel = work.type === "presentation" ? "Presentation" : "Draft";
                      const hasFile = Boolean(work.file_url);

                      return (
                        <option key={work.id} value={work.id}>
                          {hasFile
                            ? `⭐ ${leadName}${company} — ${typeLabel} [Stored Draft Ready]`
                            : `⚪ ${leadName}${company} — ${typeLabel}`}
                        </option>
                      );
                    })}
                  </select>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Selecting a project with <strong className="text-foreground">⭐</strong> directly imports its saved draft link from the database, pre-fills title & client, and automatically generates high-resolution slide previews.
                  </p>
                </div>
              )}

              {/* SECTION 3: PRESENTATION METADATA INPUTS (SPACIOUS, COMFORTABLE SIZING) */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Presentation Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Ventures — Series A Pitch Deck"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-sm font-medium rounded-xl border border-input/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Client / Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Ventures Inc."
                      value={formClient}
                      onChange={(e) => setFormClient(e.target.value)}
                      className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-sm font-medium rounded-xl border border-input/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-sm font-medium rounded-xl border border-input/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Highlight Metric / Tag (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Raised $14M, 16 Slides"
                      value={formMetrics}
                      onChange={(e) => setFormMetrics(e.target.value)}
                      className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-sm font-medium rounded-xl border border-input/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Tagline / Short Summary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Minimalist high-impact investment deck crafted for enterprise fintech Series A."
                    value={formTagline}
                    onChange={(e) => setFormTagline(e.target.value)}
                    className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-sm font-medium rounded-xl border border-input/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                  />
                </div>
              </div>

              {/* SECTION 4: EXTRACTED SLIDES PREVIEW STRIP */}
              <div className="pt-2 border-t border-border/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      Slide Sequence ({formSlides.length} slide{formSlides.length === 1 ? "" : "s"})
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Preview slide thumbnails extracted from your presentation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => batchImageInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Files className="size-3.5" />
                    <span>+ Add Images</span>
                  </button>
                </div>

                {formSlides.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 max-h-48 overflow-y-auto p-1">
                    {formSlides.map((slide, sIdx) => (
                      <div
                        key={slide.id || sIdx}
                        className="group relative rounded-xl border border-border/80 overflow-hidden bg-card aspect-[16/9] shadow-xs"
                      >
                        <img
                          src={slide.preview_url}
                          alt={`Slide ${sIdx + 1}`}
                          className="size-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-between px-2.5 transition-opacity">
                          <span className="text-[11px] text-white font-mono font-bold">
                            #{sIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlideFromModal(sIdx)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Remove slide"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {sIdx === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-primary text-[9px] font-semibold text-primary-foreground">
                            Cover
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center border border-dashed rounded-xl bg-secondary/20">
                    <p className="text-xs text-muted-foreground italic">
                      Upload a PDF or slide image above to populate the presentation sequence automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* MODAL FOOTER: PUBLISH TOGGLES & ACTION BUTTONS */}
            <div className="p-4 sm:p-6 border-t border-border/80 bg-card/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
              <div className="flex flex-col xs:flex-row sm:flex-row items-start xs:items-center sm:items-center gap-2.5 sm:gap-6">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
                  <Switch checked={formPublished} onCheckedChange={setFormPublished} />
                  <span>Publish Live to Client Showcase</span>
                </label>

                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
                  <Switch checked={formFeatured} onCheckedChange={setFormFeatured} />
                  <span>Featured</span>
                </label>
              </div>

              <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 sm:h-11 px-4 sm:px-5 flex-1 sm:flex-initial rounded-xl border border-border text-xs sm:text-sm font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProcessingFile}
                  className="h-10 sm:h-11 px-5 sm:px-6 flex-1 sm:flex-initial rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessingFile ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : editingItem ? (
                    "Update Presentation"
                  ) : (
                    "Save & Publish"
                  )}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => !open && !isDeleting && setDeleteConfirmItem(null)}
      >
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete Presentation?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove "{deleteConfirmItem?.title}" from the showcase portfolio? This
              action cannot be undone and will immediately sync across all client devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmItem(null)}
              disabled={isDeleting}
              className="h-10 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-10 px-4 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Delete Presentation</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLEAR ALL PROJECTS CONFIRMATION DIALOG */}
      <Dialog
        open={isClearAllDialogOpen}
        onOpenChange={(open) => !open && !isClearingAll && setIsClearAllDialogOpen(false)}
      >
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              <span>Clear All Presentations?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Are you sure you want to delete all {items.length} presentations? This will permanently wipe all
              projects from both the manager and the public showcase. No dummy or fallback projects will be shown.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={() => setIsClearAllDialogOpen(false)}
              disabled={isClearingAll}
              className="h-10 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllProjects}
              disabled={isClearingAll}
              className="h-10 px-4 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all flex items-center justify-center gap-2"
            >
              {isClearingAll ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Clearing All...</span>
                </>
              ) : (
                "Confirm Delete All"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
