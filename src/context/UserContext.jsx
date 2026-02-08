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

    useEffect(() => {
        let unsubscribeSnapshot = null;
        let unsubscribeSession = null;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        // Failsafe: Force stop loading after 6 seconds
        const failsafe = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.log("Force clearing loading state due to timeout.");
                    return false;
                }
                return prev;
            });
        }, 6000);

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser ? "User Logged In" : "User Logged Out");
            setUser(currentUser);

            // Cleanup
            if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
            if (unsubscribeSession) { unsubscribeSession(); unsubscribeSession = null; }

            if (currentUser) {
                setLoading(true);

                // Session Management
                registerSession(currentUser.uid).then((sessionId) => {
                    if (sessionId) {
                        const sessionRef = doc(db, 'users', currentUser.uid, 'sessions', sessionId);
                        unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
                            if (!docSnap.exists()) {
                                console.log("Session revoked.");
                                auth.signOut().then(() => {
                                    clearLocalSession();
                                    alert("Session expired/revoked.");
                                });
                            }
                        });
                    }
                }).catch(e => console.error("Session Error:", e));

                // 2. Detection Logic (Original Stable Logic)
                const detectFull = async () => {
                    if (retryCount >= MAX_RETRIES) {
                        setUserData(null);
                        setLoading(false);
                        return;
                    }
                    retryCount++;

                    // Parallel Check
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

                        if (instSnap.exists()) {
                            // 1. Set Data IMMEDIATELY
                            setUserData({ ...instSnap.data(), uid: currentUser.uid, role: (instSnap.data().role || 'institution').toLowerCase() });
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'institutions');

                            // 2. Subscribe for updates
                            unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'institution').toLowerCase() });
                            });
                        } else if (teachSnap.exists()) {
                            // 1. Set Data IMMEDIATELY
                            setUserData({ ...teachSnap.data(), uid: currentUser.uid, role: (teachSnap.data().role || 'teacher').toLowerCase() });
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'teachers');

                            // 2. Subscribe
                            unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'teacher').toLowerCase() });
                            });
                        } else if (userSnap.exists()) {
                            // 1. Set Data IMMEDIATELY
                            setUserData({ ...userSnap.data(), uid: currentUser.uid, role: (userSnap.data().role || 'student').toLowerCase() });
                            setLoading(false);
                            sessionStorage.setItem('user_collection_cache', 'users');

                            // 2. Subscribe
                            unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'student').toLowerCase() });
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
                            console.log("Instant Load: Using cached profile.");
                            setUserData(cachedProfile);
                            setLoading(false);
                        }
                    } catch (e) {
                        console.error("Cache parsing error", e);
                    }
                }

                // Internal helper to update state and cache
                const updateUserData = (data) => {
                    setUserData(data);
                    try {
                        sessionStorage.setItem('user_profile_cache', JSON.stringify(data));
                    } catch (e) {
                        console.warn("Storage full?", e);
                    }
                };

                // OPTIMIZATION: Check Collection Cache First (Background Validation)
                const cachedCollection = sessionStorage.getItem('user_collection_cache');

                if (cachedCollection) {
                    console.log("Verifying with cached collection:", cachedCollection);
                    unsubscribeSnapshot = onSnapshot(doc(db, cachedCollection, currentUser.uid), (d) => {
                        if (d.exists()) {
                            const data = d.data();
                            let role = data.role;
                            if (!role) {
                                if (cachedCollection === 'institutions') role = 'institution';
                                else if (cachedCollection === 'teachers') role = 'teacher';
                                else role = 'student';
                            }
                            const completeProfile = { ...data, uid: currentUser.uid, role: role.toLowerCase() };

                            // Update State & Cache
                            updateUserData(completeProfile);
                            setLoading(false); // Ensure loading is off
                        } else {
                            // Validation failed - clear bad cache
                            sessionStorage.removeItem('user_collection_cache');
                            sessionStorage.removeItem('user_profile_cache');
                            if (!cachedProfileJSON) { // Only fallback if we don't have a cache shown
                                detectFull();
                            } else {
                                // We are showing cached data that is now invalid! Re-run detect.
                                detectFull();
                            }
                        }
                    }, (err) => {
                        console.error("Cache subscribe error", err);
                        // If we didn't have a cache, fallback.
                        if (!cachedProfileJSON) detectFull();
                    });
                } else {
                    // No collection cache? Run full detect
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
    }, []);

    const values = React.useMemo(() => ({
        user, userData, loading, setUserData
    }), [user, userData, loading]);

    const handleLogout = () => {
        auth.signOut();
        sessionStorage.clear();
        window.location.reload();
    };

    return (
        <UserContext.Provider value={values}>
            {loading ? (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    fontFamily: 'sans-serif'
                }}>
                    <div className="spinner" style={{
                        width: '40px', height: '40px',
                        border: '4px solid #f3f3f3', borderTop: '4px solid #3498db',
                        borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }}></div>
                    <h2>Loading Platform...</h2>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                        {user ? "Verifying Profile..." : "Checking Connection..."}
                    </p>

                    {/* Failsafe Button */}
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '8px 16px',
                            background: '#ff4757',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }}
                    >
                        Stuck? Click to Reset
                    </button>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
