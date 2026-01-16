import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';

export default function Allotment() {
    const navigate = useNavigate();
    const location = useLocation();

    // Check if we came from Waiting List to allot someone specific
    const personToAllot = location.state?.personToAllot;

    const [role, setRole] = useState(personToAllot ? personToAllot.role : null);
    const [cls, setCls] = useState('');
    const [sec, setSec] = useState('');
    const [entries, setEntries] = useState([]);
    const [name, setName] = useState(personToAllot ? personToAllot.name : '');
    const [extra, setExtra] = useState(personToAllot ? (personToAllot.subject || personToAllot.age) : '');
    const [currentUser, setCurrentUser] = useState(null);
    const [existingTeachers, setExistingTeachers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);

    // Fetch Teachers for dropdown
    useEffect(() => {
        if (role === 'teacher') {
            const fetchTeachers = async () => {
                const q = query(collection(db, "users"), where("role", "==", "teacher"));
                const snap = await getDocs(q);
                setExistingTeachers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            };
            fetchTeachers();
        }
    }, [role]);

    const handleSelectTeacher = (e) => {
        const uid = e.target.value;
        setSelectedUserId(uid);
        if (uid) {
            const t = existingTeachers.find(t => t.uid === uid);
            if (t) {
                setName(t.name);
                setExtra(t.subject || '');
            }
        } else {
            setName('');
            setExtra('');
        }
    };

    // If Allotting a person, verify we are in the right Role tab
    useEffect(() => {
        if (personToAllot && role !== personToAllot.role) {
            setRole(personToAllot.role);
        }
    }, [personToAllot, role]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const fetchEntries = async () => {
        if (!cls || !sec || !role) return;
        const colName = role === 'teacher' ? 'teacher_allotments' : 'student_allotments';
        const q = query(collection(db, colName), where('classAssigned', '==', cls), where('section', '==', sec));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
        setEntries(list);
    };

    useEffect(() => {
        fetchEntries();
    }, [role, cls, sec]);

    const handleAdd = async () => {
        if (!name || !extra || !cls || !sec || !role) return alert('Fill all fields');

        try {
            const finalUserId = personToAllot?.userId || selectedUserId || null;

            const colName = role === 'teacher' ? 'teacher_allotments' : 'student_allotments';
            const docData = {
                name,
                classAssigned: cls,
                section: sec,
                [role === 'teacher' ? 'subject' : 'age']: extra,
                createdBy: currentUser ? currentUser.uid : 'unknown',
                userId: finalUserId
            };
            if (role === 'teacher' && finalUserId) docData.teacherId = finalUserId;

            // Add to main allotment collection
            await addDoc(collection(db, colName), docData);

            // AUTO-CREATE GROUP if Teacher
            if (role === 'teacher') {
                const subject = extra;
                const groupId = `${subject}_${cls}_${sec}`.replace(/\s+/g, "_").toUpperCase();

                await setDoc(doc(db, "groups", groupId), {
                    groupName: `${subject} (${cls}-${sec})`,
                    subject: subject,
                    className: cls,
                    section: sec,
                    teacherName: name,
                    createdBy: currentUser ? currentUser.uid : 'system',
                    createdAt: new Date(),
                    type: 'academic'
                });
                console.log("Group Created:", groupId);
            }

            // Update Profile Link (For both Waiting List and Manual Selection)
            if (finalUserId) {
                // Trust 'users' collection for manual selection, or respect legacy logic if waiting list
                const userColl = (personToAllot?.role === 'teacher') ? 'teachers' : 'users';

                await setDoc(doc(db, userColl, finalUserId), {
                    approved: true,
                    assignedClass: cls,
                    assignedSection: sec,
                    class: cls,
                    section: sec,
                    ...(role === 'teacher' ? { subject: extra } : { age: extra }),
                    updatedAt: new Date()
                }, { merge: true });
            }

            // If this was from waiting list, update the admission status!
            if (personToAllot) {
                await updateDoc(doc(db, "admissions", personToAllot.id), {
                    status: 'allotted',
                    assignedClass: cls,
                    assignedSection: sec,
                    allottedAt: new Date()
                });

                alert(`${name} has been successfully allotted to Class ${cls}-${sec}!\nStudy Group '${extra} (${cls}-${sec})' has been created.`);
                navigate('/waiting-list');
                return;
            }

            setName('');
            setExtra('');
            setSelectedUserId(null); // Clear selection
            fetchEntries();
        } catch (e) {
            console.error(e);
            alert("Error adding entry");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete?')) return;
        const colName = role === 'teacher' ? 'teacher_allotments' : 'student_allotments';
        await deleteDoc(doc(db, colName, id));
        fetchEntries();
    };

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title="Class & Section Allotment" />

            {/* Teaching Context Warning */}
            <div style={{
                background: 'linear-gradient(to right, #ff6b6b, #ff9f43)',
                color: 'white',
                padding: '10px',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
            }}>
                📢 Attention: Assign teachers and students only after proper feedback and evaluation process!
            </div>

            <div className="container">
                <div className="card">
                    {/* H2 removed as title is now in TopBar */}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <select value={cls} onChange={e => setCls(e.target.value)} className="input-field" style={{ width: 'auto', minWidth: '150px' }}>
                            <option value="">Select Class</option>
                            {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={sec} onChange={e => setSec(e.target.value)} className="input-field" style={{ width: 'auto', minWidth: '150px' }}>
                            <option value="">Select Section</option>
                            {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
                        <button
                            className="btn"
                            style={{ backgroundColor: role === 'teacher' ? '#0984e3' : '#b2bec3', flex: 1 }}
                            onClick={() => setRole(role === 'teacher' ? null : 'teacher')}
                        >
                            👨‍🏫 {role === 'teacher' ? 'Close Teachers' : 'Teachers'}
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: role === 'student' ? '#00b894' : '#b2bec3', flex: 1 }}
                            onClick={() => setRole(role === 'student' ? null : 'student')}
                        >
                            👩‍🎓 {role === 'student' ? 'Close Students' : 'Students'}
                        </button>
                    </div>

                    {role && (
                        <div style={{ animation: 'fadeIn 0.5s' }}>
                            <h3 className="text-center" style={{ margin: '20px 0' }}>{role === 'teacher' ? 'Teachers' : 'Students'} in {cls} - {sec}</h3>

                            <div style={{ marginBottom: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                                {entries.length === 0 ? <p className="text-center text-muted">No entries found.</p> : entries.map(e => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f4f4f4', marginBottom: '8px', borderRadius: '8px' }}>
                                        <span style={{ fontWeight: 'bold' }}>{e.name}</span>
                                        <span style={{ color: '#666' }}>({role === 'teacher' ? e.subject : `${e.age} yrs`})</span>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {role === 'teacher' && (
                                                <button
                                                    className="btn"
                                                    style={{ backgroundColor: '#0984e3', padding: '5px 12px', fontSize: '12px' }}
                                                    onClick={() => {
                                                        setName(e.name);
                                                        setExtra(e.subject || '');
                                                        if (e.userId) setSelectedUserId(e.userId);
                                                        alert(`Selected ${e.name}. \n1. Now change Class/Section dropdowns at the top. \n2. Then click 'Add' below.`);
                                                    }}
                                                >
                                                    + Another Class
                                                </button>
                                            )}
                                            <button className="btn" style={{ backgroundColor: '#e74c3c', padding: '5px 12px', fontSize: '12px' }} onClick={() => handleDelete(e.id)}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: '#ecf0f1', padding: '15px', borderRadius: '8px' }}>
                                {role === 'teacher' && (
                                    <select className="input-field" style={{ flex: 2 }} value={selectedUserId || ''} onChange={handleSelectTeacher}>
                                        <option value="">-- Select Existing Teacher --</option>
                                        {existingTeachers.map(t => <option key={t.uid} value={t.uid}>{t.name} ({t.subject})</option>)}
                                        <option value="">(Or Type Manually)</option>
                                    </select>
                                )}
                                <input className="input-field" style={{ flex: 2 }} placeholder="Name" value={name} onChange={e => setName(e.target.value)} disabled={!!selectedUserId} />
                                <input className="input-field" style={{ flex: 1 }} placeholder={role === 'teacher' ? 'Subject' : 'Age'} value={extra} onChange={e => setExtra(e.target.value)} />
                                <button className="btn" style={{ flex: 1, backgroundColor: '#2ecc71' }} onClick={handleAdd}>Add</button>
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <button className="btn" style={{ backgroundColor: '#6c5ce7', marginRight: '10px' }} onClick={() => navigate('/admission')}>➕ New Admission</button>
                        <button className="btn" style={{ backgroundColor: '#fdcb6e', color: '#333' }} onClick={() => navigate('/waiting-list')}>🕒 View Waiting List</button>
                    </div>

                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
