import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4100', changeOrigin: true } } },
  preview: { proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4100', changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false },
})
