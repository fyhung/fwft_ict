import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    assetsInlineLimit: 32 * 1024 * 1024,
    rollupOptions: {
      input: resolve(process.cwd(), 'editor-source.html'),
    },
  },
});
