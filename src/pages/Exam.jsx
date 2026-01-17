import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AnnouncementBar from '../components/AnnouncementBar';

export default function Exam() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // Opportunities List (for Students)
    const [opportunities, setOpportunities] = useState([]);

    useEffect(() => {
        const fetchOpp = async () => {
            try {
                const q = query(collection(db, "opportunities"), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
        };
        fetchOpp();
    }, []);

    const [formData, setFormData] = useState({
        title: '',
        category: 'Govt Scholarship',
        description: '',
        link: '',
        target: 'all',
        deadline: ''
    });
    const [sendNotification, setSendNotification] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSend = async () => {
        if (!formData.title || !formData.description) return alert("Please fill Title and Description.");

        setLoading(true);
        try {
            // 1. Create the Opportunity Document (Structured Data)
            await addDoc(collection(db, "opportunities"), {
                ...formData,
                createdAt: serverTimestamp(),
                postedBy: 'institution'
            });

            // 2. (Optional) Push to Announcement Bar
            if (sendNotification) {
                const notifText = `🆕 New Opportunity: ${formData.title} (${formData.category}). Check details!`;
                await addDoc(collection(db, "announcements"), {
                    text: notifText,
                    target: formData.target,
                    createdAt: serverTimestamp(),
                    active: true
                });
            }

            alert("Opportunity Posted Successfully!");
            setFormData({ title: '', category: 'Govt Scholarship', description: '', link: '', target: 'all', deadline: '' });
        } catch (e) {
            console.error(e);
            alert("Failed to post opportunity.");
        } finally {
            setLoading(false);
        }
    };

    const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' or 'results'

    // ... existing handlers ...

    // New Handler for Results (Placeholder)
    // Result Form State
    const [resultData, setResultData] = useState({
        exam: '',
        class: '10-A',
        subject: 'Math',
        studentName: '',
        marks: '',
        total: '100'
    });

    const handlePublishResult = async () => {
        if (!resultData.exam || !resultData.studentName || !resultData.marks) {
            return alert("Please fill all fields (Exam, Student, Marks).");
        }

        setLoading(true);
        try {
            await addDoc(collection(db, "results"), {
                ...resultData,
                marks: Number(resultData.marks),
                total: Number(resultData.total),
                publishedAt: serverTimestamp()
            });
            alert("Result Published Successfully! 💾");
            // Clear crucial fields
            setResultData(prev => ({ ...prev, studentName: '', marks: '' }));
        } catch (e) {
            console.error(e);
            alert("Error publishing result: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Demo Data State
    const [dummyResults, setDummyResults] = useState([]);

    const loadDemoData = () => {
        setDummyResults([
            { exam: "Mid-Term 2024", class: "10-A", student: "Rahul Sharma", marks: 85, total: 100 },
            { exam: "Mid-Term 2024", class: "10-A", student: "Vikram Singh", marks: 42, total: 100 },
            { exam: "Unit Test 1", class: "9-B", student: "Anjali Gupta", marks: 28, total: 50 },
            { exam: "Quarterly", class: "8-A", student: "Rohan Das", marks: 12, total: 100 } // Fail case
        ]);
        alert("Dummy results loaded!");
    };

    // Student View: Read-Only Opportunities
    if (userData?.role === 'student') {
        return (
            <div className="page-wrapper">
                <AnnouncementBar title="Scholarships & Exams 🎓" leftIcon="back" />
                <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>

                    {opportunities.length === 0 ? (
                        <div className="card text-center text-muted">No opportunities posted yet.</div>
                    ) : (
                        opportunities.map(op => (
                            <div key={op.id} className="card" style={{ marginBottom: '15px', borderLeft: '4px solid #6c5ce7' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#2d3436' }}>{op.title}</h3>
                                    <span style={{ fontSize: '12px', background: '#ffeaa7', padding: '4px 8px', borderRadius: '4px' }}>{op.category}</span>
                                </div>
                                <p style={{ color: '#636e72', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{op.description}</p>

                                <div style={{ marginTop: '15px', display: 'flex', gap: '15px', fontSize: '13px', color: '#b2bec3' }}>
                                    {op.deadline && <span>📅 Deadline: {op.deadline}</span>}
                                    {op.link && (
                                        <a href={op.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0984e3', textDecoration: 'underline' }}>
                                            🔗 Apply Link
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '40px auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>Back</button>
            </div>

            <div className="card">
                <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: '20px' }}>
                    <button
                        style={{ flex: 1, padding: '15px', background: activeTab === 'announcements' ? '#6c5ce7' : 'none', color: activeTab === 'announcements' ? 'white' : 'black', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setActiveTab('announcements')}
                    >
                        📢 Announcements & Scholarships
                    </button>
                    <button
                        style={{ flex: 1, padding: '15px', background: activeTab === 'results' ? '#0984e3' : 'none', color: activeTab === 'results' ? 'white' : 'black', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setActiveTab('results')}
                    >
                        📝 Publish Exam Results
                    </button>
                </div>

                {activeTab === 'announcements' ? (
                    <>
                        <h2 className="text-center" style={{ color: '#2c3e50' }}>🎓 Post Scholarship & Exam Updates</h2>
                        <p className="text-center text-muted">Create awareness about Government/Private Scholarships and Entrance Tests.</p>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold' }}>Title of Opportunity</label>
                            <input className="input-field" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. National Talent Search Exam 2024" />
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold' }}>Category</label>
                            <select className="input-field" name="category" value={formData.category} onChange={handleChange}>
                                <option>Govt Scholarship</option>
                                <option>Private Scholarship</option>
                                <option>Entrance Test</option>
                                <option>Other Competition</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold' }}>Audience</label>
                            <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                                <label><input type="radio" name="target" value="all" checked={formData.target === 'all'} onChange={handleChange} /> Everyone</label>
                                <label><input type="radio" name="target" value="students" checked={formData.target === 'students'} onChange={handleChange} /> Students</label>
                                <label><input type="radio" name="target" value="teachers" checked={formData.target === 'teachers'} onChange={handleChange} /> Teachers</label>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold' }}>Description / Eligibility</label>
                            <textarea className="input-field" name="description" value={formData.description} onChange={handleChange} placeholder="Who can apply? What are the benefits?" style={{ height: '100px' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>External Link (Optional)</label>
                                <input className="input-field" name="link" value={formData.link} onChange={handleChange} placeholder="https://..." />
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Deadline (Optional)</label>
                                <input type="date" className="input-field" name="deadline" value={formData.deadline} onChange={handleChange} />
                            </div>
                        </div>

                        <div style={{ margin: '20px 0', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="checkbox" checked={sendNotification} onChange={(e) => setSendNotification(e.target.checked)} />
                                <span>🔔 Also broadcast to scrolling Announcement Bar?</span>
                            </label>
                        </div>

                        <button
                            className="btn"
                            style={{ width: '100%', backgroundColor: '#6c5ce7' }}
                            onClick={handleSend}
                            disabled={loading}
                        >
                            {loading ? 'Posting...' : '🚀 Publish Opportunity'}
                        </button>
                    </>
                ) : (
                    <div className="results-form">
                        <h2 className="text-center" style={{ color: '#2c3e50' }}>📝 Publish Class Results</h2>
                        <p className="text-center text-muted">Upload marks for exams (e.g. Mid-Term, Finals)</p>

                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label>Exam Name</label>
                            <input className="input-field" placeholder="e.g. Half-Yearly Exam 2024" value={resultData.exam} onChange={e => setResultData({ ...resultData, exam: e.target.value })} />
                        </div>

                        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                            <div>
                                <label>Class</label>
                                <select className="input-field" value={resultData.class} onChange={e => setResultData({ ...resultData, class: e.target.value })}>
                                    {['1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label>Subject</label>
                                <select className="input-field" value={resultData.subject} onChange={e => setResultData({ ...resultData, subject: e.target.value })}>
                                    {['Math', 'Science', 'English', 'Social', 'Hindi'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                            <h4>Student Marks Entry</h4>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                <input className="input-field" placeholder="Student Name / Roll No" style={{ flex: 2 }} value={resultData.studentName} onChange={e => setResultData({ ...resultData, studentName: e.target.value })} />
                                <input className="input-field" placeholder="Marks Obtained" type="number" style={{ flex: 1 }} value={resultData.marks} onChange={e => setResultData({ ...resultData, marks: e.target.value })} />
                                <input className="input-field" placeholder="Total Marks" type="number" style={{ flex: 1 }} value={resultData.total} onChange={e => setResultData({ ...resultData, total: e.target.value })} />
                            </div>

                            <button className="btn" style={{ width: '100%', backgroundColor: '#0984e3' }} onClick={handlePublishResult}>
                                💾 Save Result
                            </button>
                        </div>

                        {/* Recent Results Table (Demo) */}
                        <div style={{ marginTop: '30px' }}>
                            <h4>📊 Recently Published Results</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '10px' }}>
                                <thead>
                                    <tr style={{ background: '#f1f2f6', textAlign: 'left' }}>
                                        <th style={{ padding: '8px' }}>Exam</th>
                                        <th style={{ padding: '8px' }}>Class</th>
                                        <th style={{ padding: '8px' }}>Student</th>
                                        <th style={{ padding: '8px' }}>Marks</th>
                                        <th style={{ padding: '8px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(dummyResults.length > 0 ? dummyResults : []).map((res, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>{res.exam}</td>
                                            <td style={{ padding: '8px' }}>{res.class}</td>
                                            <td style={{ padding: '8px' }}>{res.student}</td>
                                            <td style={{ padding: '8px' }}>{res.marks}/{res.total}</td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{ color: res.marks / res.total >= 0.35 ? 'green' : 'red', fontWeight: 'bold' }}>
                                                    {res.marks / res.total >= 0.35 ? 'Pass' : 'Fail'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {dummyResults.length === 0 && (
                                        <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No results yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                            <button className="btn" style={{ marginTop: '15px', backgroundColor: '#fab1a0', color: '#2d3436' }} onClick={loadDemoData}>
                                🧪 Load Dummy Results
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
