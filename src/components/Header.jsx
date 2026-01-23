import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth } from '../firebase';

export default function Header({ onToggleSidebar }) {
    const { userData } = useUser();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            console.log("Searching for:", searchTerm);
            // Implement global search if needed
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            auth.signOut().then(() => navigate('/'));
        }
    };

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

            {/* Center: Chrome-style Search */}
            <div style={{ flex: 1, maxWidth: '600px', margin: '0 20px', display: 'flex' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#f1f3f4',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    width: '100%',
                    border: '1px solid transparent',
                    transition: 'all 0.2s'
                }}>
                    <span style={{ color: '#5f6368', marginRight: '10px' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search anything..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleSearch}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            width: '100%',
                            fontSize: '16px',
                            color: '#202124'
                        }}
                    />
                </div>
            </div>

            {/* Right: Profile & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Notification Icon */}
                <button
                    onClick={() => navigate('/notification')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', position: 'relative' }}
                >
                    🔔
                    <span style={{
                        position: 'absolute', top: -2, right: -2,
                        width: '8px', height: '8px', background: '#d93025', borderRadius: '50%'
                    }}></span>
                </button>

                {/* AI Shortcut */}
                <button
                    onClick={() => navigate('/ttr-ai')}
                    style={{
                        background: 'linear-gradient(135deg, #1a73e8, #8ab4f8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    ✨ AI Buddy
                </button>

                {/* Profile Avatar */}
                <div onClick={handleLogout} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px',
                        borderRadius: '50%', background: '#1a73e8', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '14px'
                    }}>
                        {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                </div>
            </div>
        </header>
    );
}
