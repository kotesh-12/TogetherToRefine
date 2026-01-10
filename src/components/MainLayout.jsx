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
    const hideNavRoutes = ['/', '/details', '/login', '/signup'];
    const showNav = !hideNavRoutes.includes(location.pathname) && userData;

    return (
        <div style={{ paddingBottom: '80px' }}> {/* Add padding so content doesn't hide behind fixed nav */}
            <Outlet />
            {showNav && <BottomNav />}
        </div>
    );
}
