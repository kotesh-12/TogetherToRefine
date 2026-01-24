import React, { useState } from 'react';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Settings() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // States
    const [isDesktop, setIsDesktop] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'Light');

    useEffect(() => {
        // Sync Desktop Mode state with actual DOM
        const meta = document.querySelector('meta[name=viewport]');
        if (meta && meta.content.includes('width=1024')) {
            setIsDesktop(true);
        }
    }, []);

    const handleForceUpdate = () => {
        if (window.confirm("This will clear the cache and reload the latest version. Continue?")) {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                    for (let registration of registrations) registration.unregister();
                });
            }
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name));
                });
            }
            window.location.reload(true);
        }
    };

    const toggleDesktopMode = () => {
        const metaViewport = document.querySelector('meta[name=viewport]');
        if (!isDesktop) {
            metaViewport.setAttribute('content', 'width=1024');
            setIsDesktop(true);
        } else {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1');
            setIsDesktop(false);
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'Light' ? 'Dark' : 'Light';
        setTheme(newTheme);
        localStorage.setItem('app_theme', newTheme);
        // Placeholder for actual theme logic
        alert("Theme preference saved: " + newTheme);
    };

    const navigateToDashboard = () => {
        const role = userData?.role || 'student';
        navigate(role === 'admin' ? '/admin' : role === 'institution' ? '/institution' : role === 'teacher' ? '/teacher' : '/student');
    };

    const SettingItem = ({ icon, title, subtitle, action, value }) => (
        <div
            onClick={action}
            style={{
                display: 'flex', alignItems: 'center', padding: '15px 20px',
                borderBottom: '1px solid #f1f3f4', cursor: 'pointer',
                background: 'white'
            }}
        >
            <div style={{ fontSize: '24px', marginRight: '20px', color: '#5f6368', width: '24px', textAlign: 'center' }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', color: '#202124' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '13px', color: '#5f6368', marginTop: '2px' }}>{subtitle}</div>}
            </div>
            {value && <div style={{ fontSize: '14px', color: '#1a73e8', fontWeight: '500' }}>{value}</div>}
        </div>
    );

    return (
        <div className="page-wrapper" style={{ background: '#f8f9fa', minHeight: '100vh' }}>
            <AnnouncementBar title="Settings" />
            <AIBadge />

            <div className="container" style={{ maxWidth: '600px', margin: '0 auto', padding: '0' }}>

                {/* Section: General */}
                <div style={{ padding: '15px 20px 5px', fontSize: '14px', fontWeight: '500', color: '#1a73e8', textTransform: 'uppercase' }}>General</div>
                <div style={{ background: 'white', borderTop: '1px solid #dadce0', borderBottom: '1px solid #dadce0' }}>
                    <SettingItem
                        icon="🏠"
                        title="Dashboard"
                        subtitle="Go to your main dashboard"
                        action={navigateToDashboard}
                    />
                    <SettingItem
                        icon="👤"
                        title="Edit Profile"
                        subtitle="Manage personal details"
                        action={() => navigate('/details')}
                    />
                </div>

                {/* Section: Appearance */}
                <div style={{ padding: '25px 20px 5px', fontSize: '14px', fontWeight: '500', color: '#1a73e8', textTransform: 'uppercase' }}>Appearance</div>
                <div style={{ background: 'white', borderTop: '1px solid #dadce0', borderBottom: '1px solid #dadce0' }}>
                    <SettingItem
                        icon="🎨"
                        title="Theme"
                        subtitle="App color scheme"
                        value={theme}
                        action={toggleTheme}
                    />
                    <SettingItem
                        icon={isDesktop ? "📱" : "🖥️"}
                        title="Desktop Site"
                        subtitle="Request desktop view"
                        value={isDesktop ? "On" : "Off"}
                        action={toggleDesktopMode}
                    />
                </div>

                {/* Section: About & System */}
                <div style={{ padding: '25px 20px 5px', fontSize: '14px', fontWeight: '500', color: '#1a73e8', textTransform: 'uppercase' }}>System</div>
                <div style={{ background: 'white', borderTop: '1px solid #dadce0', borderBottom: '1px solid #dadce0' }}>
                    <SettingItem
                        icon="↻"
                        title="Check for Updates"
                        subtitle="Force update application"
                        action={handleForceUpdate}
                    />
                    <SettingItem
                        icon="ℹ️"
                        title="App Version"
                        value="v0.0.3"
                        action={() => { }}
                    />
                </div>

                <div style={{ textAlign: 'center', margin: '30px', color: '#9aa0a6', fontSize: '12px' }}>
                    Together To Refine &copy; 2026<br />
                    Made with ❤️ for Education
                </div>
            </div>
        </div>
    );
}
