
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
    const [stats, setStats] = useState(null); // { totalStudents: 0 }

    const navigate = useNavigate();

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
        const fetchData = async () => {
            try {
                // 1. Fetch recent unique fees
                const q = query(
                    collection(db, "fees"),
                    where("institutionId", "==", userData.uid)
                );
                const snap = await getDocs(q);
                const uniqueItems = {};
                snap.docs.forEach(d => {
                    const data = d.data();
                    const key = `${data.title}-${data.class}`;
                    if (!uniqueItems[key] || (data.createdAt?.seconds > uniqueItems[key].createdAt?.seconds)) {
                        uniqueItems[key] = { id: d.id, ...data };
                    }
                });
                const list = Object.values(uniqueItems);
                list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setRecentFees(list.slice(0, 10));

                // 2. Fetch total student count for this school
                const qStudents = query(
                    collection(db, "users"),
                    where("institutionId", "==", userData.uid),
                    where("role", "==", "student")
                );
                const sSnap = await getDocs(qStudents);
                setStats({ totalStudents: sSnap.size });

            } catch (e) {
                console.error("Fetch Error:", e);
            }
        };
        fetchData();
    }, [userData]);

    const handleAssignFee = async (e) => {
        if (e) e.preventDefault();

        console.log("🚀 Starting Assignment Process...");

        if (!userData || !userData.uid) {
            window.alert("Session Error: User not found. Please log in again.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            window.alert("Please fill all required fields.");
            return;
        }

        setLoading(true);

        try {
            const instId = userData.uid;

            // Step 1: Query students in school
            console.log("Querying students for Institution:", instId);
            const q = query(
                collection(db, "users"),
                where("institutionId", "==", instId)
            );

            const snap = await getDocs(q);
            console.log(`Query Success: Found ${snap.size} total school members.`);

            const normalizedTarget = normalizeClass(targetClass);
            const students = snap.docs.filter(d => {
                const data = d.data();
                return data.role === 'student' && normalizeClass(data.class) === normalizedTarget;
            });

            if (students.length === 0) {
                window.alert(`No students found in Class ${targetClass}.\n\nTotal school members: ${snap.size}.\n\nEnsure students have registered with your Institution ID.`);
                setLoading(false);
                return;
            }

            if (!window.confirm(`Assign ₹${amount} fee to ${students.length} students?`)) {
                setLoading(false);
                return;
            }

            // Step 2: Batch Write
            console.log(`Planning batch for ${students.length} students...`);
            const batch = writeBatch(db);

            students.forEach(sDoc => {
                const sData = sDoc.data();
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: sDoc.id,
                    studentName: sData.name || `${sData.firstName || ''} ${sData.secondName || ''}`.trim() || "Student",
                    institutionId: instId,
                    institutionName: userData.schoolName || userData.name || "Institution",
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: normalizedTarget,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            console.log("Committing batch...");
            await batch.commit();
            console.log("✅ Batch commit complete!");

            window.alert(`🎉 SUCCESS!\n\nFee "${title}" has been assigned to ${students.length} students in Class ${targetClass}.`);

            // UI Reset
            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            // Optimistic refresh for recent items
            setRecentFees(prev => [{
                id: 'new-' + Date.now(),
                title,
                amount,
                class: normalizedTarget,
                createdAt: { seconds: Date.now() / 1000 }
            }, ...prev].slice(0, 10));

        } catch (err) {
            console.error("Assignment Critical Error:", err);
            let msg = err.message;
            if (err.code === 'permission-denied') {
                msg = "Permission Denied. I've just deployed fresh security rules to fix this. Please refresh the page and try one more time.";
            }
            window.alert("Error: " + msg);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <button className="btn" onClick={() => navigate(-1)} style={{ background: '#f8f9fa', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '12px' }}>
                    ← Dashboard
                </button>
                {stats && (
                    <div style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        🏫 {stats.totalStudents} Registered Students
                    </div>
                )}
            </div>

            <div className="header-card" style={{ textAlign: 'center', marginBottom: '40px', padding: '40px', borderRadius: '30px', background: 'linear-gradient(145deg, #ffffff, #f1f2f6)', boxShadow: '20px 20px 60px #d9d9d9, -20px -20px 60px #ffffff' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#2d3436', margin: 0 }}>Fee Management</h1>
                <p style={{ color: '#636e72', marginTop: '10px' }}>Securely assign and track student billing.</p>
            </div>

            <div className="card glass-form" style={{ padding: '40px', borderRadius: '24px', background: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f1f2f6' }}>
                <h3 style={{ marginBottom: '25px', color: '#2d3436' }}>Create Assignment</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Select Class</label>
                            <select
                                className="input-field"
                                value={targetClass}
                                onChange={e => setTargetClass(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa', fontSize: '1rem', outline: 'none' }}
                            >
                                <option value="">-- Choose Class --</option>
                                {classOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>Class {opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Title</label>
                            <input
                                className="input-field"
                                placeholder="Yearly Fee"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Amount (₹)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Due Date</label>
                            <input
                                type="date"
                                className="input-field"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAssignFee}
                        disabled={loading}
                        className="btn submit-btn"
                        style={{
                            marginTop: '15px',
                            background: loading ? '#dfe6e9' : 'linear-gradient(135deg, #00b894, #00cec9)',
                            color: 'white',
                            padding: '20px',
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: loading ? 'wait' : 'pointer',
                            boxShadow: '0 10px 20px rgba(0, 184, 148, 0.2)',
                            transition: 'all 0.3s'
                        }}
                    >
                        {loading ? '⚡ PROCESSING...' : 'CONFIRM & ASSIGN NOW'}
                    </button>
                </div>
            </div>

            <div className="history" style={{ marginTop: '50px' }}>
                <h3 style={{ marginBottom: '20px', fontWeight: '800', color: '#2d3436' }}>🕒 Recent Activity</h3>
                {recentFees.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9fb', borderRadius: '20px', border: '2px dashed #e0e0e0', color: '#b2bec3' }}>
                        No assignments recorded yet.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {recentFees.map(fee => (
                            <div key={fee.id} style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800', color: '#2d3436' }}>{fee.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#636e72', marginTop: '5px' }}>Class {fee.class}</div>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#00b894' }}>₹{fee.amount}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .submit-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0, 184, 148, 0.4); }
                .submit-btn:active { transform: scale(0.98); }
                .input-field:focus { border-color: #00b894 !important; background: white !important; }
            `}</style>
        </div>
    );
}
