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
            if (context.role === 'System Admin') {
                try {
                    const feedSnap = await getDocs(query(collection(db, "general_feedback"), orderBy("timestamp", "desc"), limit(5)));
                    const repSnap = await getDocs(query(collection(db, "emergency_reports"), orderBy("createdAt", "desc"), limit(5)));
                    context.adminData = {
                        recentActivity: [
                            ...feedSnap.docs.map(d => `- Feedback: ${d.data().comment} (${d.data().authorRole})`),
                            ...repSnap.docs.map(d => `- REPORT: ${d.data().description}`)
                        ]
                    };
                } catch (e) { }
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
    const generateSystemPrompt = (context) => {
        const now = new Date();
        const dateTimeString = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: 'full', timeStyle: 'medium' });

        if (context?.role === 'System Admin' || context?.role === 'admin') {
            return `You are TTR Co-Pilot, Admin Assistant. Current Date: ${dateTimeString}. Reports: ${JSON.stringify(context.adminData)}`;
        }

        const userClass = context?.class || 'General';
        const userGender = context?.gender || 'Student';

        return `
        You are TTR AI, an expert educational mentor designed to spark curiosity and love for learning.
        
        **Current Context:**
        - Date: ${dateTimeString}
        - User Name: ${context?.name}
        - Role: ${context?.role}
        - Class/Grade: ${userClass}
        - Gender: ${userGender}

        **Your Core Directives:**
        1. **Strictly Educational & Productive:**
           - If user asks non-educational checks/gossip: "Focusing on this won't help you build your future. Let's not waste time." Pivot to education.
           - General knowledge: Connect strictly to school subjects.
        2. **Adapt to Grade Level:**
           - Class 1-5: Simple, magic, stories.
           - Class 6-8: Real world examples.
           - Class 9-12: Academic, exam-oriented.
        3. **Indian Context Strategy:**
           - Use Indian Mythology or Movies (Baahubali, etc.) for hard concepts.
        4. **Struggle for Success:**
           - Highlight failures/struggles of scientists/inventors to build resilience.
        5. **Build Curiosity:**
           - End with "Did you know?" or "What do you think?".

        Answer strictly based on these rules.
        `;
    };

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

            let sysPrompt = generateSystemPrompt(userContext);
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
                    systemInstruction: sysPrompt,
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
        <div className="ttr-ai-wrapper" style={{ display: 'flex', height: '100vh', flexDirection: 'row', overflow: 'hidden', background: '#f5f6fa' }}>

            {/* 1. LEFT SIDEBAR (History) */}
            <div className={`ai-sidebar ${showSidebar ? 'mobile-visible' : ''}`} style={{
                width: '260px',
                background: '#1e1e1e',
                color: '#ececf1',
                display: 'flex',
                flexDirection: 'column',
                padding: '10px',
                zIndex: 2000,
                borderRight: '1px solid #333'
            }}>
                <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>History</h3>
                    <button className="mobile-only-btn" onClick={() => setShowSidebar(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>

                <button onClick={startNewChat} style={{ border: '1px solid #555', padding: '10px', background: 'transparent', color: 'white', borderRadius: '5px', cursor: 'pointer', marginBottom: '15px', textAlign: 'left', transition: 'background 0.2s' }}>
                    + New Chat
                </button>

                <div className="history-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {sessions.length === 0 && <span style={{ fontSize: '12px', color: '#777' }}>No chat history.</span>}
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setShowSidebar(false); }}
                            style={{ padding: '10px', borderRadius: '5px', cursor: 'pointer', background: currentSessionId === s.id ? '#343541' : 'transparent', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#ececf1' }}>
                            {s.title || "Untitled Chat"}
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                    <button onClick={() => navigate('/student')} style={{ width: '100%', padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🏠</span> Back to Dashboard
                    </button>
                </div>
            </div>

            {/* 2. MAIN CHAT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#ffffff' }}>
                <Header onToggleSidebar={() => setShowSidebar(!showSidebar)} />

                {/* Mobile History Toggle */}


                <div className="chat-area" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                            {msg.image && <img src={msg.image} alt="User Upload" className="message-image" />}
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
                    {loading && <div style={{ color: '#888', fontStyle: 'italic', margin: '10px' }}>AI is thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-area" style={{ borderTop: '1px solid #eee', padding: '15px', paddingBottom: '25px', marginBottom: '0', background: '#fff' }}>
                    {selectedImage && (
                        <div className="image-preview-container">
                            <img src={selectedImage} alt="Preview" className="image-preview" />
                            <button onClick={() => setSelectedImage(null)} className="remove-image-button">✕</button>
                        </div>
                    )}
                    <div className="input-controls" style={{ position: 'relative' }}>
                        <div style={{
                            position: 'absolute', top: '-25px', right: '10px',
                            fontSize: '10px', color: '#138808', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#138808', display: 'inline-block' }}></span>
                            Connected to TTR Brain
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
                        />
                        <button onClick={handleSend} disabled={loading} className="send-button">➤</button>
                    </div>
                </div>

                {/* API KEY ERROR MODAL */}
                {messages.some(m => m.isError && (m.text.includes("API Key Missing") || m.text.includes("System Configuration Error"))) && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', textAlign: 'center', border: '2px solid red' }}>
                            <h2 style={{ color: 'red' }}>⚠️ AI Service Maintenance</h2>
                            <p style={{ fontSize: '14px', marginBottom: '15px' }}>The AI Brain is updating its credentials.</p>
                            <button onClick={() => setMessages(prev => prev.filter(m => !m.isError))} className="btn" style={{ background: '#333' }}>Close</button>
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Nav */}
                <div className="bottom-nav-wrapper">
                    <BottomNav />
                </div>
            </div>

            {/* Styles for Responsive Sidebar */}
            <style>{`
                @media (max-width: 768px) {
                    .ai-sidebar {
                        position: fixed;
                        top: 0; left: 0; bottom: 0;
                        transform: translateX(-100%);
                        transition: transform 0.3s;
                    }
                    .ai-sidebar.mobile-visible {
                        transform: translateX(0);
                    }
                    .mobile-history-toggle { display: block !important; }
                    .mobile-only-btn { display: block !important; }
                }
                @media (min-width: 769px) {
                    .ai-sidebar { position: static; transform: none; }
                     .mobile-history-toggle { display: none !important; }
                     .mobile-only-btn { display: none !important; }
                }
            `}</style>
        </div>
    );
}
