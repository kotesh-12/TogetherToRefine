import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useUser } from '../context/UserContext';

export default function MainLayout() {
    const { userData } = useUser();
    const location = useLocation();

    // Define routes where BottomNav should appear
    // We generally want it on dashboard-like pages, not necessarily on specific detail pages or login
    // BUT user wants SPA feel, so persistent nav is good.
    // Let's hide it on Login ('/') and Details ('/details')
    const hideNavRoutes = ['/', '/details', '/login', '/signup', '/ttr-ai'];
    const showNav = !hideNavRoutes.includes(location.pathname) && userData && userData.role !== 'admin';


    const handleForceUpdate = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        }
        if ('caches' in window) {
            caches.keys().then((names) => {
                names.forEach((name) => {
                    caches.delete(name);
                });
            });
        }
        window.location.reload(true);
    };


    // Show Update Button only on Dashboard pages (and related sub-pages if broad matching wanted)
    const dashboardPaths = ['/student', '/teacher', '/institution', '/admin'];
    const showUpdateBtn = dashboardPaths.some(path => location.pathname.startsWith(path));

    return (
        <div style={{ paddingBottom: '80px' }}> {/* Add padding so content doesn't hide behind fixed nav */}

            {showUpdateBtn && (
                <button
                    onClick={handleForceUpdate}
                    style={{
                        position: 'fixed',
                        top: '105px', // Below Header + Announcement Bar
                        left: '10px',
                        zIndex: 10000,
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: 0.95
                    }}
                >
                    <span>Update App</span>
                    <span style={{ fontSize: '1.2em' }}>↻</span>
                </button>
            )}
            <Outlet />
            {showNav && <BottomNav />}
        </div>
    );
}
