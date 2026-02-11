import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import logo from '../assets/logo.png';

export default function Header({ onToggleSidebar }) {
    const { userData } = useUser();
    const { theme, toggleTheme } = useTheme();
    const { language, toggleLanguage } = useLanguage();
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

    const handleSuggestionClick = (item) => {
        setIsSearchMode(false);
        setSearchTerm('');
        navigate('/profile-view', { state: { target: item } });
    };

    // Auto-Search with improved filtering and robust error handling
    React.useEffect(() => {
        if (!searchTerm || searchTerm.length < 2 || !userData) {
            setSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            const lowerTerm = searchTerm.toLowerCase();
            let results = [];
            const uniqueResults = new Map();

            try {
                // Determine Institution ID
                // 1. If I am Institution -> My UID
                // 2. If I am Student/Teacher -> My 'institutionId' or 'createdBy'
                const instId = userData.role === 'institution'
                    ? userData.uid
                    : (userData.institutionId || userData.createdBy);

                console.log("Search Context:", { role: userData.role, instId, term: lowerTerm });

                if (!instId) {
                    console.warn("Search aborted: No Institution ID found for user.");
                    return;
                }

                // 1. Fetch Local Matches (Teachers/Students based on role)
                if (userData.role === 'student') {
                    // Student searches for Teachers in their institution
                    const q = query(collection(db, "teacher_allotments"), where("createdBy", "==", instId));
                    const snap = await getDocs(q);
                    snap.forEach(d => {
                        const data = d.data();
                        const name = data.name || data.teacherName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            // Important: Capture the real userId (teacherId) if available to fetch profile pic later
                            const realId = data.teacherId || data.userId || d.id;
                            uniqueResults.set(realId, { id: realId, ...data, name: name, type: 'Teacher', collection: 'teacher_allotments' });
                        }
                    });
                } else if (userData.role === 'teacher') {
                    // Teacher searches for Students in their institution
                    const q = query(collection(db, "student_allotments"), where("createdBy", "==", instId));
                    const snap = await getDocs(q);
                    snap.forEach(d => {
                        const data = d.data();
                        const name = data.name || data.studentName;
                        if (name && name.toLowerCase().includes(lowerTerm)) {
                            const realId = data.studentId || data.userId || d.id;
                            uniqueResults.set(realId, { id: realId, ...data, name: name, type: 'Student', collection: 'student_allotments' });
                        }
                    });
                } else if (userData.role === 'institution') {
                    // Institution Search (Both Teachers & Students)
                    // 1. Teachers
                    const qT = query(collection(db, "teacher_allotments"), where("createdBy", "==", instId));
                    const snapT = await getDocs(qT);
                    snapT.forEach(d => {
                        const data = d.data();
                        if ((data.name || '').toLowerCase().includes(lowerTerm)) {
                            const realId = data.teacherId || data.userId || d.id;
                            uniqueResults.set(realId, { id: realId, ...data, name: data.name || '', type: 'Teacher' });
                        }
                    });

                    // 2. Students
                    const qS = query(collection(db, "student_allotments"), where("createdBy", "==", instId));
                    const snapS = await getDocs(qS);
                    snapS.forEach(d => {
                        const data = d.data();
                        if ((data.name || '').toLowerCase().includes(lowerTerm)) {
                            const realId = data.studentId || data.userId || d.id;
                            uniqueResults.set(realId, { id: realId, ...data, name: data.name || '', type: 'Student' });
                        }
                    });
                }

                // 2. Fetch Global Institutions (Both Students and Teachers can search Institutions)
                // Fetch ALL institutions and filter locally since Firestore 'includes' is partial
                const instQuery = query(collection(db, "users"), where("role", "==", "institution"));
                const instSnap = await getDocs(instQuery);
                instSnap.forEach(d => {
                    const data = d.data();
                    const name = data.institutionName || data.name;
                    if (name && name.toLowerCase().includes(lowerTerm)) {
                        uniqueResults.set(d.id, { id: d.id, ...data, name: name, type: 'Institution', collection: 'users' });
                    }
                });

                results = Array.from(uniqueResults.values());
                setSuggestions(results.slice(0, 10));
            } catch (e) {
                console.error("Search error:", e);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, userData]);

    // SEARCH MODE HEADER (YouTube Style)
    if (isSearchMode) {
        return (
            <header className="app-header header-search-mode">
                <button
                    onClick={() => { setIsSearchMode(false); setSearchTerm(''); }}
                    className="icon-button back-search"
                >
                    ←
                </button>
                <div className="search-input-wrapper">
                    <input
                        autoFocus
                        type="text"
                        placeholder={userData?.role === 'student' ? "Search Teachers..." : "Search Students..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field header-search-input"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="search-clear">×</button>
                    )}

                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                        <div className="search-suggestions-dropdown shadow-lg">
                            {suggestions.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSuggestionClick(item)}
                                    className="suggestion-item"
                                >
                                    <div className="suggestion-avatar" style={{ background: item.type === 'Teacher' ? 'var(--primary)' : 'var(--warning)' }}>
                                        {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="suggestion-content">
                                        <div className="suggestion-name">{item.name}</div>
                                        <div className="suggestion-meta">{item.type} • {item.subject || (item.classAssigned ? `Class ${item.classAssigned}` : '')}</div>
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
        <header className="app-header shadow-sm">
            {/* Left: Logo & Menu */}
            <div className="header-left">
                <button onClick={onToggleSidebar} className="menu-toggle">
                    ☰
                </button>
                <div
                    onClick={() => navigate('/')}
                    className="header-brand"
                >
                    <img src={logo} alt="TTR" className="logo" />
                    <h1 className="brand-text">TTR</h1>
                </div>
            </div>

            {/* Right: Actions Group */}
            <div className="header-right">
                <LanguageSelector />

                {/* Desktop Search Bar */}
                {window.innerWidth > 768 && (
                    <div className="search-input-wrapper desktop-search" style={{ minWidth: '300px', margin: '0 10px' }}>
                        <input
                            type="text"
                            placeholder={t('search_placeholder') || "Search students, teachers..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field header-search-input"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="search-clear" style={{ right: '15px' }}>×</button>
                        )}
                        {/* Suggestions Dropdown for Desktop */}
                        {suggestions.length > 0 && (
                            <div className="search-suggestions-dropdown shadow-lg">
                                {suggestions.map((item, idx) => (
                                    <div key={idx} onClick={() => handleSuggestionClick(item)} className="suggestion-item">
                                        <div className="suggestion-avatar" style={{ background: item.type === 'Teacher' ? 'var(--primary)' : 'var(--warning)' }}>
                                            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <div className="suggestion-content">
                                            <div className="suggestion-name">{item.name}</div>
                                            <div className="suggestion-meta">{item.type} {item.subject ? `• ${item.subject}` : ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {window.innerWidth <= 768 && (
                    <button
                        onClick={() => setIsSearchMode(true)}
                        className="action-icon-btn"
                        title="Search"
                    >
                        🔍
                    </button>
                )}

                <div
                    onClick={() => navigate('/profile')}
                    className="profile-avatar-mini"
                >
                    {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                </div>

                <div className="dropdown-wrapper">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="more-options-btn"
                    >
                        ⋮
                    </button>

                    {menuOpen && (
                        <>
                            <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
                            <div className="dropdown-menu shadow-md">
                                <div className="menu-header">
                                    <div className="menu-name">{userData?.name || 'User'}</div>
                                    <div className="menu-role">{userData?.role || 'Guest'}</div>
                                </div>
                                <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} className="menu-item">👤 Profile</button>
                                <button onClick={() => { navigate('/settings'); setMenuOpen(false); }} className="menu-item">⚙️ Settings</button>
                                <button onClick={() => { toggleDesktopMode(); setMenuOpen(false); }} className="menu-item">
                                    {desktopMode ? '📱 Mobile Site' : '🖥️ Desktop Site'}
                                </button>
                                <button onClick={() => { navigate('/download'); setMenuOpen(false); }} className="menu-item">📥 Install App</button>
                                <button onClick={() => { toggleTheme(); setMenuOpen(false); }} className="menu-item">
                                    {theme === 'Light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                                </button>
                                <div className="menu-divider" />
                                <button onClick={handleLogout} className="menu-item menu-logout">🚪 Logout</button>
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
