
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

    // Mapping for UI
    const classOptions = [
        { label: 'Nursery', value: 'Nursery' },
        { label: 'LKG', value: 'LKG' },
        { label: 'UKG', value: 'UKG' },
        { label: '1', value: '1st' },
        { label: '2', value: '2nd' },
        { label: '3', value: '3rd' },
        { label: '4', value: '4th' },
        { label: '5', value: '5th' },
        { label: '6', value: '6th' },
        { label: '7', value: '7th' },
        { label: '8', value: '8th' },
        { label: '9', value: '9th' },
        { label: '10', value: '10th' }
    ];

    const normalizeClass = (c) => {
        if (!c) return '';
        let s = String(c).trim().toLowerCase();
        s = s.replace(/(st|nd|rd|th)$/, '');
        if (s === '1') return '1st';
        if (s === '2') return '2nd';
        if (s === '3') return '3rd';
        const num = parseInt(s);
        if (!isNaN(num) && num >= 4 && num <= 12) return num + 'th';
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

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
                list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setRecentFees(list.slice(0, 10));
            } catch (e) {
                console.error("Fetch Error:", e);
            }
        };
        fetchRecent();
    }, [userData]);

    const handleAssignFee = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log("Submit clicked");

        // Failsafe for missing data
        if (!userData || !userData.uid) {
            window.alert("Institution session not found. Please log out and log in again.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            window.alert("Please fill all fields: Class, Title, Amount, and Due Date.");
            return;
        }

        if (!window.confirm(`Assign fee "${title}" of ₹${amount} to all students in Class ${targetClass}?`)) {
            return;
        }

        setLoading(true);

        try {
            const instId = userData.uid;

            // 1. Fetch Students
            const q = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("institutionId", "==", instId)
            );

            const snap = await getDocs(q);
            const normalizedTarget = normalizeClass(targetClass);

            const students = snap.docs.filter(d => {
                const sClass = normalizeClass(d.data().class);
                return sClass === normalizedTarget;
            });

            if (students.length === 0) {
                window.alert(`No students found in Class ${targetClass} (normalized: ${normalizedTarget}).\n\nTotal students in school: ${snap.size}.\n\nPlease ensure students have selected this school in their profile.`);
                setLoading(false);
                return;
            }

            // 2. Batch write
            const batch = writeBatch(db);
            students.forEach(sDoc => {
                const data = sDoc.data();
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: sDoc.id,
                    studentName: data.name || `${data.firstName || ''} ${data.secondName || ''}`.trim() || "Student",
                    institutionId: instId,
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: normalizedTarget,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();

            window.alert(`✅ SUCCESS! Fee assigned to ${students.length} students.`);

            // Reset fields
            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            // Optimistic update
            setRecentFees(prev => [{
                id: 'new-' + Date.now(),
                title,
                amount,
                class: normalizedTarget,
                createdAt: { seconds: Date.now() / 1000 }
            }, ...prev].slice(0, 10));

        } catch (err) {
            console.error("Assignment Critical Error:", err);
            window.alert("Failed: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: '#eee', color: '#333' }}>
                ← Back
            </button>

            <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>💰 Fee Management</h2>

            <div className="card" style={{ padding: '30px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                <h3>➕ Create New Fee Structure</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Target Class</label>
                        <select
                            className="input-field"
                            value={targetClass}
                            onChange={e => setTargetClass(e.target.value)}
                            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                        >
                            <option value="">-- Select Class --</option>
                            {classOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>Class {opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Fee Title</label>
                        <input
                            className="input-field"
                            placeholder="e.g. Exam Fee Term 2"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Amount (₹)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="5000"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Due Date</label>
                            <input
                                type="date"
                                className="input-field"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAssignFee}
                        disabled={loading}
                        className="btn"
                        style={{
                            marginTop: '10px',
                            background: loading ? '#95a5a6' : '#27ae60',
                            color: 'white',
                            padding: '18px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        {loading ? '⚡ Assigning to Batch...' : 'Assign Fee to All Selected Students'}
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginTop: '30px' }}>
                <h3 style={{ marginBottom: '15px' }}>🕒 Recent Assignments</h3>
                {recentFees.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#7f8c8d' }}>No assignments yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentFees.map(fee => (
                            <div key={fee.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#f9f9f9', borderRadius: '8px', borderLeft: '4px solid #3498db' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{fee.title}</div>
                                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Class: {fee.class}</div>
                                </div>
                                <div style={{ fontWeight: 'bold', color: '#27ae60' }}>₹{fee.amount}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .btn:active { transform: scale(0.98); }
                .input-field:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 2px rgba(52,152,219,0.2); }
            `}</style>
        </div>
    );
}
