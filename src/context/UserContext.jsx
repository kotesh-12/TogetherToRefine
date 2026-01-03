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

                // 1. Try 'users' collection with real-time listener
                unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
                    if (docSnap.exists()) {
                        console.log("User data found in 'users'");
                        setUserData({ ...docSnap.data(), uid: currentUser.uid, collection: 'users' });
                        setLoading(false);
                    } else {
                        // 2. Fallback: Check 'institutions' or 'teachers' (One-time fetch for simplicity, or could chain listeners)
                        console.log("User not in 'users', checking others...");

                        try {
                            const instSnap = await getDoc(doc(db, "institutions", currentUser.uid));
                            if (instSnap.exists()) {
                                console.log("User found in 'institutions'");
                                setUserData({ ...instSnap.data(), uid: currentUser.uid, collection: 'institutions' });
                                setLoading(false);
                                return;
                            }

                            const teachSnap = await getDoc(doc(db, "teachers", currentUser.uid));
                            if (teachSnap.exists()) {
                                console.log("User found in 'teachers'");
                                setUserData({ ...teachSnap.data(), uid: currentUser.uid, collection: 'teachers' });
                                setLoading(false);
                                return;
                            }

                            // No profile found
                            console.log("No profile found for user.");
                            setUserData(null);
                        } catch (e) {
                            console.error("Error checking user roles:", e);
                        } finally {
                            setLoading(false);
                        }
                    }
                }, (error) => {
                    console.error("Firestore Snapshot Error:", error);
                    setLoading(false);
                });

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
