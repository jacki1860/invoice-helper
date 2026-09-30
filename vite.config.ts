import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { seoPages } from './scripts/seo-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), seoPages()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
