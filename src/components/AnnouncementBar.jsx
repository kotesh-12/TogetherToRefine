import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

export default function TopBar({ title, leftIcon = 'home' }) {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [announcement, setAnnouncement] = useState('Welcome to TTR!');


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
                const text = data.text;
                setAnnouncement(text);


            }
        });
        return () => unsubscribe();
    }, []);

    const [installPrompt, setInstallPrompt] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = () => {
        if (!installPrompt) {
            alert("This button is visible for testing. In production, it only appears if the browser allows installation!");
            return;
        }
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                setInstallPrompt(null);
            } else {
                console.log('User dismissed the install prompt');
            }
        });
    };

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 999, backgroundColor: '#f0f2f5' }}>

            {/* Main Header with Home & Profile */}
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
                <div
                    className="icon-btn"
                    onClick={handleLeftClick}
                    style={{
                        fontSize: leftIcon === 'back' ? '16px' : '24px',
                        fontWeight: leftIcon === 'back' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        padding: '0',
                        color: leftIcon === 'back' ? 'white' : 'inherit',
                        position: 'relative',
                        left: 'auto'
                    }}
                    title={leftIcon === 'back' ? "Go Back" : "Dashboard"}
                >
                    {leftIcon === 'back' ? 'Back' : '🏠'}
                </div>

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
                    {title || `Welcome, ${userData?.name || "User"}!`}
                </h1>

                {/* Right: Install & Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', zIndex: 100 }}>

                    {/* Install App Button - TEST MODE ENABLED */}
                    {(installPrompt || true) && (
                        <div style={{ display: 'block' }}>
                            <button
                                onClick={handleInstallClick}
                                style={{
                                    background: '#ff4757', // High contrast red
                                    color: 'white',
                                    border: '2px solid white',
                                    borderRadius: '50px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                ⬇️ Install TTR
                            </button>
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
            </header>

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
            <div className="announcement-bar" style={{ marginTop: 0, borderRadius: '0 0 10px 10px', position: 'relative', overflow: 'hidden' }}>
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
