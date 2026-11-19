import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: path.resolve(__dirname, 'electron/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: { input: { index: path.resolve(__dirname, 'electron/preload/index.ts') } },
    },
  },
  renderer: {
    root: path.resolve(__dirname, 'frontend'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: path.resolve(__dirname, 'frontend/index.html') },
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'frontend/src') },
    },
    plugins: [react(), tailwindcss()],
  },
})
