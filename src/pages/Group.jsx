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
        try {
            // Fetch allotments for this teacher
            const q = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
            const snap = await getDocs(q);
            const classes = [];
            const seen = new Set();

            snap.forEach(d => {
                const data = d.data();
                if (data.classAssigned && data.section) {
                    const key = `${data.classAssigned}-${data.section}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        classes.push({ className: data.classAssigned, section: data.section });
                    }
                }
            });
            // Sort
            classes.sort((a, b) => a.className.localeCompare(b.className));
            setTeacherClasses(classes);
            // If only 1 class, maybe auto-select? Let's keep it manual for now for clarity
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGroupsForSelection = async (scope = null) => {
        if (!userData) return;
        setGroupList([]); // Clear old list
        try {
            let q;
            // 1. Institution: Show all groups created by them
            if (userData.role === 'institution') {
                q = query(collection(db, "groups"), where("createdBy", "==", userData.uid));
            }
            // 2. Teacher with Scope
            else if (userData.role === 'teacher') {
                const targetScope = scope || selectedClassScope;
                if (!targetScope) return; // Should not happen if flow is correct

                // Query by ClassName
                // IMPORTANT: Groups data usually stores "className" and "section"
                // Ideally we filter by BOTH in query, but firestore composite index might be needed.
                // We'll query by class and filter by section in JS to avoid index issues for now.
                q = query(collection(db, "groups"), where("className", "==", targetScope.className));
            }
            // 3. Student
            else {
                let userClass = userData.class || userData.assignedClass;
                if (userClass && parseInt(userClass)) userClass = parseInt(userClass).toString(); // Normalize

                if (userClass) {
                    q = query(collection(db, "groups"), where("className", "==", userClass));
                }
            }

            if (q) {
                const snap = await getDocs(q);
                const list = [];

                // Determine Section Filter
                let sectionFilter = null;
                if (userData.role === 'student') sectionFilter = userData.section || userData.assignedSection;
                if (userData.role === 'teacher') sectionFilter = (scope || selectedClassScope)?.section;

                snap.forEach(d => {
                    const data = d.data();
                    // FILTER LOGIC:
                    // Show if:
                    // 1. Institution (All)
                    // 2. Section Matches (Strict for Student/Teacher scope)
                    // 3. Group has NO section (Global class group)

                    const matchesSection = !data.section || data.section === sectionFilter;

                    if (userData.role === 'institution' || matchesSection) {
                        list.push({ id: d.id, ...data });
                    }
                });
                setGroupList(list);
            }
        } catch (e) {
            console.error("Error loading groups", e);
        }
    };

    // ... [Rest of loadGroupChat, fetchMembers etc. remains the same] ...

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
                    {groupList.length === 0 ? (
                        <p className="text-center text-muted">
                            {userData?.role === 'teacher' ? "No groups found for this class." : "No groups active for your class."}
                        </p>
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
                                    <div style={{ fontWeight: 'bold' }}>{i + 1}. {m.name} {m.type === 'Teacher' && '⭐'}</div>
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
