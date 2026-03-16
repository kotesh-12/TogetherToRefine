import React, { useState, useEffect, useRef } from 'react';
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
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            <div ref={menuRef} style={{ padding: '16px 12px', borderTop: '1px solid var(--divider)', position: 'relative' }}>
                <style>{`
                    @keyframes premiumPopup {
                        0% { opacity: 0; transform: translateY(20px) scale(0.9); filter: blur(10px); }
                        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                    }
                    @keyframes slideInItem {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    .menu-item {
                        animation: slideInItem 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                        opacity: 0;
                    }
                    .premium-shimmer::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(
                            90deg,
                            transparent,
                            rgba(255, 255, 255, 0.2),
                            transparent
                        );
                        animation: shimmer 2s infinite;
                        transform: skewX(-20deg);
                    }
                `}</style>

                {isMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '12px',
                        right: '12px',
                        background: theme === 'Dark' ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)',
                        backdropFilter: 'blur(20px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(200%)',
                        borderRadius: '24px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                        padding: '12px',
                        zIndex: 1200,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transformOrigin: 'bottom center',
                        animation: 'premiumPopup 0.5s cubic-bezier(0.19, 1, 0.22, 1)'
                    }}>
                        {[
                            { label: 'Themes', icon: theme === 'Dark' ? '☀️' : '🌙', action: toggleTheme, color: '#f59e0b', sub: 'Switch Appearance' },
                            { label: 'Upgrade Plan', icon: '💎', action: () => navigate('/fees/student'), color: '#3b82f6', sub: 'Unlock Features' },
                            { label: 'Intelligence Hub', icon: '🧠', action: () => navigate('/ttr-ai'), color: '#8b5cf6', sub: 'AI Core' },
                            { label: 'Gurukul Board', icon: '🎓', action: () => navigate('/student'), color: '#10b981', sub: 'My Progress' },
                            { label: 'Enable Voice', icon: voiceEnabled ? '🔊' : '🎙️', action: () => setVoiceEnabled(!voiceEnabled), color: voiceEnabled ? '#ef4444' : '#6b7280', sub: 'Hands-free' },
                            { label: 'Download App', icon: '📱', action: () => navigate('/download'), color: '#6366f1', sub: 'Mobile Ready' },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="menu-item"
                                onClick={(e) => { e.stopPropagation(); item.action(); if (item.label !== 'Enable Voice' && item.label !== 'Themes') setIsMenuOpen(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px',
                                    padding: '12px 14px',
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: 'transparent',
                                    animationDelay: `${i * 0.05}s`,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = theme === 'Dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <span style={{ 
                                    fontSize: '20px', 
                                    width: '36px', 
                                    height: '36px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    background: `${item.color}20`,
                                    borderRadius: '12px',
                                    color: item.color,
                                    boxShadow: `0 4px 10px ${item.color}30`
                                }}>
                                    {item.icon}
                                </span>
                                {isOpen && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{item.label}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>{item.sub}</span>
                                    </div>
                                )}
                                {item.label === 'Enable Voice' && isOpen && (
                                    <div style={{ marginLeft: 'auto' }}>
                                        <div style={{ 
                                            width: '24px', 
                                            height: '12px', 
                                            borderRadius: '20px', 
                                            background: voiceEnabled ? '#ef4444' : '#cbd5e1',
                                            padding: '2px',
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: voiceEnabled ? 'flex-end' : 'flex-start'
                                        }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Sign Up Trigger Button */}
                <div
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="premium-shimmer"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        padding: '16px 20px',
                        cursor: 'pointer',
                        borderRadius: '22px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                        color: 'white',
                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        boxShadow: isMenuOpen ? '0 0 30px rgba(37, 99, 235, 0.5)' : '0 12px 24px rgba(0,0,0,0.15)',
                        position: 'relative',
                        overflow: 'hidden',
                        transform: isMenuOpen ? 'scale(0.96)' : 'scale(1)'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.35)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = isMenuOpen ? 'scale(0.96)' : 'scale(1)';
                        e.currentTarget.style.boxShadow = isMenuOpen ? '0 0 30px rgba(37, 99, 235, 0.5)' : '0 12px 24px rgba(0,0,0,0.15)';
                    }}
                >
                    <div style={{ 
                        fontSize: '24px', 
                        minWidth: '32px', 
                        display: 'flex', 
                        justifyContent: 'center',
                        filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))'
                    }}>✨</div>
                    
                    {isOpen && (
                        <div style={{ marginLeft: '14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <span style={{
                                fontSize: '15px',
                                fontWeight: '900',
                                whiteSpace: 'nowrap',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                {t('signup')}
                            </span>
                            <span style={{ fontSize: '10px', opacity: 0.9, fontWeight: '500', color: 'rgba(255,255,255,0.8)' }}>
                                {isMenuOpen ? 'Tap to close' : 'Explore Premium'}
                            </span>
                        </div>
                    )}
                    
                    {isOpen && (
                        <div style={{ 
                            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: isMenuOpen ? 'rotate(180deg) scale(1.2)' : 'rotate(0deg) scale(1)',
                            opacity: 0.8
                        }}>
                            <span style={{ fontSize: '14px' }}>▲</span>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '500', opacity: 0.5 }}>
                    {isOpen ? 'Together To Refine © 2026' : 'TTR'}
                </div>
            </div>
        </div>
    );
}
