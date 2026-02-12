import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export default function UniversalScanner() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [scanType, setScanType] = useState('lesson_plan'); // lesson_plan, notice, student_work
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [allottedStudents, setAllottedStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);

    // 1. Fetch Teacher's Allotted Students
    useEffect(() => {
        const fetchStudents = async () => {
            if (!userData?.uid || userData.role !== 'teacher') return;
            try {
                setLoadingStudents(true);
                // First get classes
                const allotmentsQuery = query(
                    collection(db, "teacher_allotments"),
                    where("teacherId", "==", userData.uid)
                );
                const allotmentsSnap = await getDocs(allotmentsQuery);
                const myGroups = allotmentsSnap.docs.map(d => ({
                    class: d.data().classAssigned,
                    section: d.data().section
                }));

                if (myGroups.length === 0 && userData.class && userData.section) {
                    myGroups.push({ class: userData.class, section: userData.section });
                }

                if (myGroups.length === 0) {
                    setAllottedStudents([]);
                    return;
                }

                // Fetch students for these groups
                let studentList = [];
                for (const group of myGroups) {
                    const studentQuery = query(
                        collection(db, "student_allotments"),
                        where("classAssigned", "==", group.class),
                        where("section", "==", group.section)
                    );
                    const studentSnap = await getDocs(studentQuery);
                    studentSnap.forEach(d => {
                        studentList.push({ id: d.id, ...d.data() });
                    });
                }
                setAllottedStudents(studentList);
            } catch (err) {
                console.error("Fetch Students Error:", err);
            } finally {
                setLoadingStudents(false);
            }
        };

        fetchStudents();
    }, [userData]);

    const handleUniversalScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (scanType === 'student_work' && !selectedStudentId) {
            alert("Please select a student first!");
            return;
        }

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
                const student = allottedStudents.find(s => s.id === selectedStudentId);
                prompt = `Analyze this student's written work for student: ${student?.name || 'Unknown'}. Provide a brief summary of the content and auto-grade it on a scale of 1-10 based on effort and clarity. Correct any obvious mistakes.`;
            }

            // Correct API URL to match platform standards
            const API_URL = window.location.hostname === 'localhost'
                ? 'https://together-to-refine.vercel.app/api/chat'
                : '/api/chat';

            const response = await fetch(API_URL, {
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

            if (!response.ok) throw new Error("AI Service Error");

            const data = await response.json();
            setScanResult(data.text);

            // 2. Save to DB automatically based on type
            if (scanType === 'notice') {
                await addDoc(collection(db, "announcements"), {
                    text: `[Scanned Notice]: ${data.text.substring(0, 800)}...`,
                    type: 'global',
                    authorName: userData.name,
                    createdAt: serverTimestamp(),
                    isAIDetected: true
                });
            } else if (scanType === 'student_work' && selectedStudentId) {
                const student = allottedStudents.find(s => s.id === selectedStudentId);
                const targetUid = student.userId || student.id;
                await addDoc(collection(db, "student_feedback"), {
                    studentId: targetUid,
                    studentName: student.name,
                    teacherId: userData.uid,
                    teacherName: userData.name,
                    type: 'ai_scan_eval',
                    content: data.text,
                    createdAt: serverTimestamp()
                });
            }

        } catch (err) {
            console.error("Scan Error:", err);
            alert("Error processing paper. Please ensure the photo is clear and try again.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📑 AI Paper Scanner</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                <div className="card" style={{ marginBottom: '20px', borderLeft: '5px solid #6c5ce7' }}>
                    <h3>Select Scan Category</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '15px' }}>
                        {[
                            { id: 'lesson_plan', label: '📖 Lesson Plan', color: '#0984e3' },
                            { id: 'notice', label: '📢 School Notice', color: '#e17055' },
                            { id: 'student_work', label: '✏️ Student Work', color: '#00b894' }
                        ].map(type => (
                            <div
                                key={type.id}
                                onClick={() => { setScanType(type.id); setScanResult(null); }}
                                style={{
                                    padding: '15px',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    background: scanType === type.id ? type.color : 'var(--bg-body)',
                                    color: scanType === type.id ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontWeight: 'bold',
                                    border: scanType === type.id ? 'none' : '2px solid var(--divider)'
                                }}
                            >
                                {type.label}
                            </div>
                        ))}
                    </div>

                    {scanType === 'student_work' && (
                        <div style={{ marginTop: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: '500' }}>Assign work to student:</label>
                            <select
                                value={selectedStudentId}
                                onChange={(e) => setSelectedStudentId(e.target.value)}
                                className="input-field"
                                style={{ width: '100%' }}
                            >
                                <option value="">-- Select Student from Allotted Classes --</option>
                                {allottedStudents.map(student => (
                                    <option key={student.id} value={student.id}>
                                        {student.name} ({student.classAssigned}-{student.section})
                                    </option>
                                ))}
                            </select>
                            {loadingStudents && <p style={{ fontSize: '12px', color: '#6c5ce7', marginTop: '5px' }}>Loading your students...</p>}
                        </div>
                    )}
                </div>

                <div className="card text-center" style={{ padding: '40px', background: 'var(--bg-surface)' }}>
                    {!scanResult ? (
                        <>
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📸</div>
                            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Ready to Digitize?</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
                                Capture a clear photo of the document. AI will extract and organize the data.
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
                                {isScanning ? '⏳ AI is processing...' : '🚀 Capture & Scan'}
                            </label>
                        </>
                    ) : (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>✨ AI Digital Summary</h3>
                                <button onClick={() => setScanResult(null)} className="btn-outline" style={{ padding: '5px 15px' }}>Scan New</button>
                            </div>
                            <div style={{
                                background: 'var(--bg-body)',
                                padding: '20px',
                                borderRadius: '10px',
                                border: '1px solid var(--divider)',
                                whiteSpace: 'pre-wrap',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                color: 'var(--text-main)',
                                minHeight: '300px'
                            }}>
                                {scanResult}
                            </div>
                            <button
                                className="btn"
                                style={{ marginTop: '20px', width: '100%', backgroundColor: '#00b894' }}
                                onClick={() => {
                                    navigator.clipboard.writeText(scanResult);
                                    alert("Result copied to clipboard!");
                                }}
                            >
                                📋 Copy Digital Text
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
