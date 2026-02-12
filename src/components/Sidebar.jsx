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
        { path: '/admin', label: 'Admin', icon: '🛡️', roles: ['admin'] },
        { path: '/institution', label: 'Institution', icon: '🏛️', roles: ['institution'] },
        { path: '/teacher', label: 'Teacher', icon: '👨‍🏫', roles: ['teacher'] },
        { path: '/student', label: 'Student', icon: '🎓', roles: ['student'] },
        { path: '/group', label: t('my_class'), icon: '🏫', roles: ['teacher', 'student'] },
        { path: '/homework', label: 'Homework', icon: '📚', roles: ['teacher', 'student'] },
        { path: '/marks', label: 'Marks', icon: '🎯', roles: ['teacher', 'student'] },
        { path: '/attendance', label: t('attendance'), icon: '📅', roles: ['teacher', 'student', 'institution'] },
        { path: '/timetable', label: t('timetable'), icon: '🕒', roles: ['teacher', 'student', 'institution'] },
        { path: '/exam', label: t('exams'), icon: '📝', roles: ['teacher', 'student', 'institution'] },
        { path: '/video-library', label: t('video_library'), icon: '📺' },
        { path: '/health', label: t('health'), icon: '❤️' },
        { path: '/general-feedback', label: t('feedback'), icon: '💬' },
        { path: '/exam-seating', label: 'Seat Allotment', icon: '🪑', roles: ['institution'] },
        { path: '/settings', label: t('settings'), icon: '⚙️' },
    ];

    // Filter by Role
    const userRole = (userData?.role || 'student').toLowerCase();
    const routes = allRoutes.filter(r => !r.roles || r.roles.includes(userRole));

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
            else if (userRole === 'parent') navigate('/parent');
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
            height: '100%',
            position: 'relative',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden'
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
