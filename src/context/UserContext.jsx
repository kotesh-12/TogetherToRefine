import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { registerSession, clearLocalSession } from '../utils/sessionManager';

const UserContext = createContext();

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Track Network Status
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    // OFFLINE UNBLOCKER: If we go offline, stop loading immediately so cached content shows
    useEffect(() => {
        if (!isOnline && loading) {
            console.log("Network Offline: Force dismissing loading spinner.");
            setLoading(false);
        }
    }, [isOnline, loading]);

    useEffect(() => {
        let unsubscribeSnapshot = null;
        let unsubscribeSession = null;
        let retryCount = 0; // Prevent infinite recursion
        const MAX_RETRIES = 3;

        // AUTH LISTENER
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser ? "User Logged In" : "User Logged Out");
            setUser(currentUser);

            // Cleanup previous listeners
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            if (unsubscribeSession) {
                unsubscribeSession();
                unsubscribeSession = null;
            }

            if (currentUser) {
                setLoading(true);

                // --- SESSION MANAGEMENT START ---
                registerSession(currentUser.uid).then((sessionId) => {
                    if (sessionId) {
                        const sessionRef = doc(db, 'users', currentUser.uid, 'sessions', sessionId);
                        unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
                            if (!docSnap.exists()) {
                                console.log("Current session revoked. Signing out.");
                                auth.signOut().then(() => {
                                    clearLocalSession();
                                    alert("You have been signed out from this device.");
                                });
                            }
                        });
                    }
                }).catch(e => console.error("Session Init Error:", e));
                // --- SESSION MANAGEMENT END ---

                const detectFull = async () => {
                    if (retryCount >= MAX_RETRIES) {
                        console.error("Max role detection retries exceeded. Force logout.");
                        setUserData(null);
                        setLoading(false);
                        auth.signOut();
                        return;
                    }
                    retryCount++;

                    console.time("RoleDetection");
                    const instRef = doc(db, "institutions", currentUser.uid);
                    const teachRef = doc(db, "teachers", currentUser.uid);
                    const userRef = doc(db, "users", currentUser.uid);

                    try {
                        // OFFLINE HANDLING: If offline, getDoc might hang, so we rely on cache via onSnapshot if possible
                        // But for detection, we need to know WHICH one exists.
                        // Promise.allSettled is fine, as getDoc will use cache if available.

                        const results = await Promise.allSettled([
                            getDoc(instRef),
                            getDoc(teachRef),
                            getDoc(userRef)
                        ]);

                        const instSnap = results[0].status === 'fulfilled' ? results[0].value : { exists: () => false };
                        const teachSnap = results[1].status === 'fulfilled' ? results[1].value : { exists: () => false };
                        const userSnap = results[2].status === 'fulfilled' ? results[2].value : { exists: () => false };

                        try {
                            if (instSnap.exists()) {
                                unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                    const data = d.data();
                                    setUserData({ ...data, uid: currentUser.uid, collection: 'institutions', role: (data?.role || 'institution').toLowerCase() });
                                    sessionStorage.setItem('user_collection_cache', 'institutions');
                                    setLoading(false);
                                });
                            } else if (teachSnap.exists()) {
                                unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                    const data = d.data();
                                    setUserData({ ...data, uid: currentUser.uid, collection: 'teachers', role: (data?.role || 'teacher').toLowerCase() });
                                    sessionStorage.setItem('user_collection_cache', 'teachers');
                                    setLoading(false);
                                });
                            } else if (userSnap.exists()) {
                                unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                    const data = d.data();
                                    setUserData({ ...data, uid: currentUser.uid, collection: 'users', role: (data?.role || 'student').toLowerCase() });
                                    sessionStorage.setItem('user_collection_cache', 'users');
                                    setLoading(false);
                                });
                            } else {
                                console.log("User document not found.");
                                setUserData(null);
                                setLoading(false);
                            }
                        } catch (snapErr) {
                            console.error("Snapshot Error", snapErr);
                            // If snapshot fails (e.g. permission offline), force safe state
                            setLoading(false);
                        }

                    } catch (err) {
                        console.error("Parallel detection failed", err);
                        setLoading(false);
                    }
                    console.timeEnd("RoleDetection");
                };

                const subscribe = (col) => {
                    return onSnapshot(doc(db, col, currentUser.uid), (d) => {
                        if (d.exists()) {
                            const data = d.data();
                            setUserData({ ...data, uid: currentUser.uid, collection: col, role: (data?.role || 'student').toLowerCase() });
                            setLoading(false);
                        } else {
                            detectFull();
                        }
                    }, (err) => {
                        console.warn("Snapshot failed (offline?):", err);
                        setLoading(false); // Unblock UI if offline check fails
                    });
                };

                // Fast Path
                const cachedCollection = sessionStorage.getItem('user_collection_cache');
                if (cachedCollection) {
                    unsubscribeSnapshot = subscribe(cachedCollection);
                } else {
                    detectFull();
                }

            } else {
                // LOGGED OUT
                setUserData(null);
                setLoading(false);
                sessionStorage.removeItem('user_collection_cache');
            }
        });

        // Failsafe Timer
        const failsafeTimer = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.warn("Auth Timeout: Force clearing loading state.");
                    return false;
                }
                return prev;
            });
        }, 4000);

        return () => {
            clearTimeout(failsafeTimer);
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSession) unsubscribeSession();
        };
    }, []);

    // Memoize value to prevent unneeded re-renders in consumers
    const values = React.useMemo(() => ({
        user,
        userData,
        loading,
        setUserData
    }), [user, userData, loading]);

    return (
        <UserContext.Provider value={values}>
            {/* If loading and ONLINE, show spinner. If OFFLINE, dismiss it. */}
            {loading && isOnline ? (
                <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ marginTop: '15px', color: '#666' }}>Connecting to TTR...</p>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
