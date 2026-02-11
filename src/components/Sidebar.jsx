import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar({ isOpen }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();
    const { t } = useLanguage();

    const routes = [
        { path: '/', label: t('dashboard'), icon: '🏠' },
        { path: '/institution', label: 'Institution', icon: '🏛️' },
        { path: '/teacher', label: 'Teacher', icon: '👨‍🏫' },
        { path: '/student', label: 'Student', icon: '🎓' },
        { path: '/group', label: t('my_class'), icon: '🏫' },
        { path: '/attendance', label: t('attendance'), icon: '📅' },
        { path: '/timetable', label: t('timetable'), icon: '🕒' },
        { path: '/exam', label: t('exams'), icon: '📝' },
        { path: '/video-library', label: t('video_library'), icon: '📺' },
        { path: '/health', label: t('health'), icon: '❤️' },
        { path: '/general-feedback', label: t('feedback'), icon: '💬' },
        { path: '/settings', label: t('settings'), icon: '⚙️' },
    ];

    // Filter by Role
    const userRole = userData?.role || 'student';

    // Helper to check if route is active
    const isActive = (path) => {
        if (path === '/') {
            // Dashboard matching logic
            return ['/student', '/teacher', '/institution', '/admin'].some(p => location.pathname.startsWith(p));
        }
        return location.pathname.startsWith(path);
    };

    const handleNav = (item) => {
        if (item.path === '/') {
            // Smart Dashboard Redirect
            if (userRole === 'admin') navigate('/admin');
            else if (userRole === 'institution') navigate('/institution');
            else if (userRole === 'teacher') navigate('/teacher');
            else navigate('/student');
        } else {
            navigate(item.path);
        }
    };

    return (
        <div style={{
            width: isOpen ? '240px' : '72px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--divider)',
            height: 'calc(100vh - 64px)', // Full height minus header
            position: 'sticky',
            top: '64px',
            transition: 'width 0.2s',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '10px'
        }}>
            {routes.map((item, idx) => (
                <div
                    key={idx}
                    onClick={() => handleNav(item)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 24px',
                        cursor: 'pointer',
                        background: isActive(item.path) ? 'var(--secondary)' : 'transparent',
                        color: isActive(item.path) ? 'var(--primary)' : 'var(--text-muted)',
                        borderLeft: isActive(item.path) ? '4px solid var(--primary)' : '4px solid transparent',
                        marginBottom: '4px'
                    }}
                    title={item.label}
                >
                    <span style={{ fontSize: '20px', minWidth: '40px' }}>{item.icon}</span>
                    {isOpen && (
                        <span style={{
                            fontSize: '14px',
                            fontWeight: isActive(item.path) ? '600' : '400',
                            whiteSpace: 'nowrap'
                        }}>
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
