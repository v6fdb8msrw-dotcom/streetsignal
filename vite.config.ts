import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './': relative Pfade, damit der Build auch in einem Unterordner läuft (GitHub Pages, Vorschau-Link)
export default defineConfig({
  base: './',
  plugins: [react()],
})
