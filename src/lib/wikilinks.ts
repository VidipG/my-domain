/**
 * Wikilink remark plugin
 *
 * Parses [[Note Title]] and [[Note Title|Display Text]] syntax in markdown,
 * resolving them to internal garden links.
 *
 * ## Design
 *
 * The plugin receives the slug map as an explicit option at configuration time.
 * This is the most reliable approach: the slug map is built in astro.config.ts
 * (main process context, correct cwd) and passed through as a plugin option.
 *
 * remark plugin signature:
 *   remarkPlugins: [[wikilinkPlugin, { slugMap }]]
 *
 * The `buildPluginSlugMapFromFs()` helper builds the slug map synchronously
 * from the content directory and is called in astro.config.ts.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { visit } from 'unist-util-visit';
import type { Root, Text, PhrasingContent } from 'mdast';

// ── Types ──────────────────────────────────────────────────────

/**
 * Maps a lower-cased title or alias string to the note's collection id.
 * e.g. "cap theorem" → "technical/cap-theorem"
 */
export type SlugMap = Map<string, string>;

export interface WikilinkPluginOptions {
  slugMap: SlugMap;
}

// ── Regex ──────────────────────────────────────────────────────

/**
 * Matches:
 *   [[Link Target]]
 *   [[Link Target|Display Text]]
 */
const WIKILINK_RE = /\[\[([^\]|[\n]+?)(?:\|([^\][\n]+?))?\]\]/g;

// ── Filesystem slug map builder (called from astro.config.ts) ──

/**
 * Build a slug map by reading the content directory synchronously.
 * Call this in astro.config.ts where process.cwd() is the project root.
 */
export function buildPluginSlugMapFromFs(contentDir?: string): SlugMap {
  const dir = contentDir ?? resolve(process.cwd(), 'src', 'content', 'notes');
  const map: SlugMap = new Map();

  if (!existsSync(dir)) return map;

  function walkSync(currentDir: string, prefix = ''): void {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walkSync(full, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        const id = (prefix ? `${prefix}/${entry.name}` : entry.name).replace(/\.(mdx?)$/, '');

        let content = '';
        try {
          content = readFileSync(full, 'utf-8');
        } catch {
          continue;
        }

        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];

        // Title
        const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
        if (titleMatch) {
          map.set(titleMatch[1].trim().toLowerCase(), id);
        }

        // Aliases — handles inline array: aliases: ["a", "b"]
        const aliasLine = fm.match(/^aliases:\s*\[([^\]]*)\]/m);
        if (aliasLine) {
          const aliases = [...aliasLine[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
          for (const alias of aliases) map.set(alias.toLowerCase(), id);
        }
      }
    }
  }

  walkSync(dir);
  return map;
}

// ── Exported helper (used by page frontmatter) ─────────────────

/**
 * Build a SlugMap from already-loaded collection entries.
 * Faster than filesystem reads — used in getStaticPaths() for backlinks/graph.
 */
export function buildSlugMap(
  notes: Array<{ id: string; data: { title: string; aliases: string[] } }>
): SlugMap {
  const map: SlugMap = new Map();
  for (const note of notes) {
    map.set(note.data.title.toLowerCase(), note.id);
    for (const alias of note.data.aliases) {
      map.set(alias.toLowerCase(), note.id);
    }
  }
  return map;
}

// ── Remark plugin ──────────────────────────────────────────────

/**
 * The remark plugin. Registered in astro.config.ts:
 *   markdown: { remarkPlugins: [[wikilinkPlugin, { slugMap }]] }
 *
 * where `slugMap` is built by `buildPluginSlugMapFromFs()` in astro.config.ts.
 */
export function wikilinkPlugin(opts: WikilinkPluginOptions) {
  const { slugMap } = opts;

  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      const matches: RegExpExecArray[] = [];
      let match: RegExpExecArray | null;
      WIKILINK_RE.lastIndex = 0;

      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        matches.push(match);
      }

      if (matches.length === 0) return;

      const newNodes: PhrasingContent[] = [];
      let cursor = 0;

      for (const m of matches) {
        const start   = m.index;
        const end     = m.index + m[0].length;
        const target  = m[1].trim();
        const display = m[2]?.trim() ?? target;

        if (start > cursor) {
          newNodes.push({ type: 'text', value: node.value.slice(cursor, start) });
        }

        const resolvedId = slugMap.get(target.toLowerCase());

        if (resolvedId) {
          newNodes.push({
            type:     'link',
            url:      `/garden/${resolvedId}/`,
            title:    null,
            children: [{ type: 'text', value: display }],
          });
        } else {
          // Dead link — styled via [data-dead-link] in global.css
          newNodes.push({
            type:  'html',
            value: `<a data-dead-link title="Note not found: ${escapeAttr(target)}">${escapeHtml(display)}</a>`,
          });
        }

        cursor = end;
      }

      if (cursor < node.value.length) {
        newNodes.push({ type: 'text', value: node.value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...newNodes);
      return index + newNodes.length;
    });
  };
}

// ── Helpers ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}
