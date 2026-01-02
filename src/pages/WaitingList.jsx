import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export default function WaitingList() {
    const navigate = useNavigate();
    const [waiting, setWaiting] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWaitingList();
    }, []);

    const fetchWaitingList = async () => {
        try {
            const auth = getAuth(); // Import getAuth if needed or use from firebase.js if exported
            const user = auth.currentUser;

            let q;
            if (user) {
                q = query(collection(db, "admissions"),
                    where("status", "==", "waiting"),
                    where("institutionId", "==", user.uid)
                );
            } else {
                // Fallback for demo/testing if not logged in (though they should be)
                q = query(collection(db, "admissions"), where("status", "==", "waiting"));
            }
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setWaiting(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addDemoData = async () => {
        try {
            setLoading(true);
            const demos = [
                { name: "Rahul Sharma", role: "student", age: "15", gender: "Male", status: "waiting", joinedAt: new Date() },
                { name: "Sneha Gupta", role: "teacher", subject: "Math", expYears: "5", gender: "Female", status: "waiting", joinedAt: new Date() },
                { name: "Vikram Singh", role: "student", age: "14", gender: "Male", status: "waiting", joinedAt: new Date() }
            ];

            for (const d of demos) {
                await addDoc(collection(db, "admissions"), d);
            }
            fetchWaitingList(); // Refresh list
            alert("✅ Added 3 Demo Applicants!");
        } catch (e) {
            console.error("Firebase Error:", e);
            if (e.code === 'permission-denied') {
                alert("PERMISSION ERROR: The database rules won't allow this.\nPlease update your Firestore rules to allow write access.");
            } else {
                alert("Failed to add demo data: " + e.message);
            }
        } finally {
            setLoading(false);
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
            <button onClick={() => navigate('/allotment')} style={{ marginBottom: '20px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>⬅ Back to Allotment</button>

            <div className="card">
                <h2 className="text-center">🕒 Waiting List</h2>
                <p className="text-center text-muted">Newly admitted teachers/students waiting for class allotment.</p>

                {waiting.length === 0 ? (
                    <div className="text-center" style={{ padding: '20px' }}>
                        No one in waiting list. <br />
                        <button className="btn" style={{ marginTop: '10px', marginRight: '10px' }} onClick={() => navigate('/admission')}>Add Admission</button>
                        <button className="btn" style={{ marginTop: '10px', backgroundColor: '#2d3436' }} onClick={addDemoData}>Testing: Add 3 Demo Users</button>
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
                                <button className="btn" style={{ backgroundColor: '#6c5ce7', height: 'fit-content' }} onClick={() => handleAllot(p)}>
                                    Allot Class ➡
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
