import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import TTRAIChat from './pages/TTRAIChat';
import './index.css';

function AppRoutes() {
  return (
    <Routes>
      {/* Chat is the default — no auth required */}
      <Route path="/" element={<TTRAIChat />} />
      <Route path="/ttr-ai" element={<TTRAIChat />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
