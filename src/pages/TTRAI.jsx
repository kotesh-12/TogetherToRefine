import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
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
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMsgs = snapshot.docs.map(doc => doc.data());

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

    const handleSend = async () => {
        if (!input.trim() && !selectedImage) return;
        if (!currentUser) return;

        let finalInput = input;
        let systemCtx = generateSystemPrompt(userContext);

        // 1. Link Analysis (Smart Notes)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = input.match(urlRegex);

        const userMsg = { text: input || "Image Uploaded", image: selectedImage, sender: 'user' };

        // Optimistic update handled by listener? No, usually listener acts fast but slight delay. 
        // For smoother UX, we can clear input immediately but rely on listener for display.
        // Actually, if we use listener, we don't need setMessages here.
        // BUT, saving image Base64 to Firestore is risky (size limits). 
        // We will strip the image from the DB object if it's too large, or just not save the image data to history.
        // For this version: We Save TEXT to history. We preserve Image in local context for this session ONLY?
        // Or we try to save small ones.

        const dbMsg = { ...userMsg };
        if (selectedImage && selectedImage.length > 1000000) {
            delete dbMsg.image; // Don't save large images to Firestore
            dbMsg.text += " [Image too large to save in history]";
        }

        saveMessage(dbMsg); // Save User Message

        const imageToSend = selectedImage;
        setInput('');
        setSelectedImage(null);
        setLoading(true);

        try {
            // If URL found, fetch content
            if (urls && urls.length > 0) {
                const url = urls[0];
                try {
                    const fetchRes = await fetch('/api/fetch-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url })
                    });
                    const fetchData = await fetchRes.json();

                    if (fetchData.content) {
                        systemCtx += `\n\n**CONTEXT FROM LINK (${url})**:\n"${fetchData.content}"\n\nUser Question: ${finalInput}\n(Answer based on the link content if relevant)`;
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

            // BUILD HISTORY FROM PREVIOUS MESSAGES
            // Map our specific message format to Gemini's expected format
            // Limit to last 10 messages for context window
            const previousHistory = messages.slice(-10).map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));

            const history = [
                { role: "user", parts: [{ text: systemCtx }] }, // System instruction as first user message or separate? 
                // Gemini often takes system instruction separately or as first turn. 
                // We'll put it first.
                { role: "model", parts: [{ text: "Understood. I am ready." }] },
                ...previousHistory
            ];

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    history: history,
                    message: finalInput || "Explain this image",
                    image: imageToSend ? imageToSend.split(',')[1] : null,
                    mimeType: imageToSend ? imageToSend.split(';')[0].split(':')[1] : null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch response");
            }

            const data = await response.json();

            // Save AI Response to DB
            saveMessage({ text: data.text, sender: 'ai' });

        } catch (error) {
            console.error("AI Error:", error);
            // Save error as local message only? Or db?
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
                    <label className="icon-button">
                        📷
                        <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>

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
        </div>
    );
}
