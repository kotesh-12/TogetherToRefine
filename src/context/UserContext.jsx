import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

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
                    console.time("RoleDetection");
                    // Parallelize checks!
                    const instRef = doc(db, "institutions", currentUser.uid);
                    const teachRef = doc(db, "teachers", currentUser.uid);
                    const userRef = doc(db, "users", currentUser.uid);

                    try {
                        const [instSnap, teachSnap, userSnap] = await Promise.all([
                            getDoc(instRef),
                            getDoc(teachRef),
                            getDoc(userRef)
                        ]);

                        if (instSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                const data = d.data();
                                if (!data.pid) {
                                    const pid = `IN-${Math.floor(100000 + Math.random() * 900000)}`;
                                    setDoc(instRef, { pid }, { merge: true });
                                    data.pid = pid;
                                }
                                setUserData({ ...data, uid: currentUser.uid, collection: 'institutions', role: 'institution' });
                                localStorage.setItem('user_collection_cache', 'institutions');
                                setLoading(false);
                            });
                        } else if (teachSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                const data = d.data();
                                if (!data.pid) {
                                    const pid = `TE-${Math.floor(100000 + Math.random() * 900000)}`;
                                    setDoc(teachRef, { pid }, { merge: true });
                                    data.pid = pid;
                                }
                                setUserData({ ...data, uid: currentUser.uid, collection: 'teachers', role: 'teacher' });
                                localStorage.setItem('user_collection_cache', 'teachers');
                                setLoading(false);
                            });
                        } else if (userSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                const data = d.data();
                                const role = data.role || 'student';
                                if (!data.pid) {
                                    const prefix = role === 'teacher' ? 'TE' : (role === 'institution' ? 'IN' : 'ST');
                                    const pid = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
                                    setDoc(userRef, { pid }, { merge: true });
                                    data.pid = pid;
                                }
                                setUserData({ ...data, uid: currentUser.uid, collection: 'users', role });
                                localStorage.setItem('user_collection_cache', 'users');
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
                        const cachedCollection = localStorage.getItem('user_collection_cache');

                        // Helper to subscribe
                        const subscribe = (col, roleName) => {
                            return onSnapshot(doc(db, col, currentUser.uid), (d) => {
                                if (d.exists()) {
                                    const data = d.data();
                                    const role = data.role || roleName;
                                    if (!data.pid) {
                                        const prefix = role === 'teacher' ? 'TE' : (role === 'institution' ? 'IN' : 'ST');
                                        const pid = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
                                        setDoc(doc(db, col, currentUser.uid), { pid }, { merge: true });
                                        data.pid = pid;
                                    }
                                    setUserData({ ...data, uid: currentUser.uid, collection: col, role });
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
