import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // ─── Dev Server ────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to the backend during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ─── Build Optimizations ───────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core in its own chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Utility libs
          'utils': ['axios', 'date-fns', 'react-hot-toast'],
        },
      },
    },
    // Warn if any chunk exceeds 1MB
    chunkSizeWarningLimit: 1000,
  },

  // ─── Preview (production build locally) ───────────────────────────────────
  preview: {
    port: 4173,
  },
})