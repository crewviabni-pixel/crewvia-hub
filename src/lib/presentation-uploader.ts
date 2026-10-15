import * as pdfjsLib from "pdfjs-dist";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioSlide } from "./portfolio-sample-decks";

// Configure PDF.js worker (jsdelivr CDN is fast, resilient, and CORS-friendly)
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

// Get or initialize Firebase app
function getFirebaseApp() {
  const env: any = import.meta.env;
  if (getApps().length > 0) {
    return getApp();
  }
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return initializeApp(firebaseConfig);
}

/**
 * Upload presentation file to Firebase Storage (with resilient Supabase Storage fallback)
 */
export async function uploadPresentationCloudFile(
  file: File,
  folder = "portfolio_presentations"
): Promise<string> {
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const timestamp = Date.now();
  const cloudPath = `${folder}/${timestamp}_${cleanFileName}`;

  // 1. Attempt Firebase Storage
  const env: any = import.meta.env;
  if (env.VITE_FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_PROJECT_ID) {
    try {
      const fbApp = getFirebaseApp();
      const storage = getStorage(fbApp);
      const storageRef = ref(storage, cloudPath);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || "application/pdf",
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      if (downloadUrl) {
        console.log("Uploaded successfully to Firebase Storage:", downloadUrl);
        return downloadUrl;
      }
    } catch (fbErr) {
      console.warn("Firebase Storage upload encountered error, using Supabase Storage:", fbErr);
    }
  }

  // 2. Supabase Storage Fallback (bucket 'work_files')
  const ext = file.name.split(".").pop() || "pdf";
  const supabasePath = `portfolio/${timestamp}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("work_files")
    .upload(supabasePath, file, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.warn("Supabase upload warning:", uploadError);
  }

  const { data: publicUrlData } = supabase.storage
    .from("work_files")
    .getPublicUrl(supabasePath);

  return publicUrlData.publicUrl;
}

/**
 * Extract slide images and cover from a PDF presentation in the browser.
 * Accepts either a File, Blob, ArrayBuffer, or remote PDF URL string.
 */
export async function extractSlidesFromPdf(
  input: File | Blob | ArrayBuffer | string,
  maxPages = 35
): Promise<{ coverUrl: string; slides: PortfolioSlide[]; pageCount: number }> {
  let arrayBuffer: ArrayBuffer;

  if (typeof input === "string") {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to fetch presentation from URL: HTTP ${response.status}`);
    }
    arrayBuffer = await response.arrayBuffer();
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    arrayBuffer = await input.arrayBuffer();
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pagesToProcess = Math.min(pageCount, maxPages);

  const slides: PortfolioSlide[] = [];
  let coverUrl = "";

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      // Balanced resolution: max 1280px width produces razor-sharp presentation slides while keeping payload < 80KB per slide
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetScale = Math.min(1.2, 1280 / Math.max(unscaledViewport.width, 1));
      const viewport = page.getViewport({ scale: targetScale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });

      if (ctx) {
        // Pre-fill white background for PDF transparent elements
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.76);
        let finalSlideUrl = dataUrl;

        try {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78)
          );
          if (blob) {
            const slideFile = new File([blob], `slide_${pageNum}_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            const cloudUrl = await uploadPresentationCloudFile(slideFile, "portfolio_slides");
            if (cloudUrl) {
              finalSlideUrl = cloudUrl;
            }
          }
        } catch {
          finalSlideUrl = dataUrl;
        }

        if (pageNum === 1) {
          coverUrl = finalSlideUrl;
        }
        slides.push({
          id: `pdf-slide-${pageNum}-${Date.now()}`,
          slide_number: pageNum,
          title: `Slide ${pageNum}`,
          preview_url: finalSlideUrl,
        });
      }
    } catch (err) {
      console.warn(`Failed to render PDF page ${pageNum}:`, err);
    }
  }

  return {
    coverUrl,
    slides,
    pageCount,
  };
}

/**
 * Convenience helper to extract presentation slides from a remote PDF URL directly
 */
export async function extractSlidesFromPdfUrl(
  url: string,
  maxPages = 35
) {
  return extractSlidesFromPdf(url, maxPages);
}

/**
 * Process single or multiple uploaded image files as presentation slides
 */
export async function processImageFilesAsSlides(
  files: File[]
): Promise<{ coverUrl: string; slides: PortfolioSlide[] }> {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const url = await uploadPresentationCloudFile(file, "portfolio_slides");
    uploadedUrls.push(url);
  }

  const slides: PortfolioSlide[] = uploadedUrls.map((url, idx) => ({
    id: `img-slide-${idx + 1}-${Date.now()}`,
    slide_number: idx + 1,
    title: `Slide ${idx + 1}`,
    preview_url: url,
  }));

  return {
    coverUrl: uploadedUrls[0] || "",
    slides,
  };
}
