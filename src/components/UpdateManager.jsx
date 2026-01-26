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

    return null; // No UI needed for auto-update
}
