import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function HomeworkSystem() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [activeTab, setActiveTab] = useState(userData?.role === 'teacher' ? 'create' : 'view');

    // CREATE HOMEWORK (Teacher)
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [attachment, setAttachment] = useState(null);

    // VIEW HOMEWORK (Student/Teacher)
    const [homeworkList, setHomeworkList] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(false);

    // SUBMIT HOMEWORK (Student)
    const [selectedHomework, setSelectedHomework] = useState(null);
    const [submissionFile, setSubmissionFile] = useState(null);
    const [submissionText, setSubmissionText] = useState('');

    // VIEW SUBMISSIONS (Teacher)
    const [viewSubmissionId, setViewSubmissionId] = useState(null);
    const [submissionsData, setSubmissionsData] = useState([]);

    useEffect(() => {
        if (activeTab === 'view') {
            fetchHomework();
        }
    }, [activeTab, userData]);

    const fetchHomework = async () => {
        setLoading(true);
        try {
            let q;
            if (userData?.role === 'student') {
                // Fetch homework for student's class
                q = query(
                    collection(db, "homework"),
                    where("class", "==", userData.class || userData.assignedClass),
                    orderBy("createdAt", "desc")
                );
            } else {
                // Teacher sees all homework they created
                q = query(
                    collection(db, "homework"),
                    where("teacherId", "==", userData.uid),
                    orderBy("createdAt", "desc")
                );
            }

            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setHomeworkList(list);

            // If student, fetch their submissions
            if (userData?.role === 'student') {
                const subQuery = query(
                    collection(db, "homework_submissions"),
                    where("studentId", "==", userData.uid)
                );
                const subSnap = await getDocs(subQuery);
                const subs = {};
                subSnap.docs.forEach(d => {
                    subs[d.data().homeworkId] = { id: d.id, ...d.data() };
                });
                setSubmissions(subs);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubmissions = async (hwId) => {
        if (viewSubmissionId === hwId) {
            setViewSubmissionId(null);
            return;
        }

        setLoading(true);
        try {
            const q = query(collection(db, "homework_submissions"), where("homeworkId", "==", hwId), orderBy("submittedAt", "desc"));
            const snap = await getDocs(q);
            setSubmissionsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setViewSubmissionId(hwId);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleCreateHomework = async () => {
        if (!title || !description || !deadline || !selectedClass) {
            alert("Please fill all required fields");
            return;
        }

        try {
            await addDoc(collection(db, "homework"), {
                title,
                description,
                deadline: new Date(deadline),
                class: selectedClass,
                section: selectedSection || 'All',
                subject: userData.subject || 'General',
                teacherId: userData.uid,
                teacherName: userData.name,
                createdAt: serverTimestamp(),
                institutionId: userData.institutionId || userData.createdBy || userData.uid
            });

            alert("✅ Homework posted successfully!");
            setTitle('');
            setDescription('');
            setDeadline('');
            setSelectedClass('');
            setSelectedSection('');
            setActiveTab('view');
        } catch (e) {
            console.error(e);
            alert("Error posting homework");
        }
    };

    const handleSubmitHomework = async () => {
        if (!submissionText && !submissionFile) {
            alert("Please add your submission (text or file)");
            return;
        }

        setLoading(true);
        try {
            let fileUrl = null;
            if (submissionFile) {
                const fileRef = ref(storage, `homework_submissions/${userData.uid}/${Date.now()}_${submissionFile.name}`);
                await uploadBytes(fileRef, submissionFile);
                fileUrl = await getDownloadURL(fileRef);
            }

            await addDoc(collection(db, "homework_submissions"), {
                homeworkId: selectedHomework.id,
                studentId: userData.uid,
                studentName: userData.name,
                class: userData.class || userData.assignedClass,
                submissionText: submissionText,
                fileUrl: fileUrl,
                fileName: submissionFile ? submissionFile.name : null,
                submittedAt: serverTimestamp(),
                status: 'submitted'
            });

            alert("✅ Homework submitted successfully!");
            setSelectedHomework(null);
            setSubmissionText('');
            setSubmissionFile(null);
            fetchHomework();
        } catch (e) {
            console.error(e);
            alert("Error submitting homework: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const isLate = (deadline) => {
        if (!deadline) return false;
        const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
        return new Date() > deadlineDate;
    };

    const getDaysLeft = (deadline) => {
        if (!deadline) return 'No deadline';
        const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
        const diff = Math.ceil((deadlineDate - new Date()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return 'Overdue';
        if (diff === 0) return 'Due today';
        return `${diff} days left`;
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📚 Homework & Assignments</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
                    {userData?.role === 'teacher' && (
                        <button
                            onClick={() => setActiveTab('create')}
                            style={{
                                padding: '10px 20px', background: 'none', border: 'none',
                                borderBottom: activeTab === 'create' ? '3px solid #0984e3' : 'none',
                                fontWeight: activeTab === 'create' ? 'bold' : 'normal',
                                cursor: 'pointer', color: activeTab === 'create' ? '#0984e3' : '#636e72'
                            }}
                        >
                            ➕ Create Homework
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('view')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none',
                            borderBottom: activeTab === 'view' ? '3px solid #0984e3' : 'none',
                            fontWeight: activeTab === 'view' ? 'bold' : 'normal',
                            cursor: 'pointer', color: activeTab === 'view' ? '#0984e3' : '#636e72'
                        }}
                    >
                        👁️ {userData?.role === 'teacher' ? 'My Homework' : 'View Homework'}
                    </button>
                </div>

                {/* CREATE TAB (Teacher Only) */}
                {activeTab === 'create' && userData?.role === 'teacher' && (
                    <div className="card">
                        <h3>Create New Homework</h3>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Chapter 5 Exercise"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Description *
                                </label>
                                <textarea
                                    className="input-field"
                                    rows="4"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detailed instructions for students..."
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Class *
                                    </label>
                                    <select className="input-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                                        <option value="">Select</option>
                                        {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Section
                                    </label>
                                    <select className="input-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
                                        <option value="">All Sections</option>
                                        {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Deadline *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button onClick={handleCreateHomework} className="btn" style={{ marginTop: '10px' }}>
                                ✅ Post Homework
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW TAB */}
                {activeTab === 'view' && (
                    <div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
                        ) : homeworkList.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
                                <h3>No Homework Yet</h3>
                                <p style={{ color: '#999' }}>
                                    {userData?.role === 'teacher'
                                        ? "You haven't created any homework yet."
                                        : "No homework assigned to your class."}
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {homeworkList.map(hw => {
                                    const submission = submissions[hw.id];
                                    const daysLeft = getDaysLeft(hw.deadline);
                                    const late = isLate(hw.deadline);

                                    return (
                                        <div key={hw.id} className="card" style={{
                                            borderLeft: `5px solid ${submission ? '#27ae60' : late ? '#e74c3c' : '#3498db'}`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <h3 style={{ margin: '0 0 5px 0' }}>{hw.title}</h3>
                                                    <div style={{ fontSize: '13px', color: '#636e72' }}>
                                                        {hw.subject} • Class {hw.class} {hw.section !== 'All' && `- ${hw.section}`}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    background: submission ? '#d4edda' : late ? '#f8d7da' : '#d1ecf1',
                                                    color: submission ? '#155724' : late ? '#721c24' : '#0c5460',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {submission ? '✅ Submitted' : daysLeft}
                                                </div>
                                            </div>

                                            <p style={{ margin: '10px 0', fontSize: '14px' }}>{hw.description}</p>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                                                <div style={{ fontSize: '12px', color: '#999' }}>
                                                    Posted by {hw.teacherName} • {hw.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                </div>

                                                {userData?.role === 'teacher' && (
                                                    <button
                                                        onClick={() => fetchSubmissions(hw.id)}
                                                        className="btn-outline"
                                                        style={{ fontSize: '13px', padding: '5px 10px' }}
                                                    >
                                                        {viewSubmissionId === hw.id ? 'Hide Submissions' : 'View Submissions'}
                                                    </button>
                                                )}

                                                {userData?.role === 'student' && !submission && (
                                                    <button
                                                        onClick={() => setSelectedHomework(hw)}
                                                        className="btn"
                                                        style={{ fontSize: '13px', padding: '6px 15px' }}
                                                    >
                                                        📤 Submit
                                                    </button>
                                                )}
                                            </div>

                                            {/* Teacher Submission View */}
                                            {viewSubmissionId === hw.id && (
                                                <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                                    <h4>Student Submissions ({submissionsData.length})</h4>
                                                    {submissionsData.length === 0 ? (
                                                        <div style={{ color: '#999', padding: '10px' }}>No submissions yet.</div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gap: '10px' }}>
                                                            {submissionsData.map(sub => (
                                                                <div key={sub.id} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                                        <strong>{sub.studentName} <span style={{ color: '#636e72', fontWeight: 'normal' }}>({sub.class})</span></strong>
                                                                        <span style={{ fontSize: '12px', color: '#636e72' }}>
                                                                            {sub.submittedAt?.toDate().toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    {sub.submissionText && (
                                                                        <div style={{ fontSize: '14px', marginBottom: '5px', color: '#2d3436' }}>{sub.submissionText}</div>
                                                                    )}
                                                                    {sub.fileUrl && (
                                                                        <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                            style={{ fontSize: '13px', color: '#0984e3', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                            📎 View Attachment ({sub.fileName || 'File'})
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* SUBMISSION MODAL (Student) */}
                {selectedHomework && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px'
                    }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <h3>Submit: {selectedHomework.title}</h3>

                            <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                                <div style={{ fontSize: '13px', color: '#636e72', marginBottom: '5px' }}>Instructions:</div>
                                <div style={{ fontSize: '14px' }}>{selectedHomework.description}</div>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Your Answer/Solution
                                </label>
                                <textarea
                                    className="input-field"
                                    rows="6"
                                    value={submissionText}
                                    onChange={(e) => setSubmissionText(e.target.value)}
                                    placeholder="Type your answer here or describe what you've attached..."
                                />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Attach File (Image/PDF)
                                </label>
                                <input
                                    type="file"
                                    className="input-field"
                                    onChange={(e) => setSubmissionFile(e.target.files[0])}
                                    accept="image/*,application/pdf"
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        setSelectedHomework(null);
                                        setSubmissionText('');
                                    }}
                                    className="btn-outline"
                                >
                                    Cancel
                                </button>
                                <button onClick={handleSubmitHomework} className="btn">
                                    ✅ Submit Homework
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
