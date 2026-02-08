
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function InstitutionFee() {
    const { userData } = useUser();
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState('All');
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [recentFees, setRecentFees] = useState([]);
    const [stats, setStats] = useState(null);

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

    const sectionOptions = ['All', 'A', 'B', 'C', 'D', 'E'];

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
                const q = query(
                    collection(db, "fees"),
                    where("institutionId", "==", userData.uid)
                );
                const snap = await getDocs(q);
                const uniqueItems = {};
                snap.docs.forEach(d => {
                    const data = d.data();
                    const key = `${data.title}-${data.class}-${data.section || 'All'}`;
                    if (!uniqueItems[key] || (data.createdAt?.seconds > uniqueItems[key].createdAt?.seconds)) {
                        uniqueItems[key] = { id: d.id, ...data };
                    }
                });
                const list = Object.values(uniqueItems);
                list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setRecentFees(list.slice(0, 10));

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
            const q = query(collection(db, "users"), where("institutionId", "==", instId));
            const snap = await getDocs(q);

            const normalizedTarget = normalizeClass(targetClass);
            const students = snap.docs.filter(d => {
                const data = d.data();
                if (data.role !== 'student') return false;

                const matchesClass = normalizeClass(data.class) === normalizedTarget;
                const matchesSection = targetSection === 'All' || data.section === targetSection;

                return matchesClass && matchesSection;
            });

            if (students.length === 0) {
                window.alert(`No students found in Class ${targetClass}${targetSection !== 'All' ? ` Section ${targetSection}` : ''}.`);
                setLoading(false);
                return;
            }

            if (!window.confirm(`Assign ₹${amount} fee to ${students.length} students?`)) {
                setLoading(false);
                return;
            }

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
                    section: sData.section || 'N/A',
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();

            window.alert(`🎉 SUCCESS! Fee assigned to ${students.length} students.`);

            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            setRecentFees(prev => [{
                id: 'new-' + Date.now(),
                title,
                amount,
                class: normalizedTarget,
                section: targetSection,
                createdAt: { seconds: Date.now() / 1000 }
            }, ...prev].slice(0, 10));

        } catch (err) {
            console.error("Assignment Error:", err);
            window.alert("Error: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
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

            <div className="header-card" style={{ textAlign: 'center', marginBottom: '40px', padding: '40px', borderRadius: '30px', background: 'white', border: '1px solid #f1f2f6', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#2d3436', margin: 0 }}>Fee Management</h1>
                <p style={{ color: '#636e72', marginTop: '10px' }}>Assign fees by Class and Section with precision.</p>
            </div>

            <div className="card glass-form" style={{ padding: '40px', borderRadius: '24px', background: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f1f2f6' }}>
                <h3 style={{ marginBottom: '25px', color: '#2d3436' }}>Create New Assignment</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Fee Title</label>
                            <input
                                className="input-field"
                                placeholder="e.g. Monthly Tuition Fee"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            />
                        </div>
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
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '20px', alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Class</label>
                            <select
                                className="input-field"
                                value={targetClass}
                                onChange={e => setTargetClass(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            >
                                <option value="">-- Class --</option>
                                {classOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>Class {opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', color: '#2d3436' }}>Section</label>
                            <select
                                className="input-field"
                                value={targetSection}
                                onChange={e => setTargetSection(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f1f2f6', background: '#f8f9fa' }}
                            >
                                {sectionOptions.map(sec => (
                                    <option key={sec} value={sec}>{sec === 'All' ? 'All Sections' : `Section ${sec}`}</option>
                                ))}
                            </select>
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
                        {loading ? '⚡ PROCESSING...' : 'CONFIRM & ASSIGN FEE'}
                    </button>
                </div>
            </div>

            <div className="history" style={{ marginTop: '50px' }}>
                <h3 style={{ marginBottom: '20px', fontWeight: '800', color: '#2d3436' }}>🕒 Recent Assignments</h3>
                {recentFees.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9fb', borderRadius: '20px', border: '2px dashed #e0e0e0', color: '#b2bec3' }}>
                        No assignments recorded yet.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {recentFees.map(fee => (
                            <div key={fee.id} style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.3s' }} className="history-item">
                                <div>
                                    <div style={{ fontWeight: '800', color: '#2d3436' }}>{fee.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#636e72', marginTop: '5px' }}>
                                        {fee.class} | {fee.section === 'All' ? 'All Sections' : `Sec ${fee.section}`}
                                    </div>
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
                .history-item:hover { transform: scale(1.02); box-shadow: 0 8px 25px rgba(0,0,0,0.05); }
            `}</style>
        </div>
    );
}
