import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function EarlyWarningSystem() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [loading, setLoading] = useState(true);
    const [atRiskStudents, setAtRiskStudents] = useState([]);

    useEffect(() => {
        const analyzeStudents = async () => {
            try {
                // 1. Fetch teacher's assigned students
                const q = query(collection(db, "student_allotments"), where("teacherId", "==", userData.uid));
                const snap = await getDocs(q);

                const studentList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const results = [];

                // 2. FOR EACH STUDENT: Fetch attendance records and calculate percentage
                for (const student of studentList) {
                    const targetId = student.userId || student.id;
                    const attQuery = query(collection(db, "attendance"), where("userId", "==", targetId));
                    const attSnap = await getDocs(attQuery);

                    const total = attSnap.size;
                    let present = 0;
                    attSnap.forEach(doc => {
                        if (doc.data().status === 'present') present++;
                    });

                    const percentage = total > 0 ? (present / total) * 100 : 100; // Assume 100% if no records yet

                    // 3. APPLY RISK CRITERIA: < 50% attendance is High Risk
                    if (percentage < 50 || total === 0) {
                        results.push({
                            id: student.id,
                            name: student.name || student.studentName || "Unknown Student",
                            class: student.classAssigned,
                            attendancePercentage: percentage.toFixed(0),
                            totalClasses: total,
                            riskScore: percentage < 50 ? 90 : 10,
                            riskFactors: [
                                percentage < 50 ? `Critical: Attendance dropped to ${percentage.toFixed(0)}%` : "No attendance records found yet",
                                total < 5 && total > 0 ? "Insufficient data for long-term prediction" : null
                            ].filter(Boolean),
                            parentPhone: student.parentPhone || student.phone || "N/A"
                        });
                    }
                }

                setAtRiskStudents(results);
            } catch (e) {
                console.error("Analysis Error:", e);
            } finally {
                setLoading(false);
            }
        };

        if (userData?.uid) analyzeStudents();
    }, [userData]);

    const handleWhatsApp = (student) => {
        const message = `Namaste. This is ${userData.name} from school. I am worried about ${student.name}'s attendance. Please call me.`;
        const url = `https://wa.me/${student.parentPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="page-wrapper" style={{ background: '#fff0f0', minHeight: '100vh' }}>
            <div className="container">
                <div style={{ padding: '20px 0', borderBottom: '1px solid #ffcccc' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', float: 'left', marginRight: '15px' }}>←</button>
                    <h2 style={{ margin: 0, color: '#c0392b' }}>⚠️ Dropout Predictor</h2>
                    <p style={{ margin: '5px 0 0 0', color: '#e74c3c', fontSize: '13px' }}>
                        AI Analysis of Attendance & Performance
                    </p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#c0392b' }}>
                        🔄 Analyzing patterns...
                    </div>
                ) : atRiskStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#27ae60' }}>
                        ✅ Great news! No students are currently at high risk.
                    </div>
                ) : (
                    <div style={{ marginTop: '20px' }}>
                        <div style={{ background: '#fff', borderLeft: '4px solid #c0392b', padding: '15px', marginBottom: '20px', borderRadius: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                            <strong>Action Required:</strong> {atRiskStudents.length} students identified with &gt;80% dropout probability.
                        </div>

                        {atRiskStudents.map(student => (
                            <div key={student.id} className="card" style={{ borderLeft: '5px solid #c0392b', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px 0' }}>{student.name}</h3>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Class {student.class}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ background: '#ffe6e6', color: '#c0392b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                            {student.attendancePercentage < 50 ? 'CRITICAL RISK' : 'RISK'}
                                        </div>
                                        {student.attendancePercentage !== undefined && (
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#c0392b', marginTop: '4px' }}>
                                                {student.attendancePercentage}%
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ margin: '15px 0' }}>
                                    {student.riskFactors.map((factor, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#c0392b', marginBottom: '5px' }}>
                                            <span style={{ marginRight: '8px' }}>⚠️</span> {factor}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleWhatsApp(student)}
                                        style={{
                                            flex: 1, background: '#25D366', color: 'white', border: 'none',
                                            padding: '10px', borderRadius: '5px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                        }}
                                    >
                                        💬 WhatsApp Parent
                                    </button>
                                    <button
                                        style={{
                                            flex: 1, background: '#ecf0f1', color: '#2c3e50', border: 'none',
                                            padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        📞 Call
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
