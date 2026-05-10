import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { NativeBridge } from './services/nativeBridge';

// Initializing KAVACH Protocol (System-Level Agent Bridge)
if (window.Capacitor && !window.location.protocol.startsWith('http')) {
    NativeBridge.initPush().catch(err => console.warn('Push registration failed:', err));
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
