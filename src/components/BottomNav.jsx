import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();

    // Style for the container
    const navStyle = {
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--divider)',
        padding: '10px 0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        height: '60px' // Explicit height
    };

    // Style for individual items
    const isActive = (path) => location.pathname === path;

    // Helper to render Item
    const NavItem = ({ path, icon, label }) => {
        const active = isActive(path);
        return (
            <div
                onClick={() => handleNav(path)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    flex: 1,
                    transition: 'color 0.2s',
                    fontSize: '10px', // Mobile standard
                    fontWeight: active ? '600' : '400'
                }}
            >
                <div style={{ fontSize: '22px', marginBottom: '2px' }}>{icon}</div>
                <span>{label}</span>
            </div>
        );
    };

    const handleNav = (path) => {
        if (path === '/') {
            // Use actual user role from Firebase instead of guessing from URL
            const role = userData?.role?.toLowerCase();
            if (role === 'admin' || role === 'system admin') {
                path = '/admin';
            } else if (role === 'institution') {
                path = '/institution';
            } else if (role === 'teacher') {
                path = '/teacher';
            } else if (role === 'parent') {
                path = '/parent';
            } else {
                path = '/student'; // fallback for students or unknown
            }
        }

        if (location.pathname !== path) {
            navigate(path, { replace: true });
        }
    };

    const isHomeActive = () => {
        return ['/student', '/teacher', '/institution', '/admin', '/parent', '/'].includes(location.pathname);
    };

    return (
        <nav className="bottom-nav-wrapper">
            <div onClick={() => { vibrate(); handleNav('/'); }} className={`nav-item ${isHomeActive() ? 'active' : ''}`}>
                <div className="nav-icon">🏠</div>
                <span className="nav-label">Home</span>
            </div>
            <div onClick={() => { vibrate(); handleNav('/group'); }} className={`nav-item ${isActive('/group') ? 'active' : ''}`}>
                <div className="nav-icon">🏫</div>
                <span className="nav-label">Groups</span>
            </div>
            <div onClick={() => { vibrate(); handleNav('/ttr-ai'); }} className={`nav-item ${isActive('/ttr-ai') ? 'active' : ''}`}>
                <div className="nav-icon ai-nav-icon">🤖</div>
                <span className="nav-label">AI</span>
            </div>
            <div onClick={() => { vibrate(); handleNav('/attendance'); }} className={`nav-item ${isActive('/attendance') ? 'active' : ''}`}>
                <div className="nav-icon">✅</div>
                <span className="nav-label">Attend</span>
            </div>
            <div onClick={() => { vibrate(); handleNav('/profile'); }} className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <div className="nav-icon">👤</div>
                <span className="nav-label">Profile</span>
            </div>
        </nav>
    );
}

const vibrate = () => {
    if ('vibrate' in navigator) navigator.vibrate(40);
};
