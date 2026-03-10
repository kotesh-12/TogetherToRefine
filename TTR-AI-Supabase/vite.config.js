import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit for PWA precache
      },
      manifest: {
        name: 'TTR AI - Together To Refine',
        short_name: 'TTR AI',
        description: 'TTR AI - Your Intelligent Learning Companion. AI-powered study tools, quizzes, and document analysis.',
        theme_color: '#0f0f14',
        background_color: '#0f0f14',
        display: 'standalone',
        orientation: 'any',
        id: '/',
        start_url: '/',
        scope: '/',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'TTR AI Dashboard'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'TTR AI Mobile'
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
