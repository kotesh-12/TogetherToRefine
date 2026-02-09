import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      // PWA REMOVED PERMANENTLY to stop caching issues
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
    // FAILSAFE: Explicitly expose env vars
    define: {
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'process.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID),
    },
    build: {
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        output: {
          // Force new filenames to bypass browser cache
          entryFileNames: 'assets/v50-[name]-[hash].js',
          chunkFileNames: 'assets/v50-[name]-[hash].js',
          assetFileNames: 'assets/v50-[name]-[hash].[ext]',
          // No manualChunks - let Vite optimize automatically (Single Bundle Preference)
        }
      }
    }
  }
})
