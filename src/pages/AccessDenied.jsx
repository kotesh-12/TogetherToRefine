import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import { useUser } from '../context/UserContext';
import AnnouncementBar from '../components/AnnouncementBar';
// ...
export default function AccessDenied() {
    const navigate = useNavigate();
    const { userData } = useUser();

    console.log("AccessDenied Component Loaded. User Role:", userData?.role);

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.clear(); // Clear any cached data
        navigate('/'); // Go to Login
    };

    const makeMeAdmin = async () => {
        if (!userData || !userData.uid) return;
        let success = false;
        try {
            // Try updating all potential collections to be sure
            const collections = ['institutions', 'teachers', 'users'];
            for (const col of collections) {
                try {
                    await updateDoc(doc(db, col, userData.uid), { role: 'admin' });
                    console.log(`Updated role in ${col}`);
                    success = true;
                } catch (ignore) {
                    // Document might not exist in this collection, ignoring
                }
            }

            if (success) {
                alert("Role updated to Admin! Redirecting...");
                localStorage.clear(); // Clear cache
                window.location.href = '/admin';
            } else {
                alert("Could not find your user record to update.");
            }
        } catch (e) {
            alert("Error updating role: " + e.message);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f1f2f6' }}>
            <AnnouncementBar title="Access Denied" />

            <div style={{
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                height: 'calc(100vh - 120px)', // Centered in remaining space
                padding: '20px'
            }}>
                <div style={{ fontSize: '60px' }}>🚫</div>
                <h1 style={{ color: '#d63031', marginBottom: '10px' }}>Access Denied</h1>
                <p style={{ color: '#636e72', marginBottom: '10px' }}>
                    You do not have permission to view this page.
                </p>
                {/* SECURITY: Only show this to the specific Admin Email */}
                {userData && (userData.email === 'kotesh.business12@gmail.com' || userData.email === 'INSERT_YOUR_EMAIL_HERE') && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'left', maxWidth: '400px', margin: '20px auto' }}>
                        <p style={{ marginTop: 0 }}><strong>Debug Info:</strong></p>
                        <p><strong>Current Role:</strong> <code>{userData.role}</code></p>
                        <p><strong>User ID:</strong> <code style={{ fontSize: '10px' }}>{userData.uid}</code></p>
                        <p><strong>Email:</strong> <code>{userData.email}</code></p>
                        <p style={{ fontSize: '12px', color: '#666' }}>You are seeing this because your email is whitelisted.</p>

                        <button
                            onClick={makeMeAdmin}
                            style={{
                                marginTop: '10px',
                                padding: '8px 12px',
                                background: '#d63031',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            🛠️ Fix: Set my Role to Admin
                        </button>
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        className="btn"
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        style={{ padding: '10px 20px', background: '#636e72', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        🔄 Clear Cache
                    </button>
                    <button
                        className="btn"
                        onClick={handleLogout}
                        style={{ padding: '10px 20px', background: '#d63031', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🚪 Logout
                    </button>
                    <button
                        className="btn"
                        onClick={() => navigate('/')}
                        style={{ padding: '10px 20px', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
