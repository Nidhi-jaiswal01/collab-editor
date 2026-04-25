import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['tslib'],
      output: {
        globals: {
          tslib: 'tslib'
        }
      }
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:7860',
        ws: true,
      }
    }
  }
})