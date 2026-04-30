/**
 * Mastodon syndication target (Mastodon API v1)
 *
 * Required environment variables:
 *   MASTODON_INSTANCE — base URL, e.g. https://hachyderm.io
 *   MASTODON_TOKEN    — access token with write:statuses scope
 */

import type { SyndicationTarget, SyndicationPost, SyndicationResult } from './types.ts';

const MAX_CHARS = 500;

export class MastodonTarget implements SyndicationTarget {
  readonly name = 'Mastodon';

  isConfigured(): boolean {
    return !!(process.env.MASTODON_INSTANCE && process.env.MASTODON_TOKEN);
  }

  async publish(post: SyndicationPost): Promise<SyndicationResult> {
    if (!this.isConfigured()) {
      throw new Error('Mastodon: MASTODON_INSTANCE and MASTODON_TOKEN must be set');
    }

    const instance = process.env.MASTODON_INSTANCE!.replace(/\/$/, '');
    const token    = process.env.MASTODON_TOKEN!;

    const hashtags = post.tags.map((t) => `#${t.replace(/-/g, '')}`).join(' ');
    const text     = this.#formatStatus(post.title, post.url, post.description, hashtags);

    // TODO: Implement POST /api/v1/statuses
    const response = await fetch(`${instance}/api/v1/statuses`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: text, visibility: 'public' }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mastodon publish failed: ${response.status} ${err}`);
    }

    const data = (await response.json()) as { url: string };
    return { target: this.name, url: data.url };
  }

  #formatStatus(title: string, url: string, description: string, hashtags: string): string {
    const base = `${title}\n\n${url}`;
    const withHashtags = `${base}\n\n${hashtags}`;
    if (withHashtags.length <= MAX_CHARS) return withHashtags;

    const withDesc = `${title}\n\n${description}\n\n${url}`;
    if (withDesc.length <= MAX_CHARS) return withDesc;

    return base;
  }
}
