# Implementation Plan: Astro Website with POSSE Architecture

High-performance, SSG-based website using Astro, following the POSSE model. Deployed to Cloudflare Pages. Zero JS by default, islands only where interactivity is required.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Initialization & Infrastructure](#project-initialization--infrastructure)
3. [Digital Garden & POSSE Architecture](#digital-garden--posse-architecture)
4. [Performance Strategy](#performance-strategy)
5. [Extensibility & Future Work](#extensibility--future-work)
6. [Technical Reference: Gruvbox Palette](#technical-reference-gruvbox-palette)

---

## Architecture Overview

### Core Stack

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| Framework | Astro 5.x | SSG-first, island architecture, Content Layer API, zero-JS default |
| Styling | Tailwind CSS v4 | Lightning CSS engine, zero-runtime, CSS-native variables |
| Hosting | Cloudflare Pages | Global CDN, HTTP/3, Brotli, edge Workers, generous free tier |
| Package manager | pnpm | Strict dependency isolation, faster installs |
| Language | TypeScript (strict) | End-to-end type safety for content schemas and components |

### Delivery Principles

- **Static-first:** Every page is pre-rendered at build time. No SSR cold-starts.
- **Zero-JS shell:** The HTML+CSS shell loads with no JavaScript. Islands are loaded lazily only when needed.
- **Edge-cached assets:** All static assets served from Cloudflare's edge with immutable cache headers.
- **Minimal payload:** HTML < 15 KB (gzipped), CSS < 8 KB (gzipped), no blocking fonts.
- **HTTP/3 + Early Hints:** Cloudflare serves pages over HTTP/3 (QUIC) and sends `103 Early Hints` for critical assets.

---

## Project Initialization & Infrastructure

```bash
# Bootstrap
pnpm create astro@latest . --template minimal --typescript strict --git

# Core integrations
pnpm astro add tailwind
pnpm astro add sitemap
```
---

## Digital Garden & POSSE Architecture

### Wikilink Syntax in Notes

Authors write standard `[[...]]` syntax in markdown:

```markdown
---
title: "Understanding CRDT"
type: technical
maturity: budding
tags: [distributed-systems, data-structures]
---

CRDTs solve the problem I described in [[CAP Theorem]].
They relate closely to [[Operational Transforms|OT]] as well.
```

- `[[CAP Theorem]]` → resolves by title, renders as `<a href="/garden/cap-theorem/">CAP Theorem</a>`
- `[[Operational Transforms|OT]]` → display text override, same resolution logic
- Unresolved links render as `<span class="text-gruv-red">[[Unresolved]]</span>` so dead links are visible during development

### RSS Feed (`pages/rss.xml.ts`)

RSS feed sorted by date (most recently tended first). Longform and technical notes are natural candidates for syndication; TILs can be excluded or included by preference.

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(ctx: { site: URL }) {
  const notes = await getCollection('notes', n => !n.data.draft);
  return rss({
    title: 'Your Garden',
    description: 'Notes, ideas, and things I\'m learning.',
    site: ctx.site,
    items: notes
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .map(n => ({
        title:       n.data.title,
        pubDate:     n.data.date,
        description: n.data.description,
        link:        `/garden/${n.id}/`,
        categories:  n.data.tags,
      })),
    stylesheet: '/rss/pretty-feed-v3.xsl',
  });
}
```

### POSSE Syndication Architecture

Syndication is **intentionally decoupled** from the build process. Post-publish scripts write back canonical URLs into each note's frontmatter under `syndication:`. Only mature notes (`budding` or `evergreen`) are candidates for syndication.

```
src/lib/syndication/
├── types.ts          # SyndicationTarget interface
├── bluesky.ts        # AT Protocol client
├── mastodon.ts       # Mastodon API client
└── twitter.ts        # Twitter/X API v2 client
```

```ts
// src/lib/syndication/types.ts
export interface SyndicationTarget {
  name: string;
  /** Post and return the canonical URL on the target platform */
  publish(note: { title: string; url: string; description: string; tags: string[] }): Promise<string>;
}
```

Each target implements `SyndicationTarget`. A thin CLI script (`scripts/syndicate.ts`) calls the right targets and patches the markdown frontmatter. Run manually after publishing.

---

## Performance Strategy

### Payload Budget

| Asset | Target (gzipped) |
| :--- | :--- |
| HTML (landing page) | < 10 KB |
| CSS (shared) | < 6 KB |
| JS (burger menu) | < 1 KB |
| JS (graph island) | < 35 KB |
| Font (Inter var, subset) | < 40 KB |
| Font (JetBrains Mono var, subset) | < 30 KB |

### CSS Optimization

Tailwind v4 uses Lightning CSS at build time:
- Dead code elimination: only used utility classes are emitted.
- CSS nesting resolved natively.
- Vendor prefixes added automatically.
- `inlineStylesheets: 'auto'` in Astro: small per-page styles are inlined; shared styles get a separate cached file.

### Font Optimization

```bash
# Subset fonts to Latin + punctuation only
pyftsubset Inter.ttf \
  --output-file=public/fonts/inter-var.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga,calt' \
  --unicodes='U+0020-007E,U+00A0-00FF'
```

Use `font-display: swap` so text renders immediately with a system font fallback.

### Image Optimization

No build-time image processing (avoids slow builds). Instead:
- All OG/hero images are Cloudflare-optimized via Image Resizing (`/cdn-cgi/image/...`).
- Inline SVGs for icons and decorative elements — no HTTP round-trips.
- `loading="lazy"` on all below-fold images.

### Caching Headers (`_headers` file for Cloudflare Pages)

```
# Immutable assets (content-hashed filenames)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# HTML — always revalidate
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# Fonts
/fonts/*
  Cache-Control: public, max-age=31536000, immutable

# PDF
/resume.pdf
  Cache-Control: public, max-age=86400
```

### Preloading

In `BaseLayout.astro`:
- `<link rel="preload">` for above-fold fonts.
- `<link rel="modulepreload">` for graph island script on the landing page only.
- `<link rel="dns-prefetch">` for any external links (GitHub, etc.).

---

## Extensibility & Future Work

The architecture is designed so each concern is isolated and addable without touching existing code.

| Feature | How to add |
| :--- | :--- |
| Dark/light toggle | Add CSS `prefers-color-scheme` variants in `global.css`; no JS needed |
| Search | Add `pagefind` integration (`pnpm astro add pagefind`) — builds search index at build time, < 10 KB client JS |
| Comments | Embed `giscus` as an Astro island (`client:idle`) — GitHub Discussions backed, zero server |
| Newsletter | Add a static form pointing to Buttondown/Listmonk; no backend needed |
| New syndication target | Implement `SyndicationTarget` in `src/lib/syndication/`; add to CLI script |
| Analytics | Add Cloudflare Web Analytics snippet (< 1 KB, privacy-preserving) |
| New note type | Add value to `type` enum in `content.config.ts`; add filter page under `src/pages/garden/` |
| New maturity level | Add value to `maturity` enum; add case in `MaturityBadge.astro` |
| i18n | Use Astro's built-in `i18n` routing; add locale files under `src/i18n/` |
| Open Graph images | Use `@astrojs/og` or a Cloudflare Worker that generates OG images on demand |

---

## Technical Reference: Gruvbox Palette

| Name | Dark (base) | Bright variant |
| :--- | :--- | :--- |
| Background | `#282828` | — |
| Background 1 | `#3c3836` | — |
| Background 2 | `#504945` | — |
| Foreground | `#ebdbb2` | — |
| Foreground 4 (muted) | `#a89984` | — |
| Red | `#cc241d` | `#fb4934` |
| Green | `#98971a` | `#b8bb26` |
| Yellow | `#d79921` | `#fabd2f` |
| Blue | `#458588` | `#83a598` |
| Purple | `#b16286` | `#d3869b` |
| Aqua | `#689d6a` | `#8ec07c` |
| Orange | `#d65d0e` | `#fe8019` |
| Gray | `#928374` | `#a89984` |

---
