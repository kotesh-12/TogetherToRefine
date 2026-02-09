import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Service Worker is now managed by UpdateManager.jsx
// PWA Registration
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, auto-updating...');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

const APP_VERSION = '0.0.53'; // APK PREP
console.log("TTR App Version:", APP_VERSION);

// Version Check for Debugging
const storedVersion = localStorage.getItem('ttr_version');
if (!storedVersion || storedVersion !== APP_VERSION) {
  localStorage.setItem('ttr_version', APP_VERSION);
  // Optional: Force update if version mismatch (handled by autoUpdate usually)
}

// Render App
createRoot(document.getElementById('root')).render(
  <App />
)
