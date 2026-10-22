import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '..',
  envDir: './admin',
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'admin-deploy',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: '../index.html',
        admin: '../admin/index.html',
        tv: '../hotel-tv-panel.html',
      },
    },
  },
})
