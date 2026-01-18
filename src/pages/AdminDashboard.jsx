import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        institutions: 0,
        feedbacks: 0
    });
    const [pendingInstitutions, setPendingInstitutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const fetchGlobalStats = async () => {
            // Parallel Fetch for Speed
            try {
                const [usersSnap, instSnap, teacherSnap, feedbackSnap] = await Promise.all([
                    getDocs(collection(db, "users")), // Mostly students
                    getDocs(collection(db, "institutions")),
                    getDocs(collection(db, "teachers")),
                    getDocs(collection(db, "general_feedback"))
                ]);

                setStats({
                    students: usersSnap.size, // Approximation as 'users' holds students
                    teachers: teacherSnap.size,
                    institutions: instSnap.size,
                    feedbacks: feedbackSnap.size
                });

                // Pending Institutions Logic (if we had an 'approved' field)
                const pending = [];
                instSnap.forEach(d => {
                    const data = d.data();
                    if (data.approved === false) {
                        pending.push({ id: d.id, ...data });
                    }
                });
                setPendingInstitutions(pending);

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
            setPendingInstitutions(prev => prev.filter(i => i.id !== id));
            alert("Institution Approved!");
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    return (
        <div className="page-wrapper" style={{ background: '#f1f2f6', minHeight: '100vh' }}>
            <AIBadge />
            <AnnouncementBar title="Administrator Dashboard" />

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
                    <div className="card text-center" style={{ padding: '30px', borderLeft: '5px solid #d63031' }}>
                        <div style={{ fontSize: '40px', color: '#d63031' }}>🏫</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.institutions}</h2>
                        <span style={{ color: '#636e72' }}>Institutions</span>
                    </div>
                    <div className="card text-center" style={{ padding: '30px', borderLeft: '5px solid #fdcb6e' }}>
                        <div style={{ fontSize: '40px', color: '#fdcb6e' }}>💬</div>
                        <h2 style={{ margin: '10px 0', fontSize: '30px' }}>{stats.feedbacks}</h2>
                        <span style={{ color: '#636e72' }}>Total Feedbacks</span>
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
                                {pendingInstitutions.map(inst => (
                                    <div key={inst.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '15px', borderBottom: '1px solid #eee'
                                    }}>
                                        <div>
                                            <strong>{inst.schoolName || inst.name}</strong>
                                            <div style={{ fontSize: '12px' }}>{inst.principalName}</div>
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
                            <button className="btn" style={{ background: '#636e72' }} onClick={() => navigate('/general-feedback')}>
                                📄 View Global Feedbacks
                            </button>
                            <button className="btn" style={{ background: '#2d3436' }}>
                                🔧 Site Settings (Coming Soon)
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
