import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

const UserContext = createContext();

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser ? "User Logged In" : "User Logged Out");
            setUser(currentUser);

            // Cleanup previous snapshot listener
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (currentUser) {
                setLoading(true);

                const detectFull = async () => {
                    // 1. Check Institution
                    const instRef = doc(db, "institutions", currentUser.uid);
                    const instSnap = await getDoc(instRef);
                    if (instSnap.exists()) {
                        unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                            setUserData({ ...d.data(), uid: currentUser.uid, collection: 'institutions', role: 'institution' });
                            localStorage.setItem('user_collection_cache', 'institutions');
                            setLoading(false);
                        });
                        return;
                    }

                    // 2. Check Teacher
                    const teachRef = doc(db, "teachers", currentUser.uid);
                    const teachSnap = await getDoc(teachRef);
                    if (teachSnap.exists()) {
                        unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                            setUserData({ ...d.data(), uid: currentUser.uid, collection: 'teachers', role: 'teacher' });
                            localStorage.setItem('user_collection_cache', 'teachers');
                            setLoading(false);
                        });
                        return;
                    }

                    // 3. Fallback to Student ('users')
                    const userRef = doc(db, "users", currentUser.uid);
                    unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                        if (d.exists()) {
                            console.log("Found in 'users'");
                            setUserData({ ...d.data(), uid: currentUser.uid, collection: 'users', role: d.data().role || 'student' });
                            localStorage.setItem('user_collection_cache', 'users');
                        } else {
                            console.log("User document not found in any collection.");
                            setUserData(null);
                        }
                        setLoading(false);
                    });
                };

                // Strategy: Check cached collection first, then priority sequence
                const detectAndSubscribe = async () => {
                    try {
                        const cachedCollection = localStorage.getItem('user_collection_cache');

                        // Helper to subscribe
                        const subscribe = (col, roleName) => {
                            return onSnapshot(doc(db, col, currentUser.uid), (d) => {
                                if (d.exists()) {
                                    setUserData({ ...d.data(), uid: currentUser.uid, collection: col, role: d.data().role || roleName });
                                    localStorage.setItem('user_collection_cache', col); // Cache it!
                                    setLoading(false);
                                } else {
                                    // If cached lookup failed (doc deleted?), retry full detection
                                    if (col === cachedCollection) {
                                        localStorage.removeItem('user_collection_cache');
                                        detectFull();
                                    } else {
                                        setUserData(null);
                                        setLoading(false);
                                    }
                                }
                            });
                        };

                        // Fast Path: Use Cache
                        if (cachedCollection) {
                            console.log("Using cached collection:", cachedCollection);
                            unsubscribeSnapshot = subscribe(cachedCollection, cachedCollection === 'users' ? 'student' : (cachedCollection === 'institutions' ? 'institution' : 'teacher'));
                            return;
                        }

                        // Slow Path: Full Detection
                        await detectFull();

                    } catch (err) {
                        console.error("Error detecting user role:", err);
                        setLoading(false);
                    }
                };

                detectAndSubscribe();

            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        // Failsafe: If Auth doesn't fire in 4 seconds, verify connectivity or force logout state
        const timer = setTimeout(() => {
            console.warn("Auth Listener Timeout: Force clearing loading state.");
            setLoading((prev) => {
                if (prev) return false;
                return prev;
            });
        }, 4000);

        return () => {
            clearTimeout(timer);
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
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
            {loading ? (
                <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
