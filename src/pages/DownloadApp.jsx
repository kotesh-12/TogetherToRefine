import React from 'react';
import AnnouncementBar from '../components/AnnouncementBar';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

export default function DownloadApp() {
    const { userData } = useUser();
    const [installPrompt, setInstallPrompt] = React.useState(null);

    React.useEffect(() => {
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

    // Logic: 
    // Show 'Install App Now' big button if available (supported browsers).
    // Show Android Section only on Android OR if it's not iOS/Windows (unknown Linux/etc)
    // Show iOS Section only on iOS OR if not Android/Windows
    // Show Windows Section only on Windows OR if not Android/iOS

    return (
        <div className="page-wrapper">
            <AnnouncementBar title="Get the App" leftIcon="back" />

            <div className="container" style={{ textAlign: 'center', marginTop: '30px' }}>
                <div className="card">
                    <h2 style={{ color: '#2d3436', marginBottom: '10px' }}>Download TogetherToRefine</h2>

                    {/* PRIMARY INSTALL BUTTON (Browsers that support PWA Prompt) */}
                    {installPrompt && (
                        <div style={{ marginBottom: '30px', padding: '20px', background: '#e17055', borderRadius: '10px', color: 'white' }}>
                            <h3 style={{ marginTop: 0 }}>🚀 Best Way to Install</h3>
                            <p style={{ fontSize: '14px' }}>Install the native app for the best experience.</p>
                            <button
                                onClick={handleInstallClick}
                                style={{
                                    marginTop: '10px',
                                    background: 'white', color: '#e17055',
                                    border: 'none', padding: '12px 24px',
                                    borderRadius: '30px', fontSize: '16px',
                                    fontWeight: 'bold', cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}
                            >
                                Install App Now
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Android Section */}
                        {/* Android Section */}
                        {(isAndroid) && (
                            <div style={{
                                padding: '15px',
                                border: isAndroid ? '2px solid #0984e3' : '1px solid #dfe6e9',
                                borderRadius: '10px',
                                background: isAndroid ? '#f1f2f6' : 'white'
                            }}>
                                <h3>📱 For Android</h3>
                                <p style={{ fontSize: '13px', color: '#666' }}>
                                    Install the app directly to your home screen for the best experience.
                                </p>

                                {/* If we have the prompt, show the button. If not, show instructions. */}
                                {installPrompt ? (
                                    <button
                                        onClick={handleInstallClick}
                                        className="btn"
                                        style={{
                                            background: '#0984e3',
                                            marginTop: '10px',
                                            display: 'inline-block',
                                            color: 'white',
                                            border: 'none',
                                            padding: '12px 24px',
                                            borderRadius: '30px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        ⬇️ Install App (Add to Home)
                                    </button>
                                ) : (
                                    <div style={{ marginTop: '10px', textAlign: 'left', background: '#fff', padding: '10px', borderRadius: '5px', border: '1px solid #ffeaa7' }}>
                                        <strong>⚠️ Install Button Not available</strong>
                                        <p style={{ fontSize: '13px', margin: '5px 0' }}>
                                            To install properly, please follow these steps manually:
                                        </p>
                                        <ol style={{ paddingLeft: '20px', margin: '5px 0', fontSize: '13px' }}>
                                            <li>Tap the <b>three dots</b> (⋮) in the top right of Chrome.</li>
                                            <li>Select <b>"Install App"</b> or <b>"Add to Home Screen"</b>.</li>
                                        </ol>
                                    </div>
                                )}

                                {/* Fallback text for APK */}
                                <div style={{ marginTop: '15px', fontSize: '12px' }}>
                                    Or <a href="#" onClick={(e) => {
                                        e.preventDefault();
                                        const link = "https://your-drive-link.com/app.apk";
                                        if (link.includes("your-drive-link")) alert("APK link not configured yet.");
                                        else window.open(link, '_blank');
                                    }} style={{ color: '#666', textDecoration: 'underline' }}>download APK file</a> if installation fails.
                                </div>
                            </div>
                        )}

                        {/* IOS Section */}
                        {(isIOS) && (
                            <div style={{
                                padding: '15px',
                                border: isIOS ? '2px solid #0984e3' : '1px solid #dfe6e9',
                                borderRadius: '10px',
                                background: isIOS ? '#f1f2f6' : 'white',
                                display: (isIOS) ? 'block' : 'none'
                            }}>
                                <h3>🍎 For iOS (iPhone/iPad)</h3>
                                <div style={{ marginTop: '10px', textAlign: 'left', background: '#fff', padding: '10px', borderRadius: '5px' }}>
                                    <strong>How to Install:</strong>
                                    <ol style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                        <li>Open in <b>Safari</b>.</li>
                                        <li>Tap <b>Share</b> (squares with arrow up).</li>
                                        <li>Tap <b>"Add to Home Screen"</b>.</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        {/* PC Section (Windows/Mac) - Only shown if prompt is NOT available (already installed or unsupported) */}
                        {(isWindows || (!isAndroid && !isIOS)) && !installPrompt && (
                            <div style={{
                                padding: '15px',
                                border: '1px solid #dfe6e9',
                                borderRadius: '10px',
                                background: '#white'
                            }}>
                                <h3>💻 For Windows / Mac</h3>
                                <p style={{ fontSize: '13px', color: '#666' }}>
                                    If the "Install App" button didn't appear above:
                                </p>
                                <div style={{ marginTop: '10px', textAlign: 'left', background: '#fff', padding: '10px', borderRadius: '5px' }}>
                                    <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                        <li>Click the <b>Install Icon</b> (⬇️) in the browser address bar.</li>
                                        <li>Select <b>"Install TogetherToRefine"</b>.</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                    </div>

                    <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                        <p style={{ fontStyle: 'italic', color: '#aaa', fontSize: '12px' }}>
                            Share this link: <strong style={{ color: '#0984e3' }}>{window.location.origin}/download</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
