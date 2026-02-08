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
                            unsubscribeSnapshot = onSnapshot(instRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'institution').toLowerCase() });
                                setLoading(false);
                            });
                        } else if (teachSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(teachRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'teacher').toLowerCase() });
                                setLoading(false);
                            });
                        } else if (userSnap.exists()) {
                            unsubscribeSnapshot = onSnapshot(userRef, (d) => {
                                if (!d.exists()) { detectFull(); return; }
                                setUserData({ ...d.data(), uid: currentUser.uid, role: (d.data().role || 'student').toLowerCase() });
                                setLoading(false);
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

                detectFull();

            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSession) unsubscribeSession();
        };
    }, []);

    const values = React.useMemo(() => ({
        user, userData, loading, setUserData
    }), [user, userData, loading]);

    return (
        <UserContext.Provider value={values}>
            {loading ? (
                <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Loading...
                </div>
            ) : children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
