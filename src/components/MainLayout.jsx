import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from '../context/UserContext';
import BottomNav from './BottomNav';
import AnnouncementBar from './AnnouncementBar';

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





    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* 1. Sticky Header */}
            <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

            {/* 2. Flex Body */}
            <div style={{ display: 'flex', flex: 1 }}>

                {/* 3. Sidebar (Left) - Desktop Only via CSS */}
                <div className="sidebar-wrapper">
                    <Sidebar isOpen={isSidebarOpen} />
                </div>

                {/* 4. Main Content (Right) */}
                <main className="main-content-area">


                    {/* Announcement Bar (Global) */}
                    <AnnouncementBar leftIcon={false} />


                    <Outlet />
                </main>
            </div>

            {/* 5. Bottom Nav - Mobile Only via CSS */}
            <div className="bottom-nav-wrapper">
                <BottomNav />
            </div>
        </div>
    );
}
