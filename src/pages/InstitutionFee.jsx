
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
                // Fetch fees assigned by this institution
                const q = query(
                    collection(db, "fees"),
                    where("institutionId", "==", userData.uid)
                );
                const snap = await getDocs(q);
                // Use a Map to show only unique titles per class in recent list to keep it clean
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

        if (!userData || !userData.uid) {
            window.alert("Session Error: Please log out and log in again.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            window.alert("All fields are required.");
            return;
        }

        if (!window.confirm(`Are you sure you want to assign ₹${amount} fee to all students in Class ${targetClass}?`)) {
            return;
        }

        setLoading(true);

        try {
            const instId = userData.uid;
            const normalizedTarget = normalizeClass(targetClass);

            // 1. Fetch Students with ultra-safe query
            // We only query by institutionId to AVOID composite index errors (Missing Index)
            // Composite indexes are the #1 cause of "Failed permissions/failed queries" in Firestore
            console.log("Fetching students for school:", instId);
            const q = query(
                collection(db, "users"),
                where("institutionId", "==", instId)
            );

            const snap = await getDocs(q);
            console.log(`Total school members found: ${snap.size}`);

            // Filter by role and class client-side to ensure 100% success without manual index creation
            const students = snap.docs.filter(d => {
                const data = d.data();
                return data.role === 'student' && normalizeClass(data.class) === normalizedTarget;
            });

            if (students.length === 0) {
                window.alert(`No students matched. \n\nFound ${snap.size} total members in your school, but none are registered as "Students" in Class "${targetClass}".`);
                setLoading(false);
                return;
            }

            console.log(`Assigning fee to ${students.length} matching students...`);

            // 2. Batch Execution
            const batch = writeBatch(db);
            students.forEach(sDoc => {
                const sData = sDoc.data();
                const feeRef = doc(collection(db, "fees"));
                batch.set(feeRef, {
                    studentId: sDoc.id,
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
            console.log("Batch commit successful");

            window.alert(`✅ Success! Fee assigned to ${students.length} students in Class ${targetClass}.`);

            // Reset
            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            // Optimistic refresh
            setRecentFees(prev => [{
                id: 'new-' + Date.now(),
                title,
                amount,
                class: normalizedTarget,
                createdAt: { seconds: Date.now() / 1000 }
            }, ...prev].slice(0, 10));

        } catch (err) {
            console.error("Assignment Error:", err);
            let errorMsg = err.message;
            if (err.code === 'permission-denied') {
                errorMsg = "Database Permission Denied. I am updating the security rules now. Please wait a moment and try again.";
            }
            window.alert("Error: " + errorMsg);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'var(--bg-surface)', border: '1px solid #ddd' }}>
                ← Dashboard
            </button>

            <div className="header-section" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '10px' }}>
                    Fee Management
                </h1>
                <p style={{ color: '#636e72', fontSize: '1.1rem' }}>Assign school fees and track payments with ease.</p>
            </div>

            <div className="card glass-card" style={{ padding: '40px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
                <h2 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎯</span> Create New Assignment
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '10px', color: '#2d3436' }}>Select Class</label>
                            <select
                                className="input-field"
                                value={targetClass}
                                onChange={e => setTargetClass(e.target.value)}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #edeff2', fontSize: '1rem', transition: 'all 0.3s' }}
                            >
                                <option value="">-- Choose --</option>
                                {classOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>Class {opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '10px', color: '#2d3436' }}>Fee Title</label>
                            <input
                                className="input-field"
                                placeholder="e.g. Term 1 Tuition"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #edeff2', fontSize: '1rem' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '10px', color: '#2d3436' }}>Amount (₹)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #edeff2', fontSize: '1rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '10px', color: '#2d3436' }}>Due Date</label>
                            <input
                                type="date"
                                className="input-field"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #edeff2', fontSize: '1rem' }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAssignFee}
                        disabled={loading}
                        className="btn animate-pop"
                        style={{
                            marginTop: '10px',
                            background: loading ? '#dfe6e9' : 'linear-gradient(135deg, #00b894, #00cec9)',
                            color: 'white',
                            padding: '18px',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            border: 'none',
                            borderRadius: '16px',
                            cursor: loading ? 'wait' : 'pointer',
                            boxShadow: '0 10px 20px rgba(0, 184, 148, 0.2)',
                            transition: 'all 0.3s transform ease'
                        }}
                    >
                        {loading ? '⚡ Processing Students...' : '🚀 Assign Fee to All Students'}
                    </button>
                </div>
            </div>

            <div className="recent-section" style={{ marginTop: '50px' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: '700', color: '#2d3436' }}>🕒 Recent Activity</h3>
                {recentFees.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9fb', borderRadius: '20px', border: '2px dashed #e0e0e0' }}>
                        <p style={{ color: '#b2bec3' }}>No fee assignments found yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {recentFees.map(fee => (
                            <div key={fee.id} style={{ background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '700', color: '#2d3436', fontSize: '1rem' }}>{fee.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#636e72', marginTop: '4px' }}>Class {fee.class}</div>
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#00b894' }}>₹{fee.amount}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .animate-pop:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 15px 30px rgba(0, 184, 148, 0.3); }
                .animate-pop:active { transform: translateY(0) scale(0.98); }
                .input-field:focus { outline: none; border-color: #6c5ce7 !important; }
                .glass-card { transition: all 0.3s ease; }
            `}</style>
        </div>
    );
}
