import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@` points at src/, not the project root. Both prototypes aliased it to the
    // root, which nothing used and which resolves one level too high.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5173, host: true },
});
