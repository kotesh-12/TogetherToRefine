
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

    // Detailed stats
    const [schoolStats, setSchoolStats] = useState({
        total: 0,
        approved: 0,
        unlinked: 0,
        matchingNow: 0
    });
    const [allStudentAllotments, setAllStudentAllotments] = useState([]);

    const navigate = useNavigate();

    const classOptions = [
        { label: 'Nursery', value: 'Nursery' }, { label: 'LKG', value: 'LKG' }, { label: 'UKG', value: 'UKG' },
        { label: '1', value: '1st' }, { label: '2', value: '2nd' }, { label: '3', value: '3rd' },
        { label: '4', value: '4th' }, { label: '5', value: '5th' }, { label: '6', value: '6th' },
        { label: '7', value: '7th' }, { label: '8', value: '8th' }, { label: '9', value: '9th' },
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

    // Calculate Institution ID correctly (Owner vs Staff)
    const instId = userData?.role === 'institution' ? userData?.uid : userData?.institutionId;

    // 1. Initial Data Fetch (School Stats & Recent Activity)
    useEffect(() => {
        if (!instId) return;

        const fetchData = async () => {
            try {
                // A. Fetch Recent Fees
                const qFees = query(collection(db, "fees"), where("institutionId", "==", instId));
                const feeSnap = await getDocs(qFees);
                const uniqueTitles = {};
                feeSnap.docs.forEach(d => {
                    const data = d.data();
                    const key = `${data.title}-${data.class}-${data.section || 'All'}`;
                    if (!uniqueTitles[key] || (data.createdAt?.seconds > uniqueTitles[key].createdAt?.seconds)) {
                        uniqueTitles[key] = { id: d.id, ...data };
                    }
                });
                const feeList = Object.values(uniqueTitles).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setRecentFees(feeList.slice(0, 5));

                // B. Fetch FROM STUDENT_ALLOTMENTS (This is the 40+ list!)
                // We check both 'createdBy' and 'institutionId' for maximum compatibility
                const fetchProms = [
                    getDocs(query(collection(db, "student_allotments"), where("institutionId", "==", instId))),
                    getDocs(query(collection(db, "student_allotments"), where("createdBy", "==", instId)))
                ];

                const snaps = await Promise.all(fetchProms);
                const mergedMap = new Map();
                snaps.forEach(snap => {
                    snap.forEach(d => {
                        if (!mergedMap.has(d.id)) {
                            mergedMap.set(d.id, { id: d.id, ...d.data() });
                        }
                    });
                });

                const allotments = Array.from(mergedMap.values());
                console.log(`Found ${allotments.length} student allotments for school.`);
                setAllStudentAllotments(allotments);

                // Categorize for stats
                setSchoolStats(prev => ({
                    ...prev,
                    total: allotments.length,
                    approved: allotments.filter(s => s.userId).length, // If it has a userId, they have joined the app
                    unlinked: allotments.filter(s => !s.userId).length
                }));

            } catch (e) {
                console.error("Fetch Error:", e);
            }
        };
        fetchData();
    }, [instId]);

    // 2. Live Preview Filter (derived state, not effect)
    const filtered = React.useMemo(() => {
        if (!targetClass) return [];
        const normalizedTarget = normalizeClass(targetClass);
        return allStudentAllotments.filter(s => {
            const matchesClass = normalizeClass(s.classAssigned) === normalizedTarget;
            const matchesSection = targetSection === 'All' || s.section === targetSection;
            return matchesClass && matchesSection;
        });
    }, [targetClass, targetSection, allStudentAllotments]);

    const previewList = React.useMemo(() => filtered.slice(0, 10), [filtered]);
    const matchingNow = filtered.length;

    const handleAssignFee = async (e) => {
        if (e) e.preventDefault();

        if (!instId) {
            window.alert("Session Error: Please log in again.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            window.alert("Please complete the form.");
            return;
        }

        const normalizedTarget = normalizeClass(targetClass);
        const finalStudents = allStudentAllotments.filter(s => {
            const matchesClass = normalizeClass(s.classAssigned) === normalizedTarget;
            const matchesSection = targetSection === 'All' || s.section === targetSection;
            return matchesClass && matchesSection;
        });

        if (finalStudents.length === 0) {
            window.alert(`No students found for ${targetClass} ${targetSection}.`);
            return;
        }

        const totalValue = finalStudents.length * Number(amount);
        if (!window.confirm(`Assign fee to ALL ${finalStudents.length} students in this class roster?\n\n(Includes both registered and pending students)\n\nTotal Billing: ₹${totalValue.toLocaleString()}`)) {
            return;
        }

        setLoading(true);

        try {
            const batch = writeBatch(db);
            const processedIds = new Set();

            finalStudents.forEach(sDoc => {
                // KEY FIX: Use userId if they have joined, otherwise use the Allotment ID!
                const studentIdToUse = sDoc.userId || sDoc.id;

                // DEDUPLICATION: Prevent double-billing if student appears twice in roster
                if (processedIds.has(studentIdToUse)) return;
                processedIds.add(studentIdToUse);

                const feeRef = doc(collection(db, "fees"));

                batch.set(feeRef, {
                    studentId: studentIdToUse,
                    allotmentId: sDoc.id, // Keep a reference to the school's record
                    studentName: sDoc.name || sDoc.studentName || "Student",
                    institutionId: instId,
                    institutionName: userData.schoolName || userData.name || "School",
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: normalizedTarget,
                    section: sDoc.section || 'All',
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            window.alert(`✅ Success!\n\nFee assigned to all ${finalStudents.length} students correctly.`);

            setTitle('');
            setAmount('');
            setDueDate('');
            setLoading(false);

            // Update local recent list
            setRecentFees(prev => [{
                id: 'new-' + Date.now(),
                title,
                amount,
                class: normalizedTarget,
                section: targetSection,
                createdAt: { seconds: Date.now() / 1000 }
            }, ...prev].slice(0, 5));

        } catch (err) {
            console.error("Assignment Error:", err);
            window.alert("Error: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* TOP STATS BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <button className="btn" onClick={() => navigate(-1)} style={{ background: '#f1f2f6', color: '#2f3542', border: 'none', borderRadius: '12px', padding: '10px 20px' }}>
                    ← Dashboard
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="stat-pill" style={{ background: '#e1f5fe', color: '#01579b', padding: '8px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        📋 {schoolStats.total} Total Students (Roster)
                    </div>
                    <div className="stat-pill" style={{ background: '#e8f5e9', color: '#2e7d32', padding: '8px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        📱 {schoolStats.approved} Registered on App
                    </div>
                    {schoolStats.unlinked > 0 && (
                        <div className="stat-pill" style={{ background: '#fff3e0', color: '#ef6c00', padding: '8px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ✉️ {schoolStats.unlinked} Invitation Sent
                        </div>
                    )}
                </div>
            </div>

            <h1 style={{ textAlign: 'center', fontWeight: '900', color: '#2d3436', marginBottom: '40px' }}>Fee Administration</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>

                <div className="card" style={{ padding: '40px', borderRadius: '30px', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', background: 'white' }}>
                    <h3 style={{ marginBottom: '25px', color: '#2d3436' }}>New Assignment</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>Fee Title</label>
                            <input className="input-field" placeholder="Tuition Fee Term 1" value={title} onChange={e => setTitle(e.target.value)} style={{ padding: '15px', borderRadius: '15px' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>Amount (₹)</label>
                                <input type="number" className="input-field" placeholder="1000" value={amount} onChange={e => setAmount(e.target.value)} style={{ padding: '15px', borderRadius: '15px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>Due Date</label>
                                <input type="date" className="input-field" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ padding: '15px', borderRadius: '15px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>Class</label>
                                <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} style={{ padding: '15px', borderRadius: '15px' }}>
                                    <option value="">-- Select --</option>
                                    {classOptions.map(opt => <option key={opt.value} value={opt.value}>Class {opt.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>Section</label>
                                <select className="input-field" value={targetSection} onChange={e => setTargetSection(e.target.value)} style={{ padding: '15px', borderRadius: '15px' }}>
                                    {sectionOptions.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sections' : `Section ${s}`}</option>)}
                                </select>
                            </div>
                        </div>

                        {targetClass && (
                            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '20px', border: '1px solid #e9ecef' }}>
                                <div style={{ fontWeight: 'bold', color: '#0fb9b1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    🎯 Targeting {matchingNow} Total Students
                                </div>
                                {previewList.length > 0 && (
                                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#636e72' }}>
                                        Roster Preview: {previewList.map(s => s.name || s.studentName).join(', ')} {matchingNow > 10 ? '...' : ''}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleAssignFee}
                            disabled={loading}
                            className="btn"
                            style={{
                                background: loading ? '#ccc' : '#2d3436',
                                color: 'white',
                                padding: '20px',
                                borderRadius: '20px',
                                fontWeight: '800',
                                fontSize: '1.1rem',
                                marginTop: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}
                        >
                            {loading ? 'Batch Saving...' : 'Confirm Assignment'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card" style={{ padding: '25px', borderRadius: '24px', background: '#f8f9fa', border: 'none' }}>
                        <h4 style={{ marginBottom: '15px', color: '#636e72' }}>🕒 Recent Activity</h4>
                        <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '10px' }}>Click to view payment status</p>
                        {recentFees.length === 0 ? <p className="text-muted" style={{ fontSize: '0.9rem' }}>No recent records.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {recentFees.map(f => (
                                    <div
                                        key={f.id}
                                        onClick={() => navigate(`/fee-details/${f.id}?class=${f.class}&section=${f.section}&title=${encodeURIComponent(f.title)}`)}
                                        style={{
                                            background: 'white',
                                            padding: '15px',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '0.85rem',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
                                        }}
                                    >
                                        <span><strong>{f.title}</strong><br /><small>{f.class} - {f.section}</small></span>
                                        <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>₹{f.amount}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .btn:active { transform: scale(0.98); }
                .input-field:focus { outline: none; border-color: #2d3436; box-shadow: 0 0 0 4px rgba(0,0,0,0.05); }
            `}</style>
        </div>
    );
}
