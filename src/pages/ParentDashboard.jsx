import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export default function ParentDashboard() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);

    // Child's data
    const [attendance, setAttendance] = useState({ present: 0, total: 0 });
    const [recentMarks, setRecentMarks] = useState([]);
    const [fees, setFees] = useState({ total: 0, paid: 0, pending: 0 });
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        if (userData?.role === 'parent') {
            fetchChildren();
        }
    }, [userData]);

    useEffect(() => {
        if (selectedChild) {
            fetchChildData(selectedChild.id);
        }
    }, [selectedChild]);

    const fetchChildren = async () => {
        try {
            // Fetch all students linked to this parent (Query 'users' collection)
            const parentIdentifier = userData.phone || userData.phoneNumber || userData.email;
            if (!parentIdentifier) {
                console.warn("Parent has no phone/email to link children.");
                setLoading(false);
                return;
            }

            console.log("Fetching children for parent:", parentIdentifier);

            // query users where parentPhone == parentIdentifier
            const q = query(
                collection(db, "users"),
                where("parentPhone", "==", parentIdentifier),
                where("role", "==", "student")
            );

            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.data().firstName,
                class: d.data().class || d.data().assignedClass,
                section: d.data().section || d.data().assignedSection || 'A',
                institutionId: d.data().institutionId // Direct from profile
            }));

            setChildren(list);
            if (list.length > 0) {
                setSelectedChild(list[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchChildData = async (studentId) => {
        setLoading(true);
        try {
            // 1. Fetch Attendance
            const attQuery = query(
                collection(db, "attendance"),
                where("studentId", "==", studentId)
            );
            const attSnap = await getDocs(attQuery);
            let present = 0;
            attSnap.forEach(doc => {
                if (doc.data().status === 'present') present++;
            });
            setAttendance({ present, total: attSnap.size });

            // 2. Fetch Recent Marks
            const marksQuery = query(
                collection(db, "marks"),
                where("studentId", "==", studentId),
                orderBy("createdAt", "desc"),
                limit(5)
            );
            const marksSnap = await getDocs(marksQuery);
            setRecentMarks(marksSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // 3. Fetch Fees
            const feesQuery = query(
                collection(db, "fees"),
                where("studentId", "==", studentId)
            );
            const feesSnap = await getDocs(feesQuery);
            let totalFees = 0, paidFees = 0;
            feesSnap.forEach(doc => {
                const data = doc.data();
                totalFees += data.amount || 0;
                if (data.status === 'paid') paidFees += data.amount || 0;
            });
            setFees({ total: totalFees, paid: paidFees, pending: totalFees - paidFees });

            // 4. Fetch Announcements (for child's class)
            if (selectedChild) {
                const annQuery = query(
                    collection(db, "announcements"),
                    where("targetClass", "==", selectedChild.class),
                    orderBy("createdAt", "desc"),
                    limit(20) // Fetch more for client-side filtering
                );
                const annSnap = await getDocs(annQuery);
                const all = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Filter by institutionId
                const filtered = all.filter(a => {
                    if (!a.institutionId) return true; // Legacy support
                    return a.institutionId === selectedChild.institutionId;
                }).slice(0, 5);

                setAnnouncements(filtered);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon, title, value, subtitle, color }) => (
        <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: '1 1 200px',
            borderLeft: `4px solid ${color}`
        }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '13px', color: '#636e72', textTransform: 'uppercase', marginBottom: '5px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3436' }}>{value}</div>
            {subtitle && <div style={{ fontSize: '12px', color: color, marginTop: '5px' }}>{subtitle}</div>}
        </div>
    );

    if (loading && children.length === 0) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>👨‍👩‍👧‍👦</div>
                    <div>Loading...</div>
                </div>
            </div>
        );
    }

    if (children.length === 0) {
        return (
            <div className="page-wrapper">
                <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔗</div>
                    <h2>No Children Linked</h2>
                    <p style={{ color: '#636e72', marginBottom: '20px' }}>
                        Your account is not linked to any student yet.
                    </p>
                    <p style={{ fontSize: '13px', color: '#999' }}>
                        Please contact your school administrator to link your child's account.
                    </p>
                </div>
            </div>
        );
    }

    const attendancePercentage = attendance.total > 0
        ? ((attendance.present / attendance.total) * 100).toFixed(1)
        : 0;

    return (
        <div className="page-wrapper" style={{ background: '#f5f6fa', minHeight: '100vh' }}>
            <div className="container">
                {/* Header */}
                <div style={{ padding: '20px 0', borderBottom: '2px solid #eee', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>👨‍👩‍👧‍👦 Parent Portal</h2>
                    <p style={{ margin: '5px 0 0 0', color: '#636e72' }}>Welcome, {userData?.name || 'Parent'}</p>
                </div>

                {/* Child Selector */}
                {children.length > 1 && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '13px', color: '#636e72', marginBottom: '5px', display: 'block' }}>Select Child:</label>
                        <select
                            className="input-field"
                            value={selectedChild?.id || ''}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value);
                                setSelectedChild(child);
                            }}
                            style={{ maxWidth: '300px' }}
                        >
                            {children.map(child => (
                                <option key={child.id} value={child.id}>
                                    {child.name} - Class {child.class}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedChild && (
                    <>
                        {/* Student Info Card */}
                        <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{
                                    width: '60px', height: '60px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.3)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '24px', fontWeight: 'bold'
                                }}>
                                    {selectedChild.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>{selectedChild.name}</h3>
                                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Class {selectedChild.class} - Section {selectedChild.section}</div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Overview */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                            <StatCard
                                icon="📅"
                                title="Attendance"
                                value={`${attendancePercentage}%`}
                                subtitle={`${attendance.present} / ${attendance.total} days`}
                                color={attendancePercentage >= 75 ? '#27ae60' : attendancePercentage >= 60 ? '#f39c12' : '#e74c3c'}
                            />
                            <StatCard
                                icon="💰"
                                title="Fee Status"
                                value={`₹${fees.pending}`}
                                subtitle={fees.pending === 0 ? 'All Clear!' : 'Pending'}
                                color={fees.pending === 0 ? '#27ae60' : '#e74c3c'}
                            />
                            <StatCard
                                icon="📊"
                                title="Recent Tests"
                                value={recentMarks.length}
                                subtitle="View detailed report"
                                color="#3498db"
                            />
                        </div>

                        {/* Recent Marks */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>📝 Recent Test Results</h3>
                                <button
                                    onClick={() => navigate('/analytics')}
                                    className="btn-outline"
                                    style={{ fontSize: '13px', padding: '6px 12px' }}
                                >
                                    View Full Report
                                </button>
                            </div>

                            {recentMarks.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No test results yet</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead style={{ background: '#f8f9fa' }}>
                                            <tr>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Subject</th>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Exam</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Marks</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentMarks.map(mark => {
                                                const percentage = (mark.marks / mark.maxMarks) * 100;
                                                const color = percentage >= 75 ? '#27ae60' : percentage >= 60 ? '#f39c12' : '#e74c3c';

                                                return (
                                                    <tr key={mark.id} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '10px' }}>{mark.subject}</td>
                                                        <td style={{ padding: '10px', fontSize: '13px', color: '#636e72' }}>{mark.examType}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                                            {mark.marks}/{mark.maxMarks}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            <span style={{
                                                                background: `${color}20`,
                                                                color: color,
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {percentage.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Announcements */}
                        <div className="card">
                            <h3 style={{ marginBottom: '15px' }}>📢 School Announcements</h3>
                            {announcements.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No announcements</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {announcements.map(ann => (
                                        <div key={ann.id} style={{
                                            padding: '12px',
                                            background: '#f8f9fa',
                                            borderRadius: '8px',
                                            borderLeft: '4px solid #3498db'
                                        }}>
                                            <div style={{ fontSize: '14px', marginBottom: '5px' }}>{ann.text}</div>
                                            <div style={{ fontSize: '11px', color: '#999' }}>
                                                By {ann.authorName} • {ann.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => navigate('/analytics')}
                                className="btn"
                                style={{ background: '#9b59b6' }}
                            >
                                📊 Full Performance Report
                            </button>
                            <button
                                onClick={() => {
                                    const message = `Hello, I am ${userData.name}, parent of ${selectedChild.name} (Class ${selectedChild.class}). I would like to discuss...`;
                                    window.open(`https://wa.me/919876543210?text=${encodeURIComponent(message)}`, '_blank');
                                }}
                                className="btn"
                                style={{ background: '#25D366' }}
                            >
                                💬 Contact Teacher
                            </button>
                            {fees.pending > 0 && (
                                <button
                                    onClick={() => navigate('/fees/student')}
                                    className="btn"
                                    style={{ background: '#e74c3c' }}
                                >
                                    💳 Pay Fees (₹{fees.pending})
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
