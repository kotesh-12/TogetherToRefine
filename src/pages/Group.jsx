import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Group() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [groupId, setGroupId] = useState(null);
    const [groupData, setGroupData] = useState(null); // Store full group object
    const [file, setFile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Institution/Teacher Mode
    const [isSelecting, setIsSelecting] = useState(false);
    const [groupList, setGroupList] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Teacher Specific State
    const [teacherClasses, setTeacherClasses] = useState([]);
    const [selectedClassScope, setSelectedClassScope] = useState(null); // { className, section }

    // UI States
    const [showMenu, setShowMenu] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [viewMode, setViewMode] = useState(null); // 'members', 'photos', 'files', 'docs'
    const [members, setMembers] = useState([]);

    useEffect(() => {
        const gid = localStorage.getItem("activeGroupId");

        // RESET NAVIGATION ON MOUNT
        // If we are a teacher, we might want to start fresh or restore state?
        // For now, if no GID, go to selection.

        if (!gid) {
            startSelectionFlow();
            return;
        }

        setGroupId(gid);
        const unsubscribe = loadGroupChat(gid);
        return () => { if (unsubscribe) unsubscribe(); };
    }, [navigate, userData]);

    const startSelectionFlow = () => {
        setIsSelecting(true);
        if (userData?.role === 'teacher') {
            fetchTeacherClasses();
        } else {
            fetchGroupsForSelection();
        }
    };

    const fetchTeacherClasses = async () => {
        if (!userData?.uid) return;
        try {
            // Fetch allotments for this teacher (Try userId first, then teacherId)
            let q = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
            let snap = await getDocs(q);

            if (snap.empty) {
                // Fallback for legacy data
                q = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                snap = await getDocs(q);
            }

            const classes = [];
            const seen = new Set();

            snap.forEach(d => {
                // Use userData from context instead of getAuth() directly for consistency
                const uid = userData?.uid;
                if (!uid) { alert("User not identified"); return; }
                const data = d.data();
                if (data.classAssigned && data.section) {
                    const key = `${data.classAssigned}-${data.section}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        // Store createdBy as institutionId
                        classes.push({
                            className: data.classAssigned,
                            section: data.section,
                            institutionId: data.createdBy // Critical for scope
                        });
                    }
                }
            });
            // Sort
            classes.sort((a, b) => a.className.localeCompare(b.className));
            setTeacherClasses(classes);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGroupsForSelection = async (scope = null) => {
        if (!userData) return;
        setGroupList([]);
        setLoadingGroups(true);

        try {

            const role = userData.role;

            // --- ROBUST ID RESOLUTION ---
            let instId = (scope?.institutionId) || userData.institutionId || userData.createdBy;

            // PRIORITY: If I am the institution, MY ID is the key
            if (role === 'institution') instId = userData.uid;

            // Fallback: If ID is missing, try to find it from Allotments (Data Repair/Safety)
            if (!instId && (role === 'student' || role === 'teacher')) {
                console.log("⚠️ ID missing in profile. Attempting to resolve from allotments...");
                try {
                    const collectionName = role === 'student' ? 'student_allotments' : 'teacher_allotments'; // teacher_allotments
                    const idField = role === 'student' ? 'userId' : 'userId'; // Both use userId now usually, or fallback to teacherId

                    let q = query(collection(db, collectionName), where("userId", "==", userData.uid));
                    let snap = await getDocs(q);

                    if (snap.empty && role === 'teacher') {
                        // Legacy Teacher Fallback
                        q = query(collection(db, collectionName), where("teacherId", "==", userData.uid));
                        snap = await getDocs(q);
                    }

                    if (!snap.empty) {
                        const allotData = snap.docs[0].data();
                        instId = allotData.institutionId || allotData.createdBy;
                        console.log("✅ Resolved Institution ID from allotment:", instId);
                    }
                } catch (err) {
                    console.warn("Failed to resolve ID from allotments", err);
                }
            }

            if (role === 'institution') instId = userData.uid;

            if (!instId) {
                console.warn("Could not find a valid Institution ID for selection.");
                setLoadingGroups(false);
                return;
            }

            console.log(`🔍 Group Fetch [Role: ${role}] [InstId: ${instId}] [Scope: ${scope?.className}]`);

            // UNIFIED STRATEGY
            const q1 = query(collection(db, "groups"), where("institutionId", "==", instId));
            const q2 = query(collection(db, "groups"), where("createdBy", "==", instId));

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const mergedMap = new Map();
            snap1.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() }));
            snap2.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() }));
            let rawGroups = Array.from(mergedMap.values());

            console.log(`📦 Found ${rawGroups.length} total groups for institution.`);

            const list = [];

            // Normalize helper
            const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

            if (role === 'institution') {
                rawGroups.forEach(g => list.push(g));
            }
            else if (role === 'teacher') {
                const targetScope = scope || selectedClassScope;
                if (!targetScope) { setLoadingGroups(false); return; }

                const tCls = normalize(targetScope.className || targetScope.class);
                const tSec = (targetScope.section || 'All').toString().toUpperCase();

                // Fetch teacher's subjects from teacher_allotments
                let teacherSubjects = [];
                try {
                    const allotQuery = query(
                        collection(db, 'teacher_allotments'),
                        where('userId', '==', userData.uid)
                    );
                    const allotSnap = await getDocs(allotQuery);

                    if (allotSnap.empty) {
                        // Legacy fallback
                        const legacyQuery = query(
                            collection(db, 'teacher_allotments'),
                            where('teacherId', '==', userData.uid)
                        );
                        const legacySnap = await getDocs(legacyQuery);
                        legacySnap.forEach(doc => {
                            const subject = doc.data().subject || doc.data().subjectName;
                            if (subject) teacherSubjects.push(normalize(subject));
                        });
                    } else {
                        allotSnap.forEach(doc => {
                            const subject = doc.data().subject || doc.data().subjectName;
                            if (subject) teacherSubjects.push(normalize(subject));
                        });
                    }
                } catch (err) {
                    console.warn('Failed to fetch teacher subjects:', err);
                }

                console.log(`👨‍🏫 Teacher subjects:`, teacherSubjects);

                rawGroups.forEach(data => {
                    const gCls = normalize(data.className);
                    const gSec = (data.section || 'All').toString().toUpperCase();
                    const gSubject = normalize(data.subject || data.groupName);

                    // Class and Section matching
                    const classMatches = gCls.includes(tCls) || tCls.includes(gCls);
                    const sectionMatches = (gSec === 'ALL' || gSec === tSec);

                    // Subject matching - teacher can only see groups for their subjects
                    const subjectMatches = teacherSubjects.length === 0 ||
                        teacherSubjects.some(ts => gSubject.includes(ts) || ts.includes(gSubject));

                    if (classMatches && sectionMatches && subjectMatches) {
                        list.push(data);
                    }
                });
            }
            else if (role === 'student') {
                const uClsRaw = userData.class || userData.assignedClass;
                const uCls = normalize(uClsRaw);
                const uSec = (userData.section || userData.assignedSection || 'All').toString().toUpperCase();

                if (!uCls) {
                    console.warn("Student has no class assigned.");
                }

                rawGroups.forEach(data => {
                    const gCls = normalize(data.className);
                    const gSec = (data.section || 'All').toString().toUpperCase();

                    // Robust Matching: Check if one string contains the other (e.g. "10" matches "10th", "Class 10")
                    const classMatches = (uCls && (gCls.includes(uCls) || uCls.includes(gCls)));

                    // Section Logic: 
                    // 1. Group is for 'ALL' sections -> Match
                    // 2. Student is 'ALL' (rare) -> Match
                    // 3. Exact Match
                    const sectionMatches = (gSec === 'ALL' || gSec === uSec || uSec === 'ALL');

                    if (classMatches && sectionMatches) list.push(data);
                });
            }

            setGroupList(list);
            setLoadingGroups(false);
        } catch (e) {
            console.error("Error loading groups:", e);
            setLoadingGroups(false);
        }
    };

    const loadGroupChat = (gid) => {
        if (!gid) return;

        // Fetch group data
        const groupRef = doc(db, "groups", gid);
        const unsubscribeMsg = null; // Placeholder if we need to unsubscribe from doc? No, just messages.

        getDoc(groupRef).then(async (docSnap) => {
            if (docSnap.exists()) {
                const gData = { id: docSnap.id, ...docSnap.data() };
                setGroupData(gData);

                // FETCH MEMBERS DYNAMICALLY (Based on Class/Section)
                if (gData.className && (gData.institutionId || gData.createdBy)) {
                    const memberList = [];
                    const instId = gData.institutionId || gData.createdBy;

                    try {
                        const targetCls = gData.className;
                        const targetSec = (gData.section || 'All').toString().toUpperCase();

                        // 1. Fetch Students (Query by Institution + Class)
                        // Then filter section in memory for better flexibility
                        const qS1 = query(collection(db, "student_allotments"),
                            where("institutionId", "==", instId),
                            where("classAssigned", "==", targetCls));
                        const qS2 = query(collection(db, "student_allotments"),
                            where("createdBy", "==", instId),
                            where("classAssigned", "==", targetCls));

                        const [snapS1, snapS2] = await Promise.all([getDocs(qS1), getDocs(qS2)]);
                        const mergedSnapsS = [...snapS1.docs, ...snapS2.docs];

                        mergedSnapsS.forEach(d => {
                            const md = d.data();
                            const mSec = (md.section || 'A').toString().toUpperCase();

                            // Match section if not 'All'
                            if (targetSec === 'ALL' || mSec === targetSec) {
                                memberList.push({
                                    id: md.userId || md.studentId || d.id,
                                    userId: md.userId || md.studentId, // Explicit ID for Profile
                                    studentId: md.studentId, // Explicit ID for Profile
                                    name: md.name || md.studentName,
                                    type: 'Student',
                                    role: 'student',
                                    rollNumber: md.rollNumber || 'N/A'
                                });
                            }
                        });

                        // 2. Fetch Teachers
                        const qT1 = query(collection(db, "teacher_allotments"),
                            where("institutionId", "==", instId),
                            where("classAssigned", "==", targetCls));
                        const qT2 = query(collection(db, "teacher_allotments"),
                            where("createdBy", "==", instId),
                            where("classAssigned", "==", targetCls));

                        const [snapT1, snapT2] = await Promise.all([getDocs(qT1), getDocs(qT2)]);
                        const mergedSnapsT = [...snapT1.docs, ...snapT2.docs];

                        mergedSnapsT.forEach(d => {
                            const md = d.data();
                            const mSec = (md.section || 'A').toString().toUpperCase();

                            if (targetSec === 'ALL' || mSec === targetSec) {
                                memberList.push({
                                    id: md.userId || md.teacherId || d.id,
                                    userId: md.userId || md.teacherId, // Explicit ID for Profile
                                    teacherId: md.teacherId, // Explicit ID for Profile
                                    name: md.name || md.teacherName,
                                    type: 'Teacher',
                                    role: 'teacher',
                                    subject: md.subject || 'Class Teacher'
                                });
                            }
                        });

                        // Deduplicate (Using ID as key)
                        const uniqueMap = new Map();
                        memberList.forEach(m => {
                            if (m.id) uniqueMap.set(m.id, m);
                        });

                        setMembers(Array.from(uniqueMap.values()));
                    } catch (err) {
                        console.error("Error fetching group members:", err);
                        setMembers([]);
                    }
                } else {
                    setMembers([]);
                }

            } else {
                console.log("No such group!");
                setGroupData(null);
                localStorage.removeItem("activeGroupId");
                setIsSelecting(true);
            }
        }).catch(e => console.error("Error fetching group data:", e));

        // Listen for messages
        const messagesQuery = query(
            collection(db, "groups", gid, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        }, (error) => {
            console.error("Error fetching messages:", error);
        });

        return unsubscribe;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileSelect = (e) => {
        if (e.target.files[0]) {
            const f = e.target.files[0];
            if (f.size > 500000) return alert("File too big! Max 500KB.");
            const reader = new FileReader();
            reader.onloadend = () => setFile(reader.result);
            reader.readAsDataURL(f);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if ((newMessage.trim() === '' && !file) || !groupId) return;

        const payload = {
            text: newMessage,
            image: file || null,
            createdAt: serverTimestamp(),
            uid: userData?.uid || 'anon',
            displayName: userData?.name || 'Anonymous',
            role: userData?.role || 'student',
            photoURL: userData?.profileImageURL || null
        };

        await addDoc(collection(db, "groups", groupId, "messages"), payload);
        setNewMessage('');
        setFile(null);
    };

    const selectGroup = (gid) => {
        localStorage.setItem("activeGroupId", gid);
        setGroupId(gid);
        setIsSelecting(false);
        loadGroupChat(gid);
    }

    // --- RENDER GROUP SELECTION LIST ---
    if (isSelecting) {
        // SCENARIO 1: TEACHER SELECTING CLASS
        if (userData?.role === 'teacher' && !selectedClassScope) {
            return (
                <div className="page-wrapper">
                    <header style={{ background: '#0984e3', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button onClick={() => navigate(-1)} className="btn-back-marker">Back</button>
                        <h2 style={{ margin: 0, fontSize: '18px' }}>Select Class</h2>
                    </header>
                    <div className="container" style={{ marginTop: '20px' }}>
                        <p style={{ padding: '0 15px', color: '#666' }}>Select a class to view its groups.</p>
                        {teacherClasses.length === 0 ? (
                            <p className="text-center text-muted">No classes allotted yet.</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {teacherClasses.map((c, idx) => (
                                    <div key={idx}
                                        onClick={() => {
                                            setSelectedClassScope(c);
                                            fetchGroupsForSelection(c);
                                        }}
                                        className="card"
                                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '18px' }}>Class {c.className} - {c.section}</h4>
                                        </div>
                                        <span style={{ fontSize: '24px' }}>➡️</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // SCENARIO 2: SELECTING GROUP (Student, Institution, or Teacher after Class Select)
        return (
            <div className="page-wrapper">
                <header style={{ background: '#0984e3', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => {
                        if (userData?.role === 'teacher' && selectedClassScope) {
                            setSelectedClassScope(null); // Go back to Class Select
                        } else {
                            navigate(-1);
                        }
                    }} className="btn-back-marker">Back</button>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>
                        {selectedClassScope ? `Groups for ${selectedClassScope.className}-${selectedClassScope.section}` : 'Select Group'}
                    </h2>
                </header>
                <div className="container" style={{ marginTop: '20px' }}>
                    {loadingGroups ? (
                        <div className="text-center" style={{ padding: '40px' }}>
                            <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
                            <p className="text-muted">Searching for your groups...</p>
                        </div>
                    ) : groupList.length === 0 ? (
                        <div className="text-center" style={{ padding: '40px', background: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <span style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>🔍</span>
                            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>No Groups Found</h3>
                            <p className="text-muted" style={{ fontSize: '14px', maxWidth: '300px', margin: '0 auto' }}>
                                {userData?.role === 'teacher'
                                    ? "We couldn't find any chat groups for this specific class and section."
                                    : "You haven't been added to any active chat groups yet. Please contact your institution admin."}
                            </p>
                            {userData?.role === 'institution' && (
                                <p className="text-muted" style={{ fontSize: '12px', marginTop: '20px' }}>
                                    Tip: Create allotments to automatically generate class groups.
                                </p>
                            )}
                            <button
                                onClick={() => fetchGroupsForSelection()}
                                style={{ marginTop: '20px', padding: '10px 20px', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                            >
                                🔄 Refresh Groups
                            </button>

                            <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '10px', color: '#999' }}>
                                <summary>Debug Info</summary>
                                <p>Role: {userData?.role}</p>
                                <p>UID: {userData?.uid}</p>
                                <p>Inst ID: {userData?.role === 'institution' ? userData?.uid : ((selectedClassScope?.institutionId) || userData?.institutionId || userData?.createdBy || 'N/A')}</p>
                                <p>Search Scope: {JSON.stringify(selectedClassScope || {})}</p>
                            </details>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {groupList.map(g => (
                                <div key={g.id} onClick={() => selectGroup(g.id)} className="card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: 0 }}>{g.groupName}</h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            {g.className} - {g.section || 'All Sections'}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: '20px' }}>💬</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER CHAT ---
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: '#f4f4f4',
            display: 'flex', flexDirection: 'column',
            zIndex: 1500 // Above BottomNav usually
        }}>
            {/* Header - Fixed Top */}
            <header style={{
                height: '60px',
                background: '#0984e3', color: 'white',
                padding: '0 15px', display: 'flex', alignItems: 'center', gap: '10px',
                flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
                <button onClick={() => {
                    if (userData?.role === 'institution') {
                        setIsSelecting(true);
                        localStorage.removeItem("activeGroupId");
                        setMessages([]); // Clear chat
                    } else if (userData?.role === 'teacher') {
                        navigate('/teacher', { replace: true });
                    } else if (userData?.role === 'student') {
                        navigate('/student', { replace: true });
                    } else {
                        navigate(-1);
                    }
                }} className="btn-back-marker">Back</button>

                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setViewMode('members')}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{groupData?.groupName || "Chat Group"}</h2>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>Tap for Info</span>
                </div>

                <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>⋮</button>
                    {showMenu && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0,
                            background: 'white', color: '#333',
                            borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                            minWidth: '150px', display: 'flex', flexDirection: 'column',
                            zIndex: 2000
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => { setViewMode('files'); setShowMenu(false); }}>📂 Files</div>
                            <div style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => { setViewMode('docs'); setShowMenu(false); }}>📄 Documents</div>
                            <div style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => { setViewMode('photos'); setShowMenu(false); }}>🖼️ Photos</div>
                            <div style={{ padding: '12px', cursor: 'pointer' }} onClick={() => { setViewMode('about'); setShowMenu(false); }}>ℹ️ About</div>
                        </div>
                    )}
                </div>
            </header>

            {/* Chat Area - Scrollable Middle */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {messages.map((msg) => {
                    const isMe = msg.uid === userData?.uid;
                    return (
                        <div key={msg.id} style={{ marginBottom: '15px', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '70%',
                                padding: '10px',
                                borderRadius: '12px',
                                background: isMe ? '#0984e3' : 'white',
                                color: isMe ? 'white' : 'black',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                borderTopLeftRadius: !isMe ? '0' : '12px',
                                borderTopRightRadius: isMe ? '0' : '12px'
                            }}>
                                {!isMe && <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#636e72', marginBottom: '4px' }}>{msg.displayName} ({msg.role})</div>}
                                {msg.image && <img src={msg.image} alt="attachment" style={{ width: '100%', borderRadius: '8px', marginBottom: '5px' }} />}
                                <div>{msg.text}</div>
                                <div style={{ fontSize: '10px', opacity: 0.7, textAlign: 'right', marginTop: '4px' }}>
                                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer Input - Fixed Bottom relative to container */}
            <form onSubmit={handleSend} style={{
                background: 'white', padding: '10px',
                borderTop: '1px solid #ddd', display: 'flex', gap: '10px', alignItems: 'center',
                flexShrink: 0
            }}>
                {/* Attachment Menu */}
                {showAttachMenu && (
                    <div style={{
                        position: 'absolute', bottom: '60px', left: '10px',
                        background: 'white', borderRadius: '8px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                        padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px',
                        zIndex: 2000
                    }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Attach Media</div>
                        <button type="button" onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
                            <span style={{ fontSize: '20px' }}>🖼️</span> Photos / Camera
                        </button>
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*" />
                <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} style={{ background: '#dfe6e9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer' }}>📎</button>

                <div style={{ flex: 1, position: 'relative' }}>
                    {file && <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#fab1a0', padding: '5px', fontSize: '12px', borderRadius: '4px' }}>Image Attached <button type="button" onClick={() => setFile(null)}>x</button></div>}
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        style={{ width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                    />
                </div>
                <button type="submit" className="btn" style={{ backgroundColor: '#0984e3', borderRadius: '20px', padding: '10px 20px' }}>Send</button>
            </form>

            <OverlayView title={viewMode === 'photos' ? "Shared Photos" : (viewMode === 'files' || viewMode === 'docs' ? "Shared Content" : "Group Members")}
                onClose={() => setViewMode(null)}
                visible={viewMode !== null}>

                {viewMode === 'members' || viewMode === 'about' ? (
                    members.length === 0 ? <p>Loading or no members found...</p> : (
                        members.map((m, i) => (
                            <div key={i}
                                onClick={(e) => { e.stopPropagation(); navigate('/profile-view', { state: { target: m } }); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                                <div
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: m.type === 'Teacher' ? '#ff7675' : '#a29bfe',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 'bold'
                                    }}>
                                    {m.name?.[0] || '?'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold' }}>{i + 1}. {m.name} {m.type === 'Teacher' && '⭐'}</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {m.type === 'Teacher' ? `Teacher • ${m.subject || 'General'}` : `Student • ${m.rollNumber || 'N/A'}`}
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                ) : viewMode === 'photos' ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                            {messages.filter(m => m.image).map(m => (
                                <img key={m.id} src={m.image} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '4px' }} alt="shared" />
                            ))}
                        </div>
                        {messages.filter(m => m.image).length === 0 && <p className="text-center text-muted">No photos shared.</p>}
                    </>
                ) : (
                    <p className="text-center text-muted" style={{ marginTop: '50px' }}>
                        No {viewMode} shared yet. <br />
                        <span style={{ fontSize: '12px' }}>(Only images supported currently)</span>
                    </p>
                )}
            </OverlayView>
        </div>
    );
}

// --- SUB-COMPONENTS ---
const OverlayView = ({ title, onClose, children, visible }) => {
    if (!visible) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'white', zIndex: 2000, display: 'flex', flexDirection: 'column'
        }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px' }}>⬅</button>
                <h3 style={{ margin: 0 }}>{title}</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {children}
            </div>
        </div>
    );
};
