import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Service Worker is now managed by UpdateManager.jsx
const APP_VERSION = '0.0.48'; // UPDATED
console.log("TTR App Version:", APP_VERSION);

// NUCLEAR FIX: Force unregister ALL Service Workers to clear cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('🔥 Unregistering Service Worker:', registration);
      registration.unregister();
    }
  });
}

// Clear all caches unconditionally to fix "Failed to fetch" errors for dynamic imports
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => {
      console.log('🔥 Deleting Cache:', name);
      caches.delete(name);
    });
  });
}

const storedVersion = localStorage.getItem('ttr_version');
if (!storedVersion || storedVersion !== APP_VERSION) {
  localStorage.setItem('ttr_version', APP_VERSION);
}

// Render App
createRoot(document.getElementById('root')).render(
  <App />
)
