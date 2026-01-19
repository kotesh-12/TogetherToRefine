import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AnnouncementBar from '../components/AnnouncementBar';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useUser } from '../context/UserContext';

export default function TTRAI() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [userContext, setUserContext] = useState(null);
    const messagesEndRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [statusLog, setStatusLog] = useState("Ready");

    // Initialize Gemini Client
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

    // Additional UI States
    const [selectedImage, setSelectedImage] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Permission States
    const [micPermission, setMicPermission] = useState(false);
    const [cameraPermission, setCameraPermission] = useState(false);
    const [permissionModal, setPermissionModal] = useState(null);
    const fileInputRef = useRef(null);

    // 1. Auth & Context Loading
    const { user: authUser, userData } = useUser();

    useEffect(() => {
        if (!authUser) return;

        setCurrentUser(authUser);

        // Build Context
        let context = {
            role: 'User',
            name: 'User',
            class: 'N/A',
            gender: 'N/A',
            upcomingEvents: [],
            adminData: null
        };

        if (userData) {
            context = {
                role: userData.role || 'User',
                name: userData.name || userData.schoolName || userData.principalName || 'User',
                class: userData.class || 'N/A',
                gender: userData.gender || 'N/A',
                upcomingEvents: [],
                adminData: null
            };
        } else {
            // Fallback if userData isn't loaded yet but authUser is present
            if (authUser.email === 'admin@ttr.com') { // Basic check
                context.role = 'System Admin';
                context.name = 'Admin';
            }
        }

        // Admin Override from userData
        if (userData?.role === 'admin') {
            context.role = 'System Admin';
            context.name = 'Admin';
        }

        const fetchContextData = async () => {
            try {
                // Fetch upcoming exams (students)
                if (context.role !== 'System Admin' && context.role !== 'admin') {
                    const eventsSnap = await getDocs(collection(db, "opportunities"));
                    const events = [];
                    eventsSnap.forEach(e => events.push(e.data()));
                    context.upcomingEvents = events;
                }

                // ADMIN SPECIAL: Fetch Feedback & Reports
                if (context.role === 'System Admin' || context.role === 'admin') {
                    const feedSnap = await getDocs(query(collection(db, "general_feedback"), orderBy("timestamp", "desc"), limit(5)));
                    const repSnap = await getDocs(query(collection(db, "emergency_reports"), orderBy("createdAt", "desc"), limit(5)));

                    const feedbacks = feedSnap.docs.map(d => {
                        const data = d.data();
                        return `- Feedback from ${data.authorName} (${data.role}): "${data.comment || "No text"}" (Type: ${data.type || 'General'})`;
                    });
                    const reports = repSnap.docs.map(d => {
                        const data = d.data();
                        return `- URGENT REPORT: ${data.description} (Location: ${data.location})`;
                    });

                    context.adminData = {
                        recentActivity: [...feedbacks, ...reports],
                        stats: { feedbackCount: feedSnap.size, reportCount: repSnap.size }
                    };
                }

            } catch (e) {
                console.log("Could not fetch context data", e);
            }
            setUserContext(context);
        };

        fetchContextData();

    }, [authUser, userData, navigate]);

    // 2. Chat History Listener
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

    // 3. System Prompt Generator
    const generateSystemPrompt = (context) => {
        if (context?.role === 'System Admin' || context?.role === 'admin') {
            return `
            You are the "TTR Co-Pilot", a Chief Technology & Strategy Assistant for "TogetherToRefine".
            You are speaking to the Administrator/Owner of the platform.

            **Your Core Capabilities & Guidelines:**
            
            1. **System Health & Monitoring**:
               - I have provided you the latest user reports below. Use them to "monitor" the platform status.
               - IF users report bugs, assume them as technical priorities and suggest potential code fixes or investigations.
               - IF reports are serious (harassment), advise immediately.
            
            2. **Growth & Promotion Strategist**:
               - Suggest actionable ways to promote TTR to Schools, Teachers, and Students in India.
               - Create marketing copy or social media campaign ideas if asked.

            3. **Feature Innovation**:
               - Propose new features to keep TTR competitive (Gamification, AI Tutors, Parent Portals, etc.).
               - Prioritize features that drive engagement.
            
            4. **Bug Fixing Partner**:
               - If the admin describes a bug or pastes code, YOU MUST ACT AS A SENIOR DEVELOPER.
               - Analyze the issue, explain the root cause, and provide the EXACT code fix or steps to resolve it.
            
            **Current System Status (monitor logs):**
            - Recent Feedbacks/Reports:
              ${context.adminData?.recentActivity?.length > 0 ? context.adminData.recentActivity.join('\n') : "No recent critical reports logged."}
            
            **Tone**: Strategic, Technical, and Leadership-oriented. You are a partner, not just a support bot.
            `;
        }

        return `
            You are TTR AI, an intelligent educational assistant.
            Current User Context: Name: ${context?.name}, Role: ${context?.role}, Class: ${context?.class}, Gender: ${context?.gender}

            Your Guidelines:
            1. **Educational Focus**: Help with educational, career, and future-aim related questions.
            2. **Strict Restriction on Non-Educational Topics**: If user asks unrelated questions, reply EXACTLY: "I am with you I'm here to help you in your educational and future aim questions only."
            3. **General Knowledge Exception**: Brief answers (1-2 sentences) allowed, then pivot back to studies.
            4. **Tone**: Encouraging, formal yet accessible. Matches the user's gender and age group.
            5. **Time Awareness**: Current Date: ${new Date().toDateString()}.
            6. **Upcoming Schedule**:
                 ${context?.upcomingEvents?.map(e => `- ${e.title} on ${e.deadline || 'Date TBA'}`).join('\n') || "(No upcoming exams found)"}
        `;
    };

    // Helper functions
    const saveMessage = async (msgObj) => {
        if (!currentUser) return;
        try {
            await addDoc(collection(db, 'ai_chats', currentUser.uid, 'messages'), { ...msgObj, createdAt: new Date() });
        } catch (e) {
            console.error("Error saving message", e);
        }
    };

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => { return () => { window.speechSynthesis.cancel(); }; }, []);

    const speakText = (text) => {
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                return;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Zira")) || voices.find(v => v.name.includes("Female"));
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.pitch = 1.3; utterance.rate = 0.95; utterance.volume = 1;
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
    };

    const toggleVoiceInput = () => {
        if (!micPermission) { setPermissionModal('mic'); return; }
        if (!('webkitSpeechRecognition' in window)) { alert("Voice input not supported in this browser. Try Chrome."); return; }
        if (isListening) { setIsListening(false); return; }
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => { setInput(prev => prev + (prev ? ' ' : '') + event.results[0][0].transcript); };
        recognition.start();
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

    // --- MAIN SEND HANDLER (OPTIMIZED) ---
    const handleSend = async () => {
        if (!input.trim() && !selectedImage) return;
        if (!currentUser) { setStatusLog("Error: No User Found"); return; }

        setStatusLog("Starting Request...");
        const finalInput = input;
        const userImage = selectedImage;

        // 1. Optimistic UI Update (Show User Message Immediately)
        const userMsg = { text: finalInput || "Image Uploaded", image: userImage, sender: 'user', createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);

        // Reset Input State
        setInput('');
        setSelectedImage(null);
        setLoading(true);

        try {
            // 2. API Key Check
            if (!genAI) {
                throw new Error("Configuration Error: API Key (VITE_GEMINI_API_KEY) is missing. Please check your .env file.");
            }

            // 3. Persist User Message (Background)
            // We use 'void' to indicate we don't await this blocking the UI, 
            // but we catch errors to ensure they don't crash logic.
            saveMessage({ ...userMsg, image: (userImage && userImage.length > 1000000) ? null : userImage })
                .catch(e => console.error("Message Persistence Failed:", e));

            // System Prompt
            setStatusLog("Generating System Prompt...");
            let systemCtx = "";
            try {
                systemCtx = generateSystemPrompt(userContext);
            } catch (promptError) {
                console.error("System Prompt Gen Error:", promptError);
                systemCtx = "You are a helpful AI assistant.";
            }

            // Link Analysis & Fetching
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = finalInput.match(urlRegex);
            if (urls && urls.length > 0) {
                setStatusLog("Checking Link...");
                try {
                    const fetchRes = await fetch('/api/fetch-url', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: urls[0] })
                    });
                    if (fetchRes.ok) {
                        const fetchData = await fetchRes.json();
                        if (fetchData.content) systemCtx += `\n\n**CONTEXT FROM LINK (${urls[0]})**:\n"${fetchData.content}"\n\nUser Question: ${finalInput}`;
                    }
                } catch (e) { console.warn("Link fetch skipped", e); }
            }

            if (userImage) systemCtx += `\n\n**IMAGE INPUT**: user uploaded image. Respond in 'Teacher Style'.`;

            // Gemini API Call
            setStatusLog("Connecting to Gemini API...");

            // 5. ATTEMPT 1: Server-Side API (Recommended for Production/Vercel)
            // This hides the API key and ensures CORS compliance.
            setStatusLog("Contacting Server...");

            // Generate History and sanitize it
            let historyForApi = messages.filter(m => !m.isError && m.text).slice(-10).map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));

            // GEMINI RULE: History must ALWAYS start with 'user'
            // We remove any leading 'model' messages (like the Welcome message)
            while (historyForApi.length > 0 && historyForApi[0].role !== 'user') {
                historyForApi.shift();
            }

            let responseText = "";
            let usedFallback = false;

            try {
                // Prepare API Payload
                const apiPayload = {
                    message: finalInput,
                    history: historyForApi,
                    systemInstruction: systemCtx
                };

                if (userImage) {
                    const [header, base64Data] = userImage.split(',');
                    apiPayload.image = base64Data;
                    apiPayload.mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                }

                // 20s Timeout for fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);

                const apiResponse = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!apiResponse.ok) {
                    // If 404/500, throw to trigger fallback
                    throw new Error(`Server Error: ${apiResponse.status}`);
                }

                const data = await apiResponse.json();
                if (data.error) throw new Error(data.error);
                responseText = data.text;

            } catch (serverError) {
                console.warn("Server API Failed, switching to Client Fallback:", serverError);
                setStatusLog("Server failed. Trying Client Mode...");
                usedFallback = true;

                // 6. ATTEMPT 2: Client-Side Fallback (Localhost / Direct Key)
                if (!genAI) throw new Error("Server failed and Client API Key (VITE_GEMINI_API_KEY) is missing.");

                const model = genAI.getGenerativeModel({
                    model: "gemini-flash-latest",
                    systemInstruction: systemCtx, // Pass system instruction here for better compatibility
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                    ]
                });

                const chat = model.startChat({ history: historyForApi });

                let parts = [{ text: finalInput || "Analyze this image" }];
                if (userImage) {
                    const [header, base64Data] = userImage.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    parts.push({ inlineData: { data: base64Data, mimeType } });
                }

                const result = await chat.sendMessage(parts);
                responseText = result.response.text();
            }

            setStatusLog(usedFallback ? "Response (Client-Side)" : "Response (Server-Side)");

            // 4. Optimistic UI Update (Show AI Response Immediately)
            const aiMsg = { text: responseText, sender: 'ai', createdAt: new Date() };
            setMessages(prev => [...prev, aiMsg]);

            // Persist AI Message
            saveMessage(aiMsg).catch(e => console.error("AI Message Persistence Failed:", e));

        } catch (error) {
            console.error("AI Error:", error);
            setStatusLog(`Error: ${error.message}`);

            // Show detailed error to help debugging
            let errorMsg = `Connection Failed: ${error.message}`;

            if (error.message.includes("API Key")) errorMsg = error.message;
            else if (error.message.includes("SAFETY")) errorMsg = "Response blocked due to safety settings.";
            else if (error.message.includes("Timed Out")) errorMsg = "Connection Timed Out. Please check your internet.";

            setMessages(prev => [...prev, { text: `Error: ${errorMsg}`, sender: 'ai', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ttr-ai-container">
            {/* DEBUG OVERLAY */}
            <div style={{ fontSize: '10px', background: '#333', color: '#fff', padding: '2px 5px', textAlign: 'center' }}>
                DEBUG: {statusLog} | User: {currentUser?.email} | Role: {userContext?.role}
            </div>

            <AnnouncementBar title="TTR AI Assistant ✨" leftIcon="back" />
            <div className="chat-area">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                        {msg.image && <img src={msg.image} alt="User Upload" className="message-image" />}
                        {msg.text}
                        {msg.sender === 'ai' && (
                            <button onClick={() => speakText(msg.text)} className="speak-button" title={isSpeaking ? "Stop" : "Read"}>
                                {isSpeaking ? '🔇' : '🔊'}
                            </button>
                        )}
                    </div>
                ))}
                {loading && <div className="loading-indicator">Typing...</div>}
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
                        placeholder={selectedImage ? "Add topic..." : "Type, Paste Link, or Speak..."}
                        className="chat-input"
                    />
                    <button onClick={handleSend} disabled={loading} className="send-button">➤</button>
                </div>
            </div>

            {/* PERMISSION MODAL */}
            {permissionModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '15px', maxWidth: '300px', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>{permissionModal === 'mic' ? '🎙️' : '📷'}</div>
                        <h3 style={{ margin: '0 0 10px 0' }}>Permission Needed</h3>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                            {permissionModal === 'mic' ? "Allow microphone access?" : "Allow camera/gallery access?"}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button onClick={() => setPermissionModal(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #ddd', background: 'white' }}>Deny</button>
                            <button onClick={() => {
                                if (permissionModal === 'mic') setMicPermission(true);
                                if (permissionModal === 'camera') { setCameraPermission(true); setTimeout(() => fileInputRef.current?.click(), 100); }
                                setPermissionModal(null);
                            }} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#0984e3', color: 'white', fontWeight: 'bold' }}>Allow</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
