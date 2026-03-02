/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { registerSession, clearLocalSession } from '../utils/sessionManager';

const UserContext = createContext();

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper to update state and cache consistently
    const updateUserData = React.useCallback((data) => {
        if (!data) {
            setUserData(null);
            sessionStorage.removeItem('user_profile_cache');
            return;
        }

        setUserData(prev => {
            // Optimization: Only update if data actually changed to prevent flickering
            try {
                const s1 = JSON.stringify(prev);
                const s2 = JSON.stringify(data);
                if (s1 === s2) return prev;
            } catch (e) { /* ignore */ }
            return data;
        });

        try {
            sessionStorage.setItem('user_profile_cache', JSON.stringify(data));
        } catch (e) {
            console.warn("Storage update failed", e);
        }
    }, []);

    useEffect(() => {
        let unsubscribeSnapshot = null;
        let unsubscribeSession = null;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        console.log("UserContext: Initializing Auth Listener...");

        // Failsafe: Force stop loading after 6 seconds
        const failsafe = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.warn("UserContext: Force clearing loading state due to timeout.");
                    return false;
                }
                return prev;
            });
        }, 6000);

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser ? `Logged In [${currentUser.uid}]` : "Logged Out");
            setUser(currentUser);

            // Cleanup
            if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
            if (unsubscribeSession) { unsubscribeSession(); unsubscribeSession = null; }

            if (currentUser) {
                setLoading(true);

                // CRITICAL: Check if running in Mock Mode
                if (db.type === 'mock') {
                    setUserData(null);
                    setLoading(false);
                    return;
                }

                // Session Management
                registerSession(currentUser.uid).then((sessionId) => {
                    if (sessionId) {
                        const sessionRef = doc(db, 'users', currentUser.uid, 'sessions', sessionId);
                        unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
                            if (!docSnap.exists()) {
                                auth.signOut().then(() => {
                                    clearLocalSession();
                                    alert("Session expired/revoked.");
                                });
                            }
                        });
                    }
                }).catch(e => console.error("Session Error:", e));

                // 2. Detection Logic
                const detectFull = async () => {
                    if (retryCount >= MAX_RETRIES) {
                        setUserData(null);
                        setLoading(false);
                        return;
                    }
                    retryCount++;

                    console.log(`Detecting profile (Attempt ${retryCount})...`);
                    const instRef = doc(db, "institutions", currentUser.uid);
                    const teachRef = doc(db, "teachers", currentUser.uid);
                    const userRef = doc(db, "users", currentUser.uid);

                    try {
                        const results = await Promise.allSettled([
                            getDoc(instRef),
                            getDoc(teachRef),
                            getDoc(userRef)
                        ]);

                        const instSnap = results[0].status === 'fulfilled' ? results[0].value : { exists: () => false };
                        const teachSnap = results[1].status === 'fulfilled' ? results[1].value : { exists: () => false };
                        const userSnap = results[2].status === 'fulfilled' ? results[2].value : { exists: () => false };

                        const isAdminDoc = userSnap.exists() && String(userSnap.data().role).toLowerCase() === 'admin';
                        const isAdminEmail = currentUser.email === 'koteshbitra789@gmail.com' || currentUser.email === 'admin@ttr.com';

                        if (isAdminEmail || isAdminDoc) {
                            const baseData = userSnap.exists() ? userSnap.data() : { name: currentUser.displayName || 'Admin', email: currentUser.email };
                            const data = { ...baseData, uid: currentUser.uid, role: 'admin', approved: true, profileCompleted: true, onboardingCompleted: true };
                            updateUserData(data);
                            setLoading(false);

                            if (userSnap.exists()) {
                                sessionStorage.setItem('user_collection_cache', 'users');
                                unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                    if (d.exists()) {
                                        updateUserData({ ...d.data(), uid: currentUser.uid, role: 'admin' });
                                    }
                                });
                            }
                        } else if (instSnap.exists()) {
                            const raw = instSnap.data();
                            const data = { ...raw, uid: currentUser.uid, role: String(raw.role || 'institution').toLowerCase().trim(), approved: raw.approved ?? false };
                            updateUserData(data);
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'institutions');

                            unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const dRaw = d.data();
                                updateUserData({ ...dRaw, uid: currentUser.uid, role: String(dRaw.role || 'institution').toLowerCase().trim(), approved: dRaw.approved ?? false });
                            });
                        } else if (teachSnap.exists()) {
                            const raw = teachSnap.data();
                            const data = { ...raw, uid: currentUser.uid, role: String(raw.role || 'teacher').toLowerCase().trim(), approved: raw.approved ?? false };
                            updateUserData(data);
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'teachers');

                            unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const dRaw = d.data();
                                updateUserData({ ...dRaw, uid: currentUser.uid, role: String(dRaw.role || 'teacher').toLowerCase().trim(), approved: dRaw.approved ?? false });
                            });
                        } else if (userSnap.exists()) {
                            const raw = userSnap.data();
                            const data = { ...raw, uid: currentUser.uid, role: String(raw.role || 'student').toLowerCase().trim(), approved: raw.approved ?? false };
                            updateUserData(data);
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'users');

                            unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const dRaw = d.data();
                                updateUserData({ ...dRaw, uid: currentUser.uid, role: String(dRaw.role || 'student').toLowerCase().trim(), approved: dRaw.approved ?? false });
                            });
                        } else {
                            console.log("No profile found.");
                            setUserData(null);
                            setLoading(false);
                        }
                    } catch (e) {
                        console.error("Detection Error", e);
                        setLoading(false);
                    }
                };

                // --- OPTIMIZATION: Instant Load from Profile Cache ---
                const cachedProfileJSON = sessionStorage.getItem('user_profile_cache');
                if (cachedProfileJSON) {
                    try {
                        const cachedProfile = JSON.parse(cachedProfileJSON);
                        if (cachedProfile && cachedProfile.uid === currentUser.uid) {
                            setUserData(cachedProfile);
                            setLoading(false);
                        }
                    } catch (e) {
                        console.error('Failed to parse cached profile:', e);
                    }
                }

                // Background Validation
                const cachedCollection = sessionStorage.getItem('user_collection_cache');
                if (cachedCollection) {
                    unsubscribeSnapshot = onSnapshot(doc(db, cachedCollection, currentUser.uid), (d) => {
                        if (d.exists()) {
                            const data = d.data();
                            let role = data.role || (cachedCollection === 'institutions' ? 'institution' : (cachedCollection === 'teachers' ? 'teacher' : 'student'));
                            updateUserData({ ...data, uid: currentUser.uid, role: role.toLowerCase() });
                            setLoading(false);
                        } else {
                            sessionStorage.removeItem('user_collection_cache');
                            sessionStorage.removeItem('user_profile_cache');
                            detectFull();
                        }
                    }, (err) => {
                        if (!cachedProfileJSON) detectFull();
                    });
                } else {
                    detectFull();
                }

            } else {
                setUserData(null);
                setLoading(false);
                sessionStorage.removeItem('user_collection_cache');
                sessionStorage.removeItem('user_profile_cache');
            }
        });

        return () => {
            clearTimeout(failsafe);
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSession) unsubscribeSession();
        };
    }, [updateUserData]);

    const values = React.useMemo(() => ({
        user, userData, loading, setUserData, updateUserData
    }), [user, userData, loading, updateUserData]);

    const handleLogout = () => {
        auth.signOut();
        sessionStorage.clear();
        window.location.reload();
    };

    return (
        <UserContext.Provider value={values}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        console.error("useUser must be used within a UserProvider");
    }
    return context;
}
