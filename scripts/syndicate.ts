#!/usr/bin/env node
/**
 * POSSE syndication CLI
 *
 * Usage:
 *   pnpm tsx scripts/syndicate.ts [note-id] [--target bluesky|mastodon|twitter]
 *
 * If no note-id is given, lists all budding/evergreen notes that haven't
 * been syndicated to the specified target yet.
 *
 * After a successful publish, patches the note's frontmatter with the
 * returned syndication URL and saves the file.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BlueskyTarget }  from '../src/lib/syndication/bluesky.js';
import { MastodonTarget } from '../src/lib/syndication/mastodon.js';
import { TwitterTarget }  from '../src/lib/syndication/twitter.js';
import type { SyndicationTarget } from '../src/lib/syndication/types.js';

// ── Configured targets ─────────────────────────────────────────
const TARGETS: Record<string, SyndicationTarget> = {
  bluesky:  new BlueskyTarget(),
  mastodon: new MastodonTarget(),
  twitter:  new TwitterTarget(),
};

// ── CLI ────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const noteId     = args.find((a) => !a.startsWith('--'));
const targetFlag = args.find((a) => a.startsWith('--target='))?.split('=')[1];

if (!noteId) {
  console.log('Usage: pnpm tsx scripts/syndicate.ts <note-id> --target=<bluesky|mastodon|twitter>');
  console.log('\nAvailable targets:');
  for (const [name, target] of Object.entries(TARGETS)) {
    console.log(`  ${name}: ${target.isConfigured() ? '✓ configured' : '✗ not configured'}`);
  }
  process.exit(0);
}

if (!targetFlag || !(targetFlag in TARGETS)) {
  console.error(`Error: --target must be one of: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(1);
}

const target = TARGETS[targetFlag]!;

if (!target.isConfigured()) {
  console.error(`Error: ${target.name} is not configured. Check your environment variables.`);
  process.exit(1);
}

// ── Find and load note ─────────────────────────────────────────
const CONTENT_ROOT = join(process.cwd(), 'src/content/notes');

async function findNoteFile(id: string): Promise<string | null> {
  async function walk(dir: string): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(full);
        if (found) return found;
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        // Content Layer id includes subdir: "technical/cap-theorem"
        const rel = full.replace(CONTENT_ROOT + '/', '').replace(/\.(mdx?)$/, '');
        if (rel === id) return full;
      }
    }
    return null;
  }
  return walk(CONTENT_ROOT);
}

const filePath = await findNoteFile(noteId);
if (!filePath) {
  console.error(`Error: note '${noteId}' not found in src/content/notes/`);
  process.exit(1);
}

const raw = await readFile(filePath, 'utf-8');

// ── Parse frontmatter and check maturity ──────────────────────
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) {
  console.error('Error: note has no frontmatter');
  process.exit(1);
}

const fm = fmMatch[1];
const maturityMatch = fm.match(/^maturity:\s*(.+)$/m);
const maturity = maturityMatch?.[1]?.trim();

if (!maturity || maturity === 'seedling') {
  console.error(`Error: only 'budding' or 'evergreen' notes should be syndicated (got '${maturity ?? 'none'}')`);
  process.exit(1);
}

// ── Extract note data for posting ─────────────────────────────
const titleMatch       = fm.match(/^title:\s*["']?(.+?)["']?$/m);
const descriptionMatch = fm.match(/^description:\s*["']?(.+?)["']?$/m);

const title       = titleMatch?.[1]?.trim()       ?? noteId;
const description = descriptionMatch?.[1]?.trim() ?? '';
const url         = `https://vidip.dev/garden/${noteId}/`;
const body        = raw.replace(/^---\n[\s\S]*?\n---\n/, '');

// ── Publish ────────────────────────────────────────────────────
console.log(`Publishing '${title}' to ${target.name}...`);

const result = await target.publish({ title, url, description, tags: [], body });

console.log(`✓ Published: ${result.url}`);

// ── Patch frontmatter ─────────────────────────────────────────
let updated = raw;

const syndicationEntry = `  ${targetFlag}: "${result.url}"`;

if (raw.includes('syndication:')) {
  // Add the new key under existing syndication block
  updated = raw.replace(
    /^(syndication:\n)([\s\S]*?)(?=\n\w|\n---)/m,
    (_, block, rest) => `${block}${rest}${syndicationEntry}\n`
  );
} else {
  // Add syndication block before closing ---
  updated = raw.replace(
    /\n---\n/,
    `\nsyndication:\n${syndicationEntry}\n---\n`
  );
}

await writeFile(filePath, updated, 'utf-8');
console.log(`✓ Frontmatter patched: ${filePath}`);
