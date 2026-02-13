import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar({ isOpen }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();
    const { t } = useLanguage();

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

    // Filter by Role
    const userRole = (userData?.role || 'student').toLowerCase();
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

            {/* Bottom Section */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--divider)', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {isOpen ? 'Together To Refine © 2026' : 'TTR'}
            </div>
        </div>
    );
}
