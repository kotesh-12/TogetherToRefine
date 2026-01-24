import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Sidebar({ isOpen }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();

    // Base Routes
    const routes = [
        { path: '/', label: 'Dashboard', icon: '🏠', roles: ['all'] }, // Redirects to accurate dashboard
        { path: '/my-class', label: 'My Class', icon: '🏫', roles: ['student', 'teacher'] },
        { path: '/attendance', label: 'Attendance', icon: '📅', roles: ['student', 'teacher'] },
        { path: '/timetable', label: 'Timetable', icon: '🕒', roles: ['student', 'teacher'] },
        { path: '/exam', label: 'Exams', icon: '📝', roles: ['student', 'teacher'] },
        { path: '/video-library', label: 'Library', icon: '📺', roles: ['all'] },
        { path: '/health', label: 'Health', icon: '❤️', roles: ['all'] },
        { path: '/general-feedback', label: 'Feedback', icon: '💬', roles: ['all'] },
        { path: '/settings', label: 'Settings', icon: '⚙️', roles: ['all'] },
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
            background: 'white',
            borderRight: '1px solid #dadce0',
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
                        background: isActive(item.path) ? '#e8f0fe' : 'transparent',
                        color: isActive(item.path) ? '#1967d2' : '#5f6368',
                        borderLeft: isActive(item.path) ? '4px solid #1a73e8' : '4px solid transparent',
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
