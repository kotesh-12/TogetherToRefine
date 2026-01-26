import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Service Worker is now managed by UpdateManager.jsx
const APP_VERSION = '0.0.24';
console.log("TTR App Version:", APP_VERSION);

// NUCLEAR FIX: Force unregister old Service Workers if version mismatches
// This ensures "stuck" PWAs download the fresh update.
const storedVersion = localStorage.getItem('ttr_version');
if (storedVersion !== APP_VERSION) {
  console.log(`Version mismatch (Old: ${storedVersion}, New: ${APP_VERSION}). Clearing cache...`);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
      localStorage.setItem('ttr_version', APP_VERSION);
      window.location.reload(); // Force reload to fetch new bundle
    });
  } else {
    localStorage.setItem('ttr_version', APP_VERSION);
  }
} else {
  // Regular boot
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
