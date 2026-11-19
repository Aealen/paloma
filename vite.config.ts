import { defineConfig } from 'vite'

// Tauri 前端：root 指向 frontend/，产物输出到根 dist/（tauri.conf.json 引用）。
export default defineConfig({
  root: 'frontend',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'chrome105',
    outDir: '../dist',
    emptyOutDir: true,
  },
})
