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

    // Institution Mode
    const [isSelecting, setIsSelecting] = useState(false);
    const [groupList, setGroupList] = useState([]);

    // UI States
    const [showMenu, setShowMenu] = useState(false);
    const [viewMode, setViewMode] = useState(null); // 'members', 'photos', 'files', 'docs'
    const [members, setMembers] = useState([]);

    useEffect(() => {
        const gid = localStorage.getItem("activeGroupId");

        // If no group selected, allow user to select one from their list
        if (!gid) {
            setIsSelecting(true);
            fetchGroupsForSelection();
            return;
        }

        setGroupId(gid);
        const unsubscribe = loadGroupChat(gid);

        // Cleanup subscription on unmount or gid change
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [navigate, userData]);

    const fetchGroupsForSelection = async () => {
        if (!userData) return;
        try {
            let q;
            // 1. Institution: Show all groups created by them
            if (userData.role === 'institution') {
                q = query(collection(db, "groups"), where("createdBy", "==", userData.uid));
            } else {
                // 2. Student/Teacher: Show groups for their Class
                let userClass = userData.class || userData.assignedClass;

                // Normalize "1st" -> "1" to match Group Data
                if (userClass && parseInt(userClass)) {
                    userClass = parseInt(userClass).toString();
                }

                if (userClass) {
                    q = query(collection(db, "groups"), where("className", "==", userClass));
                }
            }

            if (q) {
                const snap = await getDocs(q);
                const list = [];
                const userSection = userData.section || userData.assignedSection;

                snap.forEach(d => {
                    const data = d.data();
                    // Filter: Show if (Institution) OR (Section matches) OR (Group has no section)
                    // For Teachers, we show ALL sections of their class to be safe
                    if (userData.role === 'institution' || userData.role === 'teacher' || !data.section || data.section === userSection || !userSection) {
                        list.push({ id: d.id, ...data });
                    }
                });
                setGroupList(list);
            }
        } catch (e) {
            console.error("Error loading groups", e);
        }
    };

    const loadGroupChat = (gid) => {
        // Fetch Group Info
        getDoc(doc(db, "groups", gid)).then(d => {
            if (d.exists()) {
                setGroupData(d.data());
            }
        });

        // Listen to Messages
        const q = query(collection(db, "groups", gid, "messages"), orderBy("createdAt"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            setTimeout(scrollToBottom, 500);
        });
        return unsubscribe;
    };

    const fetchMembers = async () => {
        if (!groupData) return;
        try {
            // 1. Fetch Students
            const qStudents = query(
                collection(db, "student_allotments"),
                where("classAssigned", "==", groupData.className),
                where("section", "==", groupData.section)
            );
            const snapS = await getDocs(qStudents);
            const students = snapS.docs.map(d => ({ ...d.data(), type: 'Student' }));

            // 2. Fetch Teachers
            const qTeachers = query(
                collection(db, "teacher_allotments"),
                where("classAssigned", "==", groupData.className),
                where("section", "==", groupData.section)
            );
            const snapT = await getDocs(qTeachers);
            const teachers = snapT.docs.map(d => ({ ...d.data(), type: 'Teacher' }));

            setMembers([...teachers, ...students]);
        } catch (e) {
            console.error("Error fetching members", e);
        }
    };

    // Trigger fetch when viewMode changes to 'members'
    useEffect(() => {
        if (viewMode === 'about' || viewMode === 'members') {
            fetchMembers();
        }
    }, [viewMode, groupData]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

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

    // --- SUB-COMPONENTS ---
    const OverlayView = ({ title, onClose, children }) => (
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

    // --- RENDER GROUP SELECTION LIST (For Institution) ---
    if (isSelecting) {
        return (
            <div className="page-wrapper">
                <header style={{ background: '#0984e3', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>Select Your Class Group</h2>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>⬅</button>
                </header>
                <div className="container" style={{ marginTop: '20px' }}>
                    {groupList.length === 0 ? (
                        <p className="text-center text-muted">No active groups found. Please Allot Teachers to create groups.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {groupList.map(g => (
                                <div key={g.id} onClick={() => selectGroup(g.id)} className="card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: 0 }}>{g.groupName}</h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{g.className} - {g.section}</p>
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

                <button onClick={() => {
                    if (userData?.role === 'institution') {
                        setIsSelecting(true);
                        localStorage.removeItem("activeGroupId");
                        setMessages([]); // Clear chat
                    } else if (userData?.role === 'teacher') {
                        // FIX: Explicitly go to Teacher Dashboard to avoid blank page in history
                        navigate('/teacher', { replace: true });
                    } else if (userData?.role === 'student') {
                        navigate('/student', { replace: true });
                    } else {
                        navigate(-1);
                    }
                }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>⬅</button>
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
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*" />
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: '#dfe6e9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px' }}>📎</button>

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

            {/* OVERLAYS */}
            {(viewMode === 'members' || viewMode === 'about') && (
                <OverlayView title="Group Members" onClose={() => setViewMode(null)}>
                    {members.length === 0 ? <p>Loading or no members found...</p> : (
                        members.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: m.type === 'Teacher' ? '#ff7675' : '#a29bfe',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold'
                                }}>
                                    {m.name?.[0] || '?'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{m.name} {m.type === 'Teacher' && '⭐'}</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {m.type === 'Teacher' ? `Teacher • ${m.subject || 'General'}` : `Student • ${m.rollNumber || 'N/A'}`}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </OverlayView>
            )}

            {viewMode === 'photos' && (
                <OverlayView title="Shared Photos" onClose={() => setViewMode(null)}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                        {messages.filter(m => m.image).map(m => (
                            <img key={m.id} src={m.image} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '4px' }} alt="shared" />
                        ))}
                    </div>
                    {messages.filter(m => m.image).length === 0 && <p className="text-center text-muted">No photos shared.</p>}
                </OverlayView>
            )}

            {(viewMode === 'files' || viewMode === 'docs') && (
                <OverlayView title={viewMode === 'files' ? "Shared Files" : "Shared Documents"} onClose={() => setViewMode(null)}>
                    <p className="text-center text-muted" style={{ marginTop: '50px' }}>
                        No {viewMode} shared yet. <br />
                        <span style={{ fontSize: '12px' }}>(Only images supported currently)</span>
                    </p>
                </OverlayView>
            )}
        </div>
    );
}
