import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

export default function Settings() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const auth = getAuth();

    // States
    const [isDesktop, setIsDesktop] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'Light');

    // Password Change State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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

    const handleChangePassword = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError("Password should be at least 6 characters.");
            setLoading(false);
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            setError("No user logged in.");
            setLoading(false);
            return;
        }

        try {
            // Re-authenticate
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update Password
            await updatePassword(user, newPassword);
            setSuccess("Password updated successfully!");
            setTimeout(() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccess('');
            }, 2000);
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError("Incorrect current password.");
            } else {
                setError("Failed to update password: " + err.message);
            }
        } finally {
            setLoading(false);
        }
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
                        icon="🔑"
                        title="Change Password"
                        subtitle="Update your login password"
                        action={() => setShowPasswordModal(true)}
                    />

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
                        value="v0.0.46"
                        action={() => { }}
                    />
                </div>

                <div style={{ textAlign: 'center', margin: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Together To Refine &copy; 2026<br />
                    Made with ❤️ for Education
                </div>
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--bg-surface)', padding: '25px', borderRadius: '12px',
                        width: '90%', maxWidth: '400px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}>
                        <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>Change Password</h3>

                        {error && <div style={{ color: '#eb4d4b', fontSize: '14px', marginBottom: '15px', background: '#ffe6e6', padding: '10px', borderRadius: '5px' }}>{error}</div>}
                        {success && <div style={{ color: '#009432', fontSize: '14px', marginBottom: '15px', background: '#e6ffe6', padding: '10px', borderRadius: '5px' }}>{success}</div>}

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-muted)' }}>Current Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-muted)' }}>New Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-muted)' }}>Confirm New Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="btn"
                                onClick={handleChangePassword}
                                disabled={loading}
                                style={{ flex: 1, backgroundColor: '#0984e3' }}
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setError('');
                                    setSuccess('');
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                disabled={loading}
                                style={{ flex: 1, backgroundColor: '#b2bec3' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
