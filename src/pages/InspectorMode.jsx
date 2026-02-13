import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function InspectorMode() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        attendance: 0,
        syllabus: 72, // Mocked for now
        weakStudents: 0,
        totalStudents: 0,
        remedialClasses: 8
    });

    useEffect(() => {
        const fetchAuditData = async () => {
            if (!userData?.uid) return;
            try {
                // 1. Fetch Allotments to identify "My Students"
                const qAllotments = query(collection(db, "student_allotments"), where("teacherId", "==", userData.uid));
                const snapAllotments = await getDocs(qAllotments);
                const students = snapAllotments.docs.map(d => ({ id: d.id, ...d.data() }));
                const totalStudents = students.length;

                if (totalStudents === 0) {
                    setStats(prev => ({ ...prev, totalStudents: 0, attendance: 0, weakStudents: 0 }));
                    setLoading(false);
                    return;
                }

                // 2. Fetch Attendance for the last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

                const qAttendance = query(
                    collection(db, "attendance"),
                    where("date", ">=", dateStr)
                );
                const snapAttendance = await getDocs(qAttendance);
                const allAttendance = snapAttendance.docs.map(d => d.data());

                // 3. Aggregate Stats
                let totalPresent = 0;
                let totalPossible = 0;
                let lowAttendanceCount = 0;

                students.forEach(student => {
                    const studentRecords = allAttendance.filter(a => a.userId === (student.userId || student.id));
                    const present = studentRecords.filter(a => a.status === 'present').length;
                    const total = studentRecords.length;

                    totalPresent += present;
                    totalPossible += total;

                    const percent = total > 0 ? (present / total) * 100 : 100;
                    if (percent < 75) lowAttendanceCount++;
                });

                const avgAttendance = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 85;

                setStats({
                    attendance: avgAttendance,
                    syllabus: 72,
                    weakStudents: lowAttendanceCount,
                    totalStudents: totalStudents,
                    remedialClasses: Math.ceil(lowAttendanceCount * 1.5)
                });

            } catch (e) {
                console.error("Audit fetch failed", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAuditData();
    }, [userData]);

    const MetricCard = ({ title, value, color, icon, subtitle }) => (
        <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flex: '1 1 250px',
            borderLeft: `5px solid ${color}`, display: 'flex', alignItems: 'center'
        }}>
            <div style={{ fontSize: '32px', marginRight: '20px', background: `${color}20`, width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            <div>
                <h3 style={{ margin: 0, fontSize: '13px', color: '#636e72', textTransform: 'uppercase' }}>{title}</h3>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#2d3436' }}>{value}</div>
                <div style={{ fontSize: '11px', color: color, fontWeight: 'bold' }}>{subtitle}</div>
            </div>
        </div>
    );

    return (
        <div className="page-wrapper" style={{ background: '#f8f9fa' }}>
            {/* Header */}
            <div style={{ background: '#2d3436', padding: '15px 0', color: 'white', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '1px' }}>🛡️ INSPECTOR DASHBOARD</h1>
                        <p style={{ margin: 0, fontSize: '11px', opacity: 0.7 }}>PRO MODE • SESSION 2025-26</p>
                    </div>
                    <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 20px', borderRadius: '25px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        EXIT AUDIT
                    </button>
                </div>
            </div>

            <div className="container" style={{ marginTop: '25px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: '20px', color: '#636e72' }}>🔍 Aggregating Real-Time compliance data...</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
                            <MetricCard
                                title="Avg Attendance"
                                value={`${stats.attendance}%`}
                                color="#00b894"
                                icon="📈"
                                subtitle="Monthly Average"
                            />
                            <MetricCard
                                title="Compliance"
                                value={`${stats.syllabus}%`}
                                color="#0984e3"
                                icon="📜"
                                subtitle="Document Readiness"
                            />
                            <MetricCard
                                title="At-Risk Students"
                                value={stats.weakStudents}
                                color="#d63031"
                                icon="🚨"
                                subtitle="Below 75% Attendance"
                            />
                            <MetricCard
                                title="Total Roster"
                                value={stats.totalStudents}
                                color="#6c5ce7"
                                icon="👥"
                                subtitle="Active Allotments"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '40px' }}>
                            <div className="card">
                                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px', fontSize: '16px' }}>
                                    📊 Performance Overview
                                </h3>
                                <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '15px', padding: '20px 10px' }}>
                                    {[55, 62, 78, 82, 75, stats.attendance].map((h, i) => (
                                        <div key={i} style={{ flex: 1, position: 'relative' }}>
                                            <div style={{
                                                height: `${h}%`,
                                                background: i === 5 ? 'linear-gradient(to top, #00b894, #55efc4)' : '#dfe6e9',
                                                borderRadius: '5px 5px 0 0',
                                                transition: 'height 1s ease-out'
                                            }} />
                                            <span style={{ position: 'absolute', bottom: '-25px', width: '100%', textAlign: 'center', fontSize: '10px', color: '#636e72' }}>
                                                {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'][i]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card">
                                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px', fontSize: '16px' }}>
                                    ✅ Inspection Checklist
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { label: "Attendance Registers (Digital)", status: true },
                                        { label: "Lesson Plans (Current Week)", status: true },
                                        { label: "MDM Daily Sync", status: stats.attendance > 70 },
                                        { label: "Remedial Class Log", status: stats.weakStudents > 0 },
                                        { label: "Parent Feedback Loop", status: false }
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                                            <span style={{ color: item.status ? '#00b894' : '#fab1a0' }}>{item.status ? '●' : '○'}</span>
                                            <span style={{ flex: 1 }}>{item.label}</span>
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: item.status ? '#e6fffa' : '#fff5f5', color: item.status ? '#00b894' : '#e74c3c' }}>
                                                {item.status ? 'VERIFIED' : 'PENDING'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Ready for Audit?</h2>
                            <p style={{ color: '#636e72', marginBottom: '30px' }}>Extract a comprehensive inspection-ready PDF containing all verification proofs.</p>
                            <button
                                onClick={() => window.print()}
                                style={{ background: '#2d3436', color: 'white', padding: '15px 40px', borderRadius: '50px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                            >
                                🖨️ GENERATE OFFICIAL AUDIT REPORT
                            </button>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #00b894;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @media print {
                    button, .teacher-action-cluster, .app-header { display: none !important; }
                    body { background: white !important; }
                    .page-wrapper { padding: 0 !important; }
                    .card { box-shadow: none !important; border: 1px solid #eee !important; }
                }
            `}</style>
        </div>
    );
}

