import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function Header({ onToggleSidebar }) {
    const { userData } = useUser();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false); // YouTube-style search toggle
    const [desktopMode, setDesktopMode] = useState(false);

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            auth.signOut().then(() => navigate('/'));
        }
    };

    const toggleDesktopMode = () => {
        const metaViewport = document.querySelector('meta[name=viewport]');
        if (!desktopMode) {
            // Switch to Desktop
            metaViewport.setAttribute('content', 'width=1024');
            setDesktopMode(true);
        } else {
            // Switch back to Mobile/Responsive
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1');
            setDesktopMode(false);
        }
        setMenuOpen(false);
    };

    const [suggestions, setSuggestions] = useState([]);

    // Auto-Search on Type (Debounced manually by user typing speed usually, but here direct)
    React.useEffect(() => {
        if (!searchTerm || searchTerm.length < 2 || !userData) {
            setSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            console.log("Fetching suggestions for:", searchTerm);
            const lowerTerm = searchTerm.toLowerCase();
            let results = [];

            try {
                if (userData.role === 'student' && userData.institutionId) {
                    // Students search Teachers
                    // NOTE: Firestore doesn't support native partial text search well. 
                    // We fetch a reasonable subset or rely on client filtering if dataset is small.
                    // For scalability, we'd use Algolia/Typesense. Here we fetch matches by "name" >= term.
                    // BUT "createdBy" filter is paramount.

                    // Simple approach: Fetch all teachers of this institution (usually < 100) and filter client-side
                    const q = query(collection(db, "teacher_allotments"), where("createdBy", "==", userData.institutionId));
                    const snap = await getDocs(q);
                    const unique = new Map();
                    snap.forEach(d => {
                        const data = d.data();
                        const name = data.name || data.teacherName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            if (!unique.has(name)) unique.set(name, { id: d.id, ...data, type: 'Teacher' });
                        }
                    });
                    results = Array.from(unique.values());
                }
                else if (userData.role === 'teacher' && userData.institutionId) {
                    // Teachers search Students of their Institution
                    const q = query(collection(db, "student_allotments"), where("createdBy", "==", userData.institutionId));
                    // Ideally we limit this, but filtering by strict "includes" requires reading.
                    // Optimisation: If collection is huge, this lags. For now, assuming < 2000 docs ok.
                    const snap = await getDocs(q);
                    snap.forEach(d => {
                        const data = d.data();
                        const name = data.name || data.studentName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            results.push({ id: d.id, ...data, type: 'Student' });
                        }
                    });
                }
                else if (userData.role === 'institution') {
                    // Search Both
                    const p1 = getDocs(query(collection(db, "teacher_allotments"), where("createdBy", "==", userData.uid)));
                    const p2 = getDocs(query(collection(db, "student_allotments"), where("createdBy", "==", userData.uid)));
                    const [snap1, snap2] = await Promise.all([p1, p2]);

                    const uniqueT = new Set();
                    snap1.forEach(d => {
                        const name = d.data().name || d.data().teacherName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            if (!uniqueT.has(name)) {
                                results.push({ id: d.id, ...d.data(), type: 'Teacher' });
                                uniqueT.add(name);
                            }
                        }
                    });
                    snap2.forEach(d => {
                        const name = d.data().name || d.data().studentName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            results.push({ id: d.id, ...d.data(), type: 'Student' });
                        }
                    });
                }

                setSuggestions(results.slice(0, 10)); // Top 10 matches
            } catch (e) {
                console.error("Search error:", e);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, userData]);

    const handleSuggestionClick = (item) => {
        setIsSearchMode(false);
        setSearchTerm('');
        // Navigate based on type
        if (item.type === 'Teacher') {
            // Check if we can navigate to a feedback or details page
            navigate('/general-feedback', { state: { target: item } });
        } else if (item.type === 'Student') {
            navigate('/general-feedback', { state: { target: item } });
        }
    };

    // SEARCH MODE HEADER (YouTube Style)
    if (isSearchMode) {
        return (
            <header className="app-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', position: 'relative' }}>
                <button onClick={() => setIsSearchMode(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 10px', color: 'var(--text-main)' }}>
                    ←
                </button>
                <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--secondary)', borderRadius: '20px', padding: '5px 15px' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder={userData?.role === 'student' ? "Search Teachers..." : "Search Students..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', color: 'var(--text-main)' }}
                        />
                    </div>

                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '110%', left: 0, right: 0,
                            background: 'var(--bg-surface)', border: '1px solid var(--divider)', borderRadius: '8px', zIndex: 2000,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxHeight: '300px', overflowY: 'auto'
                        }}>
                            {suggestions.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSuggestionClick(item)}
                                    style={{ padding: '10px 15px', borderBottom: '1px solid var(--divider)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--secondary)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                >
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%',
                                        background: item.type === 'Teacher' ? '#0984e3' : '#e17055', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold'
                                    }}>
                                        {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2d3436' }}>{item.name}</div>
                                        <div style={{ fontSize: '11px', color: '#636e72' }}>{item.type} • {item.subject || (item.classAssigned ? `Class ${item.classAssigned}` : '')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
                    Together To Refine
                </div>
            </div>

            <div style={{ flex: 1 }} /> {/* Spacer */}

            {/* Right: Actions Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

                {/* Search Icon (Toggles Mode) */}
                <button
                    onClick={() => setIsSearchMode(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}
                    title="Search"
                >
                    🔍
                </button>

                {/* Theme Toggle Switch */}
                <label className="switch" title="Toggle Dark/Light Mode" style={{ transform: 'scale(0.8)' }}>
                    <input type="checkbox" checked={theme === 'Dark'} onChange={toggleTheme} />
                    <span className="slider"></span>
                </label>



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
                                    onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    ⚙️ Settings
                                </button>
                                <button
                                    onClick={toggleDesktopMode}
                                    style={menuItemStyle}
                                >
                                    {desktopMode ? '📱 Mobile Site' : '🖥️ Desktop Site'}
                                </button>
                                <button
                                    onClick={() => { window.location.href = 'mailto:support@ttr.com'; setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    ❓ Help
                                </button>
                                <button
                                    onClick={() => { toggleTheme(); setMenuOpen(false); }}
                                    style={menuItemStyle}
                                >
                                    {theme === 'Light' ? '🌙 Dark Theme' : '☀️ Light Theme'}
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
    color: 'var(--text-main)',
    cursor: 'pointer',
    textAlign: 'left'
};
