import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit for PWA precache
      },
      manifest: {
        name: 'TTR AI',
        short_name: 'TTR AI',
        description: 'TTR AI - Your Intelligent Learning Companion',
        theme_color: '#0f0f14',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2500, // Raise warning threshold (pdfjs is large)
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy document processing libs into separate chunks
          'pdf-worker': ['pdfjs-dist'],
          'doc-parsers': ['mammoth', 'jszip'],
          'syntax-highlight': ['react-syntax-highlighter'],
        }
      }
    }
  }
})
