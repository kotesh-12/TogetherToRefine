import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

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
        if (location.pathname !== path) {
            navigate(path, { replace: true });
        }
    };

    return (
        <div style={navStyle}>
            <NavItem path="/" icon="🏠" label="Home" />
            <NavItem path="/group" icon="🏫" label="Class" />
            <NavItem path="/ttr-ai" icon="🤖" label="AI" />
            <NavItem path="/attendance" icon="📅" label="Attend" />
            <NavItem path="/profile" icon="👤" label="Profile" />
        </div>
    );
}
