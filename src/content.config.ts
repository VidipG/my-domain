import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

// ── Shared enums ───────────────────────────────────────────────
export const NOTE_TYPES = ['til', 'technical', 'freeform'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

// ── Note schema ────────────────────────────────────────────────
const noteSchema = z.object({
  /** Display title — also used as the default wikilink resolution target */
  title: z.string(),

  /**
   * "Last tended" date — shown as "Tended YYYY-MM-DD" in the UI.
   * Not a publication date; update whenever you meaningfully revise the note.
   */
  date: z.coerce.date(),

  /** One-sentence summary shown in cards and RSS items */
  description: z.string(),

  /** Content format / depth */
  type: z.enum(NOTE_TYPES),

  /** Topic tags — used for graph clustering and filter pages */
  tags: z.array(z.string()).default([]),

  /**
   * Alternate names this note can be linked via, e.g.
   * aliases: ["CRDT", "Conflict-free Replicated Data Types"]
   * lets [[CRDT]] resolve to a note titled "Conflict-free Replicated Data Types".
   */
  aliases: z.array(z.string()).default([]),

  /** When true, excluded from all listings, RSS, and graph */
  draft: z.boolean().default(false),
});

export type NoteData = z.infer<typeof noteSchema>;

// ── Project schema ─────────────────────────────────────────────
const projectSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  url: z.url().optional(),
  draft: z.boolean().default(false),
});

export type ProjectData = z.infer<typeof projectSchema>;

// ── Collections ────────────────────────────────────────────────
export const collections = {
  notes: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
    schema: noteSchema,
  }),
  projects: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
    schema: projectSchema,
  }),
};
