import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function FourWayLearning() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [mode, setMode] = useState(null);
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [motherTongue, setMotherTongue] = useState('Hindi'); // Default
    const [selectedImage, setSelectedImage] = useState(null);

    const modes = [
        {
            id: 'conceptual',
            title: '🧠 Conceptual Learning',
            desc: 'Understand the "Why" and "How" with deep conceptual clarity.',
            prompt: (topic) => `Explain the concept of "${topic}" in depth. Focus on the core principles, definitions, and the underlying logic. Break it down into simple, digestible parts. Do not use complex jargon without explanation.`
        },
        {
            id: 'fictional',
            title: '🚀 Fictional Learning',
            desc: 'Learn through analogies and fictional scenarios.',
            prompt: (topic) => `Explain "${topic}" by creating a fictional story or a sci-fi analogy. Use characters or settings that make the concept easier to visualize and remember. Treat the concept as a mechanism in this fictional world.`
        },
        {
            id: 'storytelling',
            title: '📖 Story Telling',
            desc: 'Weave the topic into a compelling narrative.',
            prompt: (topic) => `Tell a story that revolves around "${topic}". The story should be engaging and the topic should be central to the plot, helping the reader understand naturally through the narrative flow.`
        },
        {
            id: 'teaching',
            title: '👩‍🏫 Teacher Style (Paragraph + Explanation)',
            desc: 'Read a formal paragraph, then explain it simply in your mother tongue.',
            prompt: (topic, lang) => `
                Act as a Teacher teaching a student. 
                Step 1: Write a formal, academic paragraph defining/explaining "${topic}".
                Step 2: Act as if you are now explaining that paragraph to a student in their mother tongue (${lang}).
                Break it down, use casual/spoken tone in ${lang} (e.g. Hinglish if Hindi, or just ${lang}), and make it super easy to grasp.
                
                Format:
                **Formal Text:**
                [Paragraph]

                **Teacher's Explanation (${lang}):**
                [Explanation]
            `
        }
    ];

    const activeMode = modes.find(m => m.id === mode);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove data URL prefix (e.g. "data:image/jpeg;base64,") to get raw base64
                const base64String = reader.result;
                setSelectedImage(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!input.trim() && !selectedImage) return; // Allow generating if image is present even if text is empty? Maybe topic is still needed.
        if (!input.trim()) {
            // If only image, prompt user for topic or assume "Explain this image"
            // But for now let's enforce input as "Topic"
            // Actually, if image is provided, "Topic" input could just be "Explain this page".
        }

        setLoading(true);
        setResult('');

        try {
            let promptText = "";
            let currentInput = input || "Explain the content of this image";

            if (activeMode.id === 'teaching') {
                promptText = activeMode.prompt(currentInput, motherTongue);
            } else {
                promptText = activeMode.prompt(currentInput);
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: [
                        { role: "user", parts: [{ text: "You are an advanced Educational AI. Adapt perfectly to the learning mode requested by the user." }] },
                        { role: "model", parts: [{ text: "Understood. I will adapt my teaching style accordingly." }] }
                    ],
                    message: promptText,
                    image: selectedImage ? selectedImage.split(',')[1] : null,
                    mimeType: selectedImage ? selectedImage.split(';')[0].split(':')[1] : null
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setResult(data.text);

        } catch (error) {
            console.error(error);
            setResult('Error generating content. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: '#f0f2f5', minHeight: '100vh', padding: '20px', fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
                    <button onClick={() => mode ? setMode(null) : navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '15px' }}>
                        ←
                    </button>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#2d3436' }}>
                        {mode ? activeMode.title : '4-Way Learning AI'}
                    </h1>
                </div>

                {!mode ? (
                    /* Dashboard - Select Mode */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {modes.map(m => (
                            <div key={m.id}
                                onClick={() => setMode(m.id)}
                                style={{
                                    background: 'white',
                                    padding: '25px',
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                    transition: 'transform 0.2s',
                                    border: '1px solid transparent'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#6c5ce7'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'transparent'; }}
                            >
                                <h3 style={{ marginTop: 0, color: '#6c5ce7' }}>{m.title}</h3>
                                <p style={{ color: '#636e72', lineHeight: '1.5' }}>{m.desc}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Active Mode Interface */
                    <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                        <p style={{ color: '#636e72', marginBottom: '20px' }}>{activeMode.desc}</p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
                                What do you want to learn?
                            </label>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="e.g. Photosynthesis, Newton's Laws, History of Rome..."
                                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #dfe6e9', fontSize: '16px', outline: 'none' }}
                            />
                        </div>

                        {activeMode.id === 'teaching' && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
                                    Upload Book Page / Image (Optional)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{ marginBottom: '15px' }}
                                />
                                {selectedImage && <img src={selectedImage} alt="Preview" style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '15px' }} />}

                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
                                    Explanation Language (Mother Tongue)
                                </label>
                                <select
                                    value={motherTongue}
                                    onChange={(e) => setMotherTongue(e.target.value)}
                                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #dfe6e9', fontSize: '16px', outline: 'none', background: 'white' }}
                                >
                                    <option value="Hindi">Hindi (Hinglish)</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="Tamil">Tamil</option>
                                    <option value="Telugu">Telugu</option>
                                    <option value="Simple English">Simple English</option>
                                </select>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={loading || (!input && !selectedImage)}
                            style={{
                                width: '100%',
                                padding: '15px',
                                background: loading ? '#b2bec3' : '#6c5ce7',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'background 0.3s'
                            }}
                        >
                            {loading ? 'Generating...' : 'Start Learning ✨'}
                        </button>

                        {/* Result Area */}
                        {result && (
                            <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#2d3436' }}>
                                {result}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
