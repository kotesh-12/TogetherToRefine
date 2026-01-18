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
    const [allInstitutions, setAllInstitutions] = useState([]);
    const [showInstModal, setShowInstModal] = useState(false);

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
                    feedbacks: feedbackSnap.size
                });

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
                setPendingInstitutions(pending);
                setAllInstitutions(allInst);

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
        <div className="page-wrapper" style={{ background: '#f1f2f6', minHeight: '100vh', paddingBottom: '20px' }}>
            <AIBadge />
            <AnnouncementBar title="Administrator Dashboard" leftIcon="home" />

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
                                    <th style={{ padding: '10px' }}>Name</th>
                                    <th style={{ padding: '10px' }}>Principal</th>
                                    <th style={{ padding: '10px' }}>Est. Year</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allInstitutions.map(inst => (
                                    <tr key={inst.id} style={{ borderBottom: '1px solid #eee' }}>
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
                                                    <button className="btn" style={{ padding: '5px 10px', fontSize: '12px', background: '#b2bec3' }}>View</button>
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
        </div>
    );
}
