import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const adminDir = import.meta.dirname
const rootDir = path.resolve(adminDir, '..')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: rootDir,
  envDir: adminDir,
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: path.resolve(rootDir, 'admin-deploy'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: path.resolve(rootDir, 'index.html'),
        admin: path.resolve(adminDir, 'index.html'),
        tv: path.resolve(rootDir, 'hotel-tv-panel.html'),
        tvInfo: path.resolve(rootDir, 'tv-info.html'),
        supervisor: path.resolve(rootDir, 'supervisor.html'),
      },
    },
  },
})
