import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function InstitutionFee() {
    const { userData } = useUser();
    const [targetClass, setTargetClass] = useState('');
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [recentFees, setRecentFees] = useState([]);

    const navigate = useNavigate();

    // Fetch Recently Created Fees
    useEffect(() => {
        if (!userData) return;
        const fetchRecent = async () => {
            const q = query(
                collection(db, "fees"),
                where("institutionId", "==", userData.uid), // Institution creates fees
                orderBy("createdAt", "desc"),
                limit(10)
            );
            // Without index, orderBy might fail initially. Can remove orderBy if needed or create index.
            // Simplified for now:
            const simpleQ = query(collection(db, "fees"), where("institutionId", "==", userData.uid));

            try {
                const snap = await getDocs(simpleQ);
                const list = snap.docs.map(d => d.data());
                // Client side sort
                list.sort((a, b) => b.createdAt - a.createdAt);
                setRecentFees(list.slice(0, 10));
            } catch (e) {
                console.error("Error fetching fees", e);
            }
        };
        fetchRecent();
    }, [userData]);

    const handleAssignFee = async (e) => {
        e.preventDefault();
        if (!targetClass || !title || !amount || !dueDate) return alert("Please fill all fields");

        setLoading(true);

        try {
            // 1. Find all students in target class belonging to this institution
            const qStudents = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("institutionId", "==", userData.uid),
                where("class", "==", targetClass)
            );

            const studentSnap = await getDocs(qStudents);

            if (studentSnap.empty) {
                alert(`No students found in Class ${targetClass}`);
                setLoading(false);
                return;
            }

            // 2. Create Fee Record for EACH student
            const batchPromises = studentSnap.docs.map(studentDoc => {
                return addDoc(collection(db, "fees"), {
                    studentId: studentDoc.id,
                    studentName: studentDoc.data().name,
                    institutionId: userData.uid,
                    title,
                    amount: Number(amount),
                    dueDate,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await Promise.all(batchPromises);

            alert(`✅ Fee Assigned successfully to ${studentSnap.size} students in Class ${targetClass}!`);

            // Reset Form
            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            // Refresh list (optimistic)
            setRecentFees(prev => [{ title, targetClass, amount, createdAt: new Date() }, ...prev]);

        } catch (error) {
            console.error("Error assigning fee:", error);
            alert("Failed to assign fee.");
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>💰 Fee Management (Institution)</h2>

            <div className="card">
                <h3>➕ Create New Fee Structure</h3>
                <form onSubmit={handleAssignFee} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d' }}>Target Class</label>
                        <select
                            className="input-field"
                            value={targetClass}
                            onChange={e => setTargetClass(e.target.value)}
                            required
                        >
                            <option value="">Select Class</option>
                            {[...Array(12)].map((_, i) => (
                                <option key={i + 1} value={`${i + 1}`}>Class {i + 1}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d' }}>Fee Title (e.g. Annual Tuition)</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: Exam Fee - Term 1"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d' }}>Amount (₹)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="5000"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d' }}>Due Date</label>
                            <input
                                type="date"
                                className="input-field"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn" disabled={loading} style={{ background: '#2980b9' }}>
                        {loading ? 'Assigning...' : 'Assign Fee to Class'}
                    </button>
                </form>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
                <h3>🕒 Recently Assigned Fees</h3>
                {recentFees.length === 0 ? (
                    <p style={{ color: '#95a5a6' }}>No fees assigned yet.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {recentFees.map((fee, idx) => (
                            <li key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                                <strong>{fee.title}</strong> for Class <strong>{fee.targetClass || 'N/A'}</strong> - ₹{fee.amount}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}


