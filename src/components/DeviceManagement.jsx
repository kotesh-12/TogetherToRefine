import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { getLocalSessionId } from '../utils/sessionManager';

export default function DeviceManagement() {
    const { user } = useUser();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentSessionId = getLocalSessionId();

    const fetchSessions = async () => {
        if (!user) return;
        try {
            const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('lastActive', 'desc'));
            const snapshot = await getDocs(q);
            const sess = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setSessions(sess);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [user]);

    const handleSignOut = async (sessionId) => {
        if (!window.confirm("Are you sure you want to sign out this device?")) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            alert("Failed to remove device.");
        }
    };

    const handleSignOutOthers = async () => {
        if (!window.confirm("Sign out of all other devices?")) return;
        try {
            const others = sessions.filter(s => s.id !== currentSessionId);
            await Promise.all(others.map(s => deleteDoc(doc(db, 'users', user.uid, 'sessions', s.id))));
            fetchSessions();
            alert("Signed out of all other devices.");
        } catch (err) {
            alert("Error signing out devices.");
        }
    };

    const getIcon = (type) => {
        if (type === 'mobile') return '📱';
        if (type === 'tablet') return 'ipod';
        return '💻';
    };

    if (loading) return <div>Loading devices...</div>;

    return (
        <div className="device-management" style={{ marginTop: '30px', textAlign: 'left', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Logged in Devices</h3>

            <div className="session-list">
                {sessions.length === 0 && <p>No active sessions found.</p>}

                {sessions.map((session) => {
                    const isCurrent = session.id === currentSessionId;
                    return (
                        <div key={session.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px', marginBottom: '10px',
                            background: isCurrent ? '#f0f9ff' : '#fff',
                            border: isCurrent ? '1px solid #bae6fd' : '1px solid #eee',
                            borderRadius: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>{getIcon(session.deviceType)}</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                        {session.deviceName}
                                        {isCurrent && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px' }}>THIS DEVICE</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {session.lastActive?.toDate ? session.lastActive.toDate().toLocaleString() : 'Just now'}
                                    </div>
                                </div>
                            </div>

                            {!isCurrent && (
                                <button
                                    onClick={() => handleSignOut(session.id)}
                                    style={{
                                        background: 'none', border: '1px solid #fee2e2', color: '#dc2626',
                                        padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                                    }}
                                >
                                    Sign Out
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {sessions.length > 1 && (
                <button
                    onClick={handleSignOutOthers}
                    style={{
                        marginTop: '10px', width: '100%', padding: '10px',
                        background: '#fff', border: '1px solid #ddd', color: '#444',
                        borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                    }}
                >
                    Sign out all other devices
                </button>
            )}
        </div>
    );
}
