import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function DownloadApp() {
    const navigate = useNavigate();

    // Check Platform
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#0f0f14',
            color: '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            zIndex: 9999,
            overflowY: 'auto',
            padding: '60px 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* BACK BUTTON (Top Left) */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    position: 'absolute', top: '20px', left: '20px',
                    background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer',
                    zIndex: 10001, display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500'
                }}
            >
                ← Back
            </button>

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
                background: 'rgba(255,255,255,0.03)',
                width: '90%', maxWidth: '420px',
                borderRadius: '32px',
                padding: '40px 20px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                animation: 'popIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                position: 'relative'
            }}>
                <img
                    src={logo}
                    alt="TTR-AI Logo"
                    style={{
                        width: '80px', height: '80px', borderRadius: '20px',
                        marginBottom: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                        border: '2px solid rgba(139, 92, 246, 0.3)'
                    }}
                />

                <h2 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#ffffff', fontWeight: '700' }}>
                    Install App
                </h2>

                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 30px 0', lineHeight: '1.5' }}>
                    Together To Refine works best as a native app. Install it now for easy access.
                </p>

                {/* INSTALL ACTION AREA */}
                {isAndroid ? (
                    // 1. NATIVE ANDROID APK OPTION
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                        <div style={{
                            background: '#e3f2fd', padding: '15px', borderRadius: '16px',
                            textAlign: 'left', border: '1px solid #bbdefb', position: 'relative'
                        }}>
                            <span style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: '#1976d2', color: 'white', fontSize: '10px',
                                padding: '3px 8px', borderRadius: '20px', fontWeight: 'bold'
                            }}>RECOMMENDED</span>
                            <p style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold', color: '#0d47a1' }}>
                                Native Android App
                            </p>
                            <p style={{ fontSize: '13px', color: '#1565c0', margin: '0 0 12px 0' }}>
                                Get the full experience with our real Android app.
                            </p>
                            <a
                                href="/TTR-AI.apk"
                                download="TTR-AI.apk"
                                style={{
                                    display: 'block', textAlign: 'center',
                                    background: '#1976d2', color: 'white',
                                    textDecoration: 'none', padding: '12px', borderRadius: '12px',
                                    fontSize: '15px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(25, 118, 210, 0.3)'
                                }}
                            >
                                Download APK
                            </a>
                        </div>

                        <p style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                            *To install APK: Open the file and allow "Install from Unknown Sources" if asked.
                        </p>
                    </div>
                ) : isIOS ? (
                    // 2. iOS INSTRUCTIONS
                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '16px', textAlign: 'left', border: '1px solid #e9ecef' }}>
                        <p style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: '600', color: '#2d3436', lineHeight: '1.5' }}>
                            Our iOS Native App is coming soon!
                        </p>
                        <p style={{ margin: '0', fontSize: '14px', color: '#555', lineHeight: '1.8' }}>
                            In the meantime, you can continue using our full-featured web experience on Safari.
                        </p>
                    </div>
                ) : (
                    // 3. DESKTOP / OTHERS
                    <div style={{ textAlign: 'left', width: '100%' }}>
                        <div style={{ background: '#f5f6fa', color: '#2d3436', padding: '15px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                            ✅ <b>Web Platform Active</b><br />
                            You are currently using the Desktop Web version.
                            <br /><br />
                            <span style={{ fontSize: '12px', color: '#636e72' }}>Download the mobile app on your phone for on-the-go access.</span>
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
                .active-btn:active {
                    transform: scale(0.98);
                }
            `}</style>
        </div>
    );
}
