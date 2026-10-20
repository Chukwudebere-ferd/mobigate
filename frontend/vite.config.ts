import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Better Auth server. Declared before '/api': Vite matches proxy keys
      // in order, and '/api' would otherwise swallow '/api/auth/*'.
      '/api/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Go API (recruitment + personnel domain)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The admin panel is the heaviest surface (recharts, tables, dialogs).
    // Routes are lazy-loaded in App.tsx, so the public careers page — which
    // most visitors actually load — does not pull the admin bundle.
    chunkSizeWarningLimit: 700,
  },
})
