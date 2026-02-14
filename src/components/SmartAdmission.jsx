
import React, { useRef, useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';

export default function SmartAdmission({ onClose, onScanComplete }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('camera'); // 'camera', 'processing', 'review'
    const [scannedText, setScannedText] = useState('');
    const [parsedData, setParsedData] = useState([]);

    // Start Camera
    useEffect(() => {
        if (status === 'camera') {
            const startCam = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    if (videoRef.current) videoRef.current.srcObject = stream;
                } catch (e) {
                    console.error("Camera Error:", e);
                    alert("Could not access camera. Please allow permissions.");
                    onClose();
                }
            };
            startCam();
        }

        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [status]);

    const captureImage = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        setStatus('processing');
        processImage(canvas.toDataURL('image/png'));
    };

    const processImage = async (imageData) => {
        try {
            const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
                logger: m => console.log(m)
            });
            setScannedText(text);
            parseText(text);
            setStatus('review');
        } catch (e) {
            console.error("OCR Error:", e);
            alert("Failed to read image.");
            setStatus('camera');
        }
    };

    const parseText = (text) => {
        // Primitive parser: Look for lines with Name and maybe Class
        // Assumption: Line format "Name Class" or just Name
        const lines = text.split('\n').filter(l => l.trim().length > 3);
        const students = lines.map((line, idx) => {
            // Check if line has digits (implies class/phone)
            const hasDigits = /\d/.test(line);

            // Generate dummy credentials
            const namePart = line.replace(/[^a-zA-Z\s]/g, '').trim();
            const cleanName = namePart.split(' ')[0].toLowerCase() + (idx + 1);
            const email = `${cleanName}@school.com`;
            const password = `Pass${Math.floor(1000 + Math.random() * 9000)}`;

            return {
                name: namePart || "Unknown",
                email: email,
                password: password,
                class: hasDigits ? line.match(/\d+/)?.[0] || '10' : '10', // Default or extracted
                original: line
            };
        });
        setParsedData(students);
    };

    const handleConfirm = () => {
        // Pass array of { name, email, password, class } to parent Import function
        onScanComplete(parsedData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)', zIndex: 3000, color: 'white',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <h3 style={{ marginBottom: '10px' }}>📸 Smart Admission AI</h3>

            {status === 'camera' && (
                <>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', height: '60vh', background: 'black', overflow: 'hidden' }}>
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div style={{
                            position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%',
                            border: '2px solid white', borderRadius: '10px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)'
                        }} />
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>Center list of names in the box</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                        <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '30px' }}>Cancel</button>
                        <button onClick={captureImage} style={{ padding: '15px 40px', background: 'white', border: 'none', color: 'black', borderRadius: '30px', fontWeight: 'bold' }}>Capture</button>
                    </div>
                </>
            )}

            {status === 'processing' && (
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ borderTopColor: 'white', margin: '0 auto 20px' }} />
                    <p>AI is reading names...</p>
                </div>
            )}

            {status === 'review' && (
                <div style={{ width: '90%', maxWidth: '600px', background: 'white', color: 'black', borderRadius: '15px', padding: '20px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Review Scanned Data</h4>
                    <p style={{ fontSize: '12px', color: '#666' }}>We found {parsedData.length} names. Credentials auto-generated.</p>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', marginBottom: '15px' }}>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8f9fa' }}>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Class</th>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Login ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.map((s, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>
                                            <input
                                                value={s.name}
                                                onChange={(e) => {
                                                    const list = [...parsedData];
                                                    list[i].name = e.target.value;
                                                    setParsedData(list);
                                                }}
                                                style={{ border: 'none', width: '100%' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <input
                                                value={s.class}
                                                onChange={(e) => {
                                                    const list = [...parsedData];
                                                    list[i].class = e.target.value;
                                                    setParsedData(list);
                                                }}
                                                style={{ border: 'none', width: '40px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px', color: '#666' }}>{s.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setStatus('camera')} style={{ padding: '8px 16px', border: '1px solid #ccc', background: 'transparent', borderRadius: '5px' }}>Retake</button>
                        <button onClick={handleConfirm} style={{ padding: '8px 24px', background: '#00b894', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Import All</button>
                    </div>
                </div>
            )}
        </div>
    );
}
