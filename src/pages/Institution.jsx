import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import { useNavigate } from 'react-router-dom';

export default function Institution() {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const addDemoData = async () => {
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return alert("You must be logged in.");

        const demoApplicants = [
            { name: "Rahul Sharma", role: "student", age: "15", class: "10-A", gender: "Male", status: "waiting", institutionId: uid, joinedAt: new Date() },
            { name: "Sneha Gupta", role: "teacher", subject: "Math", expYears: "5", gender: "Female", status: "waiting", institutionId: uid, joinedAt: new Date() },
            { name: "Vikram Singh", role: "student", age: "14", class: "9-B", gender: "Male", status: "waiting", institutionId: uid, joinedAt: new Date() }
        ];

        try {
            setLoading(true);
            for (const app of demoApplicants) {
                await addDoc(collection(db, "admissions"), app);
            }
            alert("✅ Demo applicants added to Waiting List! \n\nGo to 'Waiting List' to allot them.");
            // Optional: refresh or just let the user navigate
        } catch (e) {
            console.error(e);
            alert("Failed to add demo data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch Institution Profile
                try {
                    const docSnap = await getDoc(doc(db, "institutions", user.uid));
                    if (docSnap.exists()) {
                        setProfile(docSnap.data());
                    }
                } catch (e) {
                    console.error("Error fetching profile:", e);
                }

                // Fetch submissions
                try {
                    const q = query(
                        collection(db, "submissions"),
                        where("institutionId", "==", user.uid)
                    );
                    const snap = await getDocs(q);
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setSubmissions(list);
                } catch (e) {
                    console.error("Error fetching submissions:", e);
                    if (e.code === 'permission-denied') {
                        setError("Missing Permissions: Please update Firestore Security Rules in Firebase Console.");
                    } else {
                        setError("Error fetching data. Check console.");
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="container">Loading...</div>;

    if (error) return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
            <h2>⚠️ Action Required</h2>
            <p>{error}</p>
            <p style={{ fontSize: '14px', color: '#555' }}>Go to Firebase Console &rarr; Firestore Database &rarr; Rules and set them to allow read/write.</p>
        </div>
    );

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AIBadge />
            <AnnouncementBar title={profile?.institutionName || "Institution Dashboard"} />

            <div className="container">
                <div className="card" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* The h2 is now part of the header, so it's removed from here */}
                        {profile && (
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#666' }}>
                                <p>{profile.principalName} (Principal)</p>
                                <p>Est: {profile.estYear}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6c5ce7' }} onClick={() => navigate('/allotment')}>
                        📘 <span style={{ marginTop: '10px', fontSize: '14px' }}>Allotments</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0984e3' }} onClick={() => navigate('/attendance')}>
                        📅 <span style={{ marginTop: '10px', fontSize: '14px' }}>Attendance</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00b894' }} onClick={() => navigate('/group')}>
                        👥 <span style={{ marginTop: '10px', fontSize: '14px' }}>Groups</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e67e22' }} onClick={() => navigate('/exam')}>
                        📢 <span style={{ marginTop: '10px', fontSize: '14px' }}>Notify/Exams</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e84393' }} onClick={() => navigate('/feedback-overview')}>
                        📊 <span style={{ marginTop: '10px', fontSize: '14px' }}>Feedback View</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff7675' }} onClick={() => navigate('/health')}>
                        🏥 <span style={{ marginTop: '10px', fontSize: '14px' }}>Health Camp</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#636e72' }} onClick={() => navigate('/waiting-list')}>
                        🕒 <span style={{ marginTop: '10px', fontSize: '14px' }}>Waiting List</span>
                    </button>
                    <button className="btn" style={{ height: '100px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d63031' }} onClick={() => navigate('/video-library')}>
                        🎬 <span style={{ marginTop: '10px', fontSize: '14px' }}>Video Library</span>
                    </button>
                </div>

                <div className="card">
                    <h3 className="text-center">Student/Teacher Submissions</h3>
                    <p className="text-center text-muted">Manage your submissions here (Excel View)</p>

                    {submissions.length === 0 ? (
                        <p className="text-center">No submissions yet.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Role</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Gender</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Class/Exp</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Sub. Date</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map(sub => (
                                        <tr key={sub.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px' }}>{sub.role}</td>
                                            <td style={{ padding: '10px' }}>{sub.firstName} {sub.secondName}</td>
                                            <td style={{ padding: '10px' }}>{sub.gender}</td>
                                            <td style={{ padding: '10px' }}>{sub.role === 'student' ? sub.class : `${sub.expYears || 0}y ${sub.expMonths || 0}m`}</td>
                                            <td style={{ padding: '10px' }}>{sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: sub.status === 'pending' ? '#f1c40f' : '#2ecc71',
                                                    color: sub.status === 'pending' ? 'black' : 'white',
                                                    fontSize: '12px'
                                                }}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
