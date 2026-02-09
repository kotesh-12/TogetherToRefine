import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Service Worker is now managed by UpdateManager.jsx
const APP_VERSION = '0.0.48'; // UPDATED
console.log("TTR App Version:", APP_VERSION);

// NUCLEAR FIX: Force unregister old Service Workers if version mismatches
// This ensures "stuck" PWAs download the fresh update.
const storedVersion = localStorage.getItem('ttr_version');
if (storedVersion && storedVersion !== APP_VERSION) {
  console.log(`Version mismatch (Old: ${storedVersion}, New: ${APP_VERSION}). Clearing cache...`);
  // Update storage first to prevent loops
  localStorage.setItem('ttr_version', APP_VERSION);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister().then(() => console.log("Unregistered legacy SW"));
      }
      // Reload page once to get fresh assets
      window.location.reload();
    });
  }
} else {
  // If no version stored, store it.
  if (!storedVersion) localStorage.setItem('ttr_version', APP_VERSION);
}

createRoot(document.getElementById('root')).render(
  createRoot(document.getElementById('root')).render(
    <App />
  )
)
