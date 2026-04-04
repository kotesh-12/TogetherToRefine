import { useState, useEffect } from 'react';
import { NativeBridge } from '../services/nativeBridge';

/**
 * useNativeAgent Hook
 * Connects the AI Chat interface to the phone's hardware.
 * Allows the AI to "feel" the device battery, network, and files.
 */
export function useNativeAgent() {
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [networkStatus, setNetworkStatus] = useState(null);

    useEffect(() => {
        const fetchNativeData = async () => {
            try {
                const info = await NativeBridge.getDeviceInfo();
                const net = await NativeBridge.getNetworkStatus();
                setDeviceInfo(info);
                setNetworkStatus(net);
            } catch (e) {
                console.warn('Native context unavailable (Running in Browser Mode)');
            }
        };

        fetchNativeData();
    }, []);

    const performPushAudit = async (title, body) => {
        // Future implementation for Siddh to send background alerts
    };

    const captureHomework = async () => {
        return await NativeBridge.takePhoto();
    };

    return {
        deviceInfo,
        networkStatus,
        captureHomework,
        vibrate: NativeBridge.vibrate,
        share: NativeBridge.shareContent,
        sendSentinelAlert: NativeBridge.sendLocalNotification,
        callUser: NativeBridge.triggerNativeCall,
        sendMessage: NativeBridge.triggerNativeSMS,
        setNativeAlarm: NativeBridge.triggerNativeAlarm
    };
}
