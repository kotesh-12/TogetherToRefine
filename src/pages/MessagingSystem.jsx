import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

export default function MessagingSystem() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();

    // Get recipient info from navigation state
    const recipientInfo = location.state?.recipient;

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!recipientInfo) {
            alert("No recipient selected");
            navigate(-1);
            return;
        }

        // Validate access control
        const isAllowed = validateAccess();
        if (!isAllowed) {
            alert("You don't have permission to message this user");
            navigate(-1);
            return;
        }

        // Subscribe to messages
        const conversationId = getConversationId(userData.uid, recipientInfo.uid);
        const q = query(
            collection(db, "messages"),
            where("conversationId", "==", conversationId),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMessages(msgs);
            setLoading(false);
            setTimeout(scrollToBottom, 100);
        });

        return () => unsubscribe();
    }, [recipientInfo, userData]);

    const validateAccess = () => {
        const myRole = userData.role;
        const theirRole = recipientInfo.role;

        // Teacher → Parent
        if (myRole === 'teacher' && theirRole === 'parent') return true;

        // Institution → Parent
        if (myRole === 'institution' && theirRole === 'parent') return true;

        // Institution → Teacher
        if (myRole === 'institution' && theirRole === 'teacher') return true;

        // Reverse directions (Parent → Teacher, etc.)
        if (myRole === 'parent' && theirRole === 'teacher') return true;
        if (myRole === 'parent' && theirRole === 'institution') return true;
        if (myRole === 'teacher' && theirRole === 'institution') return true;

        return false;
    };

    const getConversationId = (uid1, uid2) => {
        // Create consistent conversation ID regardless of who initiates
        return [uid1, uid2].sort().join('_');
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        const conversationId = getConversationId(userData.uid, recipientInfo.uid);

        try {
            await addDoc(collection(db, "messages"), {
                conversationId,
                senderId: userData.uid,
                senderName: userData.name || userData.firstName || 'Unknown',
                senderRole: userData.role,
                receiverId: recipientInfo.uid,
                receiverName: recipientInfo.name,
                receiverRole: recipientInfo.role,
                message: newMessage,
                timestamp: serverTimestamp(),
                read: false
            });

            setNewMessage('');
            scrollToBottom();
        } catch (e) {
            console.error(e);
            alert("Error sending message");
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper">
                <div className="container" style={{ textAlign: 'center', padding: '60px' }}>
                    Loading messages...
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>
                            💬 {recipientInfo.name}
                        </h3>
                        <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '3px' }}>
                            {recipientInfo.role === 'parent' ? '👨‍👩‍👧 Parent' :
                                recipientInfo.role === 'teacher' ? '👨‍🏫 Teacher' :
                                    '🏢 Institution'}
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ← Back
                    </button>
                </div>

                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    background: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    {messages.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#999'
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
                            <div>No messages yet. Start the conversation!</div>
                        </div>
                    ) : (
                        messages.map(msg => {
                            const isMine = msg.senderId === userData.uid;
                            return (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                                    marginBottom: '5px'
                                }}>
                                    <div style={{
                                        maxWidth: '70%',
                                        padding: '10px 15px',
                                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                        background: isMine ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                                        color: isMine ? 'white' : '#2c3e50',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                        wordBreak: 'break-word'
                                    }}>
                                        {!isMine && (
                                            <div style={{
                                                fontSize: '11px',
                                                opacity: 0.8,
                                                marginBottom: '5px',
                                                fontWeight: 'bold'
                                            }}>
                                                {msg.senderName}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                                            {msg.message}
                                        </div>
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.7,
                                            marginTop: '5px',
                                            textAlign: 'right'
                                        }}>
                                            {msg.timestamp?.toDate?.()?.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) || 'Sending...'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{
                    padding: '15px 20px',
                    background: 'white',
                    borderTop: '1px solid #e0e0e0',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <textarea
                            className="input-field"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a message..."
                            rows="2"
                            style={{
                                flex: 1,
                                resize: 'none',
                                fontSize: '14px',
                                padding: '10px',
                                borderRadius: '20px',
                                border: '1px solid #ddd'
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim()}
                            style={{
                                background: newMessage.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '20px',
                                cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                transition: 'all 0.3s'
                            }}
                        >
                            Send 📤
                        </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                        Press Enter to send • Shift+Enter for new line
                    </div>
                </div>
            </div>
        </div>
    );
}
