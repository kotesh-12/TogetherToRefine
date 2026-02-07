
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

    // Standard Class Options (Matching Details.jsx exactly)
    const classOptions = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

    useEffect(() => {
        if (!userData || !userData.uid) return;
        const fetchRecent = async () => {
            try {
                // Single equality query doesn't need a composite index
                const q = query(
                    collection(db, "fees"),
                    where("institutionId", "==", userData.uid)
                );

                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Sort client-side to be safe
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
        console.log("🚀 Starting Fee Assignment...");

        const instId = userData?.uid || userData?.institutionId;
        if (!instId) {
            alert("Error: Your Institution ID could not be found. Please refresh the page.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            alert("Please fill all required fields.");
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Find students.
            // Using a simpler query and filtering client-side to avoid "Missing Index" errors
            console.log(`Querying students for Institution: ${instId}...`);
            const qStudents = query(
                collection(db, "users"),
                where("institutionId", "==", instId),
                where("role", "==", "student")
            );

            const studentSnap = await getDocs(qStudents);

            // Client-side filtering for Class
            const students = studentSnap.docs.filter(d => {
                const data = d.data();
                return String(data.class) === String(targetClass);
            });

            if (students.length === 0) {
                console.warn(`No students found in ${targetClass}. Total students found in school: ${studentSnap.size}`);
                alert(`No students found in Class ${targetClass}. \n\nCheck:\n1. Have students completed their profile?\n2. Did they select this school?\n3. Is their class exactly "${targetClass}"?`);
                setLoading(false);
                return;
            }

            console.log(`✅ Found ${students.length} students. Creating records...`);

            // STEP 2: Batch write for performance and reliability
            const batch = writeBatch(db);

            students.forEach(studentDoc => {
                const sData = studentDoc.data();
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: studentDoc.id,
                    studentName: sData.name || `${sData.firstName || ''} ${sData.secondName || ''}`.trim() || "Student",
                    institutionId: instId,
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: targetClass,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            console.log("🎉 All records committed successfully.");

            alert(`✅ Success! Fee "${title}" assigned to ${students.length} students in Class ${targetClass}.`);

            // Reset form
            setTitle('');
            setAmount('');
            setDueDate('');
            setRecentFees(prev => [{ id: 'new-' + Date.now(), title, class: targetClass, amount, createdAt: { seconds: Date.now() / 1000 } }, ...prev].slice(0, 10));
            setLoading(false);

        } catch (error) {
            console.error("❌ CRITICAL ERROR:", error);
            // Better error reporting
            let msg = error.message || "Unknown Error";
            if (error.code === 'permission-denied') msg = "Permission Denied. Please check database rules.";

            alert(`Failed to assign fee: ${msg}\n\nPlease check the browser console (F12) for details.`);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: '#f5f6fa', color: '#2f3640', border: '1px solid #dcdde1' }}>
                ← Back
            </button>
            <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#2f3640' }}>💰 Institution Fee Manager</h2>

            <div className="card" style={{ padding: '25px', marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '20px' }}>Assign Fee to Class</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Select Target Class</label>
                        <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} style={{ width: '100%', padding: '12px' }}>
                            <option value="">-- Choose --</option>
                            {classOptions.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Fee Title</label>
                        <input className="input-field" placeholder="e.g. Admission Fee 2024" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '12px' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Amount (₹)</label>
                            <input type="number" className="input-field" placeholder="5000" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '12px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Due Date</label>
                            <input type="date" className="input-field" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '12px' }} />
                        </div>
                    </div>

                    <button
                        onClick={handleAssignFee}
                        disabled={loading}
                        className="btn"
                        style={{
                            background: '#2ecc71',
                            padding: '15px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Processing Batch...' : 'Assign Fee to Class Now'}
                    </button>
                </div>
            </div>

            <div className="card">
                <h3>Recently Created</h3>
                {recentFees.length === 0 ? <p className="text-muted">No recent assignments.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        {recentFees.map(f => (
                            <div key={f.id} style={{ padding: '12px', background: '#f9f9f9', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', borderLeft: '3px solid #3498db' }}>
                                <span><strong>{f.title}</strong> ({f.class || 'All'})</span>
                                <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>₹{f.amount}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
