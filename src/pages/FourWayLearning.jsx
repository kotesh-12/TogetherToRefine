import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function FourWayLearning() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // Default to 'conceptual' or null? User implies a stable view, so starting with 'conceptual' is good.
    const [activeTab, setActiveTab] = useState('conceptual');

    // Store chat history for each mode independently
    const [chats, setChats] = useState({
        conceptual: [],
        fictional: [],
        storytelling: [],
        teaching: []
    });

    // Store input text for each mode independently
    const [inputs, setInputs] = useState({
        conceptual: '',
        fictional: '',
        storytelling: '',
        teaching: ''
    });

    const [loading, setLoading] = useState(false);

    // Teaching Mode Extras
    const [motherTongue, setMotherTongue] = useState('Hindi');
    const [selectedImage, setSelectedImage] = useState(null);

    const chatContainerRef = useRef(null);

    const userClass = userData?.class || "Grade 10"; // Default to 10th if unknown

    const modes = [
        {
            id: 'conceptual',
            title: '🧠 Conceptual',
            fullTitle: 'Conceptual Learning',
            desc: 'Understand the "Why" and "How" with deep conceptual clarity.',
            prompt: (topic) => `
                You are a Conceptual Tutor for a student in ${userClass}.
                Task: Explain "${topic}" strictly conceptually.
                Guidelines:
                1. Focus ONLY on the core principles, definitions, and underlying logic.
                2. Do NOT use fictional stories or analogies here. Stick to the facts.
                3. Structure the answer logically: Definition -> Core Mechanism -> Real World Application.
                4. Match the complexity to a ${userClass} level.
            `
        },
        {
            id: 'fictional',
            title: '🚀 Fictional',
            fullTitle: 'Fictional Learning',
            desc: 'Learn through analogies and fictional scenarios.',
            prompt: (topic) => `
                You are a Sci-Fi/Fantasy Writer for a student in ${userClass}.
                Task: Explain "${topic}" by creating a fictional story or analogy.
                Guidelines:
                1. Create unique characters (e.g., Superheroes, Aliens, or Wizards) that represent the parts of the concept.
                2. The interactions between characters should mirror how the concept works (e.g., Electron characters orbiting a Nucleus castle).
                3. Make it vivid and memorable.
            `
        },
        {
            id: 'storytelling',
            title: '📖 Story',
            fullTitle: 'Story Telling',
            desc: 'Weave the topic into a compelling narrative.',
            prompt: (topic) => `
                You are a Storyteller for a student in ${userClass}.
                Task: Tell an engaging short story where "${topic}" is the central plot device.
                Guidelines:
                1. Start with "Once upon a time..." or a strong hook.
                2. The protagonist should encounter a problem that is solved understanding "${topic}".
                3. The story should flow naturally, teaching the concept subconsciously.
            `
        },
        {
            id: 'teaching',
            title: '👩‍🏫 Teaching',
            fullTitle: 'Teacher Style (Dialogue)',
            desc: 'Interactive 2-way communication dialogue between Teacher and Student.',
            prompt: (topic, lang) => `
                Act as a Friendly Teacher teaching a student in ${userClass}.
                Task: Explain "${topic}" using a 2-Way Communication (Dialogue) format.
                Language: Explain primarily in ${lang} (or Hinglish if Hindi).
                
                Format:
                **Teacher:** [Introductory question or simple definition]
                **Student:** [Asks a common doubt or curious question specific to ${userClass} level]
                **Teacher:** [Explains clearly using an example]
                **Student:** [Has an "Aha!" moment or asks for clarification]
                **Teacher:** [Final summary]
                
                Keep the tone encouraging and conversational.
            `
        }
    ];

    const currentMode = modes.find(m => m.id === activeTab);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chats[activeTab], activeTab]);

    const handleGenerate = async () => {
        const currentInput = inputs[activeTab];
        if (!currentInput.trim() && !selectedImage) return;

        // Add User Message
        const newUserMsg = { role: 'user', text: currentInput, image: selectedImage };
        setChats(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], newUserMsg]
        }));
        setInputs(prev => ({ ...prev, [activeTab]: '' })); // Clear input
        if (activeTab === 'teaching') setSelectedImage(null); // Clear image after send

        setLoading(true);

        try {
            let promptText = "";
            let topic = currentInput || "Explain this image";

            // Custom Prompt Construction
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

            // Prepare History (only for context, keep it light)
            const apiHistory = chats[activeTab].map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })).slice(-6); // Limit context window

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: apiHistory,
                    message: promptText,
                    image: newUserMsg.image ? newUserMsg.image.split(',')[1] : null,
                    mimeType: newUserMsg.image ? newUserMsg.image.split(';')[0].split(':')[1] : null
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Add AI Response
            setChats(prev => ({
                ...prev,
                [activeTab]: [...prev[activeTab], { role: 'ai', text: data.text }]
            }));

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f6fa', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* 1. STICKY HEADER & TABS */}
            <div style={{ background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
                {/* Top Row: Back & Title */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                    <button
                        className="btn-back-marker" // Using your standardized class
                        onClick={() => navigate('/student-dashboard')} // Explicit exit
                    >
                        Back
                    </button>
                    <h1 style={{ margin: '0 0 0 15px', fontSize: '20px', color: '#2d3436' }}>
                        Four-Way Learning
                    </h1>
                </div>

                {/* Tab Bar */}
                <div style={{ display: 'flex', overflowX: 'auto', padding: '0 10px' }}>
                    {modes.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setActiveTab(m.id)}
                            style={{
                                flex: 1,
                                padding: '15px 10px',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === m.id ? '3px solid #6c5ce7' : '3px solid transparent',
                                color: activeTab === m.id ? '#6c5ce7' : '#636e72',
                                fontWeight: activeTab === m.id ? 'bold' : 'normal',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s'
                            }}
                        >
                            {m.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. SCROLLABLE CHAT AREA */}
            <div
                ref={chatContainerRef}
                style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}
            >
                {/* Welcome / Empty State */}
                {chats[activeTab].length === 0 && (
                    <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '50px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>✨</div>
                        <p>{currentMode.desc}</p>
                        <p style={{ fontSize: '13px' }}>Ask anything to start learning!</p>
                    </div>
                )}

                {/* Messages */}
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
                        whiteSpace: 'pre-wrap'
                    }}>
                        {msg.image && <img src={msg.image} alt="User" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />}
                        {msg.text}
                    </div>
                ))}

                {loading && (
                    <div style={{ alignSelf: 'flex-start', background: 'white', padding: '10px 20px', borderRadius: '20px', color: '#666', fontSize: '14px' }}>
                        Thinking...
                    </div>
                )}
            </div>

            {/* 3. INPUT AREA (Fixed Bottom) */}
            <div style={{ padding: '15px', background: 'white', borderTop: '1px solid #eee' }}>
                {activeTab === 'teaching' && (
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                            value={motherTongue}
                            onChange={(e) => setMotherTongue(e.target.value)}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                        >
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
                    <input
                        type="text"
                        value={inputs[activeTab]}
                        onChange={(e) => setInputs(prev => ({ ...prev, [activeTab]: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                        placeholder={`Ask in ${currentMode.title} mode...`}
                        style={{ flex: 1, padding: '12px 15px', borderRadius: '25px', border: '1px solid #dfe6e9', outline: 'none' }}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading || (!inputs[activeTab] && !selectedImage)}
                        style={{
                            width: '50px', height: '50px', borderRadius: '50%',
                            background: '#6c5ce7', color: 'white', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
