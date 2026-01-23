import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from '../context/UserContext';
// import BottomNav from './BottomNav'; // Replaced by Sidebar for Pro Look

export default function MainLayout() {
    const { userData } = useUser();
    const location = useLocation();

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 900);

    // Responsive Sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 900) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // Show Update Button logic
    const dashboardPaths = ['/student', '/teacher', '/institution', '/admin'];
    const showUpdateBtn = dashboardPaths.some(path => location.pathname.startsWith(path));

    // Hide Layout on Login/Certain pages if needed, but App.jsx handles "Route element={MainLayout}"
    // So this component ONLY renders for logged-in routes generally.

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* 1. Sticky Header */}
            <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

            {/* 2. Flex Body */}
            <div style={{ display: 'flex', flex: 1 }}>

                {/* 3. Sidebar (Left) */}
                <Sidebar isOpen={isSidebarOpen} />

                {/* 4. Main Content (Right) */}
                <main style={{
                    flex: 1,
                    padding: '24px',
                    background: '#f9f9f9',
                    overflowX: 'hidden'
                }}>

                    {/* Update Button (Floating) */}
                    {showUpdateBtn && (
                        <button
                            onClick={handleForceUpdate}
                            style={{
                                marginBottom: '20px',
                                backgroundColor: '#1a73e8', // Google Blue
                                color: 'white',
                                border: 'none',
                                borderRadius: '16px',
                                padding: '8px 16px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>Update App Version</span>
                            <span>↻</span>
                        </button>
                    )}

                    <Outlet />
                </main>
            </div>
        </div>
    );
}
