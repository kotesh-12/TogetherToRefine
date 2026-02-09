import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Onboarding() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [perms, setPerms] = useState({
        mic: 'prompt', // prompt, granted, denied
        camera: 'prompt',
        notification: 'prompt'
    });

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        // Check Mic
        try {
            const micStatus = await navigator.permissions.query({ name: 'microphone' });
            setPerms(p => ({ ...p, mic: micStatus.state }));
        } catch (e) {
            // Firefox/Safari might not support query for mic
        }

        // Check Camera
        try {
            const camStatus = await navigator.permissions.query({ name: 'camera' });
            setPerms(p => ({ ...p, camera: camStatus.state }));
        } catch (e) { }

        // Check Notifications
        if ('Notification' in window) {
            setPerms(p => ({ ...p, notification: Notification.permission === 'default' ? 'prompt' : Notification.permission }));
        }
    };

    const requestMic = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setPerms(p => ({ ...p, mic: 'granted' }));
        } catch (e) {
            console.error(e);
            setPerms(p => ({ ...p, mic: 'denied' }));
            alert("Microphone access denied. Please enable it in browser settings.");
        }
    };

    const requestCam = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            setPerms(p => ({ ...p, camera: 'granted' }));
        } catch (e) {
            setPerms(p => ({ ...p, camera: 'denied' }));
            alert("Camera access denied. Please enable it in browser settings.");
        }
    };

    const requestNotif = async () => {
        if (!('Notification' in window)) return;
        const result = await Notification.requestPermission();
        setPerms(p => ({ ...p, notification: result }));
    };

    const handleContinue = () => {
        // Use user-specific key so multiple users on same device see onboarding
        const setupKey = userData?.uid ? `ttr_setup_done_${userData.uid}` : 'ttr_setup_done';
        localStorage.setItem(setupKey, 'true');
        // Redirect based on role
        const r = userData?.role?.toLowerCase();
        if (r === 'admin') navigate('/admin');
        else if (r === 'teacher') navigate('/teacher');
        else if (r === 'institution') navigate('/institution');
        else if (r === 'student') navigate('/student');
        else navigate('/details');
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
            padding: '20px', fontFamily: "'Segoe UI', sans-serif"
        }}>
            <div style={{
                background: 'white', padding: '40px', borderRadius: '20px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxWidth: '500px', width: '100%',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '50px', marginBottom: '20px' }}>👋</div>
                <h1 style={{ color: '#2d3436', marginBottom: '10px' }}>Welcome to TTR!</h1>
                <p style={{ color: '#636e72', marginBottom: '30px', lineHeight: '1.6' }}>
                    To give you the full <b>AI Tutor</b> experience, we need a few permissions.
                    This allows you to talk to the AI and receive important updates.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                    {/* MIC */}
                    <div className="perm-row" style={rowStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px' }}>🎙️</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>Microphone</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>For Voice AI Chat</div>
                            </div>
                        </div>
                        {perms.mic === 'granted' ? <span style={grantedStyle}>Allowed ✅</span> :
                            <button onClick={requestMic} style={btnStyle}>Allow</button>}
                    </div>

                    {/* CAMERA */}
                    <div className="perm-row" style={rowStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px' }}>📷</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>Camera</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>For Image Analysis</div>
                            </div>
                        </div>
                        {perms.camera === 'granted' ? <span style={grantedStyle}>Allowed ✅</span> :
                            <button onClick={requestCam} style={btnStyle}>Allow</button>}
                    </div>

                    {/* NOTIFICATIONS */}
                    <div className="perm-row" style={rowStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px' }}>🔔</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>Notifications</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>For Important Updates</div>
                            </div>
                        </div>
                        {perms.notification === 'granted' ? <span style={grantedStyle}>Allowed ✅</span> :
                            <button onClick={requestNotif} style={btnStyle}>Allow</button>}
                    </div>
                </div>

                <button onClick={handleContinue} style={{
                    width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
                    background: '#6c5ce7', color: 'white', fontSize: '16px', fontWeight: 'bold',
                    cursor: 'pointer', transition: 'transform 0.2s'
                }}>
                    Continue to App ➤
                </button>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#b2bec3', cursor: 'pointer' }} onClick={handleContinue}>
                    Skip for now
                </div>
            </div>
        </div>
    );
}

const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '15px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee'
};

const btnStyle = {
    padding: '8px 20px', borderRadius: '20px', border: 'none',
    background: '#0984e3', color: 'white', cursor: 'pointer', fontSize: '14px'
};

const grantedStyle = {
    color: '#00b894', fontWeight: 'bold', fontSize: '14px'
};
