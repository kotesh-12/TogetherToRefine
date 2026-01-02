import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

export default function TopBar({ title, leftIcon = 'home' }) {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [announcement, setAnnouncement] = useState('🔔 Welcome to TTR! Stay tuned for updates.');

    const handleLeftClick = () => {
        if (leftIcon === 'back') {
            navigate(-1);
        } else {
            // Default: Home
            if (userData?.role === 'student') navigate('/student');
            else if (userData?.role === 'teacher') navigate('/teacher');
            else if (userData?.role === 'institution') navigate('/institution');
            else navigate('/');
        }
    };

    useEffect(() => {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setAnnouncement(`🔔 ${data.text}`);
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 999, backgroundColor: '#f0f2f5' }}>
            {/* Main Header with Home & Profile */}
            <header className="app-header" style={{ marginBottom: 0, borderRadius: '0 0 0 0' }}>
                <div
                    className="icon-btn"
                    onClick={handleLeftClick}
                    style={{
                        fontSize: leftIcon === 'back' ? '16px' : '24px',
                        fontWeight: leftIcon === 'back' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        left: '20px',
                        position: 'absolute',
                        color: leftIcon === 'back' ? 'white' : 'inherit' // Ensure visibility on header
                    }}
                    title={leftIcon === 'back' ? "Go Back" : "Dashboard"}
                >
                    {leftIcon === 'back' ? 'Back' : '🏠'}
                </div>
                <h1 style={{ fontSize: '18px', margin: 0 }}>{title || `Welcome, ${userData?.name || "User"}!`}</h1>
                <div className="profile-pic" onClick={() => navigate('/profile')} style={{ cursor: 'pointer', right: '20px', position: 'absolute' }}>
                    {userData?.profileImageURL ? (
                        <img src={userData.profileImageURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    ) : (
                        <span style={{ fontSize: '24px' }}>👤</span>
                    )}
                </div>
            </header>

            {/* Announcement Bar attached below */}
            <div className="announcement-bar" style={{ marginTop: 0, borderRadius: '0 0 10px 10px' }}>
                <div className="scrolling-text">{announcement}</div>
            </div>
        </div>
    );
}
