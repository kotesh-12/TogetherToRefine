import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export default function WaitingList() {
    const navigate = useNavigate();
    const [waiting, setWaiting] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        let q;

        if (user) {
            q = query(collection(db, "admissions"),
                where("status", "==", "waiting"),
                where("institutionId", "==", user.uid)
            );
        } else {
            // Fallback for demo/testing
            q = query(collection(db, "admissions"), where("status", "==", "waiting"));
        }

        // Real-time listener to fix stale data issues
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setWaiting(list);
            setLoading(false);
        }, (error) => {
            console.error("Waiting List Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleRemove = async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove ${name}? This acts as a rejection.`)) return;
        try {
            await deleteDoc(doc(db, "admissions", id));
        } catch (e) {
            console.error("Remove failed:", e);
            alert("Failed to remove: " + e.message);
        }
    };



    const handleAllot = (person) => {
        // We will pass this person's ID to Allotment page to pre-fill or handle logic
        // For simplicity, let's navigate to Allotment and pass state
        navigate('/allotment', { state: { personToAllot: person } });
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container" style={{ maxWidth: '800px', marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                <button onClick={() => navigate('/institution')} className="btn-back-marker">Back to Dashboard</button>
            </div>

            <div className="card">
                <h2 className="text-center">🕒 Waiting List</h2>
                <p className="text-center text-muted">Newly admitted teachers/students waiting for class allotment.</p>

                {waiting.length === 0 ? (
                    <div className="text-center" style={{ padding: '20px' }}>
                        No one in waiting list. <br />
                        <button className="btn" style={{ marginTop: '10px', marginRight: '10px' }} onClick={() => navigate('/admission')}>Add Admission</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
                        {waiting.map(p => (
                            <div key={p.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '15px', background: p.role === 'teacher' ? '#e6f0ff' : '#e6ffec',
                                borderRadius: '8px', borderLeft: `5px solid ${p.role === 'teacher' ? '#0984e3' : '#00b894'}`
                            }}>
                                <div>
                                    <h4 style={{ margin: 0 }}>{p.name}</h4>
                                    <span style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{p.role}</span>
                                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                                        {p.role === 'teacher' ? `Sub: ${p.subject}` : `Age: ${p.age}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn" style={{ backgroundColor: '#6c5ce7', height: 'fit-content' }} onClick={() => handleAllot(p)}>
                                        Allot Class ➡
                                    </button>
                                    <button className="btn" style={{ backgroundColor: '#d63031', height: 'fit-content' }} onClick={() => handleRemove(p.id, p.name)}>
                                        ✖ Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Manual Approval Tool */}
            <div className="card" style={{ marginTop: '30px', borderTop: '4px solid #fab1a0' }}>
                <h3>🛠️ Admin Troubleshooting</h3>
                <p className="text-muted">If a user is stuck in "Pending" even after allotment, enter their UID below to force-approve them.</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        id="manualUid"
                        className="input-field"
                        placeholder="Paste User UID (from Firebase Auth)..."
                        style={{ flex: 1 }}
                    />
                    <button className="btn" style={{ backgroundColor: '#2d3436' }} onClick={async () => {
                        const uid = document.getElementById('manualUid').value.trim();
                        if (!uid) return alert("Enter a UID");

                        try {
                            // Try both collections
                            await updateDoc(doc(db, "users", uid), { approved: true, updatedAt: new Date() });

                            // Cleanup Waiting List
                            const q = query(collection(db, "admissions"), where("userId", "==", uid), where("status", "==", "waiting"));
                            const snap = await getDocs(q);
                            snap.forEach(d => updateDoc(d.ref, { status: 'allotted', completedAt: new Date() }));

                            alert(`✅ Validated student ${uid}. They should now be able to login.`);
                        } catch {
                            try {
                                await updateDoc(doc(db, "teachers", uid), { approved: true, updatedAt: new Date() });

                                // Cleanup Waiting List
                                const q = query(collection(db, "admissions"), where("userId", "==", uid), where("status", "==", "waiting"));
                                const snap = await getDocs(q);
                                snap.forEach(d => updateDoc(d.ref, { status: 'allotted', completedAt: new Date() }));

                                alert(`✅ Validated teacher ${uid}. They should now be able to login.`);
                            } catch (e2) {
                                alert("❌ Failed. Ensure UID is correct and user exists in Firestore 'users' or 'teachers'. " + e2.message);
                            }
                        }
                    }}>
                        Force Approve
                    </button>
                </div>
            </div>
        </div>
    );
}
