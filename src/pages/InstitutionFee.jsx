
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

    // Helper to normalize class names for matching (e.g. "1" -> "1st")
    const normalizeClass = (c) => {
        if (!c) return '';
        const s = String(c).trim();
        if (s === '1') return '1st';
        if (s === '2') return '2nd';
        if (s === '3') return '3rd';
        if (s >= '4' && s <= '10') return s + 'th';
        return s;
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
        console.log("🚀 Starting Fee Assignment Process...");

        const instId = userData?.uid;
        if (!instId) {
            alert("Error: Institution ID not found. Please log in again.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            alert("Please fill all fields: Class, Title, Amount, and Due Date.");
            return;
        }

        setLoading(true);

        try {
            // Step 1: Query students (Wide query to handle class mismatches)
            console.log(`Searching for students in school: ${instId}...`);
            const qStudents = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("institutionId", "==", instId)
            );

            const studentSnap = await getDocs(qStudents);

            // Step 2: Client-side filter with NORMALIZATION
            const normalizedTarget = normalizeClass(targetClass);
            const filteredStudents = studentSnap.docs.filter(d => {
                const sClass = normalizeClass(d.data().class);
                return sClass === normalizedTarget;
            });

            if (filteredStudents.length === 0) {
                console.warn(`No students matched class ${normalizedTarget}.`);
                alert(`No students found in Class ${targetClass}. \n\nTotal students in school: ${studentSnap.size}. \nEnsure students have their class set correctly in their profile.`);
                setLoading(false);
                return;
            }

            console.log(`✅ Found ${filteredStudents.length} students. Proceeding with Batch Write...`);

            // Step 3: Batch Execution
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
            console.log("🎉 Success! Batch committed.");

            alert(`✅ Done! Fees assigned to ${filteredStudents.length} students in ${targetClass}.`);

            // Clean up
            setTitle('');
            setAmount('');
            setDueDate('');
            setRecentFees(prev => [{ id: 'new-' + Date.now(), title, class: targetClass, amount, createdAt: { seconds: Date.now() / 1000 } }, ...prev].slice(0, 10));
            setLoading(false);

        } catch (error) {
            console.error("❌ CRTITICAL ERROR:", error);
            alert(`Failed: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: '#f8f9fa', color: '#333' }}>
                ← Back
            </button>
            <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>💰 Fee Management</h2>

            <div className="card" style={{ padding: '30px' }}>
                <h3>Assign New Fee</h3>
                {/* Wrapped back in a form for enter-key support */}
                <form onSubmit={handleAssignFee} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>Select Class</label>
                        <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} required>
                            <option value="">-- Choose Class --</option>
                            {classOptions.map(cls => <option key={cls} value={cls}>{cls}</option>)}
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
                        {loading ? 'Processing... Please Wait' : '🚀 CONFIRM AND ASSIGN FEE'}
                    </button>
                </form>
            </div>

            <div className="card" style={{ marginTop: '30px', borderLeft: '5px solid #3498db' }}>
                <h3 style={{ marginBottom: '15px' }}>🕒 Recent Activity</h3>
                {recentFees.length === 0 ? <p className="text-muted">No activity yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentFees.map(f => (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
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
