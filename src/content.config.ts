import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

// ── Shared enums ───────────────────────────────────────────────
export const NOTE_TYPES    = ['til', 'technical', 'freeform'] as const;
export const NOTE_MATURITY = ['seedling', 'budding', 'evergreen'] as const;

export type NoteType    = (typeof NOTE_TYPES)[number];
export type NoteMaturity = (typeof NOTE_MATURITY)[number];

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

  /**
   * How developed the note is.
   * seedling  → rough idea, early notes
   * budding   → developing, partially formed
   * evergreen → complete, considered, stable
   */
  maturity: z.enum(NOTE_MATURITY).default('seedling'),

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

  /**
   * POSSE syndication URLs — written back by scripts/syndicate.ts
   * after the note is published to each platform.
   */
  syndication: z
    .object({
      bluesky:  z.url().optional(),
      mastodon: z.url().optional(),
      twitter:  z.url().optional(),
    })
    .optional(),
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
