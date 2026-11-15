import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le client vit dans client/ ; en développement, Vite relaie /api et /ws vers le serveur de jeu (port 8080).
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist/client', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
