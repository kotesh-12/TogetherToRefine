import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateManager() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    const close = () => setNeedRefresh(false);

    if (!needRefresh) return null;

    return (
        <div className="update-modal-overlay">
            <div className="update-modal">
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🚀</div>
                <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Update Available</h2>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                    A new version of TTR (with icon/feature updates) is ready.
                    Please update to get the best experience.
                </p>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={() => updateServiceWorker(true)}
                        className="btn"
                        style={{ background: '#0984e3', color: 'white', flex: 1 }}
                    >
                        Accept & Update
                    </button>
                    <button
                        onClick={close}
                        className="btn"
                        style={{ background: '#eee', color: '#666', flex: 1 }}
                    >
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
}
