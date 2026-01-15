import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New update available. Reload?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App is ready to work offline.");
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
