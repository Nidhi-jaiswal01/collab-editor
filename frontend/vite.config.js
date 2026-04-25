import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      tslib: resolve('./node_modules/tslib/tslib.es6.js')
    }
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