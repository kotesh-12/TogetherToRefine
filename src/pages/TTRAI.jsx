import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, collection, getDocs, addDoc, updateDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import Header from '../components/Header';
import { useSpeech } from '../hooks/useSpeech';
import { useUser } from '../context/UserContext';
import ReactMarkdown from 'react-markdown';
import BottomNav from '../components/BottomNav';

// Helper Component for Typewriter Effect
const TypewriterMessage = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);

    useEffect(() => {
        indexRef.current = 0;
        setDisplayedText('');

        const interval = setInterval(() => {
            setDisplayedText((prev) => {
                if (indexRef.current < text.length) {
                    const char = text.charAt(indexRef.current);
                    indexRef.current++;
                    return prev + char;
                } else {
                    clearInterval(interval);
                    if (onComplete) onComplete();
                    return prev;
                }
            });
        }, 5); // Fast Speed: 5ms per char

        return () => clearInterval(interval);
    }, [text]);

    return <ReactMarkdown>{displayedText}</ReactMarkdown>;
};

export default function TTRAI() {
    const navigate = useNavigate();
    const { user: authUser, userData } = useUser();

    // Core Chat State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const [statusLog, setStatusLog] = useState("Ready");

    // AI & UI State
    const MODEL_NAME = "gemini-flash-latest";
    const [selectedImage, setSelectedImage] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Speech Hook
    const { speak, listen, isListening, speakingText } = useSpeech();

    // Permissions
    const [permissionModal, setPermissionModal] = useState(null);
    const fileInputRef = useRef(null);

    // Context Loading
    const [userContext, setUserContext] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Session State
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);

    // 1. Auth & Context Loading
    useEffect(() => {
        if (!authUser) return;
        setCurrentUser(authUser);

        let context = {
            role: userData?.role || 'User',
            name: userData?.name || 'User',
            class: userData?.class || 'N/A',
            gender: userData?.gender || 'N/A',
            upcomingEvents: [],
            adminData: null
        };

        if (userData?.role === 'admin' || authUser.email === 'admin@ttr.com') {
            context.role = 'System Admin';
            context.name = 'Admin';
        }

        const fetchContext = async () => {
            try {
                // LEVEL 1: Advanced Real-time Context Injection
                // Fetch dynamic data about the current user specifically for the AI
                if (context.role === 'System Admin') {
                    const feedSnap = await getDocs(query(collection(db, "general_feedback"), orderBy("timestamp", "desc"), limit(5)));
                    const repSnap = await getDocs(query(collection(db, "emergency_reports"), orderBy("createdAt", "desc"), limit(5)));
                    context.adminData = {
                        recentActivity: [
                            ...feedSnap.docs.map(d => `- Feedback: ${d.data().comment} (${d.data().authorRole})`),
                            ...repSnap.docs.map(d => `- REPORT: ${d.data().description}`)
                        ]
                    };
                } else if (context.role === 'institution') {
                    // Give Institution AI context about their school size
                    const tSnap = await getDocs(query(collection(db, "teachers"), where("institutionId", "==", authUser.uid)));
                    const sSnap = await getDocs(query(collection(db, "users"), where("institutionId", "==", authUser.uid), where("role", "==", "student")));
                    context.schoolData = {
                        totalTeachers: tSnap.docs.length,
                        totalStudents: sSnap.docs.length
                    };
                } else if (context.role === 'teacher') {
                    // Give Teacher AI context about the groups/classes they teach
                    const gSnap = await getDocs(query(collection(db, "groups"), where("teacherId", "==", authUser.uid)));
                    context.teacherData = {
                        classesTeaching: gSnap.docs.map(d => d.data().className).join(", ") || "None assigned yet"
                    };
                } else if (context.role === 'student') {
                    // Give Student AI context about their current workload
                    const hwSnap = await getDocs(query(collection(db, "homework"), where("targetClass", "==", context.class || "Unknown"), limit(3)));
                    context.studentData = {
                        recentHomework: hwSnap.docs.map(d => `${d.data().subject}: ${d.data().title}`).join(" | ") || "No recent homework"
                    };
                }
            } catch (e) {
                console.error("Error fetching AI context:", e);
            }
            setUserContext(context);
        };
        fetchContext();
    }, [authUser, userData]);

    // 2. Fetch Sessions List (History)
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'ai_chats', currentUser.uid, 'sessions'), orderBy('updatedAt', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [currentUser]);

    // 3. Chat Messages Listener (Dependent on Session)
    useEffect(() => {
        if (!currentUser) return;

        // If no session is selected, clear messages or show welcome
        if (!currentSessionId) {
            setMessages([{ text: "Hello! I am TTR AI. Ask me anything!", sender: 'ai' }]);
            return;
        }

        const q = query(collection(db, 'ai_chats', currentUser.uid, 'sessions', currentSessionId, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMsgs = snapshot.docs.map(doc => doc.data());
            if (loadedMsgs.length === 0) {
            } else {
                setMessages(loadedMsgs);
            }
        });
        return () => unsubscribe();
    }, [currentUser, currentSessionId]);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => scrollToBottom(), [messages]);

    // System Prompt Generator
    // System Prompt Logic Moved to Backend (Server-Side) for Security & IP Protection.
    // The server now handles the "TTR-X1 Hyper-Algorithm" generation.

    const saveMessage = async (msgObj, sessionId) => {
        if (!currentUser || !sessionId) return;
        try {
            await addDoc(collection(db, 'ai_chats', currentUser.uid, 'sessions', sessionId, 'messages'), { ...msgObj, createdAt: new Date() });
            await updateDoc(doc(db, 'ai_chats', currentUser.uid, 'sessions', sessionId), {
                updatedAt: new Date()
            });
        } catch (e) { console.error("Error saving message", e); }
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([{ text: "Hello! I am TTR AI. Ask me anything!", sender: 'ai' }]);
        setInput('');
        setShowSidebar(false);
    };

    const handleCameraClick = () => { fileInputRef.current?.click(); };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setSelectedImage(reader.result); };
            reader.readAsDataURL(file);
        }
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text && !selectedImage) return;

        setInput('');
        setSelectedImage(null);
        setLoading(true);
        setStatusLog("Processing...");

        const userMsg = { text: text || "Image Uploaded", image: selectedImage, sender: 'user', createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);

        try {
            if (!currentUser) throw new Error("User not found");

            let activeSessionId = currentSessionId;
            if (!activeSessionId) {
                const sessionRef = await addDoc(collection(db, 'ai_chats', currentUser.uid, 'sessions'), {
                    title: text.substring(0, 30) || "New Chat",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                activeSessionId = sessionRef.id;
                setCurrentSessionId(activeSessionId);
            }

            await saveMessage(userMsg, activeSessionId);

            let responseText = "";

            try {
                // Limit history to 6 to speed up processing
                let historyForApi = messages.slice(-10).map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text || "" }]
                }));
                while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

                const payload = {
                    history: historyForApi,
                    message: text,
                    // Security Upgrade: System Prompt logic is now handled server-side
                    userContext: userContext,
                    image: selectedImage ? selectedImage.split(',')[1] : null,
                    mimeType: selectedImage ? selectedImage.match(/:(.*?);/)?.[1] : null
                };

                const API_URL = window.location.hostname === 'localhost'
                    ? 'http://localhost:5000/api/chat'
                    : '/api/chat';

                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || "Backend Error");
                }

                const data = await res.json();
                responseText = data.text;

            } catch (e) {
                console.error("AI Generation Error", e);
                throw e;
            }

            const aiMsg = { text: responseText, sender: 'ai', createdAt: new Date() };
            if (!currentSessionId) {
                setMessages(prev => [...prev, aiMsg]);
            }
            await saveMessage(aiMsg, activeSessionId);

        } catch (error) {
            console.error(error);
            let errorMsg = error.message;
            let isConfigError = false;
            // Enhanced error detection for API key issues
            if (errorMsg.includes("API key") || errorMsg.includes("403") || errorMsg.includes("key not valid") || errorMsg.includes("expired")) {
                errorMsg = "System Configuration Error: API Key is invalid or expired.";
                isConfigError = true;
            }
            setMessages(prev => [...prev, {
                text: "⚠️ **" + (isConfigError ? "Service Update" : "Error") + "**: " + errorMsg,
                sender: 'ai',
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ttr-ai-container">

            {/* 1. TOP CONTROL BAR */}
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-surface)', borderBottom: '1px solid var(--divider)' }}>
                <button
                    onClick={() => setShowSidebar(true)}
                    style={{
                        background: '#333', color: 'white', border: 'none',
                        borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer'
                    }}
                >
                    📜 History
                </button>
            </div>

            {/* 2. MAIN CHAT AREA */}
            <div className="chat-area">
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '50px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🤖</div>
                        <p>I am TTR AI, your personal academic assistant.</p>
                        <p style={{ fontSize: '13px' }}>How can I help you today?</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                        {msg.image && <img src={msg.image} alt="User Upload" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />}
                        <div className="markdown-content">
                            {msg.sender === 'ai' && idx === messages.length - 1 && !msg.isError ? (
                                <TypewriterMessage text={msg.text} />
                            ) : (
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            )}
                        </div>
                        {msg.sender === 'ai' && (
                            <button onClick={() => speak(msg.text)} className="speak-button">
                                {speakingText === msg.text ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && <div style={{ alignSelf: 'flex-start', background: 'var(--bg-surface)', padding: '10px 20px', borderRadius: '20px', color: 'var(--text-muted)' }}>AI is thinking...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* 3. INPUT AREA */}
            <div className="input-area">
                {selectedImage && (
                    <div className="image-preview-container">
                        <img src={selectedImage} alt="Preview" className="image-preview" />
                        <button onClick={() => setSelectedImage(null)} className="remove-image-button">✕</button>
                    </div>
                )}
                <div className="input-controls">
                    <div style={{
                        position: 'absolute', top: '-18px', right: '20px',
                        fontSize: '9px', color: '#138808', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '3px', opacity: 0.7
                    }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#138808', display: 'inline-block' }}></span>
                        TTR Core
                    </div>
                    <button className="icon-button" onClick={handleCameraClick} title="Upload">📷</button>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                    <button onClick={() => listen((val) => setInput(prev => prev + ' ' + val))} className={`voice-button ${isListening ? 'listening' : ''}`} title="Voice">
                        {isListening ? '🛑' : '🎙️'}
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={selectedImage ? "Add topic..." : "Ask TTR AI anything..."}
                        className="chat-input"
                        autoComplete="off"
                        spellCheck="false"
                        autoCorrect="off"
                        autoCapitalize="none"
                    />
                    <button onClick={handleSend} disabled={loading} className="send-button">➤</button>
                </div>
            </div>

            {/* 4. SIDEBAR OVERLAY (History) */}
            {showSidebar && (
                <div className="sidebar-overlay">
                    <div className="sidebar-backdrop" onClick={() => setShowSidebar(false)} />
                    <div className="sidebar-content">
                        <h2>History</h2>
                        <button onClick={startNewChat} className="btn" style={{ width: '100%', marginBottom: '15px', background: '#333' }}>+ New AI Chat</button>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sessions.length === 0 && <p style={{ color: '#666', fontStyle: 'italic' }}>No chat history yet.</p>}
                            {sessions.map(s => (
                                <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setShowSidebar(false); }}
                                    style={{
                                        padding: '10px',
                                        background: currentSessionId === s.id ? '#e3f2fd' : '#f5f5f5',
                                        borderRadius: '8px', cursor: 'pointer', fontSize: '14px', borderLeft: '4px solid var(--primary)'
                                    }}>
                                    <div style={{ fontWeight: 'bold' }}>{s.title || "Untitled Chat"}</div>
                                    <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                                        {s.updatedAt?.toDate ? s.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. API KEY ERROR MODAL */}
            {messages.some(m => m.isError && (m.text.includes("API Key Missing") || m.text.includes("System Configuration Error"))) && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', textAlign: 'center', border: '2px solid red' }}>
                        <h2 style={{ color: 'red' }}>⚠️ AI Service Maintenance</h2>
                        <p style={{ fontSize: '14px', marginBottom: '15px' }}>The AI Brain is updating its credentials.</p>
                        <button onClick={() => setMessages(prev => prev.filter(m => !m.isError))} className="btn" style={{ background: '#333' }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
