
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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

    // Standard Class Options
    const classOptions = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

    useEffect(() => {
        if (!userData || !userData.uid) return;
        const fetchRecent = async () => {
            try {
                const q = query(
                    collection(db, "fees"),
                    where("institutionId", "==", userData.uid)
                );

                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                list.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });

                setRecentFees(list.slice(0, 10));
            } catch (e) {
                console.error("Error fetching fees", e);
            }
        };
        fetchRecent();
    }, [userData]);

    const handleAssignFee = async (e) => {
        e.preventDefault();
        console.log("🚀 Starting Fee Assignment...");

        if (!userData || !userData.uid) {
            return alert("Error: Institution session not found. Please refresh.");
        }

        if (!targetClass || !title || !amount || !dueDate) {
            return alert("Please fill all fields");
        }

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
                alert(`No students found in Class ${targetClass}. Please ensure students have selected this school and class in their profile.`);
                setLoading(false);
                return;
            }

            console.log(`✅ Found ${studentSnap.size} students. Assigning...`);

            // 2. Batch write
            const batch = writeBatch(db);

            studentSnap.docs.forEach(studentDoc => {
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: studentDoc.id,
                    studentName: studentDoc.data().name || `${studentDoc.data().firstName || ''} ${studentDoc.data().secondName || ''}`.trim() || "Student",
                    institutionId: userData.uid,
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: targetClass,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();

            alert(`✅ Fee Assigned successfully to ${studentSnap.size} students in Class ${targetClass}!`);

            setTitle('');
            setAmount('');
            setDueDate('');
            setRecentFees(prev => [{ title, class: targetClass, amount, createdAt: { seconds: Date.now() / 1000 } }, ...prev].slice(0, 10));
            setLoading(false);

        } catch (error) {
            console.error("❌ Error assigning fee:", error);
            alert(`Failed to assign fee: ${error.message}`);
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
                            {classOptions.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
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
                            <li key={fee.id || idx} style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span><strong>{fee.title}</strong> - {fee.class || fee.targetClass}</span>
                                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>₹{fee.amount}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
