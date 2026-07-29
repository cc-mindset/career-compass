import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@ui-kit': path.resolve(__dirname, '../app/src/ui-kit'),
    }
  },
  build: {
    outDir: 'dist',
  },
});
