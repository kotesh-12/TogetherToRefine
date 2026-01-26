import React, { useState, useEffect } from 'react';
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

    // Apply Theme Effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app_theme', theme);
    }, [theme]);

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
    };

    const navigateToDashboard = () => {
        const role = userData?.role || 'student';
        navigate(role === 'admin' ? '/admin' : role === 'institution' ? '/institution' : role === 'teacher' ? '/teacher' : '/student');
    };

    const SettingItem = ({ icon, title, subtitle, action, value, isSwitch, isChecked }) => (
        <div
            onClick={!isSwitch ? action : undefined}
            style={{
                display: 'flex', alignItems: 'center', padding: '16px 20px',
                borderBottom: '1px solid var(--divider)', cursor: 'pointer',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
            <div style={{ fontSize: '24px', marginRight: '20px', color: 'var(--text-muted)', width: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-main)' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>}
            </div>
            {isSwitch ? (
                <label className="switch" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={action} />
                    <span className="slider"></span>
                </label>
            ) : (
                value && <div style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '500' }}>{value}</div>
            )}
        </div>
    );

    return (
        <div className="page-wrapper" style={{ background: 'var(--bg-body)', minHeight: '100vh', color: 'var(--text-main)' }}>

            <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0' }}>
                <h1 style={{ fontSize: '24px', margin: '0 0 20px 20px', color: 'var(--text-main)' }}>Settings</h1>

                <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--divider)', borderBottom: '1px solid var(--divider)' }}>
                    {/* General */}
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

                    {/* Appearance */}
                    <SettingItem
                        icon="🌙"
                        title="Dark Mode"
                        subtitle="Switch between Light and Dark themes"
                        isSwitch={true}
                        isChecked={theme === 'Dark'}
                        action={toggleTheme}
                    />
                    <SettingItem
                        icon={isDesktop ? "📱" : "🖥️"}
                        title="Desktop Site"
                        subtitle="Request desktop view"
                        isSwitch={true}
                        isChecked={isDesktop}
                        action={toggleDesktopMode}
                    />

                    {/* System */}
                    <SettingItem
                        icon="↻"
                        title="Check for Updates"
                        subtitle="Force update application"
                        action={handleForceUpdate}
                    />
                    <SettingItem
                        icon="ℹ️"
                        title="App Version"
                        value="v0.0.34"
                        action={() => { }}
                    />
                </div>

                <div style={{ textAlign: 'center', margin: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Together To Refine &copy; 2026<br />
                    Made with ❤️ for Education
                </div>
            </div>
        </div>
    );
}
