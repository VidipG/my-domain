/**
 * Twitter/X syndication target (Twitter API v2)
 *
 * Required environment variables:
 *   TWITTER_BEARER_TOKEN        — OAuth 2.0 App-only bearer token
 *   TWITTER_API_KEY             — API key (OAuth 1.0a)
 *   TWITTER_API_SECRET          — API secret
 *   TWITTER_ACCESS_TOKEN        — Access token
 *   TWITTER_ACCESS_TOKEN_SECRET — Access token secret
 */

import type { SyndicationTarget, SyndicationPost, SyndicationResult } from './types.ts';

const MAX_CHARS = 280;

export class TwitterTarget implements SyndicationTarget {
  readonly name = 'Twitter/X';

  isConfigured(): boolean {
    return !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
  }

  async publish(post: SyndicationPost): Promise<SyndicationResult> {
    if (!this.isConfigured()) {
      throw new Error('Twitter: API credentials not configured');
    }

    // TODO: Implement OAuth 1.0a signing + POST /2/tweets
    // Twitter API v2 requires OAuth 1.0a HMAC-SHA1 request signing.
    // Use the `oauth-1.0a` package or implement signing manually.
    throw new Error('Twitter syndication not yet implemented');
  }

  #formatTweet(title: string, url: string): string {
    const base = `${title}\n\n${url}`;
    return base.length <= MAX_CHARS ? base : `${title.slice(0, MAX_CHARS - url.length - 5)}...\n\n${url}`;
  }
}
