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
            <AnnouncementBar title="Get the App" leftIcon={false} />

            <div className="container" style={{ textAlign: 'center', marginTop: '30px', maxWidth: '600px', margin: '30px auto' }}>
                <div className="card" style={{ padding: '30px', borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <img src="/logo2.png" alt="App Logo" style={{ width: '80px', height: '80px', borderRadius: '20px' }} />
                    </div>
                    <h2 style={{ color: '#2d3436', marginBottom: '5px', fontSize: '24px' }}>Install Together To Refine</h2>
                    <p style={{ color: '#636e72', marginBottom: '30px' }}>Get the best experience on your device.</p>

                    {/* PRIMARY INSTALL BUTTON */}
                    {installPrompt ? (
                        <div style={{ marginBottom: '30px' }}>
                            <button
                                onClick={handleInstallClick}
                                style={{
                                    background: 'linear-gradient(135deg, #0984e3, #6c5ce7)',
                                    color: 'white',
                                    border: 'none', padding: '15px 40px',
                                    borderRadius: '50px', fontSize: '18px',
                                    fontWeight: 'bold', cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(108, 92, 231, 0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    width: '100%'
                                }}
                            >
                                <span>📥</span> Install App Now
                            </button>
                            <p style={{ fontSize: '12px', color: '#b2bec3', marginTop: '10px' }}>Tap to add to your Home Screen</p>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '30px', padding: '15px', background: '#f1f2f6', borderRadius: '10px' }}>
                            {isIOS ? (
                                <div>
                                    <strong>For iOS (iPhone/iPad):</strong>
                                    <ol style={{ textAlign: 'left', paddingLeft: '20px', margin: '10px 0' }}>
                                        <li>Tap <b>Share</b> <span style={{ fontSize: '18px' }}>⎋</span> (square with arrow).</li>
                                        <li>Scroll down and tap <b>"Add to Home Screen"</b>.</li>
                                    </ol>
                                </div>
                            ) : (
                                <div>
                                    <strong>App Installed or Not Supported</strong>
                                    <p style={{ fontSize: '13px', margin: '5px 0' }}>
                                        If the app isn't installed, tap the browser menu (⋮) and select <b>"Install App"</b> or <b>"Add to Home Screen"</b>.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SHARE LINK SECTION (The "API Key" / Magic Link Feature) */}
                    <div style={{ borderTop: '1px solid #dfe6e9', paddingTop: '20px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#2d3436' }}>🔗 Share Install Link</h4>
                        <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '15px' }}>
                            Send this link to students/users to directly open this install page.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #dfe6e9' }}>
                            <input
                                type="text"
                                readOnly
                                value={`${window.location.origin}/download`}
                                style={{ flex: 1, border: 'none', background: 'transparent', color: '#2d3436', outline: 'none', fontSize: '14px' }}
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/download`);
                                    alert("Link copied! Share it with your users.");
                                }}
                                style={{
                                    background: '#00b894', color: 'white', border: 'none',
                                    borderRadius: '5px', padding: '5px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
                                }}
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', fontSize: '12px', color: '#b2bec3' }}>
                        Platform: {isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop/Other'}
                    </div>
                </div>
            </div>
        </div>
    );
}
