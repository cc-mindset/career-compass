import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  root: '.',
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  plugins: [
    react({
      include: '**/*.{jsx,tsx}',
    }),
    {
      name: 'design-library-html',
      transformIndexHtml(html, ctx) {
        // Replace index.html content with design-library.html content
        if (ctx.path === '/index.html' || ctx.path === '/') {
          return fs.readFileSync(
            path.resolve(__dirname, 'design-library.html'),
            'utf-8'
          );
        }
        return html;
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist-design-library',
    rollupOptions: {
      input: path.resolve(__dirname, 'design-library.html'),
    },
  },
});
