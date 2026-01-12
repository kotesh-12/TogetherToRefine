import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Group() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [groupId, setGroupId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [file, setFile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Institution Mode
    const [isSelecting, setIsSelecting] = useState(false);
    const [groupList, setGroupList] = useState([]);

    useEffect(() => {
        const gid = localStorage.getItem("activeGroupId");

        // If no group selected, allow user to select one from their list
        if (!gid) {
            setIsSelecting(true);
            fetchGroupsForSelection();
            return;
        }

        setGroupId(gid);
        loadGroupChat(gid);
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
                const userClass = userData.class || userData.assignedClass;
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
                    if (userData.role === 'institution' || !data.section || data.section === userSection || !userSection) {
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
            if (d.exists()) setGroupName(d.data().groupName);
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

    // --- RENDER GROUP SELECTION LIST (For Institution) ---
    if (isSelecting) {
        return (
            <div className="page-wrapper">
                <header style={{ background: '#0984e3', color: 'white', padding: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '10px' }}>⬅</button>
                    <h2 style={{ display: 'inline', fontSize: '18px' }}>Select Your Class Group</h2>
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
        <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <header style={{ background: '#0984e3', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => {
                    if (userData?.role === 'institution') {
                        setIsSelecting(true);
                        localStorage.removeItem("activeGroupId");
                        setMessages([]); // Clear chat
                    } else {
                        navigate(-1);
                    }
                }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>⬅</button>

                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{groupName || "Chat Group"}</h2>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>Active Group</span>
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', background: '#f4f4f4', padding: '15px' }}>
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
                                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={{ padding: '10px', background: 'white', borderTop: '1px solid #ddd', display: 'flex', gap: '10px', alignItems: 'center' }}>
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
        </div>
    );
}
