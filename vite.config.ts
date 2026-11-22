import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const proxy = { '/api': 'http://127.0.0.1:3001' }

export default defineConfig({
  plugins: [react()],
  server: { proxy, host: 'localhost', strictPort: true },
  preview: { proxy, host: 'localhost', strictPort: true },
})
