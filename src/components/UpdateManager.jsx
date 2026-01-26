import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateManager() {
    // With registerType: 'autoUpdate', the SW updates immediately.
    // We keep this to log status or handle rare edge cases.
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

    // Re-added: Periodic check for updates every 15 minutes to keep app fresh
    // even if kept open in background.
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (updateServiceWorker) {
                console.log("Checking for SW updates (Interval)...");
                updateServiceWorker();
            }
        }, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [updateServiceWorker]);

    return null; // No UI needed for auto-update
}
