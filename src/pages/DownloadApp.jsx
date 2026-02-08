import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AnnouncementBar from '../components/AnnouncementBar';

export default function DownloadApp() {
    const { userData } = useUser();
    const navigate = useNavigate();
    const [installPrompt, setInstallPrompt] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                setInstallPrompt(null);
            }
        });
    };

    // Check Platform
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isWindows = /Windows/i.test(navigator.userAgent);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', // Darker dim for more focus
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(8px)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* CLOSE BUTTON (Top Right) */}
            <button
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute', top: '20px', right: '20px',
                    background: 'none', border: 'none', color: 'white', fontSize: '30px', cursor: 'pointer',
                    zIndex: 10001
                }}
            >
                &times;
            </button>

            {/* MAIN CARD */}
            <div style={{
                background: 'white',
                width: '90%', maxWidth: '380px',
                borderRadius: '24px',
                padding: '40px 30px',
                textAlign: 'center',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                animation: 'popIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                position: 'relative'
            }}>
                <img
                    src="/logo2.png"
                    alt="App Icon"
                    style={{
                        width: '90px', height: '90px', borderRadius: '22px',
                        marginBottom: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                    }}
                    onError={(e) => e.target.style.display = 'none'}
                />

                <h2 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#1a1a1a', fontWeight: '700' }}>
                    Install App
                </h2>

                <p style={{ fontSize: '15px', color: '#666', marginBottom: '35px', lineHeight: '1.6' }}>
                    Together To Refine works best as an app. Install it now for easy access.
                </p>

                {/* INSTALL ACTION AREA */}
                {installPrompt ? (
                    // 1. NATIVE PROMPT AVAILABLE (Android/Chrome/Edge)
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={handleInstallClick}
                            style={{
                                background: 'linear-gradient(135deg, #0984e3, #6c5ce7)',
                                color: 'white',
                                border: 'none', padding: '16px', borderRadius: '14px',
                                fontSize: '17px', fontWeight: 'bold', cursor: 'pointer',
                                width: '100%', boxShadow: '0 8px 15px rgba(108, 92, 231, 0.3)',
                                transition: 'transform 0.1s'
                            }}
                            className="active-btn"
                        >
                            Tap to Install
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                background: '#f1f2f6', color: '#636e72',
                                border: 'none', padding: '16px', borderRadius: '14px',
                                fontSize: '16px', fontWeight: '600', cursor: 'pointer', width: '100%'
                            }}
                        >
                            Not Now
                        </button>
                    </div>
                ) : isIOS ? (
                    // 2. iOS INSTRUCTIONS (Animated)
                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '16px', textAlign: 'left', border: '1px solid #e9ecef' }}>
                        <p style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: '600', color: '#2d3436', lineHeight: '1.5' }}>
                            To install on iPhone/iPad:
                        </p>
                        <ol style={{ paddingLeft: '20px', margin: '0', fontSize: '14px', color: '#555', lineHeight: '1.8' }}>
                            <li>Tap the <b>Share</b> button <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Apple_Share_icon.svg/1200px-Apple_Share_icon.svg.png" style={{ width: '14px', verticalAlign: '-2px' }} alt="" /> below.</li>
                            <li>Scroll down and tap <b>"Add to Home Screen"</b>.</li>
                        </ol>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
                            <span style={{ fontSize: '28px', animation: 'bounce 2s infinite', opacity: '0.8' }}>⬇️</span>
                        </div>
                    </div>
                ) : (
                    // 3. PC / ALREADY INSTALLED / UNSUPPORTED
                    <div>
                        <div style={{ background: '#e3f2fd', color: '#0d47a1', padding: '15px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px', textAlign: 'left', lineHeight: '1.5' }}>
                            ✅ App allows direct install only on supported mobile browsers. <br /><br />
                            If the prompt doesn't appear, you may already have it installed!
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                background: '#1a1a1a', color: 'white',
                                border: 'none', padding: '16px', borderRadius: '14px',
                                fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%'
                            }}
                        >
                            Continue to Website
                        </button>
                    </div>
                )}
            </div>

            {/* STYLE FOR ANIMATION */}
            <style>{`
                @keyframes popIn {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                    40% {transform: translateY(-10px);}
                    60% {transform: translateY(-5px);}
                }
                .active-btn:active {
                    transform: scale(0.98);
                }
            `}</style>
        </div>
    );
}
