import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AnnouncementBar from '../components/AnnouncementBar';

export default function TTRAI() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        { text: "Hello! I am TTR AI. I'm here to help you with your educational journey. How can I assist you today?", sender: 'ai' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [userContext, setUserContext] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch User Context for the AI
                let context = {};
                let userDoc = await getDoc(doc(db, "users", user.uid));

                if (!userDoc.exists()) {
                    userDoc = await getDoc(doc(db, "institutions", user.uid));
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

    const generateSystemPrompt = (context) => {
        return `
            You are TTR AI, an intelligent educational assistant.
            
            Current User Context:
            - Name: ${context?.name}
            - Role: ${context?.role}
            - Class/Grade: ${context?.class}
            - Gender: ${context?.gender}

            Your Guidelines:
            1. **Educational Focus**: Your primary goal is to help with educational, career, and future-aim related questions specific to the user's level (Class ${context?.class}).
            2. **Strict Restriction on Non-Educational Topics**: 
               - If the user asks clearly "uneducated" or irrelevant questions (e.g., entertainment, gossip, explicit content, pure nonsense), reply EXACTLY: "I am with you I'm here to help you in your educational and future aim questions only."
            3. **General Knowledge Exception**:
               - If the user asks a General Knowledge question (e.g., "Who is PM of India?", "Capital of France"), provide a very BRIEF answer (1-2 sentences).
               - Then, politely pivot back to how this might relate to their studies or simply cut the topic short to make it feel less important than their core studies.
            4. **Tone**: Encouraging, formal yet accessible, and mentorship-oriented. Matches the user's gender and age group appropriately.
            
            5. **Time Awareness**:
               - Current Date: ${new Date().toDateString()}
               - System Time: ${new Date().toLocaleTimeString()}
               - Mention the date if asked "What is today?".
            
            6. **Upcoming Schedule / Calendar Context**:
               - The following exams/events are scheduled for students:
                 ${context?.upcomingEvents?.map(e => `- ${e.title} on ${e.deadline || 'Date TBA'}`).join('\n') || "(No upcoming exams found in calendar)"}
               - If the user asks about exams, use this schedule to remind them. For example, if "Maths Public Exam" is on May 2nd, remind them how many days are left.
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
            // 1. Google US English (Clean, often female)
            // 2. Microsoft Zira (Standard Windows Female)
            // 3. Samantha (Mac)
            const preferredVoice = voices.find(v => v.name.includes("Google US English")) ||
                voices.find(v => v.name.includes("Zira")) ||
                voices.find(v => v.name.includes("Samantha")) ||
                voices.find(v => v.name.includes("Female"));

            if (preferredVoice) utterance.voice = preferredVoice;

            // Pitch & Rate Tuning for "Sweet/Happy" Vibe
            // Pitch 1.3 = Higher, younger, enthusiastic
            // Rate 0.95 = Slightly slower, more explanatory and calm
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
            // It stops naturally or we can force stop if we had a ref
            // simple toggle logic:
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

    const handleSend = async () => {
        if (!input.trim() && !selectedImage) return;

        let finalInput = input;
        let systemCtx = generateSystemPrompt(userContext);

        // 1. Link Analysis (Smart Notes)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = input.match(urlRegex);

        // Show user message immediately
        const userMsg = { text: input || "Image Uploaded", image: selectedImage, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);

        const imageToSend = selectedImage;
        setInput('');
        setSelectedImage(null);
        setLoading(true);

        try {
            // If URL found, fetch content
            if (urls && urls.length > 0) {
                const url = urls[0]; // Process first URL for now
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

            // If image is present, force teacher style
            if (imageToSend) {
                systemCtx += `
                    \n\n**SPECIAL INSTRUCTION FOR IMAGE/VISUAL INPUT**:
                    The user has uploaded an image or requested visual analysis.
                    You MUST respond in the **Teacher Style** format:
                    1. **Formal Text**: Explain the content/topic in formal English.
                    2. **Teacher's Explanation**: Explain it simply in a conversational mix of English and the user's likely mother tongue. 
                    Focus on making it understood easily.
                `;
            }

            const history = [
                { role: "user", parts: [{ text: systemCtx }] },
                { role: "model", parts: [{ text: "Understood. I am TTR AI, ready to assist." }] }
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

            setMessages(prev => [...prev, { text: data.text, sender: 'ai' }]);

            // Auto-speak removed as per user request. User can click speaker icon.

        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { text: "Error: " + error.message, sender: 'ai', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5' }}>
            {/* Header */}
            <AnnouncementBar title="TTR AI Assistant ✨" leftIcon="back" />

            {/* Chat Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        backgroundColor: msg.sender === 'user' ? '#6c5ce7' : 'white',
                        color: msg.sender === 'user' ? 'white' : '#333',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px',
                        borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '16px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        lineHeight: '1.5',
                        position: 'relative'
                    }}>
                        {msg.image && (
                            <img src={msg.image} alt="User Upload" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px', display: 'block' }} />
                        )}
                        {msg.text}
                        {msg.sender === 'ai' && (
                            <button
                                onClick={() => speakText(msg.text)}
                                style={{
                                    position: 'absolute', bottom: '-25px', left: '0',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px'
                                }}
                                title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
                            >
                                {isSpeaking ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && (
                    <div style={{ alignSelf: 'flex-start', backgroundColor: 'white', padding: '10px', borderRadius: '10px' }}>
                        Typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedImage && (
                    <div style={{ position: 'relative', width: 'fit-content' }}>
                        <img src={selectedImage} alt="Preview" style={{ height: '80px', borderRadius: '8px', border: '1px solid #ddd' }} />
                        <button
                            onClick={() => setSelectedImage(null)}
                            style={{ position: 'absolute', top: -10, right: -10, background: '#ff7675', color: 'white', border: 'none', borderRadius: '50%', w: '24px', h: '24px', cursor: 'pointer' }}
                        >✕</button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '50%', backgroundColor: '#f0f2f5', color: '#636e72', minWidth: '40px', height: '40px' }}>
                        📷
                        <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>

                    <button
                        onClick={toggleVoiceInput}
                        style={{
                            background: isListening ? '#ff7675' : '#f0f2f5',
                            color: isListening ? 'white' : '#636e72',
                            border: 'none',
                            borderRadius: '50%',
                            minWidth: '40px',
                            height: '40px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
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
                        style={{ flex: 1, padding: '12px', borderRadius: '24px', border: '1px solid #ddd', outline: 'none' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading}
                        style={{
                            backgroundColor: '#6c5ce7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '46px',
                            height: '46px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                        }}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
}
