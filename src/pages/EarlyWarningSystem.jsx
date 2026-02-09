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
                // Fetch teacher's students
                const q = query(collection(db, "student_allotments"), where("teacherId", "==", userData.uid));
                const snap = await getDocs(q);

                // MOCK ANALYSIS ENGINE
                // In a real app, this would query attendance/marks collections deeply.
                // Here we simulate an AI analysis of browsing headers/attendance logs.
                const analyzed = snap.docs.map((d, index) => {
                    const data = d.data();
                    // Simulate risk for Demo purposes (every 3rd student is "At Risk")
                    const isRisk = index % 3 === 0;

                    return {
                        id: d.id,
                        name: data.studentName || "Unknown Student",
                        class: data.classAssigned,
                        riskScore: isRisk ? 85 : 10, // High score = High Risk
                        riskFactors: isRisk ? ["Absent 3 days in a row", "Failed Unit Test 2"] : [],
                        parentPhone: "919876543210" // Mock phone
                    };
                }).filter(s => s.riskScore > 50); // Only show high risk

                setAtRiskStudents(analyzed);
            } catch (e) {
                console.error(e);
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
                                    <div style={{ background: '#ffe6e6', color: '#c0392b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                        Risk: High
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
