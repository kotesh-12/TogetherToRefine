import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, writeBatch, doc, setDoc } from 'firebase/firestore';

export default function MarksManagement() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // View Toggle
    const [activeTab, setActiveTab] = useState('add'); // 'add' or 'view'

    // ADD MARKS STATE
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [examType, setExamType] = useState(''); // Assignment 1, Mid-1, Final
    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({}); // { studentId: marks }

    // VIEW MARKS STATE
    const [allMarks, setAllMarks] = useState([]);
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterExamType, setFilterExamType] = useState(''); // NEW: Filter by exam type
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch students when class/section selected
    useEffect(() => {
        if (selectedClass && selectedSection && activeTab === 'add') {
            fetchStudents();
        }
    }, [selectedClass, selectedSection, activeTab]);

    // Fetch all marks when viewing
    useEffect(() => {
        if (activeTab === 'view') {
            fetchAllMarks();
        }
    }, [activeTab, filterClass, filterSection, filterExamType]);

    const fetchStudents = async () => {
        try {
            const q = query(
                collection(db, "student_allotments"),
                where("classAssigned", "==", selectedClass),
                where("section", "==", selectedSection)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(list);

            // Initialize marks object
            const initial = {};
            list.forEach(s => initial[s.studentId || s.id] = '');
            setMarksData(initial);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchAllMarks = async () => {
        setLoading(true);
        try {
            // Fetch ALL marks and filter client-side for maximum robustness
            // This bypasses Firestore index requirements and type mismatches (string vs number)
            const q = query(collection(db, "marks"));

            const snap = await getDocs(q);
            let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter logic
            if (filterClass) {
                list = list.filter(m => String(m.class) === String(filterClass));
            }
            if (filterSection) {
                list = list.filter(m => String(m.section) === String(filterSection));
            }
            if (filterExamType) {
                list = list.filter(m => m.examType === filterExamType);
            }

            // Client-side Sort (Newest First)
            list.sort((a, b) => {
                const tA = a.createdAt?.seconds || 0;
                const tB = b.createdAt?.seconds || 0;
                return tB - tA;
            });

            setAllMarks(list);
        } catch (e) {
            console.error("Error fetching marks:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkChange = (studentId, value) => {
        setMarksData(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSubmitMarks = async () => {
        if (!examType || !selectedClass || !selectedSection) {
            alert("Please select exam type, class, and section.");
            return;
        }

        if (!userData || !userData.uid) {
            alert("User session not found. Please login again.");
            return;
        }

        const entries = Object.entries(marksData).filter(([_, marks]) => marks !== '');

        if (entries.length === 0) {
            alert("Please enter at least one mark.");
            return;
        }

        // Validate marks
        const invalidEntries = entries.filter(([_, marks]) => {
            const m = parseFloat(marks);
            return isNaN(m) || m < 0 || m > 100;
        });

        if (invalidEntries.length > 0) {
            alert("Some marks are invalid. Please ensure all marks are numbers between 0 and 100.");
            return;
        }

        setIsSubmitting(true);
        try {
            console.log(`Starting submission for ${entries.length} students...`);

            // Use Parallel Requests (Robustness against single failures)
            const promises = entries.map(async ([studentId, marks]) => {
                // Find student by matching ID (handling potential type mismatch)
                const student = students.find(s => String(s.studentId || s.id) === String(studentId));

                // Construct Deterministic ID for Upsert (prevents duplicates)
                const safeSubject = (userData.subject || "General").replace(/[^a-zA-Z0-9]/g, "_");
                const safeExam = examType.replace(/[^a-zA-Z0-9]/g, "_");
                const docId = `MARK_${studentId}_${safeSubject}_${safeExam}`;

                const docRef = doc(db, "marks", docId);

                await setDoc(docRef, {
                    studentId: studentId,
                    studentName: student?.studentName || student?.name || "Unknown",
                    class: selectedClass,
                    section: selectedSection,
                    subject: userData.subject || "General",
                    examType: examType,
                    marks: parseFloat(marks),
                    maxMarks: 100,
                    teacherId: userData.uid,
                    teacherName: userData.name || "Teacher",
                    createdAt: serverTimestamp(), // Acts as 'Last Updated'
                    institutionId: userData.institutionId || userData.createdBy || userData.uid || "unknown"
                }, { merge: true });
            });

            const results = await Promise.allSettled(promises);
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.length - successCount;

            if (failCount > 0) {
                console.error("Some submissions failed:", results.filter(r => r.status === 'rejected'));
                alert(`⚠️ Submitted ${successCount} marks, but ${failCount} failed. Check console for details.`);
            } else {
                console.log("All marks submitted successfully!");
                alert(`✅ Successfully submitted all ${successCount} marks!`);
                setMarksData({});
                setExamType('');
            }
        } catch (e) {
            console.error("Error submitting marks:", e);
            alert("Error submitting marks: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📊 Marks Management</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Tab Toggle */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
                    <button
                        onClick={() => setActiveTab('add')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none',
                            borderBottom: activeTab === 'add' ? '3px solid #0984e3' : 'none',
                            fontWeight: activeTab === 'add' ? 'bold' : 'normal',
                            cursor: 'pointer', color: activeTab === 'add' ? '#0984e3' : '#636e72'
                        }}
                    >
                        ➕ Add Marks
                    </button>
                    <button
                        onClick={() => setActiveTab('view')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none',
                            borderBottom: activeTab === 'view' ? '3px solid #0984e3' : 'none',
                            fontWeight: activeTab === 'view' ? 'bold' : 'normal',
                            cursor: 'pointer', color: activeTab === 'view' ? '#0984e3' : '#636e72'
                        }}
                    >
                        👁️ View All Marks
                    </button>
                </div>

                {/* ADD MARKS TAB */}
                {activeTab === 'add' && (
                    <div className="card">
                        <h3>Enter Marks</h3>

                        {/* Selection Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#636e72' }}>Class</label>
                                <select className="input-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                                    <option value="">Select</option>
                                    {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#636e72' }}>Section</label>
                                <select className="input-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
                                    <option value="">Select</option>
                                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#636e72' }}>Exam Type</label>
                                <select className="input-field" value={examType} onChange={(e) => setExamType(e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="Assignment 1">Assignment 1</option>
                                    <option value="Assignment 2">Assignment 2</option>
                                    <option value="Mid-Term 1">Mid-Term 1</option>
                                    <option value="Mid-Term 2">Mid-Term 2</option>
                                    <option value="Final Exam">Final Exam</option>
                                </select>
                            </div>
                        </div>

                        {/* Student List */}
                        {students.length > 0 ? (
                            <>
                                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                                            <tr>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Roll No</th>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Student Name</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Marks (out of 100)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, idx) => {
                                                const studentId = student.studentId || student.id;
                                                return (
                                                    <tr key={studentId} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '10px' }}>{idx + 1}</td>
                                                        <td style={{ padding: '10px' }}>{student.studentName || student.name}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={marksData[studentId] || ''}
                                                                onChange={(e) => handleMarkChange(studentId, e.target.value)}
                                                                style={{
                                                                    width: '80px', padding: '5px', textAlign: 'center',
                                                                    border: '1px solid #ddd', borderRadius: '4px'
                                                                }}
                                                                placeholder="--"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={handleSubmitMarks} className="btn" style={{ marginTop: '15px', width: '100%' }} disabled={isSubmitting}>
                                    {isSubmitting ? '⏳ Submitting...' : '✅ Submit All Marks'}
                                </button>
                            </>
                        ) : (
                            <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                                Select class, section to load students
                            </p>
                        )}
                    </div>
                )}

                {/* VIEW MARKS TAB */}
                {activeTab === 'view' && (
                    <div className="card">
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, flex: 1 }}>All Marks</h3>

                            <select className="input-field" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: '140px' }}>
                                <option value="">All Classes</option>
                                {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>Class {i + 1}</option>)}
                            </select>

                            <select className="input-field" value={filterSection} onChange={(e) => setFilterSection(e.target.value)} style={{ width: '120px' }}>
                                <option value="">All Sections</option>
                                {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                            </select>

                            <select className="input-field" value={filterExamType} onChange={(e) => setFilterExamType(e.target.value)} style={{ width: '150px' }}>
                                <option value="">All Exam Types</option>
                                <option value="Assignment 1">Assignment 1</option>
                                <option value="Assignment 2">Assignment 2</option>
                                <option value="Mid-Term 1">Mid-Term 1</option>
                                <option value="Mid-Term 2">Mid-Term 2</option>
                                <option value="Final Exam">Final Exam</option>
                            </select>
                        </div>

                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>
                        ) : allMarks.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>No marks entered yet.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Student</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Class</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Subject</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Exam</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Marks</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Teacher</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allMarks.map((mark) => {
                                            const percentage = (mark.marks / mark.maxMarks) * 100;
                                            const isLow = percentage < 40;

                                            return (
                                                <tr key={mark.id} style={{
                                                    borderBottom: '1px solid #eee',
                                                    background: isLow ? '#fff5f5' : 'white'
                                                }}>
                                                    <td style={{ padding: '10px' }}>
                                                        {mark.studentName}
                                                        {isLow && <span style={{ marginLeft: '5px', color: '#e74c3c', fontSize: '12px' }}>⚠️ Low</span>}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>{mark.class}-{mark.section}</td>
                                                    <td style={{ padding: '10px' }}>{mark.subject}</td>
                                                    <td style={{ padding: '10px' }}>{mark.examType}</td>
                                                    <td style={{
                                                        padding: '10px',
                                                        textAlign: 'center',
                                                        fontWeight: 'bold',
                                                        color: isLow ? '#e74c3c' : percentage >= 75 ? '#27ae60' : '#f39c12'
                                                    }}>
                                                        {mark.marks}/{mark.maxMarks}
                                                    </td>
                                                    <td style={{ padding: '10px', fontSize: '12px', color: '#636e72' }}>{mark.teacherName}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
