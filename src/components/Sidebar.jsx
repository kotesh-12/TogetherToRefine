import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar({ isOpen }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();
    const { t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Filter by Role - Wait for userData to load
    if (!userData || !userData.role) {
        return null; // Don't render sidebar until user data is loaded
    }

    const userRole = userData.role.toLowerCase();

    const allRoutes = [
        { path: '/', label: t('dashboard'), icon: '🏠' },
        { path: '/admin', label: 'Admin Panel', icon: '🛡️', roles: ['admin'] },
        { path: '/institution', label: 'Institution View', icon: '🏛️', roles: ['institution'] },
        { path: '/teacher', label: 'Faculty Room', icon: '👨‍🏫', roles: ['teacher'] },
        { path: '/student', label: 'My Desk', icon: '🎓', roles: ['student'] },
        { path: '/group', label: userRole === 'student' ? 'My Class' : 'Manage Groups', icon: '🏫', roles: ['teacher', 'student', 'institution', 'admin'] },
        { path: '/homework', label: userRole === 'student' ? 'Assignments' : 'Homework Desk', icon: '📚', roles: ['teacher', 'student'] },
        { path: '/marks', label: userRole === 'student' ? 'My Progress' : 'Marks Entry', icon: '🎯', roles: ['teacher', 'student'] },
        { path: '/attendance', label: t('attendance'), icon: '📅', roles: ['teacher', 'student', 'institution'] },
        { path: '/timetable', label: t('timetable'), icon: '🕒', roles: ['teacher', 'student', 'institution'] },
        { path: '/exam', label: t('exams'), icon: '📝', roles: ['teacher', 'student', 'institution'] },
        { path: '/video-library', label: t('video_library'), icon: '📺' },
        { path: '/health', label: t('health'), icon: '❤️' },
        { path: '/general-feedback', label: t('feedback'), icon: '💬' },
        { path: '/view-exam-seating', label: 'Seating Plan', icon: '🪑', roles: ['teacher', 'student', 'institution'] },
        { path: '/exam-seating', label: 'Plan Allotment', icon: '🛠️', roles: ['institution', 'admin'] },
        { path: '/settings', label: t('settings'), icon: '⚙️' },
    ];

    const routes = allRoutes.filter(r => !r.roles || r.roles.includes(userRole));

    // Helper to check if route is active
    const isActive = (path) => {
        if (path === '/') {
            return ['/student', '/teacher', '/institution', '/admin'].some(p => location.pathname === p);
        }
        return location.pathname.startsWith(path);
    };

    const handleNav = (item) => {
        if (item.path === '/') {
            if (userRole === 'admin') navigate('/admin');
            else if (userRole === 'institution') navigate('/institution');
            else if (userRole === 'teacher') navigate('/teacher');
            else if (userRole === 'parent') navigate('/parent');
            else navigate('/student');
        } else {
            navigate(item.path);
        }
    };

    return (
        <div className="sidebar-container" style={{
            width: isOpen ? '260px' : '80px',
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--divider)',
            height: '100%',
            position: 'relative',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            boxShadow: '4px 0 10px rgba(0,0,0,0.02)'
        }}>
            {/* Sidebar Branding / Role Badge */}
            <div style={{
                padding: '24px 20px',
                borderBottom: '1px solid var(--divider)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: 'white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }}>
                    {userRole === 'admin' ? '🛡️' : userRole === 'institution' ? '🏛️' : userRole === 'teacher' ? '👨‍🏫' : '🎓'}
                </div>
                {isOpen && (
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {userRole}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            Platform Control
                        </div>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                {routes.map((item, idx) => {
                    const active = isActive(item.path);
                    return (
                        <div
                            key={idx}
                            onClick={() => handleNav(item)}
                            className={`sidebar-item ${active ? 'active' : ''}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderRadius: '12px',
                                background: active ? 'var(--primary-light)' : 'transparent',
                                color: active ? 'var(--primary)' : 'var(--text-muted)',
                                marginBottom: '4px',
                                transition: 'all 0.2s ease',
                                borderLeft: active ? '4px solid var(--primary)' : '4px solid transparent'
                            }}
                            onMouseOver={(e) => !active && (e.currentTarget.style.background = 'var(--bg-surface)')}
                            onMouseOut={(e) => !active && (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ fontSize: '20px', minWidth: '32px' }}>{item.icon}</span>
                            {isOpen && (
                                <span style={{
                                    fontSize: '14px',
                                    fontWeight: active ? '700' : '500',
                                    whiteSpace: 'nowrap',
                                    marginLeft: '12px'
                                }}>
                                    {item.label}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Premium Upward Dropdown Section */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--divider)', position: 'relative' }}>
                {isMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '12px',
                        right: '12px',
                        background: 'var(--bg-surface)',
                        borderRadius: '16px',
                        boxShadow: '0 -10px 25px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)',
                        padding: '8px',
                        marginBottom: '12px',
                        zIndex: 1200,
                        border: '1px solid var(--divider)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        <style>{`
                            @keyframes slideUp {
                                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                                to { opacity: 1; transform: translateY(0) scale(1); }
                            }
                        `}</style>
                        
                        {[
                            { label: 'Themes', icon: theme === 'Dark' ? '☀️' : '🌙', action: toggleTheme },
                            { label: 'Upgrade Plan', icon: '💎', action: () => navigate('/fees/student') },
                            { label: 'Intelligence Hub', icon: '🧠', action: () => navigate('/ttr-ai') },
                            { label: 'Gurukul Board', icon: '🎓', action: () => navigate('/student') },
                            { label: 'Enable Voice', icon: '🎙️', action: () => alert('Voice Intelligence Enabled') },
                            { label: 'Download App', icon: '📱', action: () => navigate('/download') },
                        ].map((item, i) => (
                            <div
                                key={i}
                                onClick={() => { item.action(); setIsMenuOpen(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: 'var(--text-main)',
                                    transition: 'all 0.2s ease',
                                    background: 'transparent'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--secondary)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                                {isOpen && <span>{item.label}</span>}
                            </div>
                        ))}
                    </div>
                )}

                <div
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        background: 'var(--primary-gradient, linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%))',
                        color: 'white',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(26, 115, 232, 0.2)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <span style={{ fontSize: '20px', minWidth: '32px', display: 'flex', justifyContent: 'center' }}>✨</span>
                    {isOpen && (
                        <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            marginLeft: '8px'
                        }}>
                            {t('signup')}
                        </span>
                    )}
                    {isMenuOpen && <div style={{ position: 'absolute', right: '12px', fontSize: '10px' }}>▼</div>}
                </div>

                <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {isOpen ? 'Together To Refine © 2026' : 'TTR'}
                </div>
            </div>
        </div>
    );
}
