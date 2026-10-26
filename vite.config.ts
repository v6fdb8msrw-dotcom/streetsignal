/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './': relative Pfade, damit der Build auch unter /streetsignal/ auf GitHub Pages läuft.
// /api geht im Entwicklungsmodus an den lokalen Import-Server (server/index.mjs).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5191,
    proxy: { '/api': 'http://127.0.0.1:5187' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:5187' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
})
