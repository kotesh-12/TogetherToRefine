import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true // This combined with prompt allows seamless takeover when accepted
      },
      manifest: {
        name: 'TogetherToRefine',
        short_name: 'TTR',
        description: 'Advanced AI Education Platform',
        theme_color: '#ffffff',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        icons: [
          {
            src: 'TTR1_logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'TTR1_logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
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
