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
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* BACK BUTTON (Top Left) */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    position: 'absolute', top: '24px', left: '24px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', padding: '10px 18px', borderRadius: '14px',
                    fontSize: '14px', cursor: 'pointer', zIndex: 10001,
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500',
                    transition: 'all 0.3s ease', backdropFilter: 'blur(5px)'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateX(-3px)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'translateX(0)';
                }}
            >
                ← Back
            </button>

            {/* CLOSE BUTTON (Top Right) */}
            <button
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute', top: '24px', right: '24px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', width: '42px', height: '42px', borderRadius: '14px',
                    fontSize: '22px', cursor: 'pointer', zIndex: 10001,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease', backdropFilter: 'blur(5px)'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                &times;
            </button>

            {/* MAIN CARD */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                width: '90%', maxWidth: '420px',
                borderRadius: '32px',
                padding: '45px 30px',
                textAlign: 'center',
                boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px) saturate(180%)',
                animation: 'popIn 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                position: 'relative'
            }}>
                <img
                    src={logo}
                    alt="TTR-AI Logo"
                    style={{
                        width: '95px', height: '95px', borderRadius: '24px',
                        marginBottom: '25px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                        border: '2px solid rgba(255,255,255,0.1)'
                    }}
                />

                <h2 style={{ fontSize: '26px', margin: '0 0 10px 0', color: '#ffffff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    Access TTR-AI
                </h2>

                <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 35px 0', lineHeight: '1.6' }}>
                    Together To Refine AI works flawlessly as a native Android App or optimized responsive Web platform.
                </p>

                {/* DYNAMIC CARD CONTENT BASED ON PLATFORM */}
                {isAndroid ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            padding: '24px 20px',
                            borderRadius: '20px',
                            textAlign: 'left'
                        }}>
                            <span style={{
                                background: '#3b82f6', color: 'white', fontSize: '10px',
                                padding: '3px 9px', borderRadius: '20px', fontWeight: '800',
                                float: 'right', letterSpacing: '0.5px'
                            }}>RECOMMENDED</span>
                            
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '750', color: '#3b82f6' }}>
                                Native Android App
                            </h3>
                            
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                                Download the dedicated Android APK file directly to your device for high-performance and instant access.
                            </p>

                            <a
                                href="/TTR-AI.apk"
                                download="TTR-AI.apk"
                                style={{
                                    display: 'block', textAlign: 'center',
                                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                    color: 'white', textDecoration: 'none',
                                    padding: '14px', borderRadius: '14px',
                                    fontSize: '15px', fontWeight: 'bold',
                                    boxShadow: '0 10px 20px rgba(59, 130, 246, 0.25)',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 12px 25px rgba(59, 130, 246, 0.4)'}
                                onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 10px 20px rgba(59, 130, 246, 0.25)'}
                            >
                                Download APK
                            </a>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                        {/* IOS OR DESKTOP LANDING INFO */}
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            padding: '24px 20px',
                            borderRadius: '20px',
                            textAlign: 'left'
                        }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '750', color: '#10b981' }}>
                                Pure Web Application
                            </h3>
                            <p style={{ fontSize: '13px', color: '#a7f3d0', margin: '0', lineHeight: '1.5' }}>
                                Access the platform directly in any web browser. Our web application features native-level speed and responsive fluidity across iOS, macOS, Windows, and Linux.
                            </p>
                        </div>

                        {/* Native Android APK Promo option (Even on desktop/iOS) */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            padding: '16px',
                            borderRadius: '16px',
                            textAlign: 'left',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <span style={{ fontWeight: '600', color: '#fff' }}>Android Version Available</span>
                                <div style={{ fontSize: '11px', color: '#888' }}>Download APK for Android devices</div>
                            </div>
                            <a
                                href="/TTR-AI.apk"
                                download="TTR-AI.apk"
                                style={{
                                    background: 'rgba(255,255,255,0.06)', color: '#fff',
                                    textDecoration: 'none', padding: '8px 14px', borderRadius: '10px',
                                    fontSize: '12px', fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                Get APK
                            </a>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => navigate('/')}
                    style={{
                        marginTop: '25px',
                        background: '#ffffff', color: '#0f0f14',
                        border: 'none', padding: '16px', borderRadius: '16px',
                        fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%',
                        boxShadow: '0 10px 25px rgba(255,255,255,0.05)',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,255,255,0.1)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(255,255,255,0.05)';
                    }}
                >
                    Continue to Website
                </button>
            </div>

            {/* STYLE FOR ANIMATION */}
            <style>{`
                @keyframes popIn {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
