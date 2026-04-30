/**
 * POSSE syndication interfaces
 *
 * Each syndication target implements SyndicationTarget.
 * The publish() method posts the note and returns the canonical URL
 * of the syndicated copy, which is then written back into the note's
 * frontmatter by scripts/syndicate.ts.
 */

export interface SyndicationPost {
  title:       string;
  /** Canonical URL on this domain */
  url:         string;
  description: string;
  tags:        string[];
  /** Raw markdown body — some targets may truncate or summarise */
  body:        string;
}

export interface SyndicationResult {
  target: string;
  /** URL of the syndicated copy */
  url:    string;
}

export interface SyndicationTarget {
  readonly name: string;

  /**
   * Publish the note to this target.
   * @returns URL of the syndicated copy on the target platform
   */
  publish(post: SyndicationPost): Promise<SyndicationResult>;

  /**
   * Whether this target is configured and ready.
   * Returns false if required environment variables are missing.
   */
  isConfigured(): boolean;
}
