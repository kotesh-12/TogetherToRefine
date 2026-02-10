import React, { useEffect, useState } from 'react';

export default function UpdateManager() {
    // Temporarily disabled to fix deployment crash
    return null;

    /* DISABLED CODE - Will re-enable after cache clears
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [versionDetails, setVersionDetails] = useState({ latest: '', current: '' });

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch('/version.json?t=' + Date.now(), { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                const latestVersion = (data.version || '').trim();
                const currentVersion = (localStorage.getItem('ttr_version') || '').trim();

                setVersionDetails({ latest: latestVersion, current: currentVersion });

                // Loop Protection
                const attempts = parseInt(localStorage.getItem('ttr_update_attempts') || '0');
                if (attempts > 3) {
                    console.warn("Too many update attempts, suppressing prompt.");
                    return;
                }

                if (currentVersion && latestVersion && currentVersion !== latestVersion) {
                    setUpdateAvailable(true);
                } else if (!currentVersion || currentVersion !== latestVersion) {
                    localStorage.setItem('ttr_version', latestVersion);
                    localStorage.removeItem('ttr_update_attempts'); // Reset on success/sync
                }
            } catch (e) {
                console.error("Version check failed", e);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleUpdate = async () => {
        const btn = document.getElementById('update-btn-react');
        if (btn) btn.innerText = "Updating...";

        // Increment attempts
        const attempts = parseInt(localStorage.getItem('ttr_update_attempts') || '0');
        localStorage.setItem('ttr_update_attempts', (attempts + 1).toString());

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
    };

    if (updateAvailable) {
        // Temporarily suppressed UI to prevent crash
        return null;
        
        return (
            <div style={{
                position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                background: '#2d3436', color: 'white', padding: '15px 25px', borderRadius: '30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '15px',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🚀 Update v{versionDetails.latest} Available</span>
                    <button
                        id="update-btn-react"
                        onClick={handleUpdate}
                        style={{
                            background: '#0984e3', border: 'none', color: 'white',
                            padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Update Now
                    </button>
                    <button 
                        onClick={() => {
                            setUpdateAvailable(false);
                            // Optional: ignore until next reload
                        }}
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
                    Current: {versionDetails.current || 'Old'}
                </div>
            </div>
        );
        
    }

    return null;
    */
}
