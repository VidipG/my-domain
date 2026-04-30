/**
 * Bluesky syndication target (AT Protocol)
 *
 * Required environment variables:
 *   BLUESKY_HANDLE  — your handle, e.g. user.bsky.social
 *   BLUESKY_APP_PASSWORD — an app password from bsky.app/settings
 */

import type { SyndicationTarget, SyndicationPost, SyndicationResult } from './types.ts';

export class BlueskyTarget implements SyndicationTarget {
  readonly name = 'Bluesky';

  isConfigured(): boolean {
    return !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
  }

  async publish(post: SyndicationPost): Promise<SyndicationResult> {
    if (!this.isConfigured()) {
      throw new Error('Bluesky: BLUESKY_HANDLE and BLUESKY_APP_PASSWORD must be set');
    }

    // TODO: Implement AT Protocol auth + createRecord
    // 1. POST https://bsky.social/xrpc/com.atproto.server.createSession
    // 2. POST https://bsky.social/xrpc/com.atproto.repo.createRecord
    //    with collection: 'app.bsky.feed.post' and a facet for the link
    throw new Error('Bluesky syndication not yet implemented');
  }
}
