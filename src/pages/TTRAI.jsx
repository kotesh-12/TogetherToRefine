import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, collection, getDocs, addDoc, updateDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
// import { GoogleGenerativeAI } from "@google/generative-ai"; // Removed for Security
import { useSpeech } from '../hooks/useSpeech';
import { useUser } from '../context/UserContext';
import ReactMarkdown from 'react-markdown';

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
    // AI & UI State
    // const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Managed by Backend
    // const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
    const MODEL_NAME = "gemini-flash-latest";
    const [selectedImage, setSelectedImage] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Speech Hook (Replaces local logic)
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
                // Keep the welcome message if it's a fresh session that hasn't synced yet (optimistic updates handle this usually)
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

        // Student/Teacher Context
        const userClass = context?.class || 'General';
        const userGender = context?.gender || 'Student'; // Contextual usage if needed for voice/examples

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
           - **Non-Educational/Gossip/Entertainment:** If the user asks about trivial things (movies, actors, gossip, games) that are not linked to their studies, give a boring, short answer and explicitly mention: "Focusing on this won't help you build your future. Let's not waste time." Then immediately pivot to a related educational fact.
           - **General Knowledge:** If they ask about current events or general facts, answer it but *immediately connect it to a school subject* (Science, Math, History) to make it educational.

        2. **Adapt to Grade Level (CRITICAL):**
           - **Class 1-5:** Explain like I'm 8 years old. Use magic, storytelling, and simple fun analogies.
           - **Class 6-8:** Use relatable real-world examples.
           - **Class 9-12:** Provide structured, academically accurate answers suitable for exams.

        3. **The "Indian Context" Strategy (For Complex Concepts Only):**
           - **Trigger:** If the concept is very hard, abstract, or the user says they are "suffering" or "confused".
           - **Action:** Explain the concept using an analogy from **Indian Mythology** (e.g., Mahabharata strategies, Ramayana ethics) or **Popular Indian Movies/Heroes** (e.g., Baahubali's strength for physics, a hero's determination). 
           - **Goal:** Make them feel good, motivated, and understand the logic through familiar culture.

        4. **The "Struggle for Success" Narrative (For Inventors/Scientists):**
           - **Trigger:** Questions about inventors, scientists, or successful figures (e.g., "Who is Einstein?", "Tell me about Edison").
           - **Action:** Do NOT just list inventions. You MUST highlight their **failures, rejections, and years of struggle** before they succeeded.
           - **Goal:** Build mental resilience ("thick skin") in students. Show them that great minds struggled too.
           - **Example:** "Before Thomas Edison gave us the lightbulb, he failed 1,000 times. He didn't give up; he learned 1,000 ways how *not* to make a bulb. That is true intelligence."

        5. **Build Curiosity:**
           - Always end your response with a "Did you know?" fact or a "What do you think...?" question.

        **Example Behaviors:**
        - User: "Who is J.J. Thomson?" -> AI: "J.J. Thomson is famous for discovering the electron, but it wasn't easy! For years, people thought atoms were solid balls. He had to go against the whole world's belief and faced many failed experiments. His persistence changed science forever. He taught us that even when the world doubts you, evidence speaks. Did you know he also won a Nobel Prize?"
        - User: "Who is the best actor?" -> AI: "Opinions vary, but debating this is a waste of your precious study time. Instead, did you know that cinema works on the principle of 'Persistence of Vision'? Let's learn about the eye."
        - User (Class 10): "I can't understand Newton's Third Law, it's too hard!" -> AI: "Don't worry! Remember in *Baahubali* when the team pulls the statue? Every pull had an equal reaction! Or think of Karma in mythology—what you give returns back. Simply: Action = Reaction. Now, let's look at the formula..."

        Answer strictly based on these rules.
        `;
    };

    // Helper functions
    const saveMessage = async (msgObj, sessionId) => {
        if (!currentUser || !sessionId) return;
        try {
            // Save Message
            await addDoc(collection(db, 'ai_chats', currentUser.uid, 'sessions', sessionId, 'messages'), { ...msgObj, createdAt: new Date() });

            // Update Session Timestamp (Bumps to top of list)
            await updateDoc(doc(db, 'ai_chats', currentUser.uid, 'sessions', sessionId), {
                updatedAt: new Date()
            });
        } catch (e) { console.error("Error saving message", e); }
    };

    // Create new session helper
    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([{ text: "Hello! I am TTR AI. Ask me anything!", sender: 'ai' }]);
        setInput('');
        setShowSidebar(false);
    };

    // Speech functions handled by useSpeech hook now.
    const handleCameraClick = () => { fileInputRef.current?.click(); };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setSelectedImage(reader.result); };
            reader.readAsDataURL(file);
        }
    };

    // --- MAIN SEND HANDLER ---
    const handleSend = async () => {
        const text = input.trim();
        if (!text && !selectedImage) return;

        setInput('');
        setSelectedImage(null);
        setLoading(true);
        setStatusLog("Processing...");

        // Optimistic UI Update
        const userMsg = { text: text || "Image Uploaded", image: selectedImage, sender: 'user', createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);

        try {
            if (!currentUser) throw new Error("User not found");

            // Ensure Session Exists
            let activeSessionId = currentSessionId;
            if (!activeSessionId) {
                // Create new session
                const sessionRef = await addDoc(collection(db, 'ai_chats', currentUser.uid, 'sessions'), {
                    title: text.substring(0, 30) || "New Chat",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                activeSessionId = sessionRef.id;
                setCurrentSessionId(activeSessionId);
            }

            // Save User Msg
            await saveMessage(userMsg, activeSessionId);

            // Generate AI Response (Backend Proxy)
            let sysPrompt = generateSystemPrompt(userContext);
            let responseText = "";

            try {
                // Fix history format for Backend
                let historyForApi = messages.slice(-10).map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text || "" }]
                }));
                // Ensure starts with user
                while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

                const payload = {
                    history: historyForApi,
                    message: text,
                    systemInstruction: sysPrompt,
                    image: selectedImage ? selectedImage.split(',')[1] : null,
                    mimeType: selectedImage ? selectedImage.match(/:(.*?);/)?.[1] : null
                };


                // Determine API URL: Use Production Server if on Localhost, otherwise relative path
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
                throw e; // Pass to outer catch
            }

            const aiMsg = { text: responseText, sender: 'ai', createdAt: new Date() };
            // Optimistic Update (Listener will fix duplicates if any, but usually we rely on listener)
            if (!currentSessionId) {
                // If we just created the session, logic might be tricky with listener timing
                // Use optimistic for now, listener filters later
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
                <AnnouncementBar title="" leftIcon="back" hideRightOptions={true} />

                {/* Mobile History Toggle */}
                <button
                    className="mobile-history-toggle"
                    onClick={() => setShowSidebar(true)}
                    style={{ position: 'absolute', top: '70px', left: '10px', zIndex: 10, background: '#333', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                >
                    📜 History
                </button>

                <div className="chat-area" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '100px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                            {msg.image && <img src={msg.image} alt="User Upload" className="message-image" />}
                            <div className="markdown-content">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
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

                <div className="input-area" style={{ borderTop: '1px solid #eee', padding: '15px', paddingBottom: '25px', background: '#fff' }}>
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

