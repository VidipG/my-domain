/**
 * Build-time backlink index
 *
 * Scans every note's raw body for [[wikilink]] patterns and builds an
 * inverted index: for each note id, which other notes link to it.
 *
 * This is intentionally a regex scan (not a full AST parse) for speed —
 * we run this once per build over all note bodies and don't need the full
 * mdast for this purpose.
 */

import type { CollectionEntry } from 'astro:content';
import type { SlugMap } from './wikilinks.ts';

// ── Types ──────────────────────────────────────────────────────

type NoteEntry = CollectionEntry<'notes'>;

/** Map from note id → array of notes that contain a wikilink pointing to it. */
export type BacklinkIndex = Map<string, NoteEntry[]>;

// ── Implementation ─────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]|[\n]+?)(?:\|[^\][\n]+?)?\]\]/g;

/**
 * Build the backlink index.
 *
 * @param notes   All non-draft note collection entries
 * @param slugMap Title/alias → note id map (from buildSlugMap)
 */
export function buildBacklinkIndex(
  notes: NoteEntry[],
  slugMap: SlugMap
): BacklinkIndex {
  const index: BacklinkIndex = new Map();

  // Initialise every note with an empty backlink list so callers can
  // safely call index.get(id) without checking undefined.
  for (const note of notes) {
    index.set(note.id, []);
  }

  for (const note of notes) {
    const body = note.body ?? '';
    WIKILINK_RE.lastIndex = 0;

    const seen = new Set<string>(); // deduplicate multiple links to same target
    let match: RegExpExecArray | null;

    while ((match = WIKILINK_RE.exec(body)) !== null) {
      const target = match[1].trim().toLowerCase();
      const targetId = slugMap.get(target);

      if (!targetId || targetId === note.id || seen.has(targetId)) continue;

      seen.add(targetId);
      index.get(targetId)!.push(note);
    }
  }

  return index;
}
