import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(ctx: APIContext) {
  const notes = await getCollection('notes', (n) => !n.data.draft);

  const sorted = notes.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title:       'vidip.dev — Garden',
    description: 'Notes, ideas, and things I\'m learning.',
    site:        ctx.site!,
    items: sorted.map((n) => ({
      title:       n.data.title,
      pubDate:     n.data.date,
      description: n.data.description,
      link:        `/garden/${n.id}/`,
      categories:  n.data.tags,
    })),
    customData: `<language>en-us</language>`,
    stylesheet: '/rss/pretty-feed-v3.xsl',
  });
}
