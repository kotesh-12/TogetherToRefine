import React, { useEffect, useState } from 'react';

export default function UpdateManager() {
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Fetch latest version from server with cache-busting
                const res = await fetch('/version.json?t=' + Date.now(), { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                const latestVersion = (data.version || '').trim();
                const currentVersion = (localStorage.getItem('ttr_version') || '').trim();

                console.log("Update Check:", { latest: latestVersion, current: currentVersion });

                if (currentVersion && latestVersion && currentVersion !== latestVersion) {
                    // Update found!
                    setUpdateAvailable(true);
                } else if (!currentVersion || currentVersion !== latestVersion) {
                    // First load or sync
                    localStorage.setItem('ttr_version', latestVersion);
                }
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
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '15px',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🚀 {latestVersion ? 'Update v' + latestVersion : 'Update Available'}</span>
                    <button
                        id="update-btn-react"
                        onClick={async () => {
                            const btn = document.getElementById('update-btn-react');
                            if (btn) btn.innerText = "Updating...";
                            try {
                                if ('serviceWorker' in navigator) {
                                    const regs = await navigator.serviceWorker.getRegistrations();
                                    for (let r of regs) await r.unregister();
                                }
                                const keys = await caches.keys();
                                await Promise.all(keys.map(k => caches.delete(k)));
                                localStorage.removeItem('ttr_version');
                            } catch (e) { console.error(e); }
                            window.location.href = window.location.origin + "/?v=" + Date.now();
                        }}
                        style={{
                            background: '#0984e3', border: 'none', color: 'white',
                            padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Update Now
                    </button>
                    <button
                        onClick={() => setUpdateAvailable(false)}
                        style={{
                            background: 'transparent', border: '1px solid #aaa', color: '#ccc',
                            width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                    Current: {localStorage.getItem('ttr_version') || 'v?'}
                </div>
            </div>
        );
    }

    return null;
}
