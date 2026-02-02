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
                const latestVersion = data.version;

                const currentVersion = localStorage.getItem('ttr_version');

                if (currentVersion && currentVersion !== latestVersion) {
                    // Update found!
                    console.log(`New version found: ${latestVersion} (Current: ${currentVersion})`);
                    setUpdateAvailable(true);
                } else {
                    // Only update local storage if no update is pending (meaning we are up to date)
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
                    <span>🚀 Update Available!</span>
                    <button
                        id="update-btn-react"
                        onClick={async () => {
                            const btn = document.getElementById('update-btn-react');
                            if (btn) btn.innerText = "Cleaning & Updating...";

                            try {
                                if ('serviceWorker' in navigator) {
                                    const regs = await navigator.serviceWorker.getRegistrations();
                                    for (let r of regs) await r.unregister();
                                }
                                const keys = await caches.keys();
                                await Promise.all(keys.map(k => caches.delete(k)));
                                localStorage.clear(); // Clear everything
                            } catch (e) { console.error(e); }

                            // Force reload with unique version param to bypass browser cache
                            // This ensures the server gives us the new index.html
                            window.location.href = window.location.origin + "/nuke.html?t=" + Date.now();
                        }}
                        style={{
                            background: '#0984e3', border: 'none', color: 'white',
                            padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Update Now
                    </button>
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                    ver: {localStorage.getItem('ttr_version') || 'unknown'} -{'>'} new
                </div>
            </div>
        );
    }

    return null;
}
