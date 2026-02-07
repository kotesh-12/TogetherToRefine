
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
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
        if (e) e.preventDefault();
        console.log("🚀 Starting Fee Assignment Process...");

        if (!userData || !userData.uid) {
            console.error("UserData missing:", userData);
            alert("Error: Institution session not found. Please try logging out and back in.");
            return;
        }

        if (!targetClass || !title || !amount || !dueDate) {
            alert("Please fill all fields: Class, Title, Amount, and Due Date.");
            return;
        }

        setLoading(true);
        console.log(`Searching for students in Class: ${targetClass}...`);

        try {
            // 1. Find all students
            const qStudents = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("institutionId", "==", userData.uid),
                where("class", "==", targetClass)
            );

            const studentSnap = await getDocs(qStudents);

            if (studentSnap.empty) {
                console.warn("No students found.");
                alert(`No students found in Class ${targetClass}. Please check that students have this school and class selected in their profile.`);
                setLoading(false);
                return;
            }

            console.log(`Found ${studentSnap.size} students. Assigning fees locally...`);

            // 2. Loop through students and create fee records
            // Using individual addDoc calls to avoid any potential batch issues for now
            const feePromises = studentSnap.docs.map(studentDoc => {
                const sData = studentDoc.data();
                return addDoc(collection(db, "fees"), {
                    studentId: studentDoc.id,
                    studentName: sData.name || `${sData.firstName || ''} ${sData.secondName || ''}`.trim() || "Student",
                    institutionId: userData.uid,
                    title,
                    amount: Number(amount),
                    dueDate,
                    class: targetClass,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await Promise.all(feePromises);
            console.log("All fee records created successfully.");

            alert(`✅ Success! Fees assigned to ${studentSnap.size} students in ${targetClass}.`);

            // Reset UI
            setTitle('');
            setAmount('');
            setDueDate('');

            // Refresh recent list partially
            setRecentFees(prev => [{ id: 'temp-' + Date.now(), title, class: targetClass, amount, createdAt: { seconds: Date.now() / 1000 } }, ...prev].slice(0, 10));
            setLoading(false);

        } catch (error) {
            console.error("CRITICAL ERROR during fee assignment:", error);
            alert(`Failed to assign fee: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button
                className="btn"
                onClick={() => navigate(-1)}
                style={{ marginBottom: '20px', background: '#ecf0f1', color: '#2c3e50', border: '1px solid #bdc3c7' }}
            >
                ← Back
            </button>
            <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>💰 Fee Management</h2>

            <div className="card" style={{ padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginBottom: '20px', color: '#34495e' }}>➕ Assign New Fee</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Target Class</label>
                        <select
                            className="input-field"
                            value={targetClass}
                            onChange={e => setTargetClass(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                        >
                            <option value="">-- Choose Class --</option>
                            {classOptions.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Fee Title</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Annual Tuition Fee"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Amount (₹)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="5000"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Due Date</label>
                            <input
                                type="date"
                                className="input-field"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAssignFee}
                        disabled={loading}
                        className="btn"
                        style={{
                            marginTop: '10px',
                            background: loading ? '#bdc3c7' : '#2ecc71',
                            color: 'white',
                            padding: '15px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? (
                            <>
                                <div className="spinner-small" style={{ width: '16px', height: '16px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                Processing...
                            </>
                        ) : 'Confirm and Assign Fee'}
                    </button>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </div>

            <div className="card" style={{ marginTop: '30px', padding: '25px' }}>
                <h3 style={{ marginBottom: '15px', color: '#34495e' }}>🕒 Recent Assignments</h3>
                {recentFees.length === 0 ? (
                    <p style={{ color: '#95a5a6', textAlign: 'center' }}>No fees assigned recently.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentFees.map((fee) => (
                            <div key={fee.id} style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #3498db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{fee.title}</div>
                                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Class: {fee.class || fee.targetClass}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '16px' }}>₹{fee.amount}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
