import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
// import { GoogleGenerativeAI } from "@google/generative-ai"; // Removed for Security
import { useSpeech } from '../hooks/useSpeech';
import ReactMarkdown from 'react-markdown';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';

// Helper Component for Typewriter Effect
const TypewriterMessage = ({ text }) => {
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
                    return prev;
                }
            });
        }, 5);
        return () => clearInterval(interval);
    }, [text]);

    return <ReactMarkdown>{displayedText}</ReactMarkdown>;
};

export default function FourWayLearning() {
    const navigate = useNavigate();
    const { user: authUser, userData } = useUser();

    // Active Mode Tab
    const [activeTab, setActiveTab] = useState('conceptual');

    // Chat Content (View Layer)
    const [chats, setChats] = useState({
        conceptual: [],
        fictional: [],
        storytelling: [],
        teaching: []
    });

    // Active Sessions (Persistence Layer) - Maps Mode -> SessionID
    const [activeSessionIds, setActiveSessionIds] = useState({
        conceptual: null,
        fictional: null,
        storytelling: null,
        teaching: null
    });

    // History List
    const [sessions, setSessions] = useState([]);

    // Inputs
    const [inputs, setInputs] = useState({
        conceptual: '',
        fictional: '',
        storytelling: '',
        teaching: ''
    });

    const [loading, setLoading] = useState(false);
    const [motherTongue, setMotherTongue] = useState('Hindi');
    const [selectedImage, setSelectedImage] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    const chatContainerRef = useRef(null);
    const userClass = userData?.class || "Grade 10";

    const modes = [
        {
            id: 'conceptual',
            title: '🧠 Conceptual',
            desc: 'Understand the "Why" and "How" with deep conceptual clarity.',
        },
        {
            id: 'fictional',
            title: '🚀 Fictional',
            desc: 'Learn through analogies using Indian Mythology, History, or Sci-Fi.',
        },
        {
            id: 'storytelling',
            title: '📖 Story',
            desc: 'Weave the topic into a compelling narrative.',
        },
        {
            id: 'teaching',
            title: '👩‍🏫 Teaching',
            desc: 'Interactive 2-way communication dialogue between Teacher and Student.',
        }
    ];

    const currentMode = modes.find(m => m.id === activeTab);

    // AI Helper - MOVED TO BACKEND (/api/chat) for Security
    const MODEL_NAME = "gemini-flash-latest";

    // Speech Hook
    const { speak, listen, isListening, speakingText } = useSpeech();

    const handleMicClick = () => {
        let lang = 'en-US';
        if (activeTab === 'teaching') {
            const map = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
            lang = map[motherTongue] || 'en-US';
        }

        listen((text) => {
            setInputs(prev => ({ ...prev, [activeTab]: (prev[activeTab] + ' ' + text).trim() }));
        }, lang);
    };

    // 1. Fetch User's History (Sessions)
    useEffect(() => {
        if (!authUser) return;
        // Fetch all 4-Way sessions sorted by new
        const q = query(
            collection(db, 'users', authUser.uid, 'four_way_sessions'),
            orderBy('updatedAt', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, (snap) => {
            setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [authUser]);

    // 2. Listen to Active Session Messages (Only for current tab to save bandwidth)
    useEffect(() => {
        if (!authUser) return;
        const currentId = activeSessionIds[activeTab];

        if (!currentId) {
            // No session active for this tab, clear view (or keep local optimistic if we just started?)
            // We'll keep local state if it exists, otherwise empty
            return;
        }

        const q = query(
            collection(db, 'users', authUser.uid, 'four_way_sessions', currentId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => d.data());
            setChats(prev => ({ ...prev, [activeTab]: msgs }));
        });

        return () => unsub();
    }, [activeTab, activeSessionIds, authUser]); // Refetch when tab or session ID changes

    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chats[activeTab], activeTab]);


    const handleGenerate = async () => {
        const currentInput = inputs[activeTab];
        if (!currentInput.trim() && !selectedImage) return;

        setLoading(true);
        const newUserMsg = { role: 'user', text: currentInput, image: selectedImage, createdAt: serverTimestamp() };

        // Optimistic UI
        setChats(prev => ({ ...prev, [activeTab]: [...prev[activeTab], { ...newUserMsg, createdAt: new Date() }] }));

        setInputs(prev => ({ ...prev, [activeTab]: '' }));
        if (activeTab === 'teaching') setSelectedImage(null);

        try {
            if (!authUser) throw new Error("Please login.");

            // 1. Ensure Persistent Session Exists
            let sessionId = activeSessionIds[activeTab];
            if (!sessionId) {
                const sessRef = await addDoc(collection(db, 'users', authUser.uid, 'four_way_sessions'), {
                    mode: activeTab,
                    title: currentInput.substring(0, 30) || "Image Query",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                sessionId = sessRef.id;
                setActiveSessionIds(prev => ({ ...prev, [activeTab]: sessionId }));
            } else {
                updateDoc(doc(db, 'users', authUser.uid, 'four_way_sessions', sessionId), {
                    updatedAt: serverTimestamp()
                });
            }

            // 2. Save User Msg
            await addDoc(collection(db, 'users', authUser.uid, 'four_way_sessions', sessionId, 'messages'), newUserMsg);

            // 3. AI Generation ( VIA SECURE BACKEND )
            let promptText = "";
            let topic = currentInput || "Explain this image";

            // TTR UNIVERSE: MASTER CHARACTER LIST
            // We inject this context so the AI uses consistent peronalities.
            const UNIVERSE_CONTEXT = `
                **TTR UNIVERSE - CHARACTER RULES:**
                Use these specific characters if the topic relates to their concept. Do NOT invent random names if a TTR Character exists.
                
                **PHYSICS:**
                - Proton -> **Pranav** (Positive Leader)
                - Electron -> **Esha** (Energetic Runner)
                - Neutron -> **Neel** (Calm, Neutral)
                - Gravity -> **Gajraj** (Heavy Giant)
                - Friction -> **Firoz** (Rough Blocker)
                - Velocity -> **Veer** (Speedster)
                - Light -> **Lux** (The Flash)
                - Time -> **Tara** (The Watcher)
                
                **CHEMISTRY:**
                - Atom -> **Anu** (Tiny Block)
                - Bond -> **Bandhan** (The Glue)
                - Carbon -> **Kabir** (King of Life)
                - Oxygen -> **Ojas** (The Burner)
                
                **BIOLOGY:**
                - Cell -> **Chaitanya** (The City)
                - Nucleus -> **Nawab** (The Boss)
                - DNA -> **Dina** (The Blueprint)
                - Mitochondria -> **Mitran** (Powerhouse)
                - Brain -> **Brain** (CPU)
                
                **MATH:**
                - Zero -> **Shoonya** (The Void)
                - Infinity -> **Anant** (Endless)
                - Pi -> **Pie** (Circle Master)
                - X (Variable) -> **Xavier** (The Mystery)
                
                **TECH:**
                - Code -> **Coda**
                - Bug -> **Glitch**
                - AI -> **Aio**
                
                **General Rule:** If no specific character matches, use Indian names (Aarav, Diya) with distinct personalities.
            `;

            if (activeTab === 'teaching') {
                promptText = `
                    Act as a wise and encouraging Indian Teacher (Guru) teaching a student.
                    Step 1: Write a formal, academic paragraph defining/explaining "${topic}".
                    Step 2: Act as if you are now explaining that paragraph to a student in their mother tongue (${motherTongue}).
                    Break it down, use casual/spoken tone in ${motherTongue} (e.g. Hinglish if Hindi, or just ${motherTongue}), and make it super easy to grasp.
                    Always end with a small moral note or advice on discipline and hard work.
                `;
            } else if (activeTab === 'conceptual') {
                promptText = `
                    Explain the concept of "${topic}" in depth. 
                    - Focus on the core principles, definitions, and the underlying logic. 
                    - Use simple, digestible parts.
                    - If possible, relate it to an example from Indian daily life or nature.
                    - Conclude with why this knowledge is important for a responsible citizen.
                `;
            } else if (activeTab === 'fictional') {
                promptText = `
                    Explain "${topic}" by creating a fictional story using the **TTR Universe Characters**.
                    ${UNIVERSE_CONTEXT}
                    
                    **CRITICAL INSTRUCTION:**
                    - The story MUST use the concept as a key mechanism.
                    - The story MUST teach **Ethics, Moral Values, and Dharma** alongside the concept.
                    - The goal is to build a "poisonless mind" (virtuous and ethical) in the student.
                `;
            } else if (activeTab === 'storytelling') {
                promptText = `
                    Tell a compelling story revolving around "${topic}" set in India.
                    ${UNIVERSE_CONTEXT}
                    
                    **CRITICAL INSTRUCTION:**
                    - Use the TTR Characters where applicable.
                    - The story **MUST** carry a strong moral lesson (teaching honesty, kindness, bravery, or integrity) alongside the educational topic.
                    - Example theme: "Knowledge without character is dangerous."
                    - Ensure the narrative flow naturally explains the topic.
                `;
            }

            // History for API
            let historyForApi = chats[activeTab].map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text || "" }]
            })).slice(-10); // Context window

            // Ensure starts with user
            while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

            // CALL BACKEND
            const payload = {
                history: historyForApi,
                message: promptText,
                image: newUserMsg.image ? newUserMsg.image.split(',')[1] : null,
                mimeType: newUserMsg.image ? newUserMsg.image.match(/:(.*?);/)?.[1] : null
            };

            // Connect to Production Server if on Localhost
            const API_URL = window.location.hostname === 'localhost'
                ? 'https://together-to-refine.vercel.app/api/chat'
                : '/api/chat';

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Server Error (Backend offline?)");
            }

            const data = await res.json();
            const responseText = data.text;

            // 4. Save AI Msg
            await addDoc(collection(db, 'users', authUser.uid, 'four_way_sessions', sessionId, 'messages'), {
                role: 'ai',
                text: responseText,
                createdAt: serverTimestamp()
            });

        } catch (error) {
            console.error(error);
            setChats(prev => ({
                ...prev,
                [activeTab]: [...prev[activeTab], { role: 'ai', text: "Error: " + error.message, isError: true }]
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setSelectedImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const loadSession = (session) => {
        setActiveTab(session.mode);
        setActiveSessionIds(prev => ({ ...prev, [session.mode]: session.id }));
        setShowSidebar(false);
    };

    const resetCurrentChat = () => {
        setActiveSessionIds(prev => ({ ...prev, [activeTab]: null }));
        setChats(prev => ({ ...prev, [activeTab]: [] }));
        setShowSidebar(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-body)', color: 'var(--text-main)', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* HEADER */}
            <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--divider)', flexShrink: 0, position: 'relative' }}>
                <button
                    onClick={() => setShowSidebar(true)}
                    style={{
                        position: 'absolute', top: '12px', right: '10px', zIndex: 5,
                        background: '#333', color: 'white', border: 'none',
                        borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer'
                    }}
                >
                    📜 History
                </button>

                <div style={{ display: 'flex', overflowX: 'auto', padding: '0 10px', scrollbarWidth: 'none' }}>
                    {modes.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setActiveTab(m.id)}
                            style={{
                                flex: 1, padding: '15px 10px', background: 'none', border: 'none',
                                borderBottom: activeTab === m.id ? '3px solid #6c5ce7' : '3px solid transparent',
                                color: activeTab === m.id ? '#6c5ce7' : 'var(--text-muted)',
                                fontWeight: activeTab === m.id ? 'bold' : 'normal',
                                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                            }}
                        >
                            {m.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* CHAT AREA */}
            <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {chats[activeTab].length === 0 && (
                    <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '50px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>✨</div>
                        <p>{currentMode?.desc}</p>
                        <p style={{ fontSize: '13px' }}>Ask anything to start learning!</p>
                    </div>
                )}
                {chats[activeTab].map((msg, idx) => (
                    <div key={idx} style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: msg.role === 'user' ? '#6c5ce7' : 'var(--bg-surface)',
                        color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.role === 'ai' ? '2px' : '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        lineHeight: '1.4',
                        position: 'relative' // For absolute positioning of button if needed, but flex is safer inside div
                    }}>
                        {msg.image && <img src={msg.image} alt="User" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />}
                        {/* TEXT CONTENT (Markdown Rendered) */}
                        <div className="markdown-content">
                            {msg.role === 'ai' && idx === chats[activeTab].length - 1 && !msg.isError ? (
                                <TypewriterMessage text={msg.text} />
                            ) : (
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            )}
                        </div>

                        {/* SPEAKER BUTTON */}
                        {msg.role === 'ai' && (
                            <button onClick={() => {
                                const langMap = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
                                const lang = activeTab === 'teaching' ? (langMap[motherTongue] || 'en-US') : 'en-US';
                                speak(msg.text, lang);
                            }} className="speak-button">
                                {speakingText === msg.text ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && <div style={{ alignSelf: 'flex-start', background: 'var(--bg-surface)', padding: '10px 20px', borderRadius: '20px', color: 'var(--text-muted)' }}>Thinking...</div>}
            </div>

            {/* INPUT AREA */}
            <div className="input-area">
                {selectedImage && (
                    <div className="image-preview-container">
                        <img src={selectedImage} alt="Preview" className="image-preview" />
                        <button onClick={() => setSelectedImage(null)} className="remove-image-button">✕</button>
                    </div>
                )}

                <div className="input-controls">
                    <div style={{
                        position: 'absolute', top: '-20px', right: '20px',
                        fontSize: '9px', color: '#138808', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '3px', opacity: 0.8
                    }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#138808', display: 'inline-block' }}></span>
                        TTR Intelligent Link
                    </div>

                    <button
                        onClick={handleMicClick}
                        className={`voice-button ${isListening ? 'listening' : ''}`}
                        title="Click to Speak"
                    >
                        {isListening ? '🛑' : '🎙️'}
                    </button>

                    {activeTab === 'teaching' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <select
                                value={motherTongue}
                                onChange={(e) => setMotherTongue(e.target.value)}
                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                            >
                                <option value="Hindi">HI</option>
                                <option value="Telugu">TE</option>
                                <option value="Tamil">TA</option>
                                <option value="Spanish">ES</option>
                                <option value="French">FR</option>
                            </select>
                            <label style={{ cursor: 'pointer', fontSize: '18px' }} title="Add Image">
                                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                                📷
                            </label>
                        </div>
                    )}

                    <input
                        type="text"
                        value={inputs[activeTab]}
                        onChange={(e) => setInputs(prev => ({ ...prev, [activeTab]: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                        placeholder={`Explain in ${activeTab}...`}
                        className="chat-input"
                    />

                    <button onClick={handleGenerate} disabled={loading || (!inputs[activeTab] && !selectedImage)} className="send-button">➤</button>
                </div>
            </div>

            {/* SIDEBAR HISTORY */}
            {showSidebar && (
                <div className="sidebar-overlay">
                    <div className="sidebar-backdrop" onClick={() => setShowSidebar(false)} />
                    <div className="sidebar-content">
                        <h2>History</h2>
                        <button onClick={resetCurrentChat} className="btn" style={{ width: '100%', marginBottom: '15px', background: '#333' }}>+ New {currentMode?.title} Chat</button>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sessions.filter(s => s.mode === activeTab).length === 0 && (
                                <p style={{ color: '#666', fontStyle: 'italic' }}>No {currentMode?.title} history yet.</p>
                            )}

                            {sessions.filter(s => s.mode === activeTab).map(sess => (
                                <div key={sess.id} onClick={() => loadSession(sess)} style={{
                                    padding: '10px',
                                    background: activeSessionIds[sess.mode] === sess.id ? '#e3f2fd' : '#f5f5f5',
                                    borderRadius: '8px', cursor: 'pointer', fontSize: '14px', borderLeft: `4px solid ${sess.mode === 'conceptual' ? '#ff7675' :
                                        sess.mode === 'fictional' ? '#74b9ff' :
                                            sess.mode === 'storytelling' ? '#55efc4' : '#a29bfe'
                                        }`
                                }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                        {/* No need to show mode label since list is filtered, but title is active */}
                                        {sess.title}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                                        {sess.updatedAt?.toDate ? sess.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button onClick={() => {
                                const r = userData?.role?.toLowerCase();
                                if (r === 'admin' || authUser?.email === 'admin@ttr.com') navigate('/admin');
                                else if (r === 'teacher') navigate('/teacher');
                                else if (r === 'institution') navigate('/institution');
                                else if (r === 'student') navigate('/student');
                                else navigate('/details');
                            }} className="btn" style={{ width: '100%', background: '#2193b0' }}>
                                🏠 Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
