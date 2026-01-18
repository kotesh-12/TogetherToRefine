import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AnnouncementBar from '../components/AnnouncementBar';


export default function TTRAI() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [userContext, setUserContext] = useState(null);
    const messagesEndRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Cleanup Speech on Unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Auth & Context Loading
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                // Fetch User Context for the AI
                let context = {};
                let userDoc = await getDoc(doc(db, "users", user.uid));

                if (!userDoc.exists()) {
                    userDoc = await getDoc(doc(db, "institutions", user.uid));
                }

                // Fallback check for teachers if not found in users/institutions
                if (!userDoc.exists()) {
                    userDoc = await getDoc(doc(db, "teachers", user.uid));
                }

                if (userDoc.exists()) {
                    const data = userDoc.data();

                    // Fetch upcoming exams/opportunities
                    const eventsSnap = await getDocs(collection(db, "opportunities"));
                    const events = [];
                    eventsSnap.forEach(e => events.push(e.data()));

                    context = {
                        role: data.role || 'unknown',
                        class: data.class || 'N/A',
                        gender: data.gender || 'N/A',
                        name: data.name || data.schoolName || 'User',
                        upcomingEvents: events
                    };
                }
                setUserContext(context);
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // 2. Chat History Listener
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'ai_chats', currentUser.uid, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMsgs = snapshot.docs.map(doc => doc.data()).reverse(); // Reverse because we fetched DESC

            if (loadedMsgs.length === 0) {
                setMessages([
                    { text: "Hello! I am TTR AI. I'm here to help you with your educational journey. How can I assist you today?", sender: 'ai' }
                ]);
            } else {
                setMessages(loadedMsgs);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);


    const generateSystemPrompt = (context) => {
        return `
            You are TTR AI, an intelligent educational assistant.
            
            Current User Context:
            - Name: ${context?.name}
            - Role: ${context?.role}
            - Class/Grade: ${context?.class}
            - Gender: ${context?.gender}

            Your Guidelines:
            1. **Educational Focus**: Your primary goal is to help with educational, career, and future-aim related questions specific to the user's level.
            2. **Strict Restriction on Non-Educational Topics**: 
               - If the user asks clearly "uneducated" or irrelevant questions (e.g., entertainment, gossip, explicit content, pure nonsense), reply EXACTLY: "I am with you I'm here to help you in your educational and future aim questions only."
            3. **General Knowledge Exception**:
               - If the user asks a General Knowledge question, provide a very BRIEF answer (1-2 sentences).
               - Then, politely pivot back to how this might relate to studies.
            4. **Tone**: Encouraging, formal yet accessible, and mentorship-oriented. Matches the user's gender and age group appropriately.
            
            5. **Time Awareness**:
               - Current Date: ${new Date().toDateString()}
               - System Time: ${new Date().toLocaleTimeString()}
            
            6. **Upcoming Schedule / Calendar Context**:
               - The following exams/events are scheduled for students:
                 ${context?.upcomingEvents?.map(e => `- ${e.title} on ${e.deadline || 'Date TBA'}`).join('\n') || "(No upcoming exams found)"}
               - If the user asks about exams, use this schedule to remind them.
        `;
    };

    const [selectedImage, setSelectedImage] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Permission States
    const [micPermission, setMicPermission] = useState(false);
    const [cameraPermission, setCameraPermission] = useState(false);
    const [permissionModal, setPermissionModal] = useState(null); // 'mic' or 'camera'

    const fileInputRef = useRef(null);

    // Voice Output
    const speakText = (text) => {
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';

            // Try to set a "Sweet" / Engaging Female Voice
            const voices = window.speechSynthesis.getVoices();

            // Priority list for "Sweet/Student Friendly" voices
            const preferredVoice = voices.find(v => v.name.includes("Google US English")) ||
                voices.find(v => v.name.includes("Zira")) ||
                voices.find(v => v.name.includes("Samantha")) ||
                voices.find(v => v.name.includes("Female"));

            if (preferredVoice) utterance.voice = preferredVoice;

            utterance.pitch = 1.3;
            utterance.rate = 0.95;
            utterance.volume = 1;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        }
    };

    // Voice Input
    const toggleVoiceInput = () => {
        if (!micPermission) {
            setPermissionModal('mic');
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice input not supported in this browser. Try Chrome.");
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognition.start();
    };

    const handleCameraClick = () => {
        if (!cameraPermission) {
            setPermissionModal('camera');
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                setSelectedImage(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    // Helper to add message to DB
    const saveMessage = async (msgObj) => {
        if (!currentUser) return;
        try {
            await addDoc(collection(db, 'ai_chats', currentUser.uid, 'messages'), {
                ...msgObj,
                createdAt: new Date()
            });
        } catch (e) {
            console.error("Error saving message", e);
        }
    };

    // Initialize Gemini AI Client: REMOVED (Reverting to Backend)
    // const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    // ... (restored code)

    const handleSend = async () => {
        if (!input.trim() && !selectedImage) return;
        if (!currentUser) return;

        let finalInput = input;
        let systemCtx = generateSystemPrompt(userContext);

        // 1. Link Analysis (Smart Notes)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = input.match(urlRegex);

        const userMsg = { text: input || "Image Uploaded", image: selectedImage, sender: 'user' };

        // Data prep for DB (remove large image)
        const dbMsg = { ...userMsg };
        if (selectedImage && selectedImage.length > 1000000) {
            delete dbMsg.image;
            dbMsg.text += " [Image too large to save in history]";
        }
        saveMessage(dbMsg);

        if (selectedImage && selectedImage.length > 5000000) { // ~5MB Limit for API safety
            alert("Image is too large for AI processing. Please use a smaller image (<5MB).");
            setLoading(false);
            return;
        }

        const imageToSend = selectedImage;
        setInput('');
        setSelectedImage(null);
        setLoading(true);

        try {
            // If URL found, fetch content (Backend Proxy)
            if (urls && urls.length > 0) {
                const url = urls[0];
                try {
                    const fetchRes = await fetch('/api/fetch-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: urls[0] })
                    });
                    const fetchData = await fetchRes.json();

                    if (fetchData.content) {
                        systemCtx += `\n\n**CONTEXT FROM LINK (${urls[0]})**:\n"${fetchData.content}"\n\nUser Question: ${finalInput}\n(Answer based on the link content if relevant)`;
                    }
                } catch (e) {
                    console.error("Link fetch failed", e);
                }
            }

            if (imageToSend) {
                systemCtx += `
                    \n\n**SPECIAL INSTRUCTION FOR IMAGE/VISUAL INPUT**:
                    The user has uploaded an image or requested visual analysis.
                    Respond in 'Teacher Style' format.
                `;
            }

            // BUILD HISTORY FROM PREVIOUS MESSAGES (Filter errors)
            const previousHistory = messages
                .filter(m => !m.isError)
                .slice(-10)
                .map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }]
                }));

            const history = [
                { role: "user", parts: [{ text: systemCtx }] },
                { role: "model", parts: [{ text: "Understood. I am ready." }] },
                ...previousHistory
            ];

            // ... inside handleSend ...

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        history: history,
                        message: finalInput || "Explain this image",
                        image: imageToSend ? imageToSend.split(',')[1] : null,
                        mimeType: imageToSend ? imageToSend.split(';')[0].split(':')[1] : null
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Backend Error: " + errorText);
                }
                const data = await response.json();
                saveMessage({ text: data.text, sender: 'ai' });

            } catch (backendError) {
                console.error("AI Request Failed:", backendError);
                let errorMsg = "Unable to connect to AI Server. Please ensure the backend server is running on port 5000.";

                // If it's a backend error (e.g. 500), show that instead
                if (backendError.message.includes("Backend Error")) {
                    errorMsg = backendError.message;
                }

                setMessages(prev => [...prev, {
                    text: `Error: ${errorMsg}`,
                    sender: 'ai',
                    isError: true
                }]);
            }
        } catch (error) {
            console.error("General Error:", error);
            setMessages(prev => [...prev, { text: "Error: " + error.message, sender: 'ai', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ttr-ai-container">
            {/* Header */}
            <AnnouncementBar title="TTR AI Assistant ✨" leftIcon="back" />

            {/* Chat Area */}
            <div className="chat-area">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                        {msg.image && (
                            <img src={msg.image} alt="User Upload" className="message-image" />
                        )}
                        {msg.text}
                        {msg.sender === 'ai' && (
                            <button
                                onClick={() => speakText(msg.text)}
                                className="speak-button"
                                title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
                            >
                                {isSpeaking ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="loading-indicator">
                        Typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="input-area">
                {selectedImage && (
                    <div className="image-preview-container">
                        <img src={selectedImage} alt="Preview" className="image-preview" />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="remove-image-button"
                        >✕</button>
                    </div>
                )}

                <div className="input-controls">
                    <button className="icon-button" onClick={handleCameraClick} title="Upload Image / Camera">
                        📷
                    </button>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                    />

                    <button
                        onClick={toggleVoiceInput}
                        className={`voice-button ${isListening ? 'listening' : ''}`}
                        title="Voice Input"
                    >
                        {isListening ? '🛑' : '🎙️'}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={selectedImage ? "Add topic..." : "Type, Paste Link, or Speak..."}
                        className="chat-input"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading}
                        className="send-button"
                    >
                        ➤
                    </button>
                </div>
            </div>

            {/* PERMISSION MODAL */}
            {permissionModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '15px', maxWidth: '300px', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>
                            {permissionModal === 'mic' ? '🎙️' : '📷'}
                        </div>
                        <h3 style={{ margin: '0 0 10px 0' }}>Permission Needed</h3>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                            {permissionModal === 'mic'
                                ? "Do you allow TTR AI to access your microphone for voice commands?"
                                : "Do you allow TTR AI to access your photo gallery or camera to upload images?"}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setPermissionModal(null)}
                                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                            >
                                Deny
                            </button>
                            <button
                                onClick={() => {
                                    if (permissionModal === 'mic') setMicPermission(true);
                                    if (permissionModal === 'camera') {
                                        setCameraPermission(true);
                                        setTimeout(() => fileInputRef.current?.click(), 100);
                                    }
                                    setPermissionModal(null);
                                }}
                                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#0984e3', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Allow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
