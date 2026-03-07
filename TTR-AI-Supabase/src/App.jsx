import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PWAProvider } from './context/PWAContext';
import Login from './pages/Login';
import TTRAIChat from './pages/TTRAIChat';
import DownloadApp from './pages/DownloadApp';
import './index.css';

function AppRoutes() {
  return (
    <Routes>
      {/* Chat is the default — no auth required */}
      <Route path="/" element={<TTRAIChat />} />
      <Route path="/ttr-ai" element={<TTRAIChat />} />
      <Route path="/login" element={<Login />} />
      <Route path="/download-app" element={<DownloadApp />} />
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
