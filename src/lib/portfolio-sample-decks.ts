// Presentation deck interfaces for Crewvia Portfolio Showcase
export interface PortfolioSlide {
  id: string;
  slide_number: number;
  title: string;
  subtitle?: string;
  preview_url: string; // Image URL or PDF canvas preview
  aspect_ratio?: string;
}

export type PortfolioCategory =
  | "Presentations"
  | "Roaster"
  | "Pitch Deck"
  | "Company Profile"
  | "Branding"
  | "Letter Head"
  | (string & {});

export interface PortfolioItem {
  id: string;
  title: string;
  client_name: string;
  category: PortfolioCategory;
  tagline: string;
  description: string;
  cover_image_url: string;
  slides: PortfolioSlide[];
  pdf_url?: string;
  metrics: string[];
  slide_count: number;
  featured: boolean;
  published: boolean;
  display_order: number;
  view_count: number;
  work_item_id?: string;
  created_at: string;
  updated_at?: string;
}

export const PORTFOLIO_CATEGORIES = [
  "Presentations",
  "Roaster",
  "Pitch Deck",
  "Company Profile",
  "Branding",
  "Letter Head",
] as const;

export const INITIAL_SAMPLE_DECKS: PortfolioItem[] = [];
