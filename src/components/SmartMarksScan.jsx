import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function SmartMarksScan({ onClose, onScanComplete }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('setup'); // setup -> camera -> processing -> review
    const [parsedData, setParsedData] = useState(null);

    // Initial config expectations, helps AI focus if paper doesn't explicitly mention it
    const [scanClass, setScanClass] = useState('10');
    const [scanSection, setScanSection] = useState('A');
    const [examType, setExamType] = useState('Mid-Term 1');

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
    }, [status, onClose]);

    const captureImage = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Compress and scale to avoid 20MB payload errors natively
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
            const base64Data = imageDataUrl.split(',')[1];

            const API_KEY = process.env.GEMINI_API_KEY;
            if (!API_KEY) throw new Error("API Key is missing in the environment. Please notify the administrator.");
            const cleanKey = API_KEY.replace(/["']/g, "").trim();
            const genAI = new GoogleGenerativeAI(cleanKey);

            const prompt = `You are a highly advanced OCR and Data Verification AI explicitly developed to revolutionize school grading.
Your job is to read carefully through the uploaded teacher's grading sheet or students' test papers and extract the Marks data.

CRITICAL INSTRUCTIONS:
1. Identify the CLASS (e.g. 1 to 12) if visible. (Expected: ${scanClass || 'Any'})
2. Identify the SECTION (e.g. A, B, C) if visible. (Expected: ${scanSection || 'Any'})
3. Identify the EXAM TYPE from: [Assignment 1, Assignment 2, Mid-Term 1, Mid-Term 2, Final Exam]. (Expected: ${examType || 'Any'})
4. For every student visible, extract their FULL NAME and their MARKS. If absent, marks = 0.
5. If max marks is mentioned, adjust to standard out of 100 or simply capture what is written. For simplicity, just return the marks number.

OUTPUT FORMAT:
Return ONLY a valid JSON object. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
{
  "class": "String (number)",
  "section": "String",
  "examType": "String",
  "data": [
      { "nameKey": "John Doe", "marks": 85 }
  ]
}`;

            const parts = [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ];

            let parsedDataObj = null;

            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const result = await model.generateContent(parts);
                let rawText = result.response.text();

                const startIdx = rawText.indexOf('{');
                const endIdx = rawText.lastIndexOf('}');
                if (startIdx !== -1 && endIdx !== -1) {
                    rawText = rawText.substring(startIdx, endIdx + 1);
                } else {
                    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                parsedDataObj = JSON.parse(rawText);
            } catch (e) {
                console.error("AI Model Vision exception:", e.message);
                throw new Error("Detailed AI Error: " + e.message);
            }

            if (!parsedDataObj.class) parsedDataObj.class = scanClass || "";
            if (!parsedDataObj.section) parsedDataObj.section = scanSection || "";
            if (!parsedDataObj.examType) parsedDataObj.examType = examType || "";

            if (parsedDataObj.class && !isNaN(parseInt(parsedDataObj.class))) {
                parsedDataObj.class = String(parseInt(parsedDataObj.class));
            }
            if (parsedDataObj.data) {
                parsedDataObj.data = parsedDataObj.data.map(item => ({
                    nameKey: String(item.nameKey || "Unknown").trim(),
                    marks: isNaN(Number(item.marks)) ? 0 : Number(item.marks),
                    matchedStudentId: null
                }));
            } else {
                parsedDataObj.data = [];
            }

            if (parsedDataObj.data && parsedDataObj.data.length > 0) {
                setParsedData(parsedDataObj);
                setStatus('review');
            } else {
                alert("TTR AI could not extract any names or marks cleanly. Try again, ensure lighting is good.");
                setStatus('camera');
            }
        } catch (e) {
            console.error("AI Marks Scan Error:", e);
            alert("Failed to read image via AI. " + e.message);
            setStatus('camera');
        }
    };

    const handleConfirm = () => {
        onScanComplete(parsedData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)', zIndex: 3000, color: 'white',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#0984e3' }}>📝 AI Marks Extraction</h3>

            {status === 'setup' && (
                <div style={{ width: '90%', maxWidth: '400px', background: 'white', color: 'black', borderRadius: '15px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <h4 style={{ margin: '0 0 5px 0' }}>Configure Marks Target</h4>
                    <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Select the target Class/Exam so the AI can verify consistency against the uploaded paper.</p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Class:</label>
                            <select className="input-field" value={scanClass} onChange={e => setScanClass(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }}>
                                {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Section:</label>
                            <select className="input-field" value={scanSection} onChange={e => setScanSection(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }}>
                                {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Exam Type:</label>
                        <select className="input-field" value={examType} onChange={e => setExamType(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }}>
                            <option value="Assignment 1">Assignment 1</option>
                            <option value="Assignment 2">Assignment 2</option>
                            <option value="Mid-Term 1">Mid-Term 1</option>
                            <option value="Mid-Term 2">Mid-Term 2</option>
                            <option value="Final Exam">Final Exam</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
                        <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'transparent', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => setStatus('camera')} style={{ padding: '10px 24px', background: '#e056fd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Start Scan 📸</button>
                    </div>
                </div>
            )}

            {status === 'camera' && (
                <>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', height: '60vh', background: 'black', overflow: 'hidden', borderRadius: '15px', border: '2px solid #e056fd' }}>
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div style={{
                            position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%',
                            border: '2px dashed #00E676', borderRadius: '10px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.6)', zIndex: 1
                        }} />
                        <div style={{ position: 'absolute', top: '5%', left: 0, width: '100%', textAlign: 'center', zIndex: 2 }}>
                            <span style={{ background: '#00E676', color: 'black', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                Target Marks Sheet
                            </span>
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', marginTop: '15px' }}>Hold the camera steady over the grade sheet or test paper list.</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                        <button onClick={() => setStatus('setup')} style={{ padding: '12px 25px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '30px', cursor: 'pointer' }}>Back to Config</button>
                        <button onClick={captureImage} style={{ padding: '12px 40px', background: 'white', border: 'none', color: 'black', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}>Capture & AI Extract</button>
                    </div>
                </>
            )}

            {status === 'processing' && (
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ borderTopColor: '#e056fd', margin: '0 auto 20px', width: '50px', height: '50px', borderWidth: '4px' }} />
                    <h3 style={{ margin: '0 0 10px' }}>Digitalizing Grades...</h3>
                    <p style={{ color: '#aaa', fontSize: '14px' }}>TTR Deep Learning analyzing handwritten or printed scores.</p>
                </div>
            )}

            {status === 'review' && parsedData && (
                <div style={{ width: '90%', maxWidth: '600px', background: 'white', color: 'black', borderRadius: '15px', padding: '20px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 5px 0', color: '#2d3436' }}>Review Extracted Marks</h4>
                    <p style={{ fontSize: '12px', color: '#636e72', marginBottom: '15px' }}>Class {parsedData.class}-{parsedData.section} | {parsedData.examType} | {parsedData.data.length} records</p>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #dfe6e9', marginBottom: '15px', borderRadius: '8px' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8f9fa' }}>
                                <tr>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Extracted Name</th>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Marks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.data.map((m, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f2f6' }}>
                                        <td style={{ padding: '10px', fontWeight: '600', color: '#2d3436' }}>
                                            <input
                                                value={m.nameKey}
                                                onChange={(e) => {
                                                    const list = [...parsedData.data];
                                                    list[i].nameKey = e.target.value;
                                                    setParsedData({ ...parsedData, data: list });
                                                }}
                                                style={{ border: 'none', width: '100%', background: 'transparent' }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px', color: '#d63031', fontWeight: 'bold' }}>
                                            <input
                                                type="number"
                                                value={m.marks}
                                                onChange={(e) => {
                                                    const list = [...parsedData.data];
                                                    list[i].marks = Number(e.target.value);
                                                    setParsedData({ ...parsedData, data: list });
                                                }}
                                                style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px', width: '60px' }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button onClick={() => setStatus('setup')} style={{ padding: '10px 16px', border: '1px solid #ccc', background: 'transparent', borderRadius: '8px', cursor: 'pointer' }}>Discard</button>
                        <button onClick={handleConfirm} style={{ padding: '10px 24px', background: '#0984e3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(9, 132, 227, 0.3)' }}>Inject to Grid</button>
                    </div>
                </div>
            )}
        </div>
    );
}
