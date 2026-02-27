import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AdminSettings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [settings, setSettings] = useState({
        platformName: 'TogetherToRefine',
        platformTagline: 'Empowering Education Through Technology',
        registrationOpen: true,
        maintenanceMode: false,
        maintenanceMessage: 'The platform is under scheduled maintenance. We will be back shortly.',
        maxStudentsPerClass: 60,
        maxTeachersPerInstitution: 50,
        contactEmail: 'admin@togethertorefine.com',
        supportPhone: '',
        allowGoogleLogin: true,
        allowEmailLogin: true,
        announcementBannerEnabled: true,
        defaultLanguage: 'en',
        aiChatEnabled: true,
        fourWayLearningEnabled: true,
        smartScanEnabled: true,
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const snap = await getDoc(doc(db, 'admin_config', 'platform_settings'));
                if (snap.exists()) {
                    setSettings(prev => ({ ...prev, ...snap.data() }));
                }
            } catch (e) {
                console.error('Failed to load settings:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'admin_config', 'platform_settings'), {
                ...settings,
                updatedAt: serverTimestamp()
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            alert('Error saving settings: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const cardStyle = {
        background: 'var(--bg-surface, #fff)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        border: '1px solid var(--divider, #eee)'
    };

    const rowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid var(--divider, #f0f0f0)'
    };

    const toggleStyle = (active) => ({
        width: '48px', height: '26px', borderRadius: '13px',
        background: active ? '#00b894' : '#b2bec3',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        flexShrink: 0
    });

    const toggleKnobStyle = (active) => ({
        width: '20px', height: '20px', borderRadius: '50%',
        background: 'white', position: 'absolute',
        top: '3px', left: active ? '25px' : '3px',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
    });

    const Toggle = ({ name, label, sublabel }) => (
        <div style={{ ...rowStyle, borderBottom: 'none', padding: '10px 0' }}>
            <div style={{ flex: 1, marginRight: '20px' }}>
                <div style={{ fontWeight: '600', color: 'var(--text-primary, #2d3436)', fontSize: '14px' }}>{label}</div>
                {sublabel && <div style={{ fontSize: '12px', color: 'var(--text-muted, #636e72)', marginTop: '2px' }}>{sublabel}</div>}
            </div>
            <div
                style={toggleStyle(settings[name])}
                onClick={() => setSettings(prev => ({ ...prev, [name]: !prev[name] }))}
                role="switch"
                aria-checked={settings[name]}
            >
                <div style={toggleKnobStyle(settings[name])} />
            </div>
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #eee', borderTop: '4px solid #6c5ce7', animation: 'spin 1s linear infinite' }} />
        </div>
    );

    return (
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <button
                    onClick={() => navigate('/admin')}
                    style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#636e72', padding: '4px' }}
                >←</button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-primary, #2d3436)' }}>
                        🔧 Site Settings
                    </h1>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #636e72)' }}>
                        Configure platform-wide behaviour and restrictions
                    </p>
                </div>
            </div>

            {/* Save Banner */}
            {saved && (
                <div style={{
                    background: '#d4edda', color: '#155724', padding: '12px 20px',
                    borderRadius: '10px', marginBottom: '20px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    ✅ Settings saved successfully!
                </div>
            )}

            {/* Platform Identity */}
            <div style={cardStyle}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#6c5ce7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🏷️ Platform Identity
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Platform Name</label>
                        <input
                            name="platformName"
                            value={settings.platformName}
                            onChange={handleChange}
                            className="input-field"
                            style={{ width: '100%' }}
                            placeholder="e.g. TogetherToRefine"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Tagline</label>
                        <input
                            name="platformTagline"
                            value={settings.platformTagline}
                            onChange={handleChange}
                            className="input-field"
                            style={{ width: '100%' }}
                            placeholder="Platform tagline..."
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Admin Contact Email</label>
                        <input
                            name="contactEmail"
                            type="email"
                            value={settings.contactEmail}
                            onChange={handleChange}
                            className="input-field"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Support Phone</label>
                        <input
                            name="supportPhone"
                            type="tel"
                            value={settings.supportPhone}
                            onChange={handleChange}
                            className="input-field"
                            style={{ width: '100%' }}
                            placeholder="+91 9876543210"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Default Language</label>
                        <select name="defaultLanguage" value={settings.defaultLanguage} onChange={handleChange} className="input-field" style={{ width: '100%' }}>
                            <option value="en">English</option>
                            <option value="te">Telugu</option>
                            <option value="hi">Hindi</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Access Control */}
            <div style={cardStyle}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0984e3', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔐 Access Control
                </h3>
                <Toggle name="registrationOpen" label="Open Registration" sublabel="Allow new students/teachers/institutions to sign up" />
                <Toggle name="allowGoogleLogin" label="Google Login" sublabel="Allow users to log in with their Google account" />
                <Toggle name="allowEmailLogin" label="Email/Password Login" sublabel="Allow users to log in with email and password" />

                <div style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Max Students / Class</label>
                        <input
                            name="maxStudentsPerClass"
                            type="number"
                            value={settings.maxStudentsPerClass}
                            onChange={handleChange}
                            className="input-field"
                            min="1" max="200"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #636e72)', display: 'block', marginBottom: '6px' }}>Max Teachers / Institution</label>
                        <input
                            name="maxTeachersPerInstitution"
                            type="number"
                            value={settings.maxTeachersPerInstitution}
                            onChange={handleChange}
                            className="input-field"
                            min="1" max="500"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Feature Toggles */}
            <div style={cardStyle}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#00b894', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✨ Feature Toggles
                </h3>
                <Toggle name="aiChatEnabled" label="TTR AI Chat" sublabel="Enable the AI assistant for all users" />
                <Toggle name="fourWayLearningEnabled" label="Four-Way Learning" sublabel="Enable AI-powered conceptual/fictional learning" />
                <Toggle name="smartScanEnabled" label="Smart AI Scan" sublabel="Enable camera-based AI admission and marks scanning" />
                <Toggle name="announcementBannerEnabled" label="Announcement Banner" sublabel="Show global announcements at the top of dashboards" />
            </div>

            {/* Maintenance Mode */}
            <div style={{ ...cardStyle, border: settings.maintenanceMode ? '2px solid #d63031' : '1px solid var(--divider, #eee)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#d63031', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🚧 Maintenance Mode
                </h3>
                <Toggle
                    name="maintenanceMode"
                    label="Enable Maintenance Mode"
                    sublabel={settings.maintenanceMode ? '⚠️ ACTIVE — Users will see the maintenance message below' : 'Temporarily lock all users out of the platform'}
                />
                {settings.maintenanceMode && (
                    <div style={{ marginTop: '16px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#d63031', display: 'block', marginBottom: '6px' }}>Maintenance Message (shown to users)</label>
                        <textarea
                            name="maintenanceMessage"
                            value={settings.maintenanceMessage}
                            onChange={handleChange}
                            className="input-field"
                            rows="3"
                            style={{ width: '100%', resize: 'vertical' }}
                        />
                    </div>
                )}
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                style={{
                    width: '100%', padding: '16px', borderRadius: '12px',
                    background: saving ? '#b2bec3' : 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                    color: 'white', border: 'none', fontWeight: '700',
                    fontSize: '16px', cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(108,92,231,0.3)', transition: 'all 0.2s'
                }}
            >
                {saving ? '⏳ Saving...' : '💾 Save All Settings'}
            </button>
        </div>
    );
}
