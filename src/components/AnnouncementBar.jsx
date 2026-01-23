import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

import QRCode from 'react-qr-code';

export default function TopBar({ title, leftIcon = 'home', backPath, onMenuClick, hideRightOptions = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData, user } = useUser();
    const [announcement, setAnnouncement] = useState('Welcome to TTR!');
    const [showQR, setShowQR] = useState(false); // QR Modal State

    const handleLeftClick = () => {
        if (leftIcon === 'back') {
            if (backPath) {
                navigate(backPath, { replace: true });
            } else {
                navigate(-1);
            }
        } else {
            // View first: Home Icon
            if (userData?.role === 'student') navigate('/student', { replace: true });
            else if (userData?.role === 'teacher') navigate('/teacher', { replace: true });
            else if (userData?.role === 'institution') navigate('/institution', { replace: true });
            else navigate('/', { replace: true });
        }
    };

    useEffect(() => {
        if (!userData) return;

        // Fetch multiple recent announcements to filter client-side
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const announcements = snapshot.docs.map(d => d.data());

                // Find the first relevant announcement
                const relevant = announcements.find(a => {
                    // Global announcements are for everyone
                    if (a.type === 'global') return true;

                    // Filtering based on Role
                    if ((userData && userData.role === 'admin') || (user && user.email === 'admin@ttr.com')) {
                        return false;
                    }

                    if (userData.role === 'student') {
                        // Matches Class AND (Section is 'All' OR Section Matches)
                        // Cast to string for comparison safety
                        const userClass = userData.class?.toString();
                        const targetClass = a.targetClass?.toString();

                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) {
                                return true;
                            }
                        }
                        return false;
                    }

                    if (userData.role === 'teacher') {
                        // Teachers see announcements for their assigned class or from their institution
                        // Or simply all announcements from their institution?
                        // For now, let's allow them to see what their students see + Institution posts
                        if (a.role === 'institution') return true;

                        // Own announcements?
                        if (a.authorId === userData.uid) return true;

                        return false;
                    }

                    if (userData.role === 'institution') {
                        // Institution sees what they posted
                        if (a.authorId === userData.uid) return true;
                        return false;
                    }

                    return false;
                });

                if (relevant) {
                    let text = relevant.text;
                    if (relevant.authorName) text = `${relevant.authorName}: ${text}`;
                    setAnnouncement(text);
                } else {
                    // Fallback to latest GLobal if none found, or default
                    const latestGlobal = announcements.find(a => a.type === 'global');
                    if (latestGlobal) {
                        let text = latestGlobal.text;
                        if (latestGlobal.authorName) text = `${latestGlobal.authorName}: ${text}`;
                        setAnnouncement(text);
                    } else {
                        setAnnouncement('Welcome to TTR!');
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [userData, user]);

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 999, backgroundColor: '#f0f2f5' }}>

            {/* Main Header with Home & Profile */}
            <header className="app-header" style={{
                marginBottom: 0,
                borderRadius: '0 0 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '15px 20px',
                position: 'relative'
            }}>

                {/* Left: Back/Home Icon */}
                {leftIcon && (
                    <div
                        className="icon-btn"
                        onClick={handleLeftClick}
                        style={{
                            fontSize: leftIcon === 'back' ? '16px' : '24px',
                            fontWeight: leftIcon === 'back' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            padding: '0',
                            color: leftIcon === 'back' ? '#2d3436' : 'inherit',
                            position: 'relative',
                            left: 'auto'
                        }}
                        title={leftIcon === 'back' ? "Go Back" : "Dashboard"}
                    >
                        {leftIcon === 'back' ? 'Back' : '🏠'}
                    </div>
                )}

                {/* Center: Title */}
                <h1 style={{
                    fontSize: '18px',
                    margin: 0,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60%',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {title !== undefined ? title : `Welcome, ${userData?.name || "User"}!`}
                </h1>

                {/* Right: Install & Profile */}
                {!hideRightOptions && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', zIndex: 100 }}>



                        {/* Optional 3-Line Menu Button */}
                        {onMenuClick && (
                            <div
                                onClick={onMenuClick}
                                style={{ fontSize: '24px', cursor: 'pointer', userSelect: 'none' }}
                                title="Menu"
                            >
                                ☰
                            </div>
                        )}

                        <div className="profile-pic" onClick={() => navigate('/profile')} style={{ cursor: 'pointer', width: '35px', height: '35px', position: 'relative', right: 'auto' }}>
                            {userData?.profileImageURL ? (
                                <img src={userData.profileImageURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '24px', lineHeight: '35px' }}>👤</span>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* QR CODE MODAL */}
            {showQR && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowQR(false)}>
                    <div style={{
                        background: 'white', padding: '30px', borderRadius: '15px',
                        textAlign: 'center', maxWidth: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#2d3436' }}>Scan to Join Class</h3>
                        <div style={{ background: 'white', padding: '10px', display: 'inline-block' }}>
                            <QRCode value={window.location.origin} size={200} />
                        </div>
                        <p style={{ marginTop: '15px', fontSize: '13px', color: '#636e72' }}>
                            Share this with your students.<br />
                            <b>{window.location.host}</b>
                        </p>
                        <button
                            onClick={() => setShowQR(false)}
                            style={{
                                marginTop: '15px', padding: '8px 20px',
                                background: '#e17055', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <style>
                {`
                @keyframes pulse-btn {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(9, 132, 227, 0.7); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(9, 132, 227, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(9, 132, 227, 0); }
                }
            `}
            </style>

            {/* Announcement Bar attached below */}
            <div className="announcement-bar">
                <div className="scrolling-text">{announcement}</div>
                {isPatriotic(announcement) ? <PatrioticConfetti /> : (isFestival(announcement) && <SimpleConfetti />)}
            </div>
        </div>
    );
}

// Helper: Patriotic Days (Republic & Independence Day)
function isPatriotic(text) {
    if (!text) return false;
    const keywords = ['republic day', 'independence day', 'jai hind', 'august 15', 'january 26', 'india'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

// Helper: General Festivals
function isFestival(text) {
    if (!text) return false;
    const keywords = ['festival', 'sankranthi', 'diwali', 'christmas', 'new year', 'holiday', 'pongal', 'ugadi', 'dussehra', 'celebration', 'happy'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

// Intro Animation with Lion Emblem


// Indian Flag Floating Animation
function PatrioticConfetti() {
    const particles = Array.from({ length: 40 });

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            {particles.map((_, i) => {
                const color = ['#FF9933', '#FFFFFF', '#138808'][i % 3]; // Saffron, White, Green
                const style = {
                    position: 'absolute',
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: '12px',
                    height: '8px',
                    backgroundColor: color,
                    animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                    animationDelay: `-${Math.random() * 5}s`,
                    opacity: 0.9,
                    borderRadius: '1px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                };
                return <div key={i} style={style} />;
            })}
            <style>
                {`
                @keyframes float {
                    0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
                    20% { opacity: 1; }
                    50% { transform: translateY(-20px) translateX(10px) rotate(10deg); }
                    80% { opacity: 1; }
                    100% { transform: translateY(-40px) translateX(-10px) rotate(-10deg); opacity: 0; }
                }
                `}
            </style>
        </div>
    );
}

// Lightweight Confetti Component
function SimpleConfetti() {
    const particles = Array.from({ length: 50 });

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            {particles.map((_, i) => {
                const style = {
                    position: 'absolute',
                    left: `${Math.random() * 100}%`,
                    top: `-10px`,
                    width: '8px',
                    height: '8px',
                    backgroundColor: ['#ffbeb3', '#badc58', '#f9ca24', '#686de0', '#e056fd'][Math.floor(Math.random() * 5)],
                    animation: `fall ${2 + Math.random() * 3}s linear infinite`,
                    animationDelay: `-${Math.random() * 5}s`,
                    opacity: 0.8,
                    borderRadius: '50%'
                };
                return <div key={i} style={style} />;
            })}
            <style>
                {`
                @keyframes fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
                }
                `}
            </style>
        </div>
    );
}
