import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('epubjs') || id.includes('jszip') || id.includes('localforage') || id.includes('marks-pane') || id.includes('event-emitter') || id.includes('@xmldom/xmldom')) {
            return 'reader-vendor';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('lucide-react') || id.includes('@radix-ui/react-slot') || id.includes('radix-ui')) {
            return 'ui-vendor';
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(here, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'epubjs',
      'event-emitter',
      'localforage',
      'jszip',
      'marks-pane',
      '@xmldom/xmldom',
    ],
  },
  envDir: resolve(here, '../../'),
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/health': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
