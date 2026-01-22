import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';

export default function InstitutionDetailsAdmin() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [instData, setInstData] = useState(null);
    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        feedbacks: 0
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, teachers, students, feedback

    // Lists for drill-down
    const [teacherList, setTeacherList] = useState([]);
    const [studentList, setStudentList] = useState([]);
    const [feedbackList, setFeedbackList] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Institution Profile
                console.log("Fetching Institution:", id);
                const instRef = doc(db, "institutions", id);
                const instSnap = await getDoc(instRef);
                if (!instSnap.exists()) {
                    alert("Institution not found!");
                    navigate('/admin');
                    return;
                }
                const iData = instSnap.data();
                setInstData(iData);

                // 2. Fetch Students
                try {
                    const studentsSnap = await getDocs(query(collection(db, "users"), where("institutionId", "==", id)));
                    setStats(prev => ({ ...prev, students: studentsSnap.size }));
                    const sList = [];
                    studentsSnap.forEach(d => sList.push({ id: d.id, ...d.data() }));
                    sList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                    setStudentList(sList);
                } catch (e) { console.error("Error fetching students:", e); }

                // 3. Fetch Teachers
                try {
                    const teachersSnap = await getDocs(query(collection(db, "teachers"), where("institutionId", "==", id)));
                    setStats(prev => ({ ...prev, teachers: teachersSnap.size }));
                    const tList = [];
                    teachersSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
                    tList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                    setTeacherList(tList);
                } catch (e) { console.error("Error fetching teachers:", e); }

                // 4. Fetch Feedbacks (Directly targeting this Institution) AND Emergency Reports
                try {
                    console.log("Fetching Feedback & Reports for Target ID:", id);

                    // Parallel Fetch
                    const [feedbacksSnap, reportsSnap] = await Promise.all([
                        getDocs(query(collection(db, "general_feedback"), where("targetId", "==", id))),
                        getDocs(query(collection(db, "emergency_reports"), where("institutionId", "==", id)))
                    ]);

                    console.log("Feedback Count:", feedbacksSnap.size, "Reports Count:", reportsSnap.size);

                    let mergedList = [];

                    // Standard Feedbacks
                    feedbacksSnap.forEach(d => mergedList.push({ id: d.id, isReport: false, ...d.data() }));

                    // Emergency Reports
                    reportsSnap.forEach(d => mergedList.push({ id: d.id, isReport: true, ...d.data() }));

                    // Update stats
                    setStats(prev => ({ ...prev, feedbacks: mergedList.length }));

                    // Sort: Newest First
                    mergedList.sort((a, b) => {
                        const tA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
                        const tB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
                        return tB - tA;
                    });

                    setFeedbackList(mergedList);

                } catch (e) { console.error("Error fetching feedback/reports:", e); }

            } catch (e) {
                console.error("Error in main fetch:", e);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id, navigate]);

    if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading Details...</div>;
    if (!instData) return null;

    return (
        <div className="page-wrapper" style={{ background: '#f1f2f6', minHeight: '100vh', paddingBottom: '30px' }}>
            <AIBadge />
            <AnnouncementBar title="Institution Overview" leftIcon="back" backPath="/admin" />

            <div className="container" style={{ maxWidth: '1000px', margin: '30px auto' }}>

                {/* Header Profile Card */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '30px', marginBottom: '20px' }}>
                    <img
                        src={instData.profileImageURL || "https://via.placeholder.com/150?text=Inst"}
                        alt="Profile"
                        style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #eee' }}
                    />
                    <div>
                        <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>{instData.institutionName || instData.schoolName}</h1>
                        <p style={{ margin: 0, color: '#636e72' }}>Established: {instData.estYear || 'N/A'} • ID: {instData.pid || 'N/A'}</p>
                        <div style={{ marginTop: '10px' }}>
                            <span style={{ background: instData.approved ? '#d4edda' : '#fff3cd', color: instData.approved ? '#155724' : '#856404', padding: '4px 10px', borderRadius: '15px', fontSize: '12px' }}>
                                {instData.approved ? 'Active' : 'Pending Approval'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs - Sticky */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '20px',
                    overflowX: 'auto',
                    position: 'sticky',
                    top: '60px',
                    zIndex: 10,
                    background: '#f1f2f6',
                    padding: '10px 0',
                    borderBottom: '1px solid #dfe6e9'
                }}>
                    {['overview', 'teachers', 'students', 'feedback'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="btn"
                            style={{
                                flex: 1,
                                background: activeTab === tab ? '#0984e3' : 'white',
                                color: activeTab === tab ? 'white' : '#2d3436',
                                border: '1px solid #dfe6e9',
                                textTransform: 'capitalize',
                                whiteSpace: 'nowrap',
                                minWidth: '100px'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Sections */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div className="card">
                            <h3>🏛️ Administration</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>Principal</div>
                                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{instData.principalName}</div>
                                <div style={{ fontSize: '14px' }}>
                                    {instData.principalPhone || instData.phoneNumber || 'No Phone'}
                                    {instData.principalLink && <a href={instData.principalLink} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '12px' }}>View Profile</a>}
                                </div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>Chairman</div>
                                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{instData.chairmanName || 'N/A'}</div>
                                <div style={{ fontSize: '14px' }}>
                                    {instData.chairmanPhone || instData.phoneNumber || 'No Phone'}
                                    {instData.chairmanLink && <a href={instData.chairmanLink} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '12px' }}>View Profile</a>}
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <h3>📍 Location & Safety</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>Address</div>
                                <div>{instData.address || 'Not Provided'}</div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>City/State</div>
                                <div>{instData.city}, {instData.state}</div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>Nearest Police Station</div>
                                <div>{instData.localPoliceName || instData.policeStation || 'Not Listed'}</div>
                                <div>{instData.localPolicePhone}</div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '12px', color: '#b2bec3' }}>Official Contact</div>
                                <div>Ph: {instData.phoneNumber}</div>
                                {instData.whatsappNumber && <div>WA: {instData.whatsappNumber}</div>}
                            </div>
                        </div>

                        <div className="card" onClick={() => setActiveTab('students')} style={{ cursor: 'pointer' }}>
                            <h3>📊 Stats</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span>Total Students</span>
                                <strong>{stats.students}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span>Total Teachers</span>
                                <strong>{stats.teachers}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total Feedbacks</span>
                                <strong>{stats.feedbacks}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* ... (Teachers & Students blocks remain same, skipping them in replacement if possible, but MultiReplace might need exact chunks) */}
                {/* I will use the MultiReplace tool logic effectively or just replace the Overview and Feedback blocks separately if they were contiguous, but they are not. */}
                {/* Actually, I handle 'overview' above. I'll handle 'feedback' in a separate chunk or same tool call. */}

                {activeTab === 'teachers' && (
                    <div className="card">
                        <h3>👨‍🏫 Teachers List ({teacherList.length})</h3>
                        {teacherList.length === 0 ? <p>No teachers found.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: '#f8f9fa' }}><th style={{ padding: '10px', width: '40px' }}>#</th><th style={{ padding: '10px' }}>Name</th><th style={{ padding: '10px' }}>Phone</th><th style={{ padding: '10px' }}>Subject</th></tr>
                                </thead>
                                <tbody>
                                    {teacherList.map((t, index) => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', color: '#636e72', fontWeight: 'bold' }}>{index + 1}</td>
                                            <td style={{ padding: '10px' }}>{t.name || `${t.firstName || ''} ${t.secondName || ''}`.trim() || 'No Name'}</td>
                                            <td style={{ padding: '10px' }}>{t.phone || t.phoneNumber || 'N/A'}</td>
                                            <td style={{ padding: '10px' }}>{t.subject}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'students' && (
                    <div className="card">
                        <h3>🎓 Students List ({studentList.length})</h3>
                        {studentList.length === 0 ? <p>No students found.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: '#f8f9fa' }}><th style={{ padding: '10px', width: '40px' }}>#</th><th style={{ padding: '10px' }}>Name</th><th style={{ padding: '10px' }}>Class</th><th style={{ padding: '10px' }}>Roll No</th></tr>
                                </thead>
                                <tbody>
                                    {studentList.map((s, index) => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', color: '#636e72', fontWeight: 'bold' }}>{index + 1}</td>
                                            <td style={{ padding: '10px' }}>{s.name || `${s.firstName || ''} ${s.secondName || ''}`.trim() || 'No Name'}</td>
                                            <td style={{ padding: '10px' }}>{s.assignedClass || s.class} {s.section}</td>
                                            <td style={{ padding: '10px' }}>{s.rollNumber || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'feedback' && (
                    <div className="card">
                        <h3>💬 Institution Feedback ({feedbackList.length})</h3>
                        {feedbackList.length === 0 ? <p>No feedback received yet.</p> : (
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {feedbackList.map(f => {
                                    if (f.isReport) {
                                        // RENDER RED REPORT CARD
                                        return (
                                            <div key={f.id} style={{ padding: '20px', border: '2px solid #ff7675', borderRadius: '12px', background: '#fff0f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div>
                                                        <strong style={{ color: '#d63031', fontSize: '16px' }}>
                                                            {f.type === 'sexual_harassment' ? '🚨 SEXUAL HARASSMENT REPORT' : '⚠️ MISBEHAVIOR REPORT'}
                                                        </strong>
                                                        <span style={{ display: 'block', fontSize: '13px', color: '#636e72', marginTop: '4px' }}>
                                                            From: {f.authorName || 'Anonymous'} ({f.authorRole})
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#b2bec3' }}>{f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                                </div>

                                                <div style={{ marginBottom: '10px', fontSize: '14px', color: '#2d3436' }}>
                                                    <span style={{ fontWeight: 'bold' }}>Accused:</span> {f.accusedName}
                                                </div>
                                                <div style={{ marginBottom: '10px', fontSize: '14px', color: '#2d3436' }}>
                                                    <span style={{ fontWeight: 'bold' }}>Location:</span> {f.location}
                                                </div>
                                                <div style={{ marginBottom: '10px', fontSize: '14px', color: '#2d3436' }}>
                                                    <span style={{ fontWeight: 'bold' }}>Date/Time:</span> {new Date(f.incidentDate).toLocaleString()}
                                                </div>

                                                <p style={{ margin: '5px 0', background: 'white', padding: '10px', border: '1px solid #ffdcdc', borderRadius: '5px', color: '#d63031' }}>
                                                    "{f.description}"
                                                </p>

                                                {f.evidence && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <a href={f.evidence} target="_blank" rel="noreferrer" style={{ color: '#0984e3', textDecoration: 'underline', fontSize: '14px' }}>View Evidence</a>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        // STANDARD FEEDBACK CARD
                                        return (
                                            <div key={f.id} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div>
                                                        <strong>{f.authorName || "Anonymous"}</strong> <span style={{ fontSize: '12px', color: '#636e72' }}>({f.authorRole || 'User'})</span>
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#b2bec3' }}>{f.timestamp?.seconds ? new Date(f.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                                </div>

                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                                                    {['behavior', 'communication', 'bodyLanguage', 'hardworking'].map(cat => f[cat] ? (
                                                        <span key={cat} style={{ fontSize: '12px', background: '#f1f2f6', padding: '5px 10px', borderRadius: '15px' }}>
                                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}: <strong>{f[cat].stars}★</strong>
                                                        </span>
                                                    ) : null)}
                                                </div>

                                                {f.comment && <p style={{ margin: '5px 0', fontStyle: 'italic', color: '#2d3436' }}>"{f.comment}"</p>}
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
