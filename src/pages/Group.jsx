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

    useEffect(() => {
        const gid = localStorage.getItem("activeGroupId");
        if (!gid) {
            alert("No group selected! Returning to Dashboard.");
            navigate(-1);
            return;
        }
        setGroupId(gid);

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
            setTimeout(scrollToBottom, 100);
        });

        return () => unsubscribe();
    }, [navigate]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleFileSelect = (e) => {
        if (e.target.files[0]) {
            const f = e.target.files[0];
            if (f.size > 500000) return alert("File too big! Max 500KB.");

            const reader = new FileReader();
            reader.onloadend = () => {
                setFile(reader.result);
            };
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

    return (
        <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <header style={{ background: '#0984e3', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>⬅</button>
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
