# Local Development & Content Guide

## Prerequisites

- **Node.js** ≥ 22 (`node --version`)
- **pnpm** ≥ 10 (`pnpm --version` — install via `npm i -g pnpm` if missing)

---

## Running Locally

```bash
# Install dependencies (first time or after pulling changes)
pnpm install

# Start the dev server with hot-reload
pnpm dev
```

Opens at **http://localhost:4321**.

The dev server rebuilds automatically when you save a file. Note that `astro.config.ts` and `src/content.config.ts` changes require a manual restart (`Ctrl-C`, then `pnpm dev` again).

### Type-check without building

```bash
pnpm check
```

### Production preview

```bash
pnpm build    # runs astro check → astro build → outputs dist/
pnpm preview  # serves dist/ locally at http://localhost:4321
```

---

## Adding a New Note

Notes live in `src/content/notes/` organized by type:

```
src/content/notes/
  til/
  technical/
  longform/
```

### 1. Create the file

Pick the right subdirectory for your note type and create a `.md` file. Use kebab-case for the filename — it becomes the URL slug.

```
src/content/notes/technical/my-new-note.md
→ https://vidip.dev/garden/technical/my-new-note/
```

### 2. Write the frontmatter

Every note requires these fields:

```yaml
---
title: "My New Note"
date: 2026-04-28
description: "One sentence that appears in cards and RSS."
type: technical          # til | technical | longform
maturity: seedling       # seedling | budding | evergreen
tags: [distributed-systems, databases]
---
```

Optional fields:

```yaml
aliases: ["Alt Title", "Another Name"]   # extra titles [[wikilinks]] can resolve to
draft: true                              # hides from listings and RSS (default: false)
syndication:
  bluesky: https://bsky.app/...          # written back by scripts/syndicate.ts
```

**Maturity guide**

| Stage | Meaning |
|-------|---------|
| `seedling` | Rough idea, early notes — may be incomplete |
| `budding` | Developing, partially formed |
| `evergreen` | Complete, considered, stable — ready to share |

### 3. Write the content

Plain Markdown with all standard syntax. Use wikilinks to connect notes:

```markdown
# My New Note

The CAP theorem says you can only have two of three guarantees.
See [[CAP Theorem]] for the full breakdown.

You can also alias the display text: [[CRDTs|conflict-free data structures]].
```

**Wikilink resolution:**  
`[[Target]]` resolves by matching the target string (case-insensitive) against the `title` or `aliases` fields of every note in the collection. The slug map is built at compile time, so new notes are picked up automatically on the next build/dev restart.

**Dead links:**  
If a wikilink target doesn't exist yet, the link renders as `<a data-dead-link>` with a red style. This is intentional — it's a placeholder you can fill later. The title you chose becomes a signal for which notes to write next.

### 4. Verify it builds

```bash
pnpm check   # type-check all .astro/.ts files
pnpm build   # full production build
```

Check the output for your new page:

```
generating static routes
  ├─ /garden/technical/my-new-note/index.html
```

---

## How Backlinks Work

Backlinks are computed automatically at build time — you don't manage them manually.

When you write `[[CAP Theorem]]` in any note, the build:
1. Scans the raw markdown body for wikilink patterns.
2. Resolves each link against the slug map (title + aliases).
3. Records the linking note as a backlink of the target note.
4. Renders a "Linked from" panel at the bottom of the target's page.

**Example chain:**

```
technical/crdts.md          contains [[CAP Theorem]]
technical/eventual-consistency.md  contains [[CAP Theorem]]
                                           ↓
technical/cap-theorem.md    receives backlinks from both
```

No configuration needed. Add the wikilink in the body; the panel appears automatically.

---

## How the Knowledge Graph Works

The graph on the homepage is built from the same link data:

- **Nodes** = notes. Size scales with degree (more connections = larger node). Color encodes type (blue = TIL, green = technical, yellow = longform).
- **Edges** = connections. Wikilinks create edges with weight 2. Notes that share a tag but have no wikilink between them get a weight-1 edge.

The graph data (`nodes` + `edges` JSON) is serialized into the page's HTML at build time and handed to the `<knowledge-graph>` custom element, which renders via `force-graph` only when the element scrolls into view.

---

## Draft Notes

Set `draft: true` in frontmatter to exclude a note from all listings, RSS, and the knowledge graph. The page itself is still built (useful for proofreading via the direct URL), but it won't be discoverable through the site.

```yaml
draft: true
```

Remove the field (or set to `false`) when you're ready to publish.

---

## Fonts

Place font files in `public/fonts/` before building for production:

| File | Font |
|------|------|
| `public/fonts/inter-var.woff2` | Inter Variable (body text) |
| `public/fonts/jb-mono-var.woff2` | JetBrains Mono Variable (code) |

The dev server works without them (system fonts fall back gracefully). The build produces warnings about unresolved font paths — these are safe to ignore locally; Cloudflare resolves the paths from `public/` at edge.

---

## Content Workflow Summary

```
1. pnpm dev                          # start dev server
2. Create src/content/notes/<type>/<slug>.md
3. Write frontmatter + content
4. Add [[wikilinks]] to connect notes
5. Visit http://localhost:4321/garden/<type>/<slug>/ to preview
6. Check backlinks panel and graph on homepage
7. pnpm check                        # verify no type errors
8. git add / commit / push → Cloudflare Pages auto-deploys
```
