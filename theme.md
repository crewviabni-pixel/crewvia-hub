# Crewvia Design System & Complete Theme Specification (`theme.md`)

> **Comprehensive UI/UX Architecture, Color Schemes, Geometry, Typography, Shadows, Component Styles & Grid Systems**  
> *Ready-to-use blueprint for replicating this exact theme in any modern web application.*

---

## Table of Contents
1. [Core Design Philosophy & Aesthetics](#1-core-design-philosophy--aesthetics)
2. [Typography & Font Hierarchy](#2-typography--font-hierarchy)
3. [Color Palette & Semantic Tokens (OKLCH, HEX & RGB)](#3-color-palette--semantic-tokens)
4. [Shapes, Radii, Borders & Geometry](#4-shapes-radii-borders--geometry)
5. [Shadows, Elevation & Ambient Lighting](#5-shadows-elevation--ambient-lighting)
6. [Motion, Keyframes & Micro-Interactions](#6-motion-keyframes--micro-interactions)
7. [Layout Systems, Grid Patterns & Breakpoints](#7-layout-systems-grid-patterns--breakpoints)
8. [Component Design Library & Class Tokens](#8-component-design-library--class-tokens)
9. [Status Badges, Category Tags & Accent Pills](#9-status-badges-category-tags--accent-pills)
10. [Drop-in Ready Code Templates](#10-drop-in-ready-code-templates)

---

## 1. Core Design Philosophy & Aesthetics

This theme combines **Executive B2B SaaS Utility** with **Boutique High-End Creative Studio Presentation**:
- **Clean Precision**: Crisp 1px borders, subtle 0.05 opacity background tints, high-legibility typographic scale, and tight data density.
- **Modern Perceptual Color Space (OKLCH)**: Colors are defined in OKLCH for uniform perceptual contrast between light and dark modes, preventing muddy grays or harsh neon clashes.
- **Refined Geometry**: Smooth curvature graduating from 8px (`rounded-md`) for controls, 12px–16px (`rounded-xl`/`rounded-2xl`) for panels, to 24px (`rounded-3xl`) for hero visual decks.
- **Glassmorphism & Depth**: Subtle frosted backdrops (`backdrop-blur-md`, `backdrop-blur-2xl`), ambient dot-matrices, and gentle multi-layered shadows.

---

## 2. Typography & Font Hierarchy

The project pairs a geometric, humanistic body font (`DM Sans`) with a futuristic, technical display font (`Space Grotesk`).

### 2.1 Font Families
| Role | Family | Fallback Stack | Usage |
| :--- | :--- | :--- | :--- |
| **Body & UI** | `"DM Sans"` | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | General interface, inputs, tables, cards, body copy |
| **Headings & Display** | `"Space Grotesk"` | `ui-sans-serif, system-ui, sans-serif` | Page titles (`h1`, `h2`, `h3`), stat numbers, branding logo, card titles |
| **Monospace / Data** | `font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | Slide numbers, counters, timestamps, technical indicators |

### 2.2 Google Fonts Import URL
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@500;600;700&display=swap"
  rel="stylesheet"
/>
```

### 2.3 Typographic Scale & Heading Rules

```css
/* Base Display Heading Rules */
h1, h2, h3, .font-display {
  font-family: var(--font-display);
  letter-spacing: -0.015em;
}
```

| Element / Class | Font Family | Size | Weight | Line Height | Tracking | Typical Class Combination |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **H1 (Page Title)** | Space Grotesk | `24px – 30px` (`text-2xl sm:text-3xl`) | 700 (Bold) | `1.2` (`leading-tight`) | `-0.025em` (`tracking-tight`) | `font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground` |
| **H2 (Section Header)** | Space Grotesk | `18px – 20px` (`text-lg sm:text-xl`) | 700 (Bold) | `1.25` | `-0.015em` | `font-display text-lg sm:text-xl font-bold tracking-tight text-foreground` |
| **H3 (Card / Deck Title)** | Space Grotesk | `15px – 18px` (`text-base sm:text-lg`)| 600–700 (SemiBold/Bold) | `1.3` | `-0.015em` | `font-display text-base font-semibold text-foreground` |
| **Stat Metric (Big Number)**| Space Grotesk | `24px – 30px` (`text-xl sm:text-3xl`) | 700 (Bold) | `1.0` | `-0.025em` | `font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground` |
| **Stat Label (Uppercase)** | DM Sans | `10px – 11px` (`text-[10px] sm:text-[11px]`)| 600 (SemiBold)| `1.2` | `+0.05em` (`tracking-wider`)| `text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` |
| **Body (Default UI)** | DM Sans | `14px` (`text-sm`) | 400 (Regular) | `1.5` | `normal` | `text-sm text-foreground` |
| **Muted Subtext** | DM Sans | `13px – 14px` (`text-sm`) | 400 (Regular) | `1.4` | `normal` | `text-sm text-muted-foreground` |
| **Micro Caption / Hint** | DM Sans | `11px – 12px` (`text-xs`) | 500 (Medium) | `1.3` | `normal` | `text-xs text-muted-foreground` |
| **Pill / Badge Tag** | DM Sans | `10px – 11px` (`text-[10px] sm:text-[11px]`)| 600 (SemiBold)| `1.0` | `+0.02em` | `text-[11px] font-semibold leading-none` |
| **Counter / Slide Tag**| Monospace | `10px` (`text-[10px]`) | 500 (Medium) | `1.0` | `+0.05em` (`tracking-wider`)| `font-mono text-[10px] font-medium` |

---

## 3. Color Palette & Semantic Tokens

All primary theme colors use **OKLCH format** for predictable chromaticity across OLED, sRGB, and P3 displays.

### 3.1 Light Mode Color Variables (`:root`)

| Token Variable | OKLCH Definition | Hex Equivalent | Description & Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.985 0.006 95)` | `#FBFBFC` | Page background, warm soft off-white canvas |
| `--foreground` | `oklch(0.22 0.02 250)` | `#1C2433` | Primary body text, deep navy-charcoal |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Surface for cards, containers, panels |
| `--card-foreground` | `oklch(0.22 0.02 250)` | `#1C2433` | Text on card containers |
| `--popover` | `oklch(1 0 0)` | `#FFFFFF` | Dropdown menus, selects, popovers |
| `--popover-foreground` | `oklch(0.22 0.02 250)` | `#1C2433` | Text inside popovers |
| `--primary` | `oklch(0.38 0.13 260)` | `#224494` | Royal Deep Indigo Blue (Action buttons, brand elements) |
| `--primary-foreground` | `oklch(0.985 0.006 95)` | `#FFFFFF` | Text on primary buttons and fills |
| `--secondary` | `oklch(0.95 0.01 250)` | `#EEF2F6` | Secondary actions, inactive button fills, soft chips |
| `--secondary-foreground` | `oklch(0.28 0.03 253)` | `#263245` | Text on secondary elements |
| `--muted` | `oklch(0.955 0.008 250)`| `#F0F3F8` | Inactive tab backgrounds, subtle hover highlights |
| `--muted-foreground` | `oklch(0.52 0.02 253)` | `#64748B` | Slate gray captions, timestamps, secondary labels |
| `--accent` | `oklch(0.76 0.14 165)` | `#29D698` | Luminous Emerald Teal (Sign in CTA, highlights, badges) |
| `--accent-foreground` | `oklch(0.21 0.03 165)` | `#04432C` | Deep pine text on accent background |
| `--destructive` | `oklch(0.58 0.21 25)` | `#DC2626` | Crimson red (Overdue, errors, deletions) |
| `--destructive-foreground`| `oklch(0.99 0 0)` | `#FFFFFF` | Text on destructive fills |
| `--border` | `oklch(0.905 0.01 250)`| `#E2E8F0` | Default border for cards, inputs, dividers |
| `--input` | `oklch(0.9 0.01 250)` | `#DFE5EE` | Input and field outline borders |
| `--ring` | `oklch(0.38 0.13 260)` | `#224494` | Keyboard focus ring color |
| `--sidebar` | `oklch(0.97 0.008 250)`| `#F5F7FA` | Sidebar & navigation background |
| `--sidebar-foreground`| `oklch(0.22 0.02 250)` | `#1C2433` | Sidebar text |
| `--sidebar-primary` | `oklch(0.38 0.13 260)` | `#224494` | Active nav item primary |
| `--sidebar-accent` | `oklch(0.93 0.02 165)` | `#E4FAF1` | Active navigation pill background |
| `--sidebar-accent-foreground`| `oklch(0.25 0.03 165)`| `#095237` | Active navigation pill text |

### 3.2 Dark Mode Color Variables (`.dark`)

| Token Variable | OKLCH Definition | Hex Equivalent | Description & Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.129 0.042 264.695)` | `#0B101E` | Deep obsidian midnight navy background |
| `--foreground` | `oklch(0.984 0.003 247.858)` | `#F8FAFC` | Crisp off-white text |
| `--card` | `oklch(0.208 0.042 265.755)` | `#161F33` | Elevated dark navy card surface |
| `--card-foreground` | `oklch(0.984 0.003 247.858)` | `#F8FAFC` | Text on card surface |
| `--popover` | `oklch(0.208 0.042 265.755)` | `#161F33` | Dropdown and modal surface |
| `--popover-foreground` | `oklch(0.984 0.003 247.858)` | `#F8FAFC` | Dropdown text |
| `--primary` | `oklch(0.38 0.13 260)` | `#224494` | Deep indigo royal blue |
| `--primary-foreground` | `oklch(0.985 0.006 95)` | `#FFFFFF` | Text on primary |
| `--secondary` | `oklch(0.279 0.041 260.031)` | `#222E47` | Muted dark secondary buttons/cards |
| `--secondary-foreground` | `oklch(0.984 0.003 247.858)`| `#F8FAFC` | Text on secondary elements |
| `--muted` | `oklch(0.279 0.041 260.031)` | `#222E47` | Inactive tabs and dividers |
| `--muted-foreground` | `oklch(0.704 0.04 256.788)` | `#94A3B8` | Subdued slate text |
| `--accent` | `oklch(0.76 0.14 165)` | `#29D698` | Glowing mint teal |
| `--accent-foreground` | `oklch(0.21 0.03 165)` | `#04432C` | Deep teal contrast text |
| `--destructive` | `oklch(0.704 0.191 22.216)` | `#F87171` | Vibrant red for dark mode alerts |
| `--border` | `oklch(1 0 0 / 10%)` | `rgba(255,255,255,0.10)` | 10% translucent white edge |
| `--input` | `oklch(1 0 0 / 15%)` | `rgba(255,255,255,0.15)` | 15% translucent white border |
| `--ring` | `oklch(0.38 0.13 260)` | `#224494` | Focus ring |

### 3.3 Analytics & Visualization Charts

| Token | Light Value | Dark Value | Typical Visualization |
| :--- | :--- | :--- | :--- |
| `--chart-1` | `oklch(0.38 0.13 260)` (Royal Blue) | `oklch(0.38 0.13 260)` (Royal Blue) | Total Leads / Volume / Bars |
| `--chart-2` | `oklch(0.76 0.14 165)` (Emerald Teal)| `oklch(0.76 0.14 165)` (Emerald Teal)| Conversion / Revenue / Success |
| `--chart-3` | `oklch(0.62 0.13 200)` (Cyan Blue) | `oklch(0.769 0.188 70.08)` (Amber) | Secondary Segment / Paid ratio |
| `--chart-4` | `oklch(0.68 0.15 145)` (Fresh Green) | `oklch(0.627 0.265 303.9)` (Purple)| Source Categories / Funnel Step 3 |
| `--chart-5` | `oklch(0.6 0.16 300)` (Vivid Purple) | `oklch(0.645 0.246 16.439)` (Coral) | Miscellaneous / Pending Deals |

---

## 4. Shapes, Radii, Borders & Geometry

The theme uses a mathematically nested border radius hierarchy where outer container radii cleanly enclose inner element radii without awkward pinch points.

### 4.1 Border Radius Scale (`--radius = 0.75rem` / `12px`)

| Tailwind Token | Formula / Value | Computed px | Typical Use Case |
| :--- | :--- | :--- | :--- |
| `rounded-xs` | `4px` | `4px` | Mini status dots, tooltip corners |
| `rounded-sm` | `calc(var(--radius) - 4px)` | `8px` | Small dropdown items, inside nested buttons |
| `rounded-md` | `calc(var(--radius) - 2px)` | `10px` | Form inputs, select triggers, table chips |
| `rounded-lg` | `var(--radius)` | `12px` | Standard buttons, search boxes, tab bars |
| `rounded-xl` | `calc(var(--radius) + 4px)` | `16px` | Standard cards, stat widgets, popovers |
| `rounded-2xl` | `calc(var(--radius) + 8px)` | `20px` | Dialog modals, overview metric cards |
| `rounded-3xl` | `calc(var(--radius) + 12px)`| `24px` | Showcase presentation cards, infinite canvas tiles |
| `rounded-4xl` | `calc(var(--radius) + 16px)`| `28px` | Large hero banners |
| `rounded-full` | `9999px` | Pill | Filter pills, status badges, circular icon buttons (`size-8.5`) |

### 4.2 Border Specifications
- **Standard Card Borders**: `1px solid var(--color-border)` (`border border-border/80`).
- **Accent Highlight Borders**: `border border-accent/50` or `border border-emerald-500/30`.
- **Dashed Dropzones**: `border-2 border-dashed border-border hover:border-primary/60`.
- **Translucent Dark Overlays**: `border border-white/20` or `border border-white/10`.

---

## 5. Shadows, Elevation & Ambient Lighting

Shadows are calibrated for smooth layering without heavy black smudges.

### 5.1 Elevation Hierarchy

| Level | Tailwind Utility | Box Shadow Definition | Where Used |
| :--- | :--- | :--- | :--- |
| **Flat** | `shadow-none` | `none` | Inset toolbars, flat tab containers |
| **Micro (XS)** | `shadow-xs` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | Metric stat cards, clean buttons, header pills |
| **Subtle (SM)** | `shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | Base LeadCard, interactive list items |
| **Medium (MD)** | `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Primary CTA buttons, action popups |
| **High (LG)** | `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Floating glass pills, navigation header |
| **Hover Lift (XL)**| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Presentation cards on hover (`hover:shadow-black/20`) |
| **Modal (2XL)**| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Centered dialogs, drawer panels |

### 5.2 Glows & Ambient Background Shaders

#### Studio Ambient Canvas Aura
```css
/* Radial ambient gradient for background canvas */
background-image: radial-gradient(
  ellipse 80% 80% at 50% -10%,
  rgba(59, 130, 246, 0.10),
  rgba(16, 185, 129, 0.05),
  rgba(248, 250, 252, 0)
);
```

#### Subtle Dot-Matrix Texture
```css
/* 24px subtle dot matrix background */
background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
background-size: 24px 24px;
opacity: 0.40;
```

#### Colored Button Shadows
- **Accent Glow**: `shadow-md shadow-accent/20`
- **Dark Luxury Pill Button**: `shadow-xl shadow-slate-900/15`
- **Emerald Pill**: `shadow-sm shadow-emerald-400`

---

## 6. Motion, Keyframes & Micro-Interactions

### 6.1 Shimmer Loading Effect
```css
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.animate-shimmer {
  background: linear-gradient(110deg, transparent 25%, rgba(255, 255, 255, 0.06) 50%, transparent 75%);
  background-size: 200% 100%;
  animation: shimmer 2.4s infinite linear;
}
```

### 6.2 Micro-Interactions
- **Button Press Tactility**: `active:scale-95 transition-all` or `active:scale-98`.
- **Card Hover Elevation**: `transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl`.
- **Image Zoom on Hover**: `transition-transform duration-300 group-hover:scale-105`.
- **Icon Hover Effect**: `transition-colors hover:text-foreground hover:bg-secondary`.

---

## 7. Layout Systems, Grid Patterns & Breakpoints

### 7.1 Breakpoints (`@theme inline`)
| Breakpoint | Width (px) | CSS Variable | Usage |
| :--- | :--- | :--- | :--- |
| `xs` | `384px` | `--breakpoint-xs: 24rem;` | Compact phones, micro-toolbars |
| `sm` | `640px` | `40rem` | Small tablets, two-column forms |
| `md` | `768px` | `48rem` | Desktop header swap, sidebar expand |
| `lg` | `1024px` | `64rem` | 4-column metric grid, 3-column cards |
| `xl` | `1280px` | `80rem` | Full desktop container (`max-w-7xl`) |

### 7.2 Core Layout Patterns

#### Application Shell Frame
```html
<div class="min-h-screen bg-background pb-20 md:pb-0">
  <!-- Sticky Top Navigation Header -->
  <header class="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <!-- Brand & Left Controls -->
      <!-- Center Nav Tabs -->
      <!-- Right User Actions -->
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="mx-auto max-w-7xl px-4 sm:px-6 py-6">
    <!-- Page Header (Title + Actions) -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/40">
      <div>
        <h1 class="font-display text-2xl font-bold sm:text-3xl tracking-tight text-foreground">Page Title</h1>
        <p class="mt-1 text-sm text-muted-foreground">Descriptive subtitle explaining live context.</p>
      </div>
      <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
        <!-- Action Buttons -->
      </div>
    </div>
    <!-- Dynamic Route Content -->
  </main>

  <!-- Mobile Bottom Tab Bar (< md) -->
  <nav class="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-card md:hidden">
    <!-- Mobile Nav Links -->
  </nav>
</div>
```

#### Metrics Overview Grid (4 Columns)
```html
<div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
  <!-- Card 1 -->
  <!-- Card 2 -->
  <!-- Card 3 -->
  <!-- Card 4 -->
</div>
```

#### Responsive Card Showcase Grid (3 Columns)
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
  <!-- Presentation or Project Cards -->
</div>
```

---

## 8. Component Design Library & Class Tokens

### 8.1 Buttons

#### 1. Primary Action Button
```html
<button class="inline-flex items-center justify-center gap-2 h-9 sm:h-10 rounded-xl bg-primary hover:bg-primary/90 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-primary-foreground transition-all shadow-md active:scale-95 pointer-events-auto cursor-pointer">
  <Plus className="size-4" />
  <span>Upload Presentation</span>
</button>
```

#### 2. Accent Vibrant Action Button (Mint/Teal)
```html
<button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-95">
  Sign In
</button>
```

#### 3. Emerald Success Action (e.g., "New Lead" / "Book Call")
```html
<button class="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-xs whitespace-nowrap shrink-0 transition-colors pointer-events-auto cursor-pointer">
  <Plus className="size-3.5" />
  <span>New Lead</span>
</button>
```

#### 4. Secondary / Outline Button
```html
<button class="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl border border-border/80 bg-card hover:bg-secondary px-3 sm:px-4 text-xs font-semibold text-foreground transition-all shadow-xs hover:border-foreground/20 pointer-events-auto cursor-pointer">
  <span>Live Showcase</span>
</button>
```

#### 5. Floating Glass Luxury Pill Button (Showcase)
```html
<button class="inline-flex items-center gap-2 px-5.5 h-11 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm tracking-wide active:scale-95 transition-all shadow-xl shadow-slate-900/15 border border-slate-900 pointer-events-auto cursor-pointer">
  <Calendar className="size-4 text-cyan-400 shrink-0" />
  <span>Book Call</span>
</button>
```

---

### 8.2 Cards & Surfaces

#### 1. Metric Overview / Stat Card
```html
<div class="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
  <div class="flex items-center justify-between text-muted-foreground">
    <span class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Total Decks</span>
    <div class="size-7 sm:size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Layers className="size-3.5 sm:size-4" />
    </div>
  </div>
  <div class="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
    <span class="font-display text-xl sm:text-3xl font-bold tracking-tight text-foreground">24</span>
    <span class="text-[11px] sm:text-xs text-muted-foreground">Projects</span>
  </div>
</div>
```

#### 2. Presentation Visual Deck Card (16:9 Aspect Ratio)
```html
<div class="group relative flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-black/20 transition-all duration-300 border border-border/80 bg-card">
  <!-- 16:9 Widescreen Image Stage -->
  <div class="relative aspect-[16/9] w-full overflow-hidden bg-neutral-950 cursor-pointer pointer-events-auto">
    <img src="/cover.jpg" alt="Title" class="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
    
    <!-- Top Floating Badges -->
    <div class="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
      <span class="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] sm:text-[11px] font-semibold text-white border border-white/20 shadow-sm">
        Presentations
      </span>
      <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/20">
        <span class="size-1.5 rounded-full bg-emerald-400" />
        <span>12 slides</span>
      </div>
    </div>

    <!-- Resting Gradient Title Bar -->
    <div class="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 bg-gradient-to-t from-black/85 via-black/30 to-transparent sm:group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
      <h3 class="font-display text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1 drop-shadow">
        Strategic Pitch Deck
      </h3>
      <p class="text-xs text-white/75 line-clamp-1 mt-0.5">Global Enterprise Partner</p>
    </div>
  </div>
</div>
```

---

### 8.3 Form Inputs & Select Controls

#### 1. Search Bar with Icon
```html
<div class="relative flex-1 max-w-md">
  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
  <input
    type="text"
    placeholder="Search leads, clients, or tags..."
    class="w-full h-10 pl-10 pr-4 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 shadow-xs transition-colors"
  />
</div>
```

#### 2. Native & Shadcn Select Trigger
```html
<select class="h-8.5 rounded-lg border border-border/80 bg-background/60 hover:bg-secondary/60 px-2.5 font-display font-medium text-xs shadow-none outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer">
  <option value="all">All Campaigns</option>
</select>
```

---

## 9. Status Badges, Category Tags & Accent Pills

### 9.1 Lead Lifecycle Pipeline Status Tones
Each status has an intentional pastel tint with higher contrast text and subtle border:

| Status Key | Status Label | Background | Text Color | Border Color | Exact Class String |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `take_info` | Take Info | Sky-100 | Sky-900 | Sky-300 | `bg-sky-100 text-sky-900 border-sky-300` |
| `info_taken`| Info Taken | Blue-100 | Blue-900 | Blue-300 | `bg-blue-100 text-blue-900 border-blue-300` |
| `draft_sent`| Draft Sent | Indigo-100| Indigo-900 | Indigo-300 | `bg-indigo-100 text-indigo-900 border-indigo-300`|
| `approved` | Approved | Amber-100 | Amber-900 | Amber-300 | `bg-amber-100 text-amber-900 border-amber-300` |
| `advance_received` | Advance Rec.| Orange-100| Orange-900 | Orange-300 | `bg-orange-100 text-orange-900 border-orange-300` |
| `presentation_sent`| Pres. Sent | Violet-100| Violet-900 | Violet-300 | `bg-violet-100 text-violet-900 border-violet-300` |
| `converted` | Converted | Emerald-100| Emerald-900| Emerald-300| `bg-emerald-100 text-emerald-900 border-emerald-300` |
| `lost` | Lost | Rose-100 | Rose-900 | Rose-300 | `bg-rose-100 text-rose-900 border-rose-300` |

### 9.2 Payment Status Pills
| Status Key | Status Label | Exact Class String |
| :--- | :--- | :--- |
| `unpaid` | Unpaid | `bg-rose-100 text-rose-900 border-rose-300` |
| `partial` | Partial | `bg-amber-100 text-amber-900 border-amber-300` |
| `paid` | Paid | `bg-emerald-100 text-emerald-900 border-emerald-300` |

### 9.3 Category Filter Pills
```html
<!-- Category Nav Container -->
<div class="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border/60">
  <!-- Active Category Pill -->
  <button class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground shadow-xs transition-all">
    Presentations
  </button>

  <!-- Inactive Category Pill -->
  <button class="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/60 transition-all">
    Pitch Decks
  </button>
</div>
```

---

## 10. Drop-in Ready Code Templates

### 10.1 Complete `styles.css` (Tailwind CSS v4)
Copy this entire file directly into `src/styles.css`:

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --breakpoint-xs: 24rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ring-offset-background: var(--background);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.75rem;
  --background: oklch(0.985 0.006 95);
  --foreground: oklch(0.22 0.02 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.02 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.02 250);
  --primary: oklch(0.38 0.13 260);
  --primary-foreground: oklch(0.985 0.006 95);
  --secondary: oklch(0.95 0.01 250);
  --secondary-foreground: oklch(0.28 0.03 253);
  --muted: oklch(0.955 0.008 250);
  --muted-foreground: oklch(0.52 0.02 253);
  --accent: oklch(0.76 0.14 165);
  --accent-foreground: oklch(0.21 0.03 165);
  --destructive: oklch(0.58 0.21 25);
  --destructive-foreground: oklch(0.99 0 0);
  --border: oklch(0.905 0.01 250);
  --input: oklch(0.9 0.01 250);
  --ring: oklch(0.38 0.13 260);
  --chart-1: oklch(0.38 0.13 260);
  --chart-2: oklch(0.76 0.14 165);
  --chart-3: oklch(0.62 0.13 200);
  --chart-4: oklch(0.68 0.15 145);
  --chart-5: oklch(0.6 0.16 300);
  --sidebar: oklch(0.97 0.008 250);
  --sidebar-foreground: oklch(0.22 0.02 250);
  --sidebar-primary: oklch(0.38 0.13 260);
  --sidebar-primary-foreground: oklch(0.985 0.006 95);
  --sidebar-accent: oklch(0.93 0.02 165);
  --sidebar-accent-foreground: oklch(0.25 0.03 165);
  --sidebar-border: oklch(0.9 0.01 250);
  --sidebar-ring: oklch(0.38 0.13 260);
}

.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.38 0.13 260);
  --primary-foreground: oklch(0.985 0.006 95);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.76 0.14 165);
  --accent-foreground: oklch(0.21 0.03 165);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.38 0.13 260);
  --chart-1: oklch(0.38 0.13 260);
  --chart-2: oklch(0.76 0.14 165);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.38 0.13 260);
  --sidebar-primary-foreground: oklch(0.985 0.006 95);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.38 0.13 260);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
  }

  h1, h2, h3, .font-display {
    font-family: var(--font-display);
    letter-spacing: -0.015em;
  }

  /* Universal Pointer Events & Touch Interactivity */
  button,
  [role="button"],
  input[type="button"],
  input[type="submit"],
  input[type="reset"] {
    cursor: pointer;
    pointer-events: auto;
    touch-action: manipulation;
  }

  button svg,
  [role="button"] svg {
    pointer-events: none;
  }

  button:disabled,
  button[disabled],
  [role="button"][aria-disabled="true"],
  input[type="button"]:disabled,
  input[type="submit"]:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 2.4s infinite linear;
}
```

### 10.2 Shadcn `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "src/styles.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 10.3 Utility Function (`src/lib/utils.ts`)
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
