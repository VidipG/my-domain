import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { wikilinkPlugin, buildPluginSlugMapFromFs } from './src/lib/wikilinks.ts';

// Build the slug map once at config time (main process context, correct cwd).
// This is passed to the remark plugin via options so it's available at render time.
const slugMap = buildPluginSlugMapFromFs();

export default defineConfig({
  site: 'https://vidip.dev',
  output: 'static',
  integrations: [sitemap()],
  image: {
    // Cloudflare Image Resizing handles transforms at the edge — no build-time overhead
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  markdown: {
    remarkPlugins: [[wikilinkPlugin, { slugMap }]],
    shikiConfig: {
      theme: 'vitesse-dark',
      wrap: false,
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[hash][extname]',
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
        },
      },
    },
  },
});
