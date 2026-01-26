import React, { useEffect, useState } from 'react';

export default function UpdateManager() {
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Fetch latest version from server with cache-busting
                const res = await fetch('/version.json?t=' + Date.now());
                if (!res.ok) return;
                const data = await res.json();
                const latestVersion = data.version;

                const currentVersion = localStorage.getItem('app_version');

                if (currentVersion && currentVersion !== latestVersion) {
                    // Update found!
                    console.log(`New version found: ${latestVersion} (Current: ${currentVersion})`);
                    setUpdateAvailable(true);
                }

                // Always update local storage to latest after check
                localStorage.setItem('app_version', latestVersion);
            } catch (e) {
                console.error("Version check failed", e);
            }
        };

        // Check on mount
        checkVersion();

        // Check every 5 minutes
        const interval = setInterval(checkVersion, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (updateAvailable) {
        return (
            <div style={{
                position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                background: '#2d3436', color: 'white', padding: '15px 25px', borderRadius: '30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '15px'
            }}>
                <span>🚀 Update Available!</span>
                <button
                    onClick={() => {
                        // Clear all caches aggressively
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(registrations => {
                                for (let registration of registrations) {
                                    registration.unregister();
                                }
                            });
                        }
                        caches.keys().then((names) => {
                            names.forEach((name) => {
                                caches.delete(name);
                            });
                        });
                        window.location.reload(true);
                    }}
                    style={{
                        background: '#0984e3', border: 'none', color: 'white',
                        padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    Update Now
                </button>
            </div>
        );
    }

    return null;
}
