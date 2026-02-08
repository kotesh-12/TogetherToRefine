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


    useEffect(() => {
        let unsubscribeSnapshot = null;
        let unsubscribeSession = null;
        let retryCount = 0; // Prevent infinite recursion
        const MAX_RETRIES = 3;

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
                // We fire this asynchronously so we don't block the Role Check
                registerSession(currentUser.uid).then((sessionId) => {
                    if (sessionId) {
                        const sessionRef = doc(db, 'users', currentUser.uid, 'sessions', sessionId);
                        unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
                            // If document is deleted, it means this session was revoked
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
                    // Parallelize checks!
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
                            unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const data = d.data();
                                const role = (data.role || 'institution').trim().toLowerCase();
                                setUserData({ ...data, uid: currentUser.uid, collection: 'institutions', role });
                                sessionStorage.setItem('user_collection_cache', 'institutions');
                                setLoading(false);
                            });
                        } else if (teachSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const data = d.data();
                                const role = (data.role || 'teacher').trim().toLowerCase();
                                setUserData({ ...data, uid: currentUser.uid, collection: 'teachers', role });
                                sessionStorage.setItem('user_collection_cache', 'teachers');
                                setLoading(false);
                            });
                        } else if (userSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                const data = d.data();
                                const normalizedRole = (data.role || 'student').trim().toLowerCase();
                                setUserData({ ...data, uid: currentUser.uid, collection: 'users', role: normalizedRole });
                                sessionStorage.setItem('user_collection_cache', 'users');
                                setLoading(false);
                            });
                        } else {
                            console.log("User document not found in any collection.");
                            setUserData(null);
                            setLoading(false);
                        }
                    } catch (err) {
                        console.error("Parallel detection failed", err);
                        setLoading(false);
                    }
                    console.timeEnd("RoleDetection");
                };

                // Strategy: Check cached collection first, then priority sequence
                const detectAndSubscribe = async () => {
                    try {
                        const cachedCollection = sessionStorage.getItem('user_collection_cache'); // SECURITY: Use Session

                        // Helper to subscribe
                        const subscribe = (col, roleName) => {
                            return onSnapshot(doc(db, col, currentUser.uid), (d) => {
                                if (d.exists()) {
                                    const data = d.data();
                                    const role = (data.role || roleName).trim().toLowerCase();
                                    setUserData({ ...data, uid: currentUser.uid, collection: col, role });
                                    sessionStorage.setItem('user_collection_cache', col);
                                    setLoading(false);
                                } else {
                                    // If cached lookup failed (doc deleted?), retry full detection
                                    if (col === cachedCollection) {
                                        sessionStorage.removeItem('user_collection_cache');
                                        // Retry with full detection
                                        detectFull();
                                    } else {
                                        setUserData(null);
                                        setLoading(false);
                                    }
                                }
                            });
                        };

                        // Fast Path: Check Session Cache first
                        if (cachedCollection) {
                            console.log("Using cached collection for speed:", cachedCollection);
                            unsubscribeSnapshot = subscribe(cachedCollection, 'student');
                        } else {
                            // No cache? Full scan.
                            await detectFull();
                        }
                    } catch (err) {
                        console.error("Error detecting user role:", err);
                        setLoading(false);
                    }
                };

                detectAndSubscribe();

            } else {
                console.log("User Logged Out. Clearing Data.");
                setUserData(null);
                setLoading(false);
                sessionStorage.removeItem('user_collection_cache'); // Clear cache on logout
            }
        });

        // Failsafe: If Auth doesn't fire in 4 seconds, verify connectivity or force logout state
        const failsafeTimer = setTimeout(() => {
            console.warn("Auth Listener Timeout: Force clearing loading state.");
            setLoading((prev) => {
                if (prev) return false;
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
            {/* If loading and ONLINE, show spinner. If OFFLINE, show content (cached) or login */}
            {loading && navigator.onLine ? (
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
