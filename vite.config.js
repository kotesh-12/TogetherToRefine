import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // VitePWA({...}) DISABLED FOR MANUAL KILL SWITCH
  ],
  server: {
    host: true, // Allow external access (e.g. mobile testing)
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Use Local Backend for Development
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['react-player']
        }
      }
    }
  },
})
