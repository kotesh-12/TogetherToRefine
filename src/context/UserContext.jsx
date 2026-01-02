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
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                setLoading(true);
                // Optimized listener: only listen to one document once we know where it is, or check quickly
                // For now, we assume 'users' is the primary. If 'users' returns null, we check 'institutions'.

                const unsubAuthCallback = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
                    if (docSnap.exists()) {
                        setUserData({ ...docSnap.data(), uid: currentUser.uid, collection: 'users' });
                        setLoading(false);
                    } else {
                        // Fallback checking institutions or teachers
                        try {
                            const instSnap = await getDoc(doc(db, "institutions", currentUser.uid));
                            if (instSnap.exists()) {
                                setUserData({ ...instSnap.data(), uid: currentUser.uid, collection: 'institutions' });
                                setLoading(false);
                                return;
                            }

                            const teachSnap = await getDoc(doc(db, "teachers", currentUser.uid));
                            if (teachSnap.exists()) {
                                setUserData({ ...teachSnap.data(), uid: currentUser.uid, collection: 'teachers' });
                                setLoading(false);
                                return;
                            }

                        } catch (e) { console.error(e); }
                        setLoading(false);
                    }
                });

                return () => unsubAuthCallback();
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
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
