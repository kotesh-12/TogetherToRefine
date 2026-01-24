import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';

export default function Health() {
    const [role, setRole] = useState(null);
    const [userId, setUserId] = useState(null);

    // Institution State
    const [viewClass, setViewClass] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [healthData, setHealthData] = useState({
        height: '', weight: '', bloodGroup: '', vision: '', remarks: '', generalHealth: 'Good'
    });

    // Student/Teacher State
    const [myReport, setMyReport] = useState(null);

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
            setUserId(user.uid);
            fetchUserRole(user.uid);
        }
    }, []);

    const fetchUserRole = async (uid) => {
        // Check Institution
        const instSnap = await getDoc(doc(db, "institutions", uid));
        if (instSnap.exists()) {
            setRole('institution');
            return;
        }
        // Check User
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
            setRole(userSnap.data().role);
            fetchMyReport(uid);
        }
    };

    const fetchMyReport = async (uid) => {
        try {
            const docSnap = await getDoc(doc(db, "health_records", uid));
            if (docSnap.exists()) {
                setMyReport(docSnap.data());
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchStudents = async () => {
        if (!viewClass) return;
        const q = query(collection(db, "student_allotments"), where("classAssigned", "==", viewClass));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const handleSave = async () => {
        if (!selectedStudent) return;
        try {
            await setDoc(doc(db, "health_records", selectedStudent.id), {
                ...healthData,
                studentId: selectedStudent.id,
                name: selectedStudent.name,
                class: viewClass,
                updatedAt: new Date(),
                institutionId: userId
            });
            alert("Health Record Updated!");
            setSelectedStudent(null);
            setHealthData({ height: '', weight: '', bloodGroup: '', vision: '', remarks: '', generalHealth: 'Good' });
        } catch (e) {
            console.error(e);
            alert("Error saving record");
        }
    };

    const renderInstitutionView = () => (
        <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>
            <div className="card">
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <select className="input-field" value={viewClass} onChange={(e) => setViewClass(e.target.value)}>
                        <option value="">Select Class to Monitor</option>
                        {['1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button className="btn" onClick={fetchStudents}>Fetch Students</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* List */}
                    <div style={{ maxHeight: '400px', overflowY: 'auto', borderRight: '1px solid #eee', paddingRight: '10px' }}>
                        {students.map(s => (
                            <div key={s.id} onClick={() => setSelectedStudent(s)}
                                style={{
                                    padding: '10px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                                    background: selectedStudent?.id === s.id ? '#e3f2fd' : 'white'
                                }}>
                                <strong>{s.name}</strong>
                            </div>
                        ))}
                    </div>

                    {/* Form */}
                    <div>
                        {selectedStudent ? (
                            <div>
                                <h4>Update Record: {selectedStudent.name}</h4>
                                <input className="input-field" placeholder="Height (cm)" value={healthData.height} onChange={e => setHealthData({ ...healthData, height: e.target.value })} />
                                <input className="input-field" placeholder="Weight (kg)" value={healthData.weight} onChange={e => setHealthData({ ...healthData, weight: e.target.value })} />

                                {/* Auto-BMI Display */}
                                {healthData.height && healthData.weight && (
                                    <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '5px', margin: '10px 0', borderLeft: '4px solid #0984e3' }}>
                                        <strong>🧮 Calculated BMI: </strong>
                                        {healthData.height > 0 ? ((healthData.weight / ((healthData.height / 100) * (healthData.height / 100)))).toFixed(1) : 'N/A'}
                                        <span style={{ fontSize: '12px', marginLeft: '10px' }}>
                                            ({(healthData.weight / ((healthData.height / 100) * (healthData.height / 100))) < 18.5 ? "Underweight" :
                                                (healthData.weight / ((healthData.height / 100) * (healthData.height / 100))) < 25 ? "Normal" : "Overweight"})
                                        </span>
                                    </div>
                                )}
                                <input className="input-field" placeholder="Blood Group (e.g. O+)" value={healthData.bloodGroup} onChange={e => setHealthData({ ...healthData, bloodGroup: e.target.value })} />
                                <input className="input-field" placeholder="Vision (e.g. 6/6)" value={healthData.vision} onChange={e => setHealthData({ ...healthData, vision: e.target.value })} />
                                <textarea className="input-field" placeholder="Remarks/Issues" value={healthData.remarks} onChange={e => setHealthData({ ...healthData, remarks: e.target.value })} />
                                <button className="btn" style={{ width: '100%', backgroundColor: '#e84393' }} onClick={handleSave}>Save Record</button>
                            </div>
                        ) : (
                            <p className="text-muted">Select a student to enter details.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStudentView = () => (
        <div className="container" style={{ maxWidth: '600px', margin: '20px auto' }}>
            {myReport ? (
                <div className="card" style={{ background: 'linear-gradient(to bottom right, #ffffff, #f0f8ff)', border: '2px solid #81ecec' }}>
                    <div className="text-center" style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '50px' }}>🩺</div>
                        <h3>Health Status: {myReport.generalHealth}</h3>
                        <p className="text-muted">Last Updated: {myReport.updatedAt ? new Date(myReport.updatedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="card" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0984e3' }}>{myReport.height || '--'} cm</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>Height</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e17055' }}>{myReport.weight || '--'} kg</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>Weight</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d63031' }}>{myReport.bloodGroup || '--'}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>Blood Group</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c5ce7' }}>{myReport.vision || '--'}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>Vision</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
                        <strong>👨‍⚕️ Doctor's Remarks:</strong>
                        <p>{myReport.remarks || "No specific remarks."}</p>
                    </div>
                </div>
            ) : (
                <div className="card text-center">
                    <p>No health report found. Please contact your institution admin.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar
                title={role === 'institution' ? "Health Monitoring Camp" : "My Health Report"}
                leftIcon={false}
            />
            {role === 'institution' ? renderInstitutionView() : renderStudentView()}
        </div>
    );
}
