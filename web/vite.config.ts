import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4100', changeOrigin: true } } },
  preview: { proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4100', changeOrigin: true } } },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Framework code changes far less often than app code; separate
        // chunks let browsers keep it cached across deploys.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('lucide-react')) return 'icons'
          return 'vendor'
        },
      },
    },
  },
})
