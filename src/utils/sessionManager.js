import { db } from '../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';

const SESSION_KEY = 'ttr_session_id';

export const getLocalSessionId = () => localStorage.getItem(SESSION_KEY);

export const registerSession = async (uid) => {
    try {
        const parser = new UAParser();
        const result = parser.getResult();

        const browser = `${result.browser.name || 'Unknown Browser'} ${result.browser.version || ''}`;
        const os = `${result.os.name || 'Unknown OS'} ${result.os.version || ''}`;
        const device = result.device.model || result.device.type || 'Desktop/Laptop';
        const deviceName = `${os} - ${browser}`;

        // Create a unique session ID
        let sessionId = getLocalSessionId();
        const isNewSession = !sessionId;

        if (!sessionId) {
            sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(SESSION_KEY, sessionId);
        }

        const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);

        await setDoc(sessionRef, {
            deviceName,
            browser: result.browser.name,
            os: result.os.name,
            deviceType: result.device.type || 'desktop',
            createdAt: isNewSession ? serverTimestamp() : undefined, // Only set on creation
            lastActive: serverTimestamp(),
            sessionId
        }, { merge: true });

        console.log(`Session registered: ${sessionId}`);
        return sessionId;

    } catch (error) {
        console.error("Error registering session:", error);
    }
};

export const clearLocalSession = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const removeSessionFromDb = async (uid, sessionId) => {
    try {
        await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
    } catch (error) {
        console.error("Error removing session:", error);
    }
};
