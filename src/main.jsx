import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Service Worker is now managed by UpdateManager.jsx
const APP_VERSION = '0.0.42'; // UPDATED
console.log("TTR App Version:", APP_VERSION);

// NUCLEAR FIX: Force unregister old Service Workers if version mismatches
// This ensures "stuck" PWAs download the fresh update.
const storedVersion = localStorage.getItem('ttr_version');
if (storedVersion && storedVersion !== APP_VERSION) {
  console.log(`Version mismatch (Old: ${storedVersion}, New: ${APP_VERSION}). Clearing cache...`);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length === 0) {
        // No SW found, just update version and proceed
        localStorage.setItem('ttr_version', APP_VERSION);
      } else {
        for (let registration of registrations) {
          registration.unregister().then(() => console.log("Unregistered legacy SW"));
        }
        localStorage.setItem('ttr_version', APP_VERSION);
        // Reload only if we actually killed something to avoid loop
        setTimeout(() => window.location.reload(), 500);
      }
    });
  } else {
    localStorage.setItem('ttr_version', APP_VERSION);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
