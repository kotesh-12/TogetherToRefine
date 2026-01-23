import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth } from '../firebase';

export default function Header({ onToggleSidebar }) {
    const { userData } = useUser();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false); // YouTube-style search toggle

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            console.log("Searching for:", searchTerm);
            // Implement actual search redirect or filter here if needed
            // setIsSearchMode(false); // Optional: close on search
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            auth.signOut().then(() => navigate('/'));
        }
    };

    // SEARCH MODE HEADER (YouTube Style)
    if (isSearchMode) {
        return (
            <header className="app-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white' }}>
                <button onClick={() => setIsSearchMode(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 10px' }}>
                    ←
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f1f3f4', borderRadius: '20px', padding: '5px 15px' }}>
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleSearch}
                        style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px' }}
                    />
                </div>
            </header>
        );
    }

    // DEFAULT HEADER
    return (
        <header className="app-header">
            {/* Left: Logo & Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={onToggleSidebar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#5f6368' }}>
                    ☰
                </button>
                <div
                    onClick={() => navigate('/')}
                    style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a73e8', cursor: 'pointer', letterSpacing: '-0.5px' }}
                >
                    TTR<span style={{ color: '#202124' }}>Studio</span>
                </div>
            </div>

            <div style={{ flex: 1 }} /> {/* Spacer */}

            {/* Right: Actions Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

                {/* Search Icon (Toggles Mode) */}
                <button
                    onClick={() => setIsSearchMode(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}
                    title="Search"
                >
                    🔍
                </button>

                {/* Bell Notification */}
                <button
                    onClick={() => navigate('/notification')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', position: 'relative' }}
                    title="Notifications"
                >
                    🔔
                    <span style={{
                        position: 'absolute', top: -2, right: -2,
                        width: '8px', height: '8px', background: '#d93025', borderRadius: '50%'
                    }}></span>
                </button>

                {/* Profile Avatar */}
                <div
                    onClick={() => navigate('/profile')}
                    style={{
                        width: '32px', height: '32px',
                        borderRadius: '50%', background: '#1a73e8', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
                    }}
                    title={userData?.name || "Profile"}
                >
                    {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                </div>

                {/* 3-Dot Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '20px',
                            color: '#5f6368',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f3f4'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                        ⋮
                    </button>

                    {/* Dropdown Menu */}
                    {menuOpen && (
                        <>
                            <div
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                                onClick={() => setMenuOpen(false)}
                            />
                            <div style={{
                                position: 'absolute',
                                top: '45px',
                                right: '0',
                                width: '200px',
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                border: '1px solid #dadce0',
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', background: '#f8f9fa' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#202124' }}>
                                        {userData?.name || 'User'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#5f6368' }}>
                                        {userData?.role || 'Guest'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    👤 Profile
                                </button>
                                <button
                                    onClick={() => { navigate('/details'); setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    ⚙️ Settings
                                </button>
                                <button
                                    onClick={() => { window.location.href = 'mailto:support@ttr.com'; setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    ❓ Help
                                </button>
                                <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                                <button
                                    onClick={handleLogout}
                                    style={{ ...menuItemStyle, color: '#d93025' }}
                                >
                                    🚪 Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#3c4043',
    cursor: 'pointer',
    textAlign: 'left'
};
