import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import { useUser } from '../context/UserContext';

export default function Allotment() {
    const { userData } = useUser();
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

    // Transfer Modal State
    const [transferTarget, setTransferTarget] = useState(null); // { id, name, subject, oldClass, oldSection, userId }
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState('');

    // Fetch Teachers for dropdown
    useEffect(() => {
        if (role === 'teacher') {
            const fetchTeachers = async () => {
                const instId = userData?.role === 'institution' ? userData.uid : userData?.institutionId;
                // Fix: Only show teachers from THIS institution
                let q;
                if (instId) {
                    q = query(collection(db, "users"), where("role", "==", "teacher"), where("institutionId", "==", instId));
                } else {
                    q = query(collection(db, "users"), where("role", "==", "teacher"));
                }
                const snap = await getDocs(q);
                setExistingTeachers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            };
            fetchTeachers();
        }
    }, [role, userData]);

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

    // Helper to update Timetable text
    // Modes:
    // 1. REPLACE: oldName + newName -> Swaps them
    // 2. REMOVE: oldName + null -> Removes oldName
    // 3. INJECT: null + newName -> Finds Subject (without name) and appends newName
    const updateTimetableTeacher = async (classIds, section, subject, oldName, newName, instId) => {
        try {
            console.log(`Updating Timetable: ${classIds} ${section} | ${subject}: ${oldName} -> ${newName}`);

            // Query 1: New Schema
            const q1 = query(
                collection(db, "timetables"),
                where("institutionId", "==", instId),
                where("section", "==", section)
            );

            // Query 2: Legacy Schema (some older docs might only have createdBy)
            const q2 = query(
                collection(db, "timetables"),
                where("createdBy", "==", instId),
                where("section", "==", section)
            );

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            // Merge results by ID to handle overlaps
            const combinedDocs = new Map();
            snap1.docs.forEach(d => combinedDocs.set(d.id, d));
            snap2.docs.forEach(d => combinedDocs.set(d.id, d));

            const updates = [];
            combinedDocs.forEach(d => {
                const data = d.data();
                const dClass = String(data.class).replace(/(\d+)(st|nd|rd|th)/i, '$1');
                const targetClass = String(classIds[0]).replace(/(\d+)(st|nd|rd|th)/i, '$1');

                if (dClass !== targetClass) return;

                let scheduleChanged = false;
                const schedule = data.schedule || {};
                const newSchedule = JSON.parse(JSON.stringify(schedule));

                Object.keys(newSchedule).forEach(day => {
                    Object.keys(newSchedule[day]).forEach(pId => {
                        const cell = newSchedule[day][pId];
                        let val = typeof cell === 'object' ? (cell.subject || '') : cell;

                        // Check for SUBJECT match (Case insensitive)
                        // Escaping special regex chars in subject just in case
                        const escapedSub = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const subRegex = new RegExp(escapedSub, 'i');

                        if (subRegex.test(val)) {
                            // Slot contains the Subject.
                            // We need to Rewrite the teacher part.
                            // Strategy: Look for "Subject" followed optionally by " (Anything)"
                            // Regex: /(Subject)(\s*\(.*?\))?/gi

                            const tokenRegex = new RegExp(`(${escapedSub})(\\s*\\(.*?\\))?`, 'gi');

                            if (newName) {
                                // REPLACE / INJECT Mode -> "Subject (NewName)"
                                // We replace the match with "Subject (NewName)"
                                val = val.replace(tokenRegex, `$1 (${newName})`);
                                scheduleChanged = true;
                            } else {
                                // REMOVE Mode -> "Subject"
                                // We remove the parens part, keeping just the subject
                                val = val.replace(tokenRegex, '$1');
                                scheduleChanged = true;
                            }
                        }

                        // Save back
                        if (typeof cell === 'object') {
                            newSchedule[day][pId] = { ...cell, subject: val };
                        } else {
                            newSchedule[day][pId] = val;
                        }
                    });
                });

                if (scheduleChanged) {
                    updates.push(updateDoc(doc(db, "timetables", d.id), { schedule: newSchedule }));
                }
            });

            await Promise.all(updates);
            console.log("Timetable Updated Successfully.");
        } catch (e) {
            console.error("Timetable Update Failed:", e);
        }
    };

    const handleAdd = async () => {
        if (!name || !extra || !cls || !sec || !role) return alert('Fill all fields');

        try {
            const finalUserId = personToAllot?.userId || selectedUserId || null;
            const instId = (userData?.role === 'institution' ? userData.uid : userData?.institutionId);

            // CHECK FOR EXISTING TEACHER (COLLISION)
            if (role === 'teacher') {
                const existing = entries.find(e => e.subject.toLowerCase() === extra.toLowerCase());
                if (existing) {
                    if (!window.confirm(`'${existing.name}' is already assigned as '${existing.subject}' teacher for ${cls}-${sec}.\n\nDo you want to REPLACE them with '${name}'?`)) {
                        return;
                    }

                    // 1. Update Allotment
                    await updateDoc(doc(db, "teacher_allotments", existing.id), {
                        name: name,
                        teacherId: finalUserId,
                        userId: finalUserId,
                        updatedAt: new Date()
                    });

                    // 2. Update Group
                    const groupId = `${extra}_${cls}_${sec}`.replace(/\s+/g, "_").toUpperCase();
                    await updateDoc(doc(db, "groups", groupId), { teacherName: name }).catch(e => console.log("Group update skipped"));

                    // 3. Update Timetable (Old Name -> New Name)
                    await updateTimetableTeacher([cls], sec, extra, existing.name, name, instId);

                    alert(`Replaced ${existing.name} with ${name} successfully!`);
                    setName(''); setExtra(''); setSelectedUserId(null); fetchEntries();
                    return;
                }
            }

            const colName = role === 'teacher' ? 'teacher_allotments' : 'student_allotments';
            const docData = {
                name,
                classAssigned: cls,
                section: sec,
                [role === 'teacher' ? 'subject' : 'age']: extra,
                createdBy: currentUser ? currentUser.uid : 'unknown',
                institutionId: instId || null,
                userId: finalUserId
            };
            if (role === 'teacher' && finalUserId) docData.teacherId = finalUserId;

            await addDoc(collection(db, colName), docData);

            // Group Creation
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

                // INJECT into Timetable (Subject-Only slots get Name)
                if (instId) {
                    await updateTimetableTeacher([cls], sec, extra, null, name, instId);
                }
            }

            // Profile Updates
            if (finalUserId) {
                try {
                    const userColl = (personToAllot?.role === 'teacher') ? 'teachers' : 'users';
                    await setDoc(doc(db, userColl, finalUserId), {
                        approved: true, assignedClass: cls, assignedSection: sec, class: cls, section: sec,
                        ...(role === 'teacher' ? { subject: extra } : { age: extra }), updatedAt: new Date()
                    }, { merge: true });
                } catch (profErr) { }
            }

            if (personToAllot) {
                await updateDoc(doc(db, "admissions", personToAllot.id), { status: 'allotted', assignedClass: cls, assignedSection: sec, allottedAt: new Date() });
                alert(`${name} allotted to ${cls}-${sec}!`);
                navigate('/waiting-list');
                return;
            }

            setName(''); setExtra(''); setSelectedUserId(null); fetchEntries();
        } catch (e) {
            console.error(e);
            alert("Error adding entry");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete?')) return;
        const colName = role === 'teacher' ? 'teacher_allotments' : 'student_allotments';

        // Fetch to get details before delete
        try {
            const entryRef = doc(db, colName, id);
            const entrySnap = await getDoc(entryRef);

            if (entrySnap.exists()) {
                const entry = entrySnap.data();

                // If it's a teacher, clean up Timetable
                if (role === 'teacher') {
                    const instId = userData?.role === 'institution' ? userData.uid : userData?.institutionId;
                    if (instId && entry.name && entry.subject && entry.classAssigned && entry.section) {
                        await updateTimetableTeacher(
                            [entry.classAssigned],
                            entry.section,
                            entry.subject,
                            entry.name,
                            null, // Remove mode
                            instId
                        );
                    }
                }
            }

            await deleteDoc(entryRef);
            fetchEntries();
        } catch (e) {
            console.error(e);
            alert("Delete failed");
        }
    };

    const initiateTransfer = (entry) => {
        setTransferTarget({
            id: entry.id,
            name: entry.name,
            subject: entry.subject,
            oldClass: entry.classAssigned,
            oldSection: entry.section,
            userId: entry.userId, // allotments usually have userId
            teacherId: entry.teacherId
        });
        setTargetClass('');
        setTargetSection('');
    };

    const handleTransfer = async () => {
        if (!targetClass || !targetSection) return alert("Please select target Class and Section");
        if (!transferTarget) return;

        // confirm
        if (!window.confirm(`Transfer ${transferTarget.name} from ${transferTarget.oldClass}-${transferTarget.oldSection} to ${targetClass}-${targetSection}?`)) return;

        try {
            const { id, subject, oldClass, oldSection, userId, teacherId } = transferTarget;
            const finalUserId = teacherId || userId;

            // 1. Calculate Group IDs
            const oldGroupId = `${subject}_${oldClass}_${oldSection}`.replace(/\s+/g, "_").toUpperCase();
            const newGroupId = `${subject}_${targetClass}_${targetSection}`.replace(/\s+/g, "_").toUpperCase();

            console.log(`Transferring Group: ${oldGroupId} -> ${newGroupId}`);

            // 2. Move Group (Create New, Delete Old - Firestore doesn't support rename)
            // Check if old group exists
            const oldGroupRef = doc(db, "groups", oldGroupId);
            const oldGroupSnap = await getDoc(oldGroupRef);

            if (oldGroupSnap.exists()) {
                const groupData = oldGroupSnap.data();
                // Create New Group
                await setDoc(doc(db, "groups", newGroupId), {
                    ...groupData,
                    className: targetClass,
                    section: targetSection,
                    groupName: `${subject} (${targetClass}-${targetSection})`, // Update name
                    updatedAt: new Date()
                });
                // Delete Old Group
                await deleteDoc(oldGroupRef);
            } else {
                // If old group missing, create new one anyway
                await setDoc(doc(db, "groups", newGroupId), {
                    groupName: `${subject} (${targetClass}-${targetSection})`,
                    subject: subject,
                    className: targetClass,
                    section: targetSection,
                    teacherName: transferTarget.name,
                    createdBy: currentUser ? currentUser.uid : 'system',
                    createdAt: new Date(),
                    type: 'academic'
                });
            }

            // 3. Update Allotment Doc
            await updateDoc(doc(db, "teacher_allotments", id), {
                classAssigned: targetClass,
                section: targetSection
            });

            // 4. Update Profile (if linked)
            if (finalUserId) {
                // Try updating standard users or teachers collection
                try {
                    // Update teachers collection
                    await setDoc(doc(db, "teachers", finalUserId), {
                        assignedClass: targetClass,
                        assignedSection: targetSection,
                        class: targetClass,
                        section: targetSection
                    }, { merge: true });
                } catch (e) { console.log("Updating teachers coll failed, trying users..."); }

                try {
                    await setDoc(doc(db, "users", finalUserId), {
                        assignedClass: targetClass,
                        assignedSection: targetSection,
                        class: targetClass,
                        section: targetSection
                    }, { merge: true });
                } catch (e) { }
            }

            // 5. Update Timetable (Remove Teacher Name from OLD Class)
            const instId = userData?.role === 'institution' ? userData.uid : userData?.institutionId;
            if (instId) {
                await updateTimetableTeacher([oldClass], oldSection, subject, transferTarget.name, null, instId);
            }

            alert("Transfer Successful!");
            setTransferTarget(null);
            fetchEntries(); // Refresh list (item will disappear from current view)

        } catch (e) {
            console.error("Transfer Error:", e);
            alert("Transfer failed: " + e.message);
        }
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

                            <div style={{ marginBottom: '20px', maxHeight: '500px', overflowY: 'auto' }}>
                                {entries.length === 0 ? <p className="text-center text-muted">No entries found.</p> : (
                                    role === 'teacher' ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                            <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #dfe6e9' }}>
                                                <tr>
                                                    <th style={{ padding: '12px', textAlign: 'center', width: '50px', color: '#636e72', fontSize: '13px' }}>S.No</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', color: '#636e72', fontSize: '13px' }}>Name</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', color: '#636e72', fontSize: '13px' }}>Subject</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', color: '#636e72', fontSize: '13px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entries.map((e, index) => (
                                                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f2f6' }}>
                                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                                                        <td style={{ padding: '12px' }}>{e.name}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{ background: '#e1f5fe', color: '#0288d1', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                                                {e.subject}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        setName(e.name);
                                                                        setExtra(e.subject || '');
                                                                        if (e.userId) setSelectedUserId(e.userId);
                                                                        alert(`Selected ${e.name}. \n1. Now change Class/Section dropdowns at the top. \n2. Then click 'Add' below.`);
                                                                    }}
                                                                    style={{
                                                                        border: 'none', background: '#e3f2fd', color: '#1976d2', padding: '6px 10px',
                                                                        borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                                                                    }}
                                                                    title="Add to Another Class"
                                                                >
                                                                    + Another Class
                                                                </button>

                                                                <button
                                                                    onClick={() => initiateTransfer(e)}
                                                                    style={{
                                                                        border: 'none', background: '#fff3e0', color: '#f57c00', padding: '6px 10px',
                                                                        borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                                                                    }}
                                                                >
                                                                    Transfer
                                                                </button>

                                                                <button
                                                                    onClick={() => handleDelete(e.id)}
                                                                    style={{
                                                                        border: 'none', background: '#ffebee', color: '#c62828', padding: '6px 10px',
                                                                        borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                                                                    }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        // Student List (Original Card Style)
                                        entries.map(e => (
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
                                        ))
                                    )
                                )}
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

                {/* Transfer Modal */}
                {transferTarget && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                    }}>
                        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', width: '350px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ marginTop: 0, color: '#2d3436' }}>Transfer Teacher</h3>
                            <p style={{ color: '#636e72', fontSize: '14px' }}>
                                Move <strong>{transferTarget.name}</strong> from
                                <span style={{ background: '#dfe6e9', padding: '2px 5px', borderRadius: '3px', margin: '0 5px' }}>
                                    {transferTarget.oldClass}-{transferTarget.oldSection}
                                </span>
                                to:
                            </p>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <select
                                    className="input-field"
                                    value={targetClass}
                                    onChange={e => setTargetClass(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Class</option>
                                    {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select
                                    className="input-field"
                                    value={targetSection}
                                    onChange={e => setTargetSection(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Section</option>
                                    {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    className="btn"
                                    onClick={handleTransfer}
                                    style={{ flex: 1, backgroundColor: '#f1c40f', color: '#333' }}
                                >
                                    Confirm Transfer
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => setTransferTarget(null)}
                                    style={{ flex: 1, backgroundColor: '#b2bec3' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
