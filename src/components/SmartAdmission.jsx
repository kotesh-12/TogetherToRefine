import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function SmartAdmission({ onClose, onScanComplete }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('setup'); // Flow: setup -> camera -> processing -> review
    const [parsedData, setParsedData] = useState([]);

    // Institutional Deep Setup Variables
    const [scanRole, setScanRole] = useState('student');
    const [scanClass, setScanClass] = useState('10');
    const [scanSection, setScanSection] = useState('A');

    // Start Camera when moving to 'camera' phase
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

        // Cleanup Stream
        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [status, onClose]);

    const handleStartScan = () => {
        setStatus('camera');
    };

    const captureImage = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Take Snapshot (Scale down to 1280px to safely avoid 20MB Gemini payload limit on modern 4K Mobile cameras)
        const scale = Math.min(1, 1280 / video.videoWidth);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;

        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);

        setStatus('processing');
        processImage(canvas.toDataURL('image/jpeg', 0.8));
    };

    const processImage = async (imageDataUrl) => {
        try {
            // Strip data:image/png;base64,... part for Gemini payload
            const base64Data = imageDataUrl.split(',')[1];

            const API_KEY = process.env.GEMINI_API_KEY;
            if (!API_KEY) throw new Error("API Key is missing in the environment. Please notify the administrator.");
            const cleanKey = API_KEY.replace(/["']/g, "").trim();
            const genAI = new GoogleGenerativeAI(cleanKey);

            const prompt = `You are an incredibly precise AI OCR tool explicitly developed to revolutionize school admissions.
Your job is to read carefully through the uploaded document/image and extract ALL names of people written (either handwritten or typed).
CRITICAL: 
1. Ignore headings, dates, scores, addresses, or phone numbers.
2. If there are names, return ONLY a strict, valid JSON array of strings containing the exact full names found. 
3. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
4. If the document is blank or contains no names, return [].
Example: ["Robert Thompson", "Sarah Jenkins"]`;

            const parts = [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ];

            let names = [];
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
                const result = await model.generateContent(parts);
                let rawText = result.response.text();

                const startIdx = rawText.indexOf('[');
                const endIdx = rawText.lastIndexOf(']');
                if (startIdx !== -1 && endIdx !== -1) {
                    rawText = rawText.substring(startIdx, endIdx + 1);
                } else {
                    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                names = JSON.parse(rawText);
            } catch (e) {
                console.error("AI Model Vision exception:", e.message);
                throw new Error("Detailed AI Error: " + e.message);
            }

            let structuredNames = names.map(name => {
                const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim() || "Unknown";
                const nameParts = cleanName.split(' ');
                let firstName = nameParts[0] || "Student";
                let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
                const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                return {
                    originalName: cleanName,
                    firstName: capitalize(firstName),
                    lastName: lastName ? capitalize(lastName) : ""
                };
            });

            structuredNames.sort((a, b) => {
                if (a.lastName === b.lastName) return a.firstName.localeCompare(b.firstName);
                return a.lastName.localeCompare(b.lastName);
            });

            const parsedStudentsData = structuredNames.map((person, idx) => {
                const rollNumber = idx + 1;
                const loginCredentials = `${person.firstName}${person.lastName}${rollNumber}`;
                return {
                    name: person.originalName,
                    email: `${loginCredentials.toLowerCase()}@school.com`,
                    password: loginCredentials,
                    role: scanRole || 'student',
                    class: scanRole === 'student' ? `${scanClass}-${scanSection}` : 'N/A',
                    rollNumber: rollNumber,
                    isInstitutionCreated: true
                };
            });

            if (parsedStudentsData && parsedStudentsData.length > 0) {
                setParsedData(parsedStudentsData);
                setStatus('review');
            } else {
                alert("TTR AI could not extract legible names from the image. Please retake carefully!");
                setStatus('camera');
            }
        } catch (e) {
            console.error("AI Scan Deep Error:", e);
            alert("Failed to read image via AI. " + e.message);
            setStatus('camera');
        }
    };

    const handleConfirm = () => {
        // Pass array of { name, email, password, class } to parent (Institution.jsx -> handleSmartImport)
        onScanComplete(parsedData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)', zIndex: 3000, color: 'white',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#0984e3' }}>🤖 Smart AI Admission Scan</h3>

            {/* PHASE 1: PRE-ALLOT SETUP */}
            {status === 'setup' && (
                <div style={{ width: '90%', maxWidth: '400px', background: 'white', color: 'black', borderRadius: '15px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <h4 style={{ margin: '0 0 5px 0' }}>Configure Scan Allotment</h4>
                    <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Configure the default class & role BEFORE scanning. The AI uses 100% accurate vision extraction algorithms.</p>

                    <div>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Scanning Photo For Role:</label>
                        <select className="input-field" value={scanRole} onChange={e => setScanRole(e.target.value)} style={{ margin: '5px 0 0 0', width: '100%' }}>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                        </select>
                    </div>

                    {scanRole === 'student' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Allot to Class:</label>
                                <select className="input-field" value={scanClass} onChange={e => setScanClass(e.target.value)} style={{ margin: '5px 0 0 0', width: '100%' }}>
                                    {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Allot to Section:</label>
                                <select className="input-field" value={scanSection} onChange={e => setScanSection(e.target.value)} style={{ margin: '5px 0 0 0', width: '100%' }}>
                                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
                        <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'transparent', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleStartScan} style={{ padding: '10px 24px', background: '#e056fd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Start AI Scan 📸</button>
                    </div>
                </div>
            )}

            {/* PHASE 2: CAMERA CAPTURE */}
            {status === 'camera' && (
                <>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', height: '60vh', background: 'black', overflow: 'hidden', borderRadius: '15px', border: '2px solid #e056fd' }}>
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div style={{
                            position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%',
                            border: '2px solid #00E676', borderRadius: '10px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.6)', zIndex: 1
                        }} />
                        <div style={{ position: 'absolute', top: '5%', left: 0, width: '100%', textAlign: 'center', zIndex: 2 }}>
                            <span style={{ background: '#00E676', color: 'black', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                TTR High-Res Vision Active
                            </span>
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', marginTop: '15px', opacity: 0.9 }}>Center your printed or handwritten lists tightly inside the green box.</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                        <button onClick={() => setStatus('setup')} style={{ padding: '12px 25px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '30px', cursor: 'pointer' }}>Back to Settings</button>
                        <button onClick={captureImage} style={{ padding: '12px 40px', background: 'white', border: 'none', color: 'black', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}>Capture & Extract</button>
                    </div>
                </>
            )}

            {/* PHASE 3: PROCESSING */}
            {status === 'processing' && (
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ borderTopColor: '#e056fd', margin: '0 auto 20px', width: '50px', height: '50px', borderWidth: '4px' }} />
                    <h3 style={{ margin: '0 0 10px' }}>Analyzing Credentials...</h3>
                    <p style={{ color: '#aaa', fontSize: '14px' }}>TTR Deep Learning Model extracting accurate data.</p>
                </div>
            )}

            {/* PHASE 4: REVIEW & CONFIRM */}
            {status === 'review' && (
                <div style={{ width: '90%', maxWidth: '600px', background: 'white', color: 'black', borderRadius: '15px', padding: '20px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2d3436' }}>Verify Exact AI Data Extraction</h4>
                    <p style={{ fontSize: '12px', color: '#636e72' }}>Extracted {parsedData.length} individuals automatically. Logins autogenerated.</p>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #dfe6e9', marginBottom: '15px', borderRadius: '8px' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }} id="credentials-table">
                            <thead style={{ background: '#f8f9fa' }}>
                                <tr>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Name</th>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Class</th>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Login ID (Email)</th>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Password</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.map((s, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f2f6' }}>
                                        <td style={{ padding: '10px' }}>
                                            <input
                                                value={s.name}
                                                onChange={(e) => {
                                                    const list = [...parsedData];
                                                    list[i].name = e.target.value;
                                                    setParsedData(list);
                                                }}
                                                style={{ border: 'none', width: '100%', fontWeight: '600', color: '#2d3436', background: 'transparent' }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px', color: '#0984e3', fontWeight: '500' }}>
                                            {s.role === 'teacher' ? 'Teacher' : `Class ${s.class}`}
                                        </td>
                                        <td style={{ padding: '10px', color: '#b2bec3', fontSize: '11px' }}>{s.email}</td>
                                        <td style={{ padding: '10px', color: '#d63031', fontSize: '11px', fontWeight: 'bold' }}>{s.password}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => {
                            const printWindow = window.open('', '_blank');
                            printWindow.document.write('<html><head><title>Login Credentials</title><style>table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid black; padding: 8px; text-align: left; }</style></head><body><h2>Login Credentials</h2>');
                            printWindow.document.write(document.getElementById('credentials-table').outerHTML);
                            printWindow.document.write('</body></html>');
                            printWindow.document.close();
                            printWindow.print();
                        }} style={{ padding: '10px 16px', border: '1px solid #0984e3', color: '#0984e3', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print Credentials 🖨️</button>

                        <button onClick={() => setStatus('setup')} style={{ padding: '10px 16px', border: '1px solid #ccc', background: 'transparent', borderRadius: '8px', cursor: 'pointer' }}>Discard & Retake</button>
                        <button onClick={handleConfirm} style={{ padding: '10px 24px', background: '#00b894', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 184, 148, 0.3)' }}>Deploy All to Database</button>
                    </div>
                </div>
            )}
        </div>
    );
}
