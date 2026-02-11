import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function UniversalScanner() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [scanType, setScanType] = useState('lesson_plan'); // lesson_plan, notice, student_work
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);

    const handleUniversalScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            const base64Img = await base64Promise;

            const token = await auth.currentUser?.getIdToken();

            let prompt = "";
            if (scanType === 'lesson_plan') {
                prompt = "Analyze this handwritten or printed lesson plan. Extract the Topic, Objectives, and Key Activities. Structure it as a clean digital document.";
            } else if (scanType === 'notice') {
                prompt = "Analyze this school notice or circular. Extract the Heading, Date, and main Content. Identify who it is for (Parents/Students/All).";
            } else {
                prompt = "Analyze this student's written work. Provide a brief summary of the content and auto-grade it on a scale of 1-10 based on effort and clarity.";
            }

            const response = await fetch(`${window.location.origin.includes('localhost') ? 'http://localhost:5000' : ''}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: prompt,
                    image: base64Img,
                    mimeType: file.type,
                    userContext: userData
                })
            });

            const data = await response.json();
            setScanResult(data.text);

            // Optional: Save to DB automatically
            if (scanType === 'notice') {
                await addDoc(collection(db, "announcements"), {
                    text: `[Scanned Notice]: ${data.text.substring(0, 500)}...`,
                    type: 'global',
                    authorName: userData.name,
                    createdAt: serverTimestamp(),
                    isAIDetected: true
                });
            }

        } catch (err) {
            console.error("Scan Error:", err);
            alert("Error processing paper. Please try a clearer photo.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📑 Paper-to-Digital Scanner</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                <div className="card" style={{ marginBottom: '20px', borderLeft: '5px solid #6c5ce7' }}>
                    <h3>Select What to Scan</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '15px' }}>
                        {[
                            { id: 'lesson_plan', label: '📖 Lesson Plan', color: '#0984e3' },
                            { id: 'notice', label: '📢 School Notice', color: '#e17055' },
                            { id: 'student_work', label: '✏️ Student Work', color: '#00b894' }
                        ].map(type => (
                            <div
                                key={type.id}
                                onClick={() => setScanType(type.id)}
                                style={{
                                    padding: '15px',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    background: scanType === type.id ? type.color : '#f1f2f6',
                                    color: scanType === type.id ? 'white' : '#636e72',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontWeight: 'bold',
                                    border: scanType === type.id ? 'none' : '2px solid #eee'
                                }}
                            >
                                {type.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card text-center" style={{ padding: '40px' }}>
                    {!scanResult ? (
                        <>
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📸</div>
                            <h3 style={{ margin: '0 0 10px 0' }}>Ready to Scan?</h3>
                            <p style={{ color: '#636e72', marginBottom: '30px' }}>
                                Take a clear photo of your paper. Our AI will handle the rest.
                            </p>

                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                id="universal-scanner"
                                hidden
                                onChange={handleUniversalScan}
                                disabled={isScanning}
                            />
                            <label
                                htmlFor="universal-scanner"
                                style={{
                                    padding: '15px 40px',
                                    background: isScanning ? '#b2bec3' : '#6c5ce7',
                                    color: 'white',
                                    borderRadius: '30px',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 6px 20px rgba(108, 92, 231, 0.4)',
                                    display: 'inline-block'
                                }}
                            >
                                {isScanning ? '⏳ AI is Reading...' : '🚀 Start Scanning'}
                            </label>
                        </>
                    ) : (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>✨ AI Digitized Result</h3>
                                <button onClick={() => setScanResult(null)} className="btn-outline" style={{ padding: '5px 15px' }}>Scan Another</button>
                            </div>
                            <div style={{
                                background: '#f8f9fa',
                                padding: '20px',
                                borderRadius: '10px',
                                border: '1px solid #eee',
                                whiteSpace: 'pre-wrap',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                color: '#2d3436',
                                minHeight: '300px'
                            }}>
                                {scanResult}
                            </div>
                            <button
                                className="btn"
                                style={{ marginTop: '20px', width: '100%' }}
                                onClick={() => {
                                    navigator.clipboard.writeText(scanResult);
                                    alert("Copied to clipboard!");
                                }}
                            >
                                📋 Copy to Clipboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
