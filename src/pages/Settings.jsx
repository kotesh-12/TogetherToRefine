import React, { useState } from 'react';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
    const navigate = useNavigate();

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

    return (
        <div className="page-wrapper">
            <AIBadge />


            <div className="container" style={{ maxWidth: '600px', margin: '20px auto' }}>
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>App Settings</h3>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <strong>Check for Updates</strong>
                            <div className="text-muted" style={{ fontSize: '13px' }}>Force refresh to get the latest features.</div>
                        </div>
                        <button
                            className="btn"
                            onClick={handleForceUpdate}
                            style={{ background: '#0984e3' }}
                        >
                            Update App ↻
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <strong>App Version</strong>
                            <div className="text-muted" style={{ fontSize: '13px' }}>Current installed version</div>
                        </div>
                        <div style={{ background: '#f1f2f6', padding: '5px 10px', borderRadius: '5px', fontSize: '14px' }}>
                            v0.0.3
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
