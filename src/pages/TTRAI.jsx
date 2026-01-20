import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, collection, getDocs, addDoc, updateDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
    const MODEL_NAME = "gemini-flash-latest";
    const [selectedImage, setSelectedImage] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speakingText, setSpeakingText] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Permissions
    const [micPermission, setMicPermission] = useState(false);
    const [cameraPermission, setCameraPermission] = useState(false);
    const [permissionModal, setPermissionModal] = useState(null);
    const fileInputRef = useRef(null);
    const [voices, setVoices] = useState([]); // Voice state

    // Context Loading
    const [userContext, setUserContext] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Session State
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);

    // Load Voices
    useEffect(() => {
        const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }, []);

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

    const utteranceRef = useRef(null);

    const speakText = (text) => {
        if (!('speechSynthesis' in window)) return;

        const cleanText = text.replace(/[*#_`]/g, '');
        if (!cleanText.trim()) return;

        window.speechSynthesis.cancel();

        if (speakingText === text) {
            setSpeakingText(null);
            return;
        }

        // Delay to prevent race condition
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utteranceRef.current = utterance;

            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en"))
                || voices.find(v => v.name.includes("Microsoft") && v.lang.includes("en"))
                || voices.find(v => v.lang.startsWith("en"));

            if (preferredVoice) utterance.voice = preferredVoice;

            utterance.rate = 1.0;
            utterance.onend = () => setSpeakingText(null);
            utterance.onerror = (e) => { console.error("TTS Error", e); setSpeakingText(null); };

            setSpeakingText(text);
            window.speechSynthesis.speak(utterance);
        }, 50);
    };

    const toggleVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Use Chrome for Voice.");
        if (!micPermission) { setPermissionModal('mic'); return; }
        if (isListening) { setIsListening(false); return; }
        const r = new window.webkitSpeechRecognition();
        r.onstart = () => setIsListening(true);
        r.onend = () => setIsListening(false);
        r.onresult = (e) => setInput(prev => prev + ' ' + e.results[0][0].transcript);
        r.start();
    };

    const handleCameraClick = () => { !cameraPermission ? setPermissionModal('camera') : fileInputRef.current?.click(); };
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

            // Generate AI Response
            let sysPrompt = generateSystemPrompt(userContext);
            let responseText = "";

            try {
                // FORCE CLIENT-SIDE ONLY (Fixes 404 API Errors)
                if (!genAI) throw new Error("API Key Missing. Please configure VITE_GEMINI_API_KEY.");
                const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction: sysPrompt });

                // Fix: Google Gemini mandates that history MUST start with 'user' role.
                // We filter the history to ensure this sequence.
                let historyForApi = messages.slice(-10).map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text || "" }]
                }));

                // Ensure the first message is strictly from 'user'
                while (historyForApi.length > 0 && historyForApi[0].role !== 'user') {
                    historyForApi.shift();
                }

                const chat = model.startChat({
                    history: historyForApi
                });

                let msgParts = text;
                if (selectedImage) {
                    msgParts = [
                        { text: text || "Analyze this image" },
                        { inlineData: { mimeType: selectedImage.match(/:(.*?);/)?.[1] || "image/jpeg", data: selectedImage.split(',')[1] } }
                    ];
                }

                const result = await chat.sendMessage(msgParts);
                responseText = result.response.text();

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
            setMessages(prev => [...prev, { text: "Error: " + error.message, sender: 'ai', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ttr-ai-container">
            <AnnouncementBar title="TTR AI Assistant" leftIcon="back" onMenuClick={() => setShowSidebar(true)} />

            <div className="chat-area">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                        {msg.image && <img src={msg.image} alt="User Upload" className="message-image" />}
                        <div className="markdown-content">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                        {msg.sender === 'ai' && (
                            <button onClick={() => speakText(msg.text)} className="speak-button">
                                {speakingText === msg.text ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && <div style={{ color: '#888', fontStyle: 'italic', margin: '10px' }}>AI is thinking...</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
                {selectedImage && (
                    <div className="image-preview-container">
                        <img src={selectedImage} alt="Preview" className="image-preview" />
                        <button onClick={() => setSelectedImage(null)} className="remove-image-button">✕</button>
                    </div>
                )}
                <div className="input-controls">
                    <button className="icon-button" onClick={handleCameraClick} title="Upload">📷</button>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                    <button onClick={toggleVoiceInput} className={`voice-button ${isListening ? 'listening' : ''}`} title="Voice">
                        {isListening ? '🛑' : '🎙️'}
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={selectedImage ? "Add topic..." : "WELCOME TTR'S AI"}
                        className="chat-input"
                    />
                    <button onClick={handleSend} disabled={loading} className="send-button">➤</button>
                </div>
            </div>

            {/* PERMISSION MODAL */}
            {permissionModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '15px', maxWidth: '300px', textAlign: 'center' }}>
                        <p>Permission Required for {permissionModal}</p>
                        <button onClick={() => {
                            if (permissionModal === 'mic') setMicPermission(true);
                            if (permissionModal === 'camera') setCameraPermission(true);
                            setPermissionModal(null);
                        }}>Allow</button>
                    </div>
                </div>
            )}

            {/* API KEY ERROR MODAL */}
            {messages.some(m => m.isError && m.text.includes("API Key Missing")) && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', textAlign: 'center', border: '2px solid red' }}>
                        <h2 style={{ color: 'red' }}>⚠️ Action Required</h2>
                        <p style={{ fontSize: '14px', marginBottom: '15px' }}>The AI brain works locally but is missing its key on this website.</p>

                        <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '5px', textAlign: 'left', fontSize: '12px', marginBottom: '15px' }}>
                            <strong>How to fix (for Admin):</strong><br />
                            1. Go to your Vercel/Netlify Dashboard.<br />
                            2. Settings &rarr; Environment Variables.<br />
                            3. Add New Variable:<br />
                            4. Key: <code style={{ color: 'blue' }}>VITE_GEMINI_API_KEY</code><br />
                            5. Value: <em>(Your Google AI Key)</em><br />
                            6. <strong>IMPORTANT: Redeploy the project!</strong>
                        </div>

                        <button onClick={() => setMessages(prev => prev.filter(m => !m.text.includes("API Key Missing")))} className="btn" style={{ background: '#333' }}>
                            Okay, I'll Fix It
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR MENU */}
            {showSidebar && (
                <div className="sidebar-overlay">
                    <div className="sidebar-backdrop" onClick={() => setShowSidebar(false)} />
                    <div className="sidebar-content">
                        <h2>History</h2>

                        <button onClick={startNewChat} className="btn" style={{ width: '100%', marginBottom: '20px', background: '#333' }}>
                            + New Chat
                        </button>

                        <div style={{ marginBottom: '10px' }}>
                            <button onClick={() => {
                                const r = userData?.role?.toLowerCase();
                                if (r === 'admin' || authUser?.email === 'admin@ttr.com') navigate('/admin');
                                else if (r === 'teacher') navigate('/teacher');
                                else if (r === 'institution') navigate('/institution');
                                else if (r === 'student') navigate('/student');
                                else navigate('/details'); // Fallback if role is missing/unknown
                            }} className="btn" style={{ width: '100%', background: '#2193b0' }}>
                                🏠 Go to Dashboard
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sessions.length === 0 && <p style={{ color: '#666', fontStyle: 'italic' }}>No history yet.</p>}
                            {sessions.map(sess => (
                                <div
                                    key={sess.id}
                                    onClick={() => { setCurrentSessionId(sess.id); setShowSidebar(false); }}
                                    style={{
                                        padding: '10px',
                                        background: currentSessionId === sess.id ? '#e3f2fd' : '#f5f5f5',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    {sess.title || "Chat"}
                                    <div style={{ fontSize: '10px', color: '#888' }}>
                                        {sess.updatedAt?.toDate ? sess.updatedAt.toDate().toLocaleDateString() : ""}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <button onClick={() => setShowSidebar(false)} className="btn" style={{ background: '#ddd', color: '#333', width: '100%' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

