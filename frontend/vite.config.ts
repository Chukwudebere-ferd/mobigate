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
      // Go API (recruitment + personnel domain)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Better Auth server. The better-auth React client is transport-agnostic:
      // it only issues fetches against /api/auth/*, so this target can later
      // be repointed at the Go binary without touching frontend code.
      '/api/auth': {
        target: 'http://localhost:3000',
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
