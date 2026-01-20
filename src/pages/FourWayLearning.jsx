import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';

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

    // AI Helper
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
    const MODEL_NAME = "gemini-flash-latest";

    // Text to Speech Helper
    const [speakingText, setSpeakingText] = useState(null);
    const [voices, setVoices] = useState([]);

    useEffect(() => {
        window.speechSynthesis.cancel(); // Cleanup on mount
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
        };
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();

        return () => window.speechSynthesis.cancel(); // Cleanup on unmount
    }, []);

    const utteranceRef = useRef(null);

    const speakText = (text) => {
        if (!('speechSynthesis' in window)) return;
        if (!text) return; // Safety check

        const cleanText = text.replace(/[*#_`]/g, '');
        if (!cleanText.trim()) return;

        window.speechSynthesis.cancel();

        if (speakingText === text) {
            setSpeakingText(null);
            return;
        }

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
            if (!genAI) throw new Error("API Key Missing! Please configure VITE_GEMINI_API_KEY.");
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
                // Update timestamp/title
                updateDoc(doc(db, 'users', authUser.uid, 'four_way_sessions', sessionId), {
                    updatedAt: serverTimestamp()
                });
            }

            // 2. Save User Msg
            await addDoc(collection(db, 'users', authUser.uid, 'four_way_sessions', sessionId, 'messages'), newUserMsg);

            // 3. AI Generation
            let promptText = "";
            let topic = currentInput || "Explain this image";

            if (activeTab === 'teaching') {
                promptText = `
                    Act as a Teacher teaching a student.
                    Step 1: Write a formal, academic paragraph defining/explaining "${topic}".
                    Step 2: Act as if you are now explaining that paragraph to a student in their mother tongue (${motherTongue}).
                    Break it down, use casual/spoken tone in ${motherTongue} (e.g. Hinglish if Hindi, or just ${motherTongue}), and make it super easy to grasp.
                `;
            } else if (activeTab === 'conceptual') {
                promptText = `Explain the concept of "${topic}" in depth. Focus on the core principles, definitions, and the underlying logic. Break it down into simple, digestible parts. Do not use complex jargon without explanation.`;
            } else if (activeTab === 'fictional') {
                promptText = `Explain "${topic}" by creating a fictional story or a sci-fi analogy. Use characters or settings that make the concept easier to visualize and remember. Treat the concept as a mechanism in this fictional world.`;
            } else if (activeTab === 'storytelling') {
                promptText = `Tell a story that revolves around "${topic}". The story should be engaging and the topic should be central to the plot, helping the reader understand naturally through the narrative flow.`;
            }

            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            // History for API
            let historyForApi = chats[activeTab].map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text || "" }]
            })).slice(-10); // Context window

            // Ensure starts with user
            while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

            const chat = model.startChat({ history: historyForApi });

            let msgParts = [promptText];
            if (newUserMsg.image) {
                const base64Data = newUserMsg.image.split(',')[1];
                const mimeType = newUserMsg.image.match(/:(.*?);/)?.[1] || "image/jpeg";
                msgParts = [promptText, { inlineData: { mimeType, data: base64Data } }];
            }

            const result = await chat.sendMessage(msgParts);
            const responseText = result.response.text();

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f6fa', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* HEADER */}
            <div style={{ background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                    <button
                        onClick={() => setShowSidebar(true)}
                        style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '15px', color: '#2d3436' }}
                    >
                        ☰
                    </button>
                    <button className="btn-back-marker" onClick={() => navigate(-1)}>Back</button>
                    <h1 style={{ margin: '0 0 0 15px', fontSize: '20px', color: '#2d3436' }}>Four-Way Learning</h1>
                </div>

                <div style={{ display: 'flex', overflowX: 'auto', padding: '0 10px' }}>
                    {modes.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setActiveTab(m.id)}
                            style={{
                                flex: 1, padding: '15px 10px', background: 'none', border: 'none',
                                borderBottom: activeTab === m.id ? '3px solid #6c5ce7' : '3px solid transparent',
                                color: activeTab === m.id ? '#6c5ce7' : '#636e72',
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
            <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                        background: msg.role === 'user' ? '#6c5ce7' : 'white',
                        color: msg.role === 'user' ? 'white' : '#2d3436',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.role === 'ai' ? '2px' : '12px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        lineHeight: '1.5',
                        position: 'relative' // For absolute positioning of button if needed, but flex is safer inside div
                    }}>
                        {msg.image && <img src={msg.image} alt="User" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />}
                        {/* TEXT CONTENT (Markdown Rendered) */}
                        <div className="markdown-content">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>

                        {/* SPEAKER BUTTON */}
                        {msg.role === 'ai' && (
                            <button onClick={() => speakText(msg.text)} className="speak-button">
                                {speakingText === msg.text ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && <div style={{ alignSelf: 'flex-start', background: 'white', padding: '10px 20px', borderRadius: '20px', color: '#666' }}>Thinking...</div>}
            </div>

            {/* INPUT AREA */}
            <div style={{ padding: '15px', background: 'white', borderTop: '1px solid #eee' }}>
                {activeTab === 'teaching' && (
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select value={motherTongue} onChange={(e) => setMotherTongue(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}>
                            <option value="Hindi">Hindi</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Tamil">Tamil</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                        </select>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#6c5ce7', fontSize: '14px' }}>
                            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                            📷 {selectedImage ? 'Image Added' : 'Add Image'}
                        </label>
                        {selectedImage && <button onClick={() => setSelectedImage(null)} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}>✕</button>}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" value={inputs[activeTab]} onChange={(e) => setInputs(prev => ({ ...prev, [activeTab]: e.target.value }))} onKeyPress={(e) => e.key === 'Enter' && handleGenerate()} placeholder={`Ask in ${currentMode?.title} mode...`} style={{ flex: 1, padding: '12px 15px', borderRadius: '25px', border: '1px solid #dfe6e9', outline: 'none' }} />
                    <button onClick={handleGenerate} disabled={loading || (!inputs[activeTab] && !selectedImage)} style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#6c5ce7', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>➤</button>
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
