import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PWAProvider } from './context/PWAContext';
import Login from './pages/Login';
import TTRAIChat from './pages/TTRAIChat';
import DownloadApp from './pages/DownloadApp';
import Pricing from './pages/Pricing';
import './index.css';

// Lazy load for high security - stops Admin code from bundling with user code
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function AppRoutes() {
  return (
    <Routes>
      {/* Chat is the default — no auth required */}
      <Route path="/" element={<TTRAIChat />} />
      <Route path="/ttr-ai" element={<TTRAIChat />} />
      <Route path="/login" element={<Login />} />
      <Route path="/download-app" element={<DownloadApp />} />
      <Route path="/pricing" element={<Pricing />} />

      {/* 🚨 Hidden Admin Route 🚨 */}
      <Route
        path="/admin-ttrai-hq"
        element={
          <Suspense fallback={<div style={{ padding: '50px', color: '#8b5cf6', background: '#0f0f14', height: '100vh', textAlign: 'center' }}>Loading Restricted Area...</div>}>
            <AdminDashboard />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </PWAProvider>
  );
}

export default App;
