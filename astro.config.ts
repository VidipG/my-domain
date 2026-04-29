import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { wikilinkPlugin } from './src/lib/wikilinks.ts';

export default defineConfig({
  site: 'https://vidip.dev',
  output: 'static',
  integrations: [sitemap()],
  image: {
    // Cloudflare Image Resizing handles transforms at the edge — no build-time overhead
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  markdown: {
    remarkPlugins: [wikilinkPlugin],
    shikiConfig: {
      theme: 'gruvbox-dark-hard',
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
