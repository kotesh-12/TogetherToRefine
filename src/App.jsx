import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import TTRAIChat from './pages/TTRAIChat';
import IntelligenceHub from './pages/IntelligenceHub';
import PrivacyPolicy from './pages/PrivacyPolicy';

import './index.css';
import 'katex/dist/katex.min.css';

// Lazy load for high security - stops Admin code from bundling with user code
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('TTR-AI Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui', padding: '20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>⚡ TTR-AI Engine Reset Required</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Something unexpected happened. Click below to reload.</p>
          <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }} style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', cursor: 'pointer', marginBottom: '20px' }}>Clear Cache & Reload</button>
          {this.state.error && (
            <div style={{ background: '#1a0505', color: '#ff4d4d', padding: '15px', borderRadius: '8px', border: '1px solid #ff4d4d', fontSize: '0.85rem', fontFamily: 'monospace', width: '100%', maxWidth: '500px', textAlign: 'left', overflow: 'auto', maxHeight: '250px' }}>
              <strong style={{ color: '#ff6b6b' }}>Error:</strong> {this.state.error.message}<br/>
              <strong style={{ color: '#ff6b6b' }}>Stack:</strong> {this.state.error.stack}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  return (
    <Routes>
      {/* Chat is the default — no auth required */}
      <Route path="/" element={<TTRAIChat />} />
      <Route path="/ttr-ai" element={<TTRAIChat />} />
      <Route path="/nexus/:sessionId" element={<TTRAIChat />} />
      <Route path="/login" element={<Login />} />
      <Route path="/intelligence-hub" element={<IntelligenceHub />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />


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
  React.useEffect(() => {
    // Secondary loader removal trigger
    const loader = document.getElementById('root-loading');
    if (loader) {
        setTimeout(() => {
            const el = document.getElementById('root-loading');
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 500);
            }
        }, 1000); // Wait a bit for the first frame
    }
  }, []);

  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <AppRoutes />
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
