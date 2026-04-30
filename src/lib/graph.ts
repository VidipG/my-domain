/**
 * Build-time knowledge graph data extractor
 *
 * Produces a GraphData object (nodes + edges) consumed by the KnowledgeGraph
 * island on the landing page. Includes both garden notes and projects.
 *
 * Edge priority:
 *   1. Wikilink edges   → weight 2 (explicit semantic connection, notes only)
 *   2. Shared-tag edges → weight 1 (implicit topical affinity, cross-collection)
 *
 * If a wikilink edge already exists between two nodes, a shared-tag edge is
 * not added — the explicit link takes precedence.
 */

import type { NoteType, NoteMaturity } from '../content.config.ts';
import type { SlugMap } from './wikilinks.ts';

// ── Types ──────────────────────────────────────────────────────

export type NodeKind = NoteType | 'project';

export interface GraphNode {
  id:    string;
  label: string;
  tags:  string[];
  /** Determines colour in the graph renderer */
  type:  NodeKind;
  url:   string;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** Higher = stronger relationship. Wikilinks = 2, shared tags = 1+. */
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Internal unified shape — maturity is optional (projects don't have it)
type AnyEntry = {
  id:    string;
  body?: string;
  data: {
    title:    string;
    tags:     string[];
    type:     NodeKind;
  };
  urlPrefix: string; // '/garden/' or '/projects/'
};

// ── Implementation ─────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]|[\n]+?)(?:\|[^\][\n]+?)?\]\]/g;

export function buildGraphData(
  notes: {
    id: string;
    body?: string;
    data: { title: string; tags: string[]; type: NoteType; maturity: NoteMaturity };
  }[],
  slugMap: SlugMap,
  projects: {
    id: string;
    body?: string;
    data: { title: string; tags: string[] };
  }[] = [],
): GraphData {
  // Normalise both collections into a shared shape
  const noteEntries: AnyEntry[] = notes.map((n) => ({
    id:        n.id,
    body:      n.body,
    data:      { title: n.data.title, tags: n.data.tags, type: n.data.type },
    urlPrefix: '/garden/',
  }));

  const projectEntries: AnyEntry[] = projects.map((p) => ({
    id:        p.id,
    body:      p.body,
    data:      { title: p.data.title, tags: p.data.tags, type: 'project' as const },
    urlPrefix: '/projects/',
  }));

  const all: AnyEntry[] = [...noteEntries, ...projectEntries];

  const nodes: GraphNode[] = all.map((e) => ({
    id:    e.id,
    label: e.data.title,
    tags:  e.data.tags,
    type:  e.data.type,
    url:   `${e.urlPrefix}${e.id}/`,
  }));

  const edgeMap = new Map<string, { source: string; target: string; weight: number }>();

  // ── Pass 1: wikilink edges among notes only (weight 2) ────────
  for (const note of noteEntries) {
    const body = note.body ?? '';
    WIKILINK_RE.lastIndex = 0;

    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = WIKILINK_RE.exec(body)) !== null) {
      const target   = match[1].trim().toLowerCase();
      const targetId = slugMap.get(target);

      if (!targetId || targetId === note.id || seen.has(targetId)) continue;
      seen.add(targetId);

      const key = edgeKey(note.id, targetId);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: note.id, target: targetId, weight: 2 });
      }
    }
  }

  // ── Pass 2: shared-tag edges across all nodes (weight = shared tag count) ──
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];

      const sharedTags = a.data.tags.filter((t) => b.data.tags.includes(t));
      if (sharedTags.length === 0) continue;

      const key = edgeKey(a.id, b.id);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: a.id, target: b.id, weight: sharedTags.length });
      }
    }
  }

  const edges: GraphEdge[] = [...edgeMap.values()];

  return { nodes, edges };
}

// ── Helpers ────────────────────────────────────────────────────

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}→${b}` : `${b}→${a}`;
}
