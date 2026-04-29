# Implementation Plan: Astro Website with POSSE Architecture

High-performance, SSG-based website using Astro, following the POSSE (Publish on Own Site, Syndicate Elsewhere) model. Deployed to Cloudflare Pages. Zero JS by default, islands only where interactivity is required.

> **Tooling constraint:** `pnpm` only. No `npm` or `yarn`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Initialization & Infrastructure](#2-project-initialization--infrastructure)
3. [Folder Structure](#3-folder-structure)
4. [Design System & Theming (Gruvbox)](#4-design-system--theming-gruvbox)
5. [Content Layer & Type Safety](#5-content-layer--type-safety)
6. [Landing Page](#6-landing-page)
7. [Digital Garden & POSSE Architecture](#7-digital-garden--posse-architecture)
8. [Resume Page](#8-resume-page)
9. [Performance Strategy](#9-performance-strategy)
10. [Build Pipeline & Deployment](#10-build-pipeline--deployment)
11. [Extensibility & Future Work](#11-extensibility--future-work)
12. [Technical Reference: Gruvbox Palette](#12-technical-reference-gruvbox-palette)

---

## 1. Architecture Overview

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

### Island Strategy

Only two components justify JavaScript:

| Component | Island trigger | Library | Hydration |
| :--- | :--- | :--- | :--- |
| Knowledge Graph | `client:visible` | `force-graph` (< 30 KB gz) | On viewport entry |
| Burger menu | `client:idle` | Vanilla custom element | After main thread idle |

Everything else (PostCard, navigation links, resume render) is static HTML.

---

## 2. Project Initialization & Infrastructure

```bash
# Bootstrap
pnpm create astro@latest . --template minimal --typescript strict --git

# Core integrations
pnpm astro add tailwind
pnpm astro add sitemap

# Dev tooling
pnpm add -D @astrojs/check typescript prettier prettier-plugin-astro wrangler
```

### `astro.config.ts`

```ts
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://yourdomain.com',
  output: 'static',
  integrations: [
    tailwind({ nesting: true }),
    sitemap(),
  ],
  image: {
    // Use Cloudflare Image Resizing at the edge — no build-time image processing overhead
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  build: {
    // Inline CSS for single-page critical path; separate chunk for shared styles
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // Brotli compression handled by Cloudflare; keep Vite output clean
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          // Content-hash filenames for immutable caching
          assetFileNames: 'assets/[hash][extname]',
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
        },
      },
    },
  },
});
```

### `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

---

## 3. Folder Structure

```
my-domain/
├── public/
│   ├── fonts/           # Self-hosted, subset WOFF2 only
│   └── favicon.svg      # SVG favicon (no .ico needed)
├── src/
│   ├── content/
│   │   └── notes/       # All garden notes — *.md / *.mdx
│   │       ├── til/     # Optional subdirectory per type (slug becomes til/note-name)
│   │       ├── technical/
│   │       └── longform/
│   ├── components/
│   │   ├── graph/
│   │   │   ├── KnowledgeGraph.astro    # Static canvas placeholder (no-JS fallback)
│   │   │   └── KnowledgeGraph.ts       # Island client code (force-graph)
│   │   ├── garden/
│   │   │   ├── NoteCard.astro          # Card for garden index listing
│   │   │   ├── TagBadge.astro
│   │   │   ├── MaturityBadge.astro     # Seedling / Budding / Evergreen indicator
│   │   │   └── BacklinkPanel.astro     # "Linked from" section in note layout
│   │   ├── ui/
│   │   │   ├── BurgerMenu.astro        # HTML structure + custom element
│   │   │   └── BurgerMenu.ts           # <burger-menu> custom element
│   │   └── resume/
│   │       └── ResumeEmbed.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro            # <html>, head, global CSS, fonts
│   │   ├── NoteLayout.astro            # Wraps BaseLayout; adds backlinks, ToC, syndication UI
│   │   └── PageLayout.astro            # Wraps BaseLayout; generic page chrome
│   ├── lib/
│   │   ├── syndication/
│   │   │   ├── types.ts                # SyndicationTarget interface
│   │   │   ├── bluesky.ts
│   │   │   ├── mastodon.ts
│   │   │   └── twitter.ts
│   │   ├── wikilinks.ts                # Remark plugin: parse [[links]], resolve slugs
│   │   ├── backlinks.ts                # Build-time backlink index builder
│   │   ├── graph.ts                    # Build-time graph data from wikilink edges
│   │   └── rss.ts                      # Feed helpers
│   ├── pages/
│   │   ├── index.astro                 # Landing page
│   │   ├── garden/
│   │   │   ├── index.astro             # Garden index (topic clusters, recently tended)
│   │   │   ├── til.astro               # TIL filter view
│   │   │   ├── technical.astro         # Technical filter view
│   │   │   ├── longform.astro          # Longform filter view
│   │   │   └── [...slug].astro         # Dynamic note pages
│   │   ├── resume.astro
│   │   ├── uses.astro                  # Hardware/Software stack
│   │   └── rss.xml.ts                  # RSS feed endpoint
│   └── styles/
│       └── global.css                  # CSS custom properties, reset, typography
├── content.config.ts                   # Astro 5 Content Layer config
├── tailwind.config.ts
├── astro.config.ts
├── wrangler.toml
└── package.json
```

---

## 4. Design System & Theming (Gruvbox)

### Tailwind v4 config (`tailwind.config.ts`)

Tailwind v4 uses CSS-native `@theme` instead of a JS config object. Define once, use everywhere.

```ts
// tailwind.config.ts — only needed for content paths in v4
export default {
  content: ['./src/**/*.{astro,html,ts,tsx,md,mdx}'],
};
```

### `src/styles/global.css`

```css
@import 'tailwindcss';

@theme {
  /* Gruvbox dark palette */
  --color-gruv-bg:      #282828;
  --color-gruv-bg1:     #3c3836;
  --color-gruv-bg2:     #504945;
  --color-gruv-fg:      #ebdbb2;
  --color-gruv-fg4:     #a89984;
  --color-gruv-red:     #cc241d;
  --color-gruv-red-b:   #fb4934;  /* bright variant */
  --color-gruv-green:   #98971a;
  --color-gruv-green-b: #b8bb26;
  --color-gruv-yellow:  #d79921;
  --color-gruv-blue:    #458588;
  --color-gruv-blue-b:  #83a598;
  --color-gruv-purple:  #b16286;
  --color-gruv-aqua:    #689d6a;
  --color-gruv-orange:  #d65d0e;
  --color-gruv-gray:    #928374;

  /* Typography scale */
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}

/* Base reset */
*, *::before, *::after { box-sizing: border-box; }

html {
  background-color: var(--color-gruv-bg);
  color: var(--color-gruv-fg);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--color-gruv-bg1); }
::-webkit-scrollbar-thumb { background: var(--color-gruv-gray); border-radius: 3px; }
```

### Font Loading Strategy

Self-host variable fonts, subset to Latin, serve only WOFF2. No Google Fonts DNS lookup.

```html
<!-- In BaseLayout.astro <head> -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/jb-mono-var.woff2" as="font" type="font/woff2" crossorigin>
```

Use `pyftsubset` (fonttools) or `glyphhanger` to strip unused Unicode ranges before committing fonts.

---

## 5. Content Layer & Type Safety

### Garden Note Model

Notes are **evergreen documents**, not chronological posts. The primary organizational axes are:

| Axis | Values | Purpose |
| :--- | :--- | :--- |
| `type` | `til`, `technical`, `longform` | Content format / depth |
| `maturity` | `seedling`, `budding`, `evergreen` | How developed the note is |
| `tags` | free-form strings | Topic grouping and graph clustering |
| Wikilinks (`[[...]]`) | inline in body | Explicit relationships — primary graph edges |

`date` is "last tended" — the last time you meaningfully revised the note. It appears in the UI as "Tended YYYY-MM-DD", not "Published". Notes are sorted by topic cluster on the index, with a "Recently tended" secondary sort.

### `content.config.ts` (Astro 5 Content Layer API)

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const noteSchema = z.object({
  title:       z.string(),
  date:        z.coerce.date(),                        // Last tended date
  description: z.string(),
  type:        z.enum(['til', 'technical', 'longform']),
  maturity:    z.enum(['seedling', 'budding', 'evergreen']).default('seedling'),
  tags:        z.array(z.string()).default([]),
  aliases:     z.array(z.string()).default([]),         // Alternate names for wikilink resolution
  draft:       z.boolean().default(false),
  // POSSE: filled in post-publish by syndication scripts
  syndication: z.object({
    bluesky:  z.string().url().optional(),
    mastodon: z.string().url().optional(),
    twitter:  z.string().url().optional(),
  }).optional(),
});

export type Note = z.infer<typeof noteSchema>;

export const collections = {
  notes: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
    schema: noteSchema,
  }),
};
```

### Data Flow

```
src/content/notes/**/*.md
        │
        ▼  (Astro Content Layer — build time)
  Parsed + Zod-validated
        │
        ├──▶  lib/wikilinks.ts    →  slug resolution map (title/aliases → id)
        │
        ├──▶  lib/backlinks.ts   →  BacklinkIndex (noteId → Note[])
        │                                │
        │                                └──▶  NoteLayout.astro  (backlinks panel)
        │
        ├──▶  lib/graph.ts       →  GraphData (nodes + wikilink edges + tag edges)
        │                                │
        │                                └──▶  KnowledgeGraph island (landing page)
        │
        ├──▶  garden/index.astro  (topic clusters + recently tended)
        ├──▶  garden/[...slug].astro  (individual note pages)
        └──▶  rss.xml.ts          (feed, sorted by date)
```

---

## 6. Landing Page

### Layout: Two-Column Split

```
┌──────────────────────────────────────────────────┐
│  [burger icon]                                   │
│                                                  │
│   ┌─────────────────┐  ┌──────────────────────┐  │
│   │  Left: Identity │  │  Right: Graph        │  │
│   │                 │  │  (island, lazy)       │  │
│   │  • Name         │  │                      │  │
│   │  • Role         │  │   ●───●              │  │
│   │  • Links        │  │  ╱ ╲ ╱               │  │
│   │                 │  │ ●   ●                │  │
│   └─────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### `src/pages/index.astro`

```astro
---
import PageLayout from '@/layouts/PageLayout.astro';
import BurgerMenu from '@/components/ui/BurgerMenu.astro';
import KnowledgeGraph from '@/components/graph/KnowledgeGraph.astro';
import { getCollection } from 'astro:content';
import { buildGraphData } from '@/lib/graph';
import { buildBacklinkIndex } from '@/lib/backlinks';

const notes = await getCollection('notes', n => !n.data.draft);
const graphData = buildGraphData(notes);  // wikilink edges are primary
---
<PageLayout title="Your Name">
  <BurgerMenu />
  <main class="grid grid-cols-1 md:grid-cols-2 min-h-screen">
    <section class="flex flex-col justify-center px-12 py-16 gap-4">
      <h1 class="text-4xl font-bold text-gruv-fg">Your Name</h1>
      <p class="text-gruv-fg4">Software engineer. Writer. Builder.</p>
      <nav class="flex gap-4 text-gruv-blue-b">
        <a href="/garden">Garden</a>
        <a href="/resume">Resume</a>
        <a href="https://github.com/you" rel="noopener">GitHub</a>
      </nav>
    </section>
    <section class="flex items-center justify-center p-8">
      <KnowledgeGraph data={graphData} client:visible />
    </section>
  </main>
</PageLayout>
```

### Knowledge Graph Implementation

The graph has two tiers of edges, both derived at build time:

| Edge type | Source | Weight |
| :--- | :--- | :--- |
| Wikilink | `[[Note Title]]` in note body | 2 (explicit connection) |
| Shared tag | Notes sharing ≥1 tag | 1 (implicit affinity) |

Wikilink edges are always preferred; tag edges fill in the graph for isolated notes.

**`src/lib/wikilinks.ts`** — A remark plugin that:
1. Receives a `slugMap: Map<string, string>` (title/alias → note id) at plugin init.
2. Scans all `[[...]]` tokens in the AST.
3. Replaces each with an `<a href="/garden/{resolvedId}">` link.
4. Returns the set of outgoing link targets for backlink indexing.

```ts
// src/lib/wikilinks.ts
import type { CollectionEntry } from 'astro:content';
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

export type SlugMap = Map<string, string>;  // title/alias → note id

/** Build the title+alias → id lookup used by the remark plugin. */
export function buildSlugMap(notes: CollectionEntry<'notes'>[]): SlugMap {
  const map: SlugMap = new Map();
  for (const note of notes) {
    map.set(note.data.title.toLowerCase(), note.id);
    for (const alias of note.data.aliases) {
      map.set(alias.toLowerCase(), note.id);
    }
  }
  return map;
}

/** Remark plugin factory. Returns [plugin, outgoingLinks ref]. */
export function wikilinkPlugin(slugMap: SlugMap) {
  const outgoing = new Set<string>();
  function plugin() {
    return (tree: Root) => {
      visit(tree, 'text', (node, index, parent) => {
        // Regex: [[Link Text]] or [[Link Text|Display Text]]
        const RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        // ...split text, replace matches with link nodes, collect targets
        // Returns mutated node list; populates `outgoing`
      });
    };
  }
  return { plugin, outgoing };
}
```

**`src/lib/backlinks.ts`** — Builds the inverse index at build time by scanning raw note bodies for `[[...]]` patterns (regex, not AST — faster for indexing).

```ts
// src/lib/backlinks.ts
import type { CollectionEntry } from 'astro:content';

export type BacklinkIndex = Map<string, CollectionEntry<'notes'>[]>;

export async function buildBacklinkIndex(
  notes: CollectionEntry<'notes'>[],
  slugMap: Map<string, string>,
): Promise<BacklinkIndex> {
  const index: BacklinkIndex = new Map();
  const RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  for (const note of notes) {
    // Access raw body via note.body (Astro 5 Content Layer exposes this)
    const body = note.body ?? '';
    for (const match of body.matchAll(RE)) {
      const targetId = slugMap.get(match[1].toLowerCase());
      if (!targetId) continue;
      if (!index.has(targetId)) index.set(targetId, []);
      index.get(targetId)!.push(note);
    }
  }
  return index;
}
```

**`src/lib/graph.ts`** — Combines wikilink edges (strong) and tag edges (weak) into a single `GraphData` object.

```ts
// src/lib/graph.ts
import type { CollectionEntry } from 'astro:content';
import type { SlugMap } from './wikilinks';

export interface GraphNode {
  id:       string;
  label:    string;
  tags:     string[];
  type:     'til' | 'technical' | 'longform';
  maturity: 'seedling' | 'budding' | 'evergreen';
  url:      string;
}
export interface GraphEdge { source: string; target: string; weight: number }
export interface GraphData  { nodes: GraphNode[]; edges: GraphEdge[] }

export function buildGraphData(
  notes: CollectionEntry<'notes'>[],
  slugMap: SlugMap,
): GraphData {
  const nodes: GraphNode[] = notes.map(n => ({
    id:       n.id,
    label:    n.data.title,
    tags:     n.data.tags,
    type:     n.data.type,
    maturity: n.data.maturity,
    url:      `/garden/${n.id}/`,
  }));

  const edgeMap = new Map<string, number>();

  // Pass 1: wikilink edges (weight 2)
  const RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  for (const note of notes) {
    for (const match of (note.body ?? '').matchAll(RE)) {
      const targetId = slugMap.get(match[1].toLowerCase());
      if (!targetId || targetId === note.id) continue;
      const key = [note.id, targetId].sort().join('→');
      edgeMap.set(key, (edgeMap.get(key) ?? 0) + 2);
    }
  }

  // Pass 2: shared-tag edges (weight 1, only if no wikilink already)
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const shared = notes[i].data.tags.filter(t => notes[j].data.tags.includes(t));
      if (shared.length === 0) continue;
      const key = [notes[i].id, notes[j].id].sort().join('→');
      if (!edgeMap.has(key)) edgeMap.set(key, shared.length);
    }
  }

  const edges: GraphEdge[] = [...edgeMap.entries()].map(([key, weight]) => {
    const [source, target] = key.split('→');
    return { source, target, weight };
  });

  return { nodes, edges };
}
```

**`src/components/graph/KnowledgeGraph.ts`** — Island, loaded `client:visible`. Nodes are colored by `type`, sized by connection degree. Clicking a node navigates to `/garden/{id}`.

```ts
// KnowledgeGraph.ts — hydrated only when canvas enters viewport
import ForceGraph from 'force-graph';

const TYPE_COLOR = {
  til:       '#83a598',  // gruv-blue-b
  technical: '#b8bb26',  // gruv-green-b
  longform:  '#fabd2f',  // gruv-yellow-b
};

// Initialized on connectedCallback of the <knowledge-graph> custom element.
// Receives serialized GraphData via a data-graph attribute (JSON).
class KnowledgeGraphElement extends HTMLElement {
  connectedCallback() {
    const data = JSON.parse(this.dataset.graph!);
    const canvas = this.querySelector('canvas')!;
    ForceGraph()(canvas)
      .graphData(data)
      .nodeColor(n => TYPE_COLOR[n.type] ?? '#a89984')
      .nodeRelSize(4)
      .onNodeClick(n => { location.href = n.url; })
      .linkColor(() => '#504945')
      .backgroundColor('#282828');
  }
}
customElements.define('knowledge-graph', KnowledgeGraphElement);
```

### Burger Menu (Custom Element, no framework)

```ts
// src/components/ui/BurgerMenu.ts
class BurgerMenu extends HTMLElement {
  connectedCallback() {
    const btn = this.querySelector('[data-toggle]')!;
    const nav = this.querySelector('[data-nav]')!;
    btn.addEventListener('click', () => nav.classList.toggle('open'));
  }
}
customElements.define('burger-menu', BurgerMenu);
```

Loaded with `<script src="/burger-menu.js" type="module" async>` — non-blocking.

---

## 7. Digital Garden & POSSE Architecture

### Garden vs. Blog: Key Differences

| Dimension | Traditional Blog | Digital Garden |
| :--- | :--- | :--- |
| Organization | Reverse-chronological | Topic clusters + maturity |
| Discovery | Feed / pagination | Graph + wikilinks |
| Note state | Final on publish | Continuously tended |
| Connections | Tags only | Explicit wikilinks + tags |
| URL semantics | `/blog/2025-01-my-post` | `/garden/my-note` (timeless) |

### Garden Index (`garden/index.astro`)

The index is **not a feed** — it's a map of the garden. Layout:

```
┌──────────────────────────────────────────────────────┐
│  The Garden          [All] [TIL] [Technical] [Long]  │
│                                                      │
│  Recently Tended                  By Topic           │
│  ──────────────                   ─────────          │
│  ● Note Title      evergreen      #systems           │
│  ● Note Title      budding          ↳ Note A         │
│  ● Note Title      seedling         ↳ Note B         │
│                                   #programming       │
│                                     ↳ Note C         │
└──────────────────────────────────────────────────────┘
```

```astro
---
// src/pages/garden/index.astro
import { getCollection } from 'astro:content';
import PageLayout from '@/layouts/PageLayout.astro';
import NoteCard from '@/components/garden/NoteCard.astro';

const notes = await getCollection('notes', n => !n.data.draft);

// Recently tended: last 8 by date
const recent = [...notes].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()).slice(0, 8);

// By topic: group by first tag
const byTopic = notes.reduce<Record<string, typeof notes>>((acc, n) => {
  const tag = n.data.tags[0] ?? 'untagged';
  (acc[tag] ??= []).push(n);
  return acc;
}, {});
---
<PageLayout title="Garden">
  <main class="max-w-5xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-gruv-fg mb-2">Garden</h1>
    <p class="text-gruv-fg4 mb-8">A collection of notes, ideas, and things I'm learning.</p>

    <!-- Type filters (static links, no JS) -->
    <nav class="flex gap-3 mb-10 text-sm">
      <a href="/garden" class="text-gruv-yellow">All</a>
      <a href="/garden/til" class="text-gruv-blue-b">TIL</a>
      <a href="/garden/technical" class="text-gruv-green-b">Technical</a>
      <a href="/garden/longform" class="text-gruv-fg4">Longform</a>
    </nav>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <section class="lg:col-span-2">
        <h2 class="text-gruv-fg4 text-xs uppercase tracking-widest mb-4">Recently Tended</h2>
        <ul class="flex flex-col gap-3">
          {recent.map(n => <NoteCard note={n} />)}
        </ul>
      </section>
      <section>
        <h2 class="text-gruv-fg4 text-xs uppercase tracking-widest mb-4">By Topic</h2>
        {Object.entries(byTopic).map(([tag, notes]) => (
          <div class="mb-6">
            <p class="text-gruv-yellow text-sm mb-1">#{tag}</p>
            <ul class="flex flex-col gap-1 pl-3 border-l border-gruv-bg2">
              {notes.map(n => (
                <li><a href={`/garden/${n.id}/`} class="text-gruv-fg text-sm hover:text-gruv-blue-b">{n.data.title}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  </main>
</PageLayout>
```

### Type Filter Pages

Each filter page is a thin static page — no JS, no duplication of logic.

```astro
---
// src/pages/garden/til.astro  (same pattern for technical.astro, longform.astro)
import { getCollection } from 'astro:content';
import PageLayout from '@/layouts/PageLayout.astro';
import NoteCard from '@/components/garden/NoteCard.astro';

const notes = await getCollection('notes', n => !n.data.draft && n.data.type === 'til');
const sorted = notes.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---
<PageLayout title="TIL — Garden">
  <main class="max-w-3xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-gruv-fg mb-2">Today I Learned</h1>
    <!-- ... NoteCard list ... -->
  </main>
</PageLayout>
```

### Note Page (`garden/[...slug].astro`)

```astro
---
import { getCollection, render } from 'astro:content';
import NoteLayout from '@/layouts/NoteLayout.astro';
import { buildSlugMap } from '@/lib/wikilinks';
import { buildBacklinkIndex } from '@/lib/backlinks';

export async function getStaticPaths() {
  const notes = await getCollection('notes', n => !n.data.draft);
  const slugMap = buildSlugMap(notes);
  const backlinks = await buildBacklinkIndex(notes, slugMap);

  return notes.map(note => ({
    params: { slug: note.id },
    props:  { note, backlinks: backlinks.get(note.id) ?? [] },
  }));
}

const { note, backlinks } = Astro.props;
const { Content, headings } = await render(note);
---
<NoteLayout note={note} headings={headings} backlinks={backlinks}>
  <Content />
</NoteLayout>
```

### `NoteLayout.astro`

```astro
---
// src/layouts/NoteLayout.astro
import BaseLayout from './BaseLayout.astro';
import BacklinkPanel from '@/components/garden/BacklinkPanel.astro';
import MaturityBadge from '@/components/garden/MaturityBadge.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  note:      CollectionEntry<'notes'>;
  headings:  { depth: number; slug: string; text: string }[];
  backlinks: CollectionEntry<'notes'>[];
}
const { note, headings, backlinks } = Astro.props;
const { title, date, maturity, tags, type, syndication } = note.data;
---
<BaseLayout title={title}>
  <article class="max-w-3xl mx-auto px-6 py-12">
    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-center gap-3 text-gruv-fg4 text-sm mb-3">
        <span class="text-gruv-blue-b uppercase text-xs">{type}</span>
        <MaturityBadge maturity={maturity} />
        <time datetime={date.toISOString()}>Tended {date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
      </div>
      <h1 class="text-3xl font-bold text-gruv-fg">{title}</h1>
      <div class="flex gap-2 mt-3">
        {tags.map(t => <span class="text-gruv-yellow text-sm">#{t}</span>)}
      </div>
    </header>

    <!-- Body -->
    <div class="prose prose-gruvbox max-w-none">
      <slot />
    </div>

    <!-- Backlinks -->
    {backlinks.length > 0 && <BacklinkPanel backlinks={backlinks} />}

    <!-- POSSE syndication -->
    {syndication && (
      <aside class="text-gruv-fg4 text-sm mt-10 border-t border-gruv-bg2 pt-4">
        <p class="mb-2">Also on:</p>
        <ul class="flex gap-3">
          {syndication.bluesky  && <li><a href={syndication.bluesky}  class="text-gruv-blue-b">Bluesky</a></li>}
          {syndication.mastodon && <li><a href={syndication.mastodon} class="text-gruv-blue-b">Mastodon</a></li>}
          {syndication.twitter  && <li><a href={syndication.twitter}  class="text-gruv-blue-b">Twitter/X</a></li>}
        </ul>
      </aside>
    )}
  </article>
</BaseLayout>
```

### `BacklinkPanel.astro`

```astro
---
// src/components/garden/BacklinkPanel.astro
import type { CollectionEntry } from 'astro:content';
interface Props { backlinks: CollectionEntry<'notes'>[] }
const { backlinks } = Astro.props;
---
<aside class="mt-10 pt-6 border-t border-gruv-bg2">
  <h2 class="text-gruv-fg4 text-xs uppercase tracking-widest mb-4">
    Linked from ({backlinks.length})
  </h2>
  <ul class="flex flex-col gap-2">
    {backlinks.map(n => (
      <li>
        <a href={`/garden/${n.id}/`} class="text-gruv-blue-b hover:underline">{n.data.title}</a>
        <span class="text-gruv-fg4 text-sm ml-2">{n.data.description}</span>
      </li>
    ))}
  </ul>
</aside>
```

### `MaturityBadge.astro`

```astro
---
type Maturity = 'seedling' | 'budding' | 'evergreen';
interface Props { maturity: Maturity }
const { maturity } = Astro.props;
const MAP: Record<Maturity, { label: string; color: string; icon: string }> = {
  seedling:  { label: 'Seedling',  color: 'text-gruv-green',  icon: '🌱' },
  budding:   { label: 'Budding',   color: 'text-gruv-yellow', icon: '🌿' },
  evergreen: { label: 'Evergreen', color: 'text-gruv-aqua',   icon: '🌲' },
};
const { label, color, icon } = MAP[maturity];
---
<span class={`text-xs ${color}`} title={label}>{icon} {label}</span>
```

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

## 8. Resume Page

```astro
---
// src/pages/resume.astro
import PageLayout from '@/layouts/PageLayout.astro';
---
<PageLayout title="Resume">
  <main class="flex flex-col items-center py-12 px-4">
    <h1 class="text-3xl font-bold mb-6 text-gruv-fg">Resume</h1>
    <iframe
      src="/resume.pdf"
      class="w-full max-w-4xl"
      style="height: 85vh; border: none;"
      title="Resume PDF"
    />
    <a
      href="/resume.pdf"
      download
      class="mt-4 text-gruv-blue-b underline"
    >Download PDF</a>
  </main>
</PageLayout>
```

Place `resume.pdf` in `public/` — served as a static asset, no processing overhead. Replace the file to update the resume; no code changes needed.

---

## 9. Performance Strategy

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

## 10. Build Pipeline & Deployment

### `package.json` scripts

```json
{
  "scripts": {
    "dev":     "astro dev",
    "build":   "astro check && astro build",
    "preview": "astro preview",
    "deploy":  "pnpm run build && wrangler pages deploy dist",
    "check":   "astro check"
  }
}
```

### `wrangler.toml`

```toml
name            = "my-domain"
compatibility_date = "2026-01-01"
pages_build_output_dir = "dist"

[env.production]
# Any Cloudflare bindings (KV, R2) go here when needed
```

### `_headers` (in `public/`, auto-deployed by Cloudflare Pages)

See caching headers in §9.

### `_redirects` (in `public/`)

```
# Redirect bare domain to www (or vice versa — pick one)
https://yourdomain.com/*  https://www.yourdomain.com/:splat  301
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: latest }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: my-domain
          directory: dist
```

---

## 11. Extensibility & Future Work

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

## 12. Technical Reference: Gruvbox Palette

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

## Checklist

### Phase 1 — Foundation
- [ ] Initialize Astro project (`minimal` template, TypeScript strict)
- [ ] Configure `astro.config.ts` with integrations and Vite build options
- [ ] Set up Tailwind v4 with `@theme` Gruvbox variables in `global.css`
- [ ] Self-host and subset Inter Variable and JetBrains Mono Variable fonts
- [ ] Create `BaseLayout.astro`, `PageLayout.astro`, `NoteLayout.astro`
- [ ] Define `notes` collection in `content.config.ts` with full Zod schema (type, maturity, aliases)

### Phase 2 — Garden Infrastructure
- [ ] Implement `src/lib/wikilinks.ts` remark plugin (parse `[[...]]`, resolve slugs, handle aliases, flag dead links)
- [ ] Implement `src/lib/backlinks.ts` build-time backlink index builder
- [ ] Implement `src/lib/graph.ts` with wikilink edges (weight 2) + tag edges (weight 1)
- [ ] Wire remark plugin into `astro.config.ts` markdown config
- [ ] Build `MaturityBadge.astro`, `TagBadge.astro`, `NoteCard.astro`, `BacklinkPanel.astro`

### Phase 3 — Pages
- [ ] Build landing page with two-column layout (static left, graph island right)
- [ ] Implement `KnowledgeGraph` island with `force-graph` (node color by type, click → navigate)
- [ ] Implement `BurgerMenu` as a vanilla custom element
- [ ] Build `garden/index.astro` — topic clusters + recently tended layout
- [ ] Build `garden/til.astro`, `garden/technical.astro`, `garden/longform.astro` filter views
- [ ] Build `garden/[...slug].astro` — note page with backlinks panel and syndication UI
- [ ] Add `rss.xml.ts` endpoint with XSL stylesheet
- [ ] Build `resume.astro` with PDF embed

### Phase 4 — POSSE & Syndication
- [ ] Stub out `src/lib/syndication/` with `SyndicationTarget` interface
- [ ] Implement Bluesky, Mastodon, Twitter targets
- [ ] Write `scripts/syndicate.ts` CLI (filters to `budding`/`evergreen` notes, patches frontmatter)

### Phase 5 — Performance & Deployment
- [ ] Add `public/_headers` with cache-control rules
- [ ] Add `public/_redirects`
- [ ] Configure `wrangler.toml`
- [ ] Set up GitHub Actions deploy workflow
- [ ] Run Lighthouse audit — target 100/100 Performance
- [ ] Verify < 100 ms TTFB on Cloudflare edge
- [ ] Verify wikilink resolution has 0 dead links in initial content
