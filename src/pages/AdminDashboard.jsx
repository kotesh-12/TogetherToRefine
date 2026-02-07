import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, getDoc, addDoc } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        institutions: 0,
        feedbacks: 0,
        totalFees: 0,
        collectedFees: 0
    });
    const [pendingInstitutions, setPendingInstitutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [allInstitutions, setAllInstitutions] = useState([]);
    const [showInstModal, setShowInstModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [allFeedbacks, setAllFeedbacks] = useState([]);
    const [message, setMessage] = useState('');
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

    const handlePostAnnouncement = async () => {
        const text = message.trim();
        if (!text) return alert("Please enter text.");
        try {
            await addDoc(collection(db, "announcements"), {
                text,
                createdAt: new Date(),
                authorName: "Announcement",
                type: 'global'
            });
            alert("Announcement Posted!");
            setMessage('');
            setShowAnnouncementModal(false);
        } catch (e) {
            console.error(e);
            alert("Error posting.");
        }
    };

    // Fetch Feedbacks when Modal Opens
    useEffect(() => {
        if (!showFeedbackModal) return;

        const fetchAllFeedbacks = async () => {
            // 1. Fetch General Feedbacks
            // 2. Fetch Emergency Reports
            try {
                const [fbSnap, repSnap] = await Promise.all([
                    getDocs(query(collection(db, "general_feedback"), orderBy("timestamp", "desc"))),
                    getDocs(query(collection(db, "emergency_reports"), orderBy("createdAt", "desc")))
                ]);

                let merged = [];
                fbSnap.forEach(d => merged.push({ id: d.id, isReport: false, ...d.data() }));
                repSnap.forEach(d => merged.push({ id: d.id, isReport: true, ...d.data(), timestamp: d.data().createdAt }));

                // Sort merged list
                merged.sort((a, b) => {
                    const tA = a.timestamp?.seconds || 0;
                    const tB = b.timestamp?.seconds || 0;
                    return tB - tA;
                });

                setAllFeedbacks(merged);
            } catch (e) {
                console.error("Error fetching all feedbacks", e);
            }
        };

        fetchAllFeedbacks();
    }, [showFeedbackModal]);

    useEffect(() => {
        const fetchGlobalStats = async () => {
            try {
                // ... (existing imports)
                const [usersSnap, instSnap, teacherSnap, feedbackSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(collection(db, "institutions")),
                    getDocs(collection(db, "teachers")),
                    getDocs(collection(db, "general_feedback"))
                ]);

                setStats({
                    students: usersSnap.size,
                    teachers: teacherSnap.size,
                    institutions: instSnap.size,
                    inputs: instSnap.size,
                    feedbacks: feedbackSnap.size
                });

                // Fee Stats
                let total = 0;
                let collected = 0;
                const feesSnap = await getDocs(collection(db, "fees"));
                feesSnap.forEach(d => {
                    const data = d.data();
                    total += Number(data.amount || 0);
                    if (data.status === 'paid') {
                        collected += Number(data.amount || 0);
                    }
                });

                setStats(prev => ({ ...prev, totalFees: total, collectedFees: collected }));

                // Pending Institutions Logic & All Institutions
                const pending = [];
                const allInst = [];
                instSnap.forEach(d => {
                    const data = d.data();
                    allInst.push({ id: d.id, ...data });
                    if (data.approved === false) {
                        pending.push({ id: d.id, ...data });
                    }
                });
                setPendingInstitutions(pending.sort((a, b) => (a.schoolName || a.name || "").localeCompare(b.schoolName || b.name || "")));
                setAllInstitutions(allInst.sort((a, b) => (a.schoolName || a.name || "").localeCompare(b.schoolName || b.name || "")));

            } catch (e) {
                console.error("Admin stats error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchGlobalStats();
    }, []);

    const approveInstitution = async (id) => {
        if (!confirm("Approve this Institution?")) return;
        try {
            await updateDoc(doc(db, "institutions", id), { approved: true });

            // 1. Remove from Pending List
            setPendingInstitutions(prev => prev.filter(i => i.id !== id));

            // 2. Update status in All Institutions List (Fixes View button issue)
            setAllInstitutions(prev => prev.map(inst =>
                inst.id === id ? { ...inst, approved: true } : inst
            ));

            alert("Institution Approved!");
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    const deleteInstitution = async (id) => {
        if (!confirm("Are you sure you want to DELETE this institution? This action cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "institutions", id));
            setAllInstitutions(prev => prev.filter(i => i.id !== id));
            setPendingInstitutions(prev => prev.filter(i => i.id !== id));
            setStats(prev => ({ ...prev, institutions: prev.institutions - 1 }));
            alert("Institution Deleted Successfully.");
        } catch (e) {
            console.error(e);
            alert("Error deleting: " + e.message);
        }
    };

    if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading Admin Dashboard...</div>;

    return (
        <div className="page-wrapper" style={{ position: 'relative', background: '#f1f2f6', minHeight: '100vh', paddingBottom: '20px' }}>
            <AIBadge />

            {/* Notification (Announcement) Icon - Moved to Left Side below Home Button (Absolute) */}
            <div style={{ position: 'absolute', top: '150px', left: '20px', zIndex: 90 }}>
                <button
                    onClick={() => setShowAnnouncementModal(true)}
                    style={{
                        width: '50px', height: '50px', borderRadius: '50%',
                        background: '#fff', border: 'none',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '24px', cursor: 'pointer', color: '#0984e3',
                        transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title="Post Notification"
                >
                    📢
                </button>
            </div>

            <div className="container" style={{ maxWidth: '1100px', margin: '30px auto' }}>



                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    <div className="card text-center" style={{ padding: '30px', borderLeft: '5px solid #0984e3' }}>
                        <div style={{ fontSize: '40px', color: '#0984e3' }}>🎓</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.students}</h2>
                        <span style={{ color: '#636e72' }}>Students</span>
                    </div>
                    <div className="card text-center" style={{ padding: '30px', borderLeft: '5px solid #00b894' }}>
                        <div style={{ fontSize: '40px', color: '#00b894' }}>👨‍🏫</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.teachers}</h2>
                        <span style={{ color: '#636e72' }}>Teachers</span>
                    </div>
                    <div className="card text-center"
                        onClick={() => setShowInstModal(true)}
                        style={{ padding: '30px', borderLeft: '5px solid #d63031', cursor: 'pointer', transition: 'transform 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ fontSize: '40px', color: '#d63031' }}>🏫</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.institutions}</h2>
                        <span style={{ color: '#636e72' }}>Institutions</span>
                        <div style={{ fontSize: '12px', color: '#b2bec3', marginTop: '5px' }}>Click to view details</div>
                    </div>
                    <div className="card text-center"
                        onClick={() => setShowFeedbackModal(true)}
                        style={{ padding: '30px', borderLeft: '5px solid #fdcb6e', cursor: 'pointer', transition: 'transform 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ fontSize: '40px', color: '#fdcb6e' }}>💬</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.feedbacks}</h2>
                        <span style={{ color: '#636e72' }}>Total Feedbacks</span>
                        <div style={{ fontSize: '12px', color: '#b2bec3', marginTop: '5px' }}>Click to view all</div>
                    </div>
                </div>

                {/* Dashboard Controls */}
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div className="card" style={{ flex: 1 }}>
                        <h3>Pending Actions</h3>
                        {pendingInstitutions.length === 0 ? (
                            <p style={{ color: '#b2bec3' }}>No pending institutions to approve.</p>
                        ) : (
                            <div>
                                {pendingInstitutions.map((inst, index) => (
                                    <div key={inst.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '15px', borderBottom: '1px solid #eee'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#636e72', minWidth: '20px' }}>{index + 1}.</span>
                                            <div>
                                                <strong>{inst.schoolName || inst.name}</strong>
                                                <div style={{ fontSize: '12px' }}>{inst.principalName}</div>
                                            </div>
                                        </div>
                                        <button className="btn" style={{ padding: '5px 15px', fontSize: '12px' }} onClick={() => approveInstitution(inst.id)}>Approve</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ flex: 1 }}>
                        <h3>System Tools</h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {/* Removed generic view button as the card is now clickable */}
                            <button className="btn" style={{ background: '#2d3436' }}>
                                🔧 Site Settings (Coming Soon)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Announcement Poster */}
                <div className="card" style={{ marginTop: '20px' }}>
                    <h3>📢 Post Global Announcement</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            placeholder="Type announcement here..."
                            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}
                            id="announcementInput"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                        <button
                            className="btn"
                            style={{ background: '#0984e3' }}
                            onClick={async () => {
                                const text = message.trim(); // Use state variable
                                if (!text) return alert("Please enter text.");
                                try {
                                    await addDoc(collection(db, "announcements"), {
                                        text,
                                        createdAt: new Date(),
                                        authorName: "Announcement",
                                        type: 'global'
                                    });
                                    alert("Announcement Posted!");
                                    setMessage(''); // Clear state variable
                                } catch (e) {
                                    console.error(e);
                                    alert("Error posting.");
                                }
                            }}
                        >
                            Post
                        </button>
                    </div>
                </div>

            </div>

            {/* Feedback List Modal */}
            {showFeedbackModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
                        <button
                            onClick={() => setShowFeedbackModal(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer'
                            }}
                        >
                            &times;
                        </button>
                        <h2 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Global Feedback & Reports</h2>

                        <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
                            {allFeedbacks.length === 0 ? <p className="text-center text-muted">Loading or No Feedbacks...</p> : allFeedbacks.map(f => {
                                if (f.isReport) {
                                    // Emergency Report Card
                                    return (
                                        <div key={f.id} style={{ padding: '20px', border: '2px solid #ff7675', borderRadius: '12px', background: '#fff0f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <div>
                                                    <strong style={{ color: '#d63031', fontSize: '16px' }}>
                                                        {f.type === 'sexual_harassment' ? '🚨 SEXUAL HARASSMENT REPORT' : '⚠️ MISBEHAVIOR REPORT'}
                                                    </strong>
                                                    <span style={{ display: 'block', fontSize: '13px', color: '#636e72', marginTop: '4px' }}>
                                                        From: {f.authorName || 'Anonymous'} | Inst: {f.institutionName || 'Unknown'}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#b2bec3' }}>{f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                            </div>

                                            <div style={{ marginBottom: '5px' }}><strong>Accused:</strong> {f.accusedName}</div>
                                            <div style={{ marginBottom: '10px' }}><strong>Location:</strong> {f.location}</div>

                                            <p style={{ margin: '5px 0', background: 'white', padding: '10px', border: '1px solid #ffdcdc', borderRadius: '5px', color: '#d63031' }}>
                                                "{f.description}"
                                            </p>
                                        </div>
                                    );
                                } else {
                                    // Standard Feedback Card
                                    return (
                                        <div key={f.id} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px', background: '#f9f9f9' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <div>
                                                    <strong>{f.authorName || "Anonymous"}</strong> <span style={{ fontSize: '12px', color: '#636e72' }}> to {f.targetName || 'Institution'}</span>
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#b2bec3' }}>{f.timestamp?.seconds ? new Date(f.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                            </div>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                                                {['behavior', 'communication', 'bodyLanguage', 'hardworking'].map(cat => f[cat] ? (
                                                    <span key={cat} style={{ fontSize: '12px', background: '#e3f2fd', padding: '5px 10px', borderRadius: '15px' }}>
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
                    </div>
                </div>
            )}

            {/* Institution List Modal */}
            {showInstModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                        <button
                            onClick={() => setShowInstModal(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer'
                            }}
                        >
                            &times;
                        </button>
                        <h2 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Registered Institutions ({allInstitutions.length})</h2>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                                    <th style={{ padding: '10px', width: '40px' }}>#</th>
                                    <th style={{ padding: '10px' }}>Name</th>
                                    <th style={{ padding: '10px' }}>Principal</th>
                                    <th style={{ padding: '10px' }}>Est. Year</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allInstitutions.map((inst, index) => (
                                    <tr key={inst.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '10px', color: '#636e72', fontWeight: 'bold' }}>{index + 1}</td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {inst.profileImageURL ? (
                                                    <img src={inst.profileImageURL} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏫</div>
                                                )}
                                                <strong>{inst.institutionName || inst.schoolName}</strong>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>{inst.principalName}</td>
                                        <td style={{ padding: '10px' }}>{inst.estYear}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '12px', fontSize: '12px',
                                                background: inst.approved ? '#d4edda' : '#fff3cd',
                                                color: inst.approved ? '#155724' : '#856404'
                                            }}>
                                                {inst.approved ? 'Active' : 'Pending'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {!inst.approved && (
                                                    <button className="btn" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => approveInstitution(inst.id)}>Approve</button>
                                                )}
                                                {inst.approved && (
                                                    <button className="btn" style={{ padding: '5px 10px', fontSize: '12px', background: '#b2bec3' }} onClick={() => navigate(`/admin/institution/${inst.id}`)}>View</button>
                                                )}
                                                <button className="btn" style={{ padding: '5px 10px', fontSize: '12px', background: '#d63031', color: 'white' }} onClick={() => deleteInstitution(inst.id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {allInstitutions.length === 0 && <p className="text-center text-muted">No institutions found.</p>}
                    </div>
                </div>
            )}

            {/* Announcement Modal */}
            {showAnnouncementModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px', position: 'relative', padding: '25px' }}>
                        <button
                            onClick={() => setShowAnnouncementModal(false)}
                            style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#636e72'
                            }}
                        >
                            &times;
                        </button>
                        <h3 style={{ marginTop: 0, textAlign: 'center', color: '#2d3436' }}>📢 Post Global Notification</h3>
                        <p className="text-center text-muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
                            This announcement will be visible to ALL users (Students, Teachers, Institutions).
                        </p>

                        <textarea
                            className="input-field"
                            rows="5"
                            placeholder="Type your announcement here..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' }}
                        />

                        <button
                            className="btn"
                            onClick={handlePostAnnouncement}
                            style={{ width: '100%', marginTop: '15px', background: '#0984e3', padding: '12px' }}
                        >
                            Post Announcement
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
