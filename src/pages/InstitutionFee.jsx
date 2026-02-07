
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

    // Flexible Class Options - UI shows 1, 2, 3... but matches 1st, 2nd, 3rd...
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

    // Robust Normalizer: Handles "10", "10th", "10 ", etc.
    const normalizeClass = (c) => {
        if (!c) return '';
        let s = String(c).trim().toLowerCase();

        // Remove 'st', 'nd', 'rd', 'th' suffices to get pure number for comparison
        s = s.replace(/(st|nd|rd|th)$/, '');

        // Return matching ordinal for consistency in DB, or original name for non-numeric
        if (s === '1') return '1st';
        if (s === '2') return '2nd';
        if (s === '3') return '3rd';
        const num = parseInt(s);
        if (!isNaN(num) && num >= 4 && num <= 12) return num + 'th';

        // Return capitalized original for things like 'Nursery'
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

                list.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });

                setRecentFees(list.slice(0, 10));
            } catch (e) {
                console.error("Error fetching recent fees:", e);
            }
        };
        fetchRecent();
    }, [userData]);

    const handleAssignFee = async (e) => {
        if (e) e.preventDefault();

        const instId = userData?.uid;
        if (!instId) {
            alert("Error: Session expired. Please refresh.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            alert("Please fill all fields.");
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Query all students in the school
            const qStudents = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("institutionId", "==", instId)
            );

            const studentSnap = await getDocs(qStudents);

            // STEP 2: Normalize and match
            const normalizedTarget = normalizeClass(targetClass);
            const filteredStudents = studentSnap.docs.filter(d => {
                const sClass = normalizeClass(d.data().class);
                return sClass === normalizedTarget;
            });

            if (filteredStudents.length === 0) {
                alert(`No students found in Class ${targetClass}. \n\nPlease verify that students have updated their profile to this class.`);
                setLoading(false);
                return;
            }

            // STEP 3: Batch Write
            const batch = writeBatch(db);

            filteredStudents.forEach(studentDoc => {
                const sData = studentDoc.data();
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: studentDoc.id,
                    studentName: sData.name || `${sData.firstName || ''} ${sData.secondName || ''}`.trim() || "Student",
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

            alert(`✅ Success! Fee assigned to ${filteredStudents.length} students in Class ${targetClass}.`);

            // Reset
            setTitle('');
            setAmount('');
            setDueDate('');
            setRecentFees(prev => [{ id: 'new-' + Date.now(), title, class: normalizedTarget, amount, createdAt: { seconds: Date.now() / 1000 } }, ...prev].slice(0, 10));
            setLoading(false);

        } catch (error) {
            console.error("Error:", error);
            alert(`Failed: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: '#f1f2f6', color: '#2f3542' }}>
                ← Back
            </button>
            <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>💰 Fee Management</h2>

            <div className="card" style={{ padding: '30px' }}>
                <h3>Add New Fee Item</h3>
                <form onSubmit={handleAssignFee} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>Select Class</label>
                        <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} required>
                            <option value="">-- Choose Class --</option>
                            {classOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>Class {opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>Fee Title</label>
                        <input className="input-field" placeholder="e.g. Monthly Tuition Fee" value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>Amount (₹)</label>
                            <input type="number" className="input-field" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>Due Date</label>
                            <input type="date" className="input-field" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn"
                        style={{
                            background: '#2ecc71',
                            padding: '18px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginTop: '10px'
                        }}
                    >
                        {loading ? 'Processing...' : '🚀 ASSIGN FEE TO CLASS'}
                    </button>
                </form>
            </div>

            <div className="card" style={{ marginTop: '30px' }}>
                <h3 style={{ marginBottom: '15px' }}>🕒 Recent Activity</h3>
                {recentFees.length === 0 ? <p className="text-muted">No recent assignments found.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentFees.map(f => (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #3498db' }}>
                                <span><strong>{f.title}</strong> ({f.class || 'Class'})</span>
                                <span style={{ color: '#27ae60', fontWeight: 'bold' }}>₹{f.amount}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
