import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useUser } from '../context/UserContext';

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
    const [selectedImage, setSelectedImage] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Permissions
    const [micPermission, setMicPermission] = useState(false);
    const [cameraPermission, setCameraPermission] = useState(false);
    const [permissionModal, setPermissionModal] = useState(null);
    const fileInputRef = useRef(null);

    // Context Loading
    const [userContext, setUserContext] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

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

    // 2. Chat History Listener (Direct, No Sessions)
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'ai_chats', currentUser.uid, 'messages'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMsgs = snapshot.docs.map(doc => doc.data()).reverse();
            if (loadedMsgs.length === 0) {
                setMessages([{ text: "Hello! I am TTR AI. How can I assist you today?", sender: 'ai' }]);
            } else {
                setMessages(loadedMsgs);
            }
        }, (error) => {
            console.error("Chat History Error:", error);
            setMessages([{ text: "Welcome! (Chat history unavailable)", sender: 'ai' }]);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => scrollToBottom(), [messages]);

    // System Prompt Generator
    const generateSystemPrompt = (context) => {
        if (context?.role === 'System Admin' || context?.role === 'admin') {
            return `You are TTR Co-Pilot, Admin Assistant. Reports: ${JSON.stringify(context.adminData)}`;
        }
        return `You are TTR AI. User: ${context?.name}, Role: ${context?.role}. Help with education only.`;
    };

    // Helper functions
    const saveMessage = async (msgObj) => {
        if (!currentUser) return;
        try {
            await addDoc(collection(db, 'ai_chats', currentUser.uid, 'messages'), { ...msgObj, createdAt: new Date() });
        } catch (e) { console.error("Error saving message", e); }
    };

    const speakText = (text) => {
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
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

        const userMsg = { text: text || "Image Uploaded", image: selectedImage, sender: 'user', createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);

        try {
            if (!currentUser) throw new Error("User not found");

            // Save User Msg
            saveMessage(userMsg);

            // Generate AI Response
            let sysPrompt = generateSystemPrompt(userContext);
            let responseText = "";

            try {
                // Server Side Call (Primary)
                const payload = {
                    message: text,
                    history: messages.slice(-5).map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
                    systemInstruction: sysPrompt
                };
                if (selectedImage) {
                    payload.image = selectedImage.split(',')[1];
                    payload.mimeType = selectedImage.match(/:(.*?);/)?.[1];
                }

                const res = await fetch('/api/chat', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error("Server Failed");
                const data = await res.json();
                responseText = data.text;

            } catch (e) {
                console.warn("Server failed, using client fallback", e);
                // Client Side Fallback
                if (!genAI) throw new Error("No API Key");
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", systemInstruction: sysPrompt });
                const chat = model.startChat();
                const result = await chat.sendMessage(text || "image");
                responseText = result.response.text();
            }

            const aiMsg = { text: responseText, sender: 'ai', createdAt: new Date() };
            setMessages(prev => [...prev, aiMsg]);
            saveMessage(aiMsg);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { text: "Error: " + error.message, sender: 'ai', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ttr-ai-container">
            <AnnouncementBar title="TTR AI Assistant" leftIcon="back" />

            <div className="chat-area">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                        {msg.image && <img src={msg.image} alt="User Upload" className="message-image" />}
                        {msg.text}
                        {msg.sender === 'ai' && (
                            <button onClick={() => speakText(msg.text)} className="speak-button">
                                {isSpeaking ? '🔇' : '🔊'}
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
        </div>
    );
}

