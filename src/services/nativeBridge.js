import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

/**
 * TTR-AI Native Bridge (KAVACH Protocol)
 * Provides "Siri-like" access to the hardware for Siddh Assistant.
 */

export const NativeBridge = {
    // 🏛️ Device Info (Gap 1/Siri Logic)
    getDeviceInfo: async () => {
        const info = await Device.getInfo();
        const battery = await Device.getBatteryInfo();
        return { ...info, battery };
    },

    // 🔬 Network Awareness
    getNetworkStatus: async () => {
        return await Network.getStatus();
    },

    // 📣 Native Interaction (Social & Engagement)
    shareContent: async (title, text, url) => {
        await Share.share({ title, text, url, dialogTitle: 'Share with TTR Community' });
    },

    // ⚡ Physical Feedback
    vibrate: async (style = ImpactStyle.Medium) => {
        await Haptics.impact({ style });
    },

    // 👁️ Visual Input (Homework Scanning)
    takePhoto: async () => {
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: true,
            resultType: CameraResultType.Base64
        });
        return image.base64String;
    },

    // 📁 File System Access
    saveStudyNote: async (filename, content) => {
        try {
            await Filesystem.writeFile({
                path: `TTR_Notes/${filename}.txt`,
                data: content,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        } catch (e) {
            console.error('Filesystem Error:', e);
            return false;
        }
    },

    // 🔔 Push Initialization
    initPush: async () => {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
           console.log('Push skipped on web');
           return;
        }
        
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
            perm = await PushNotifications.requestPermissions();
        }

        if (perm.receive !== 'granted') {
            throw new Error('Push notification permission denied');
        }

        await PushNotifications.register();
    },

    // 🕊️ Sentinel Notifications (Gap 1/Siri)
    sendLocalNotification: async (title, body) => {
        try {
            await PushNotifications.requestPermissions();
            await PushNotifications.createChannel({
                id: 'ttr-sentinel',
                name: 'TTR Sentinel Notifications',
                description: 'Autonomous AI Insights',
                importance: 5, // Max
                visibility: 1
            });
            await PushNotifications.schedule({
                notifications: [
                    {
                        title: title,
                        body: body,
                        id: Math.floor(Math.random() * 100000),
                        channelId: 'ttr-sentinel',
                        smallIcon: 'ic_stat_name', // Needs to match manifest icon
                        actionTypeId: 'OPEN_APP'
                    }
                ]
            });
            return true;
        } catch (e) {
            console.error('Notification Error:', e);
            return false;
        }
    }
};
