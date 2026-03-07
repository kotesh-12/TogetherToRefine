import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ReactMarkdown from 'react-markdown';

/* ──────────────── Typewriter Effect ──────────────── */
const TypewriterMessage = ({ text, onComplete }) => {
    const [displayed, setDisplayed] = useState('');
    const idx = useRef(0);

    useEffect(() => {
        idx.current = 0;
        setDisplayed('');
        const iv = setInterval(() => {
            setDisplayed(prev => {
                if (idx.current < text.length) {
                    const ch = text.charAt(idx.current);
                    idx.current++;
                    return prev + ch;
                }
                clearInterval(iv);
                if (onComplete) onComplete();
                return prev;
            });
        }, 5);
        return () => clearInterval(iv);
    }, [text]);

    return <ReactMarkdown>{displayed}</ReactMarkdown>;
};

/* ──────────────── Gurukul Heroes Data ──────────────── */
const GURUKUL_HEROES = {
    arjuna: { id: 'arjuna', name: 'Arjuna', emoji: '🏹', title: 'The Focused Warrior', trait: 'Laser Focus & Mastery' },
    ekalavya: { id: 'ekalavya', name: 'Ekalavya', emoji: '🙏', title: 'The Self-Made Scholar', trait: 'Self-Learning & Devotion' },
    krishna: { id: 'krishna', name: 'Krishna', emoji: '🪈', title: 'The Strategic Thinker', trait: 'Wisdom & Emotional Intelligence' },
    rama: { id: 'rama', name: 'Rama', emoji: '⚡', title: 'The Dharma Keeper', trait: 'Righteousness & Duty' },
    karna: { id: 'karna', name: 'Karna', emoji: '☀️', title: 'The Resilient Fighter', trait: 'Resilience & Generosity' },
    dharmaraj: { id: 'dharmaraj', name: 'Dharmaraj', emoji: '⚖️', title: 'The Truth Seeker', trait: 'Truth & Justice Always' },
    abhimanyu: { id: 'abhimanyu', name: 'Abhimanyu', emoji: '🛡️', title: 'The Fearless Explorer', trait: 'Courage & Action' },
    bheema: { id: 'bheema', name: 'Bheema', emoji: '💪', title: 'The Unstoppable Force', trait: 'Raw Strength & Endurance' },
    nakula: { id: 'nakula', name: 'Nakula', emoji: '🐎', title: 'The Observant Explorer', trait: 'Perception & Agility' },
    sahadeva: { id: 'sahadeva', name: 'Sahadeva', emoji: '🔭', title: 'The Visionary Scholar', trait: 'Foresight & Intellect' },
    ghatotkacha: { id: 'ghatotkacha', name: 'Ghatotkacha', emoji: '⛰️', title: 'The Loyal Giant', trait: 'Power & Selflessness' },
    hanuman: { id: 'hanuman', name: 'Hanuman', emoji: '🐒', title: 'The Devoted Student', trait: 'Intellect & Humility' },
    dronacharya: { id: 'dronacharya', name: 'Dronacharya', emoji: '🎯', title: 'The Ultimate Master', trait: 'Discipline & Excellence' },
    bhishma: { id: 'bhishma', name: 'Bhishma', emoji: '👑', title: 'The Elder Statesman', trait: 'Wisdom & Duty' },
    parashurama: { id: 'parashurama', name: 'Parashurama', emoji: '🪓', title: 'The Fierce Instructor', trait: 'Purity & Rigor' },
    chanakya: { id: 'chanakya', name: 'Chanakya', emoji: '📜', title: 'The Kingmaker', trait: 'Strategy & Pragmatism' },
};

/* ──────────────── Secure Context Heroes Data (Pop-Culture) ──────────────── */
const SECURE_HEROES = {
    arjuna: { id: 'arjuna', name: 'Baahubali', emoji: '🏹', title: 'The Focused Warrior', trait: 'Laser Focus & Mastery' },
    ekalavya: { id: 'ekalavya', name: 'Rocky', emoji: '⛏️', title: 'The Self-Made Survivor', trait: 'Self-Learning & Devotion' },
    krishna: { id: 'krishna', name: 'The Professor', emoji: '🧠', title: 'The Mastermind', trait: 'Strategy & Emotional Intelligence' },
    rama: { id: 'rama', name: 'Captain America', emoji: '🛡️', title: 'The Righteous Leader', trait: 'Righteousness & Duty' },
    karna: { id: 'karna', name: 'Pushpa', emoji: '🪓', title: 'The Resilient Underdog', trait: 'Resilience & Generosity' },
    dharmaraj: { id: 'dharmaraj', name: 'Batman', emoji: '🦇', title: 'The Justice Seeker', trait: 'Truth & Justice Always' },
    abhimanyu: { id: 'abhimanyu', name: 'Spider-Man', emoji: '🕸️', title: 'The Fearless Challenger', trait: 'Courage & Action' },
    bheema: { id: 'bheema', name: 'The Hulk', emoji: '💪', title: 'The Unstoppable Force', trait: 'Raw Strength & Endurance' },
    nakula: { id: 'nakula', name: 'Sherlock Holmes', emoji: '🔍', title: 'The Observant Detective', trait: 'Perception & Agility' },
    sahadeva: { id: 'sahadeva', name: 'Iron Man', emoji: '🤖', title: 'The Visionary Inventor', trait: 'Foresight & Intellect' },
    ghatotkacha: { id: 'ghatotkacha', name: 'Optimus Prime', emoji: '🚛', title: 'The Loyal Protector', trait: 'Power & Selflessness' },
    hanuman: { id: 'hanuman', name: 'Kattappa', emoji: '🗡️', title: 'The Devoted Warrior', trait: 'Loyalty & Humility' },
    dronacharya: { id: 'dronacharya', name: 'Master Shifu', emoji: '🥋', title: 'The Ultimate Master', trait: 'Discipline & Excellence' },
    bhishma: { id: 'bhishma', name: 'Albus Dumbledore', emoji: '🧙‍♂️', title: 'The Elder Guide', trait: 'Wisdom & Duty' },
    parashurama: { id: 'parashurama', name: 'John Wick', emoji: '🔫', title: 'The Fierce Instructor', trait: 'Purity & Rigor' },
    chanakya: { id: 'chanakya', name: 'Thomas Shelby', emoji: '🚬', title: 'The Strategic Kingmaker', trait: 'Strategy & Pragmatism' },
};

/* ──────────────── 4-Way Learning Heroes Data ──────────────── */
const FOUR_WAY_HEROES = {
    conceptual: { id: 'conceptual', name: '🧠 Conceptual Mode', emoji: '🧠', title: 'Deep Logic & Why', trait: 'Understand Core Fundamentals' },
    fictional: { id: 'fictional', name: '🚀 Fictional Mode', emoji: '🚀', title: 'Analogies & Sci-Fi', trait: 'Indian Mythology & Analogies' },
    storytelling: { id: 'storytelling', name: '📖 Story Mode', emoji: '📖', title: 'Narrative Driven', trait: 'Narrative Storytelling' },
    teaching: { id: 'teaching', name: '👩‍🏫 Teaching Mode', emoji: '👩‍🏫', title: 'Interactive Dialogue', trait: 'Socratic Dialogue' }
};

/* ──────────────── Main Chat Page ──────────────── */
export default function TTRAIChat() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Session state (only for logged-in users)
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Gurukul Path State
    const [currentPath, setCurrentPath] = useState(localStorage.getItem('ttr_guest_path') || '');
    const [currentDomain, setCurrentDomain] = useState(localStorage.getItem('ttr_guest_domain') || null);
    const [showPathModal, setShowPathModal] = useState(false);

    // Save path to local storage so guests don't lose it
    useEffect(() => {
        if (currentPath) {
            localStorage.setItem('ttr_guest_path', currentPath);
        } else {
            localStorage.removeItem('ttr_guest_path');
        }
        if (currentDomain) {
            localStorage.setItem('ttr_guest_domain', currentDomain);
        } else {
            localStorage.removeItem('ttr_guest_domain');
        }
    }, [currentPath, currentDomain]);

    const activeHeroes = currentDomain === 'secure' ? SECURE_HEROES : currentDomain === '4way' ? FOUR_WAY_HEROES : GURUKUL_HEROES;

    // Image upload
    const [selectedImage, setSelectedImage] = useState(null);
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Welcome message
    const WELCOME_MSG = { text: "Hello! I'm **TTR AI** 🧠 — your intelligent learning companion.\n\nAsk me anything about academics, coding, science, math, or just have a conversation!", sender: 'ai' };

    // Set welcome message on mount
    useEffect(() => {
        setMessages([WELCOME_MSG]);
    }, []);

    /* ── Load sessions (only if logged in) ── */
    useEffect(() => {
        if (!user) return;
        loadSessions();
    }, [user]);

    const loadSessions = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(30);
        if (!error && data) setSessions(data);
    };

    /* ── Load messages when session changes (only if logged in) ── */
    useEffect(() => {
        if (!user) return;
        if (!currentSessionId) {
            setMessages([WELCOME_MSG]);
            return;
        }
        loadMessages(currentSessionId);
    }, [currentSessionId, user]);

    const loadMessages = async (sessionId) => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
            setMessages(data.map(m => ({ text: m.content, sender: m.role === 'user' ? 'user' : 'ai', image: m.image_url })));
        }
    };

    /* ── Auto scroll ── */
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => scrollToBottom(), [messages]);

    /* ── Save message to DB (only if logged in) ── */
    const saveMessage = async (content, role, sessionId, imageUrl = null) => {
        if (!user) return;
        await supabase.from('chat_messages').insert({
            session_id: sessionId,
            user_id: user.id,
            role,
            content,
            image_url: imageUrl,
        });
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
    };

    /* ── New Chat ── */
    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([WELCOME_MSG]);
        setInput('');
        setShowSidebar(false);
    };

    /* ── Load a session ── */
    const loadSession = (session) => {
        setCurrentSessionId(session.id);
        setShowSidebar(false);
    };

    /* ── Delete a session ── */
    const deleteSession = async (e, sessionId) => {
        e.stopPropagation();
        await supabase.from('chat_messages').delete().eq('session_id', sessionId);
        await supabase.from('chat_sessions').delete().eq('id', sessionId);
        if (currentSessionId === sessionId) startNewChat();
        loadSessions();
    };

    /* ── Image handling ── */
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setSelectedImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    /* ── Send Message ── */
    const handleSend = async () => {
        const text = input.trim();
        if (!text && !selectedImage) return;

        setInput('');
        const imgData = selectedImage;
        setSelectedImage(null);
        setLoading(true);

        const userMsg = { text: text || 'Image uploaded', image: imgData, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);

        try {
            // Create session if logged in and needed
            let sessionId = currentSessionId;
            if (user && !sessionId) {
                const { data: newSession, error } = await supabase
                    .from('chat_sessions')
                    .insert({ user_id: user.id, title: text.substring(0, 40) || 'New Chat' })
                    .select()
                    .single();
                if (error) throw error;
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
            }

            // Save user message (only if logged in)
            if (user && sessionId) {
                await saveMessage(text || 'Image uploaded', 'user', sessionId, imgData);
            }

            // Build history
            let historyForApi = messages.slice(-10).map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text || '' }]
            }));
            while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

            const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';

            const payload = {
                history: historyForApi,
                message: text,
                userContext: {
                    name: displayName,
                    gurukul_path: currentPath,
                    domain: currentDomain || 'gurukul'
                },
                image: imgData ? imgData.split(',')[1] : null,
                mimeType: imgData ? imgData.match(/:(.*?);/)?.[1] : null,
            };

            const API_URL = window.location.hostname === 'localhost'
                ? 'http://localhost:5000/api/chat'
                : '/.netlify/functions/chat';

            abortControllerRef.current = new AbortController();

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const result = await response.json();
            const responseText = result.response || result.text || 'No response received.';

            const aiMsg = { text: responseText, sender: 'ai', isNew: true };
            setMessages(prev => [...prev, aiMsg]);

            // Save AI response (only if logged in)
            if (user && sessionId) {
                await saveMessage(responseText, 'assistant', sessionId);
                loadSessions();
            }

        } catch (err) {
            if (err.name !== 'AbortError') {
                const errMsg = { text: `⚠️ Error: ${err.message}`, sender: 'ai' };
                setMessages(prev => [...prev, errMsg]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
        }
    };

    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';

    return (
        <div className="chat-page">
            {/* ── Sidebar ── */}
            <div className={`sidebar ${showSidebar ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Chat History</h3>
                    <button className="sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
                </div>

                <button className="new-chat-btn" onClick={startNewChat}>
                    <span>+</span> New Chat
                </button>

                {user ? (
                    <>
                        <div className="sessions-list">
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    className={`session-item ${currentSessionId === s.id ? 'active' : ''}`}
                                    onClick={() => loadSession(s)}
                                >
                                    <span className="session-title">{s.title || 'Untitled'}</span>
                                    <button className="delete-btn" onClick={(e) => deleteSession(e, s.id)}>🗑</button>
                                </div>
                            ))}
                            {sessions.length === 0 && <p className="no-sessions">No conversations yet</p>}
                        </div>

                        <div className="sidebar-footer">
                            <div className="user-info">
                                <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
                                <span className="user-name">{displayName}</span>
                            </div>
                            <button className="logout-btn" onClick={signOut}>Sign Out</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="sessions-list">
                            <div className="guest-notice">
                                <div className="guest-icon">🔒</div>
                                <p>Sign in to save your chat history and access it from any device.</p>
                                <button className="signin-prompt-btn" onClick={() => navigate('/login')}>
                                    Sign In / Sign Up
                                </button>
                            </div>
                        </div>
                        <div className="sidebar-footer">
                            <div className="user-info">
                                <div className="user-avatar guest">G</div>
                                <span className="user-name">Guest</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Sidebar Overlay ── */}
            {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

            {/* ── Main Chat ── */}
            <div className="chat-main">
                {/* Header */}
                <div className="chat-header">
                    <button className="menu-btn" onClick={() => setShowSidebar(true)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="header-title">
                        <div className="header-logo">
                            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                                <rect width="40" height="40" rx="10" fill="url(#hg)" />
                                <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" opacity="0.9" />
                                <path d="M18 14L24 20L30 14L24 8L18 14Z" fill="white" opacity="0.6" />
                                <path d="M18 26L24 20L30 26L24 32L18 26Z" fill="white" opacity="0.6" />
                                <defs><linearGradient id="hg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#6C63FF" /><stop offset="100%" stopColor="#AB47BC" /></linearGradient></defs>
                            </svg>
                        </div>
                        <span>TTR AI</span>
                    </div>
                    <div className="header-actions">
                        <button
                            className="path-header-btn"
                            onClick={() => setShowPathModal(true)}
                            title="Choose AI Experience Path"
                        >
                            {currentPath && activeHeroes[currentPath] ? activeHeroes[currentPath].emoji : '🕉️'}
                        </button>
                        {!user && (
                            <button className="signin-header-btn" onClick={() => navigate('/login')}>
                                Sign In
                            </button>
                        )}
                        <button className="new-chat-header-btn" onClick={startNewChat} title="New Chat">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="messages-container">
                    {messages.map((msg, i) => (
                        <div key={i} className={`message ${msg.sender}`}>
                            {msg.sender === 'ai' && (
                                <div className="msg-avatar ai-avatar">
                                    <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                                        <rect width="40" height="40" rx="10" fill="url(#mg)" />
                                        <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" opacity="0.9" />
                                        <defs><linearGradient id="mg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#6C63FF" /><stop offset="100%" stopColor="#AB47BC" /></linearGradient></defs>
                                    </svg>
                                </div>
                            )}
                            <div className="msg-content">
                                {msg.image && <img src={msg.image} alt="upload" className="msg-image" />}
                                {msg.isNew && msg.sender === 'ai' ? (
                                    <TypewriterMessage text={msg.text} onComplete={() => {
                                        setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, isNew: false } : m));
                                    }} />
                                ) : (
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                )}
                            </div>
                            {msg.sender === 'user' && (
                                <div className="msg-avatar user-avatar">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="message ai">
                            <div className="msg-avatar ai-avatar">
                                <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                                    <rect width="40" height="40" rx="10" fill="url(#lg)" />
                                    <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" opacity="0.9" />
                                    <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stopColor="#6C63FF" /><stop offset="100%" stopColor="#AB47BC" /></linearGradient></defs>
                                </svg>
                            </div>
                            <div className="msg-content thinking">
                                <div className="thinking-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="input-area">
                    {selectedImage && (
                        <div className="image-preview">
                            <img src={selectedImage} alt="preview" />
                            <button onClick={() => setSelectedImage(null)}>✕</button>
                        </div>
                    )}
                    <div className="input-bar">
                        <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach Image">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask TTR AI anything..."
                            rows="1"
                            disabled={loading}
                        />
                        {loading ? (
                            <button className="send-btn stop" onClick={handleStop} title="Stop">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            </button>
                        ) : (
                            <button className="send-btn" onClick={handleSend} disabled={!input.trim() && !selectedImage} title="Send">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <p className="input-hint">TTR AI can make mistakes. Verify important information.</p>
                </div>
            </div>

            {/* ── Gurukul Path Modal ── */}
            {showPathModal && (
                <div className="path-modal-overlay" onClick={() => setShowPathModal(false)}>
                    <div className="path-modal" onClick={e => e.stopPropagation()}>
                        <div className="path-modal-header">
                            <h2>Choose Your Gurukul Path</h2>
                            <p>Select an ancient personality to guide your learning.</p>
                            <button className="close-modal" onClick={() => setShowPathModal(false)}>✕</button>
                        </div>
                        {user ? (
                            !currentDomain ? (
                                <div className="domain-selector">
                                    <h3>Select your AI Experience Domain</h3>
                                    <p style={{ marginBottom: 20 }}>Some users prefer modern pop-culture equivalents over traditional mythological references.</p>
                                    <div className="domain-cards" style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <div
                                            className="domain-card"
                                            onClick={() => setCurrentDomain('gurukul')}
                                            style={{ cursor: 'pointer', padding: '20px', border: '1px solid var(--border)', borderRadius: '10px', textAlign: 'center', width: '200px' }}
                                        >
                                            <div style={{ fontSize: 40 }}>🏛️</div>
                                            <h4>Gurukul Context</h4>
                                            <small style={{ color: 'var(--text-secondary)' }}>Ancient wisdom, mythological names</small>
                                        </div>
                                        <div
                                            className="domain-card"
                                            onClick={() => setCurrentDomain('secure')}
                                            style={{ cursor: 'pointer', padding: '20px', border: '1px solid var(--border)', borderRadius: '10px', textAlign: 'center', width: '200px' }}
                                        >
                                            <div style={{ fontSize: 40 }}>🎬</div>
                                            <h4>Secure Context</h4>
                                            <small style={{ color: 'var(--text-secondary)' }}>Pop-culture, cinematic heroes</small>
                                        </div>
                                        <div
                                            className="domain-card"
                                            onClick={() => setCurrentDomain('4way')}
                                            style={{ cursor: 'pointer', padding: '20px', border: '1px solid var(--border)', borderRadius: '10px', textAlign: 'center', width: '200px' }}
                                        >
                                            <div style={{ fontSize: 40 }}>🧭</div>
                                            <h4>4-Way Learning</h4>
                                            <small style={{ color: 'var(--text-secondary)' }}>Core methodologies, 4 perspectives</small>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="change-domain-btn"
                                        onClick={() => setCurrentDomain(null)}
                                        style={{ margin: '-10px auto 15px', display: 'block', background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 15px', borderRadius: 20, cursor: 'pointer' }}
                                    >
                                        Switch Domain (Currently {currentDomain === 'secure' ? 'Secure' : currentDomain === '4way' ? '4-Way Learning' : 'Gurukul'})
                                    </button>
                                    <div className="path-list">
                                        <div
                                            className={`path-card ${currentPath === '' ? 'active' : ''}`}
                                            onClick={() => { setCurrentPath(''); setShowPathModal(false); }}
                                        >
                                            <div className="path-emoji">🧠</div>
                                            <h3>{currentDomain === 'secure' ? 'Universal AI' : currentDomain === '4way' ? 'Unified Learner' : 'Universal TTR AI'}</h3>
                                            <p>Standard intelligent learning companion.</p>
                                        </div>
                                        {Object.values(activeHeroes).map(hero => (
                                            <div
                                                key={hero.id}
                                                className={`path-card ${currentPath === hero.id ? 'active' : ''}`}
                                                onClick={() => { setCurrentPath(hero.id); setShowPathModal(false); }}
                                            >
                                                <div className="path-emoji">{hero.emoji}</div>
                                                <h3>{hero.name}</h3>
                                                <p className="path-title">{hero.title}</p>
                                                <p className="path-trait">{hero.trait}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )
                        ) : (
                            <div className="path-modal-locked">
                                <div className="locked-content">
                                    <div className="locked-icon">🔒</div>
                                    <h3>Unlock Learning Paths</h3>
                                    <p>Sign up to choose from 16 ancient personalities or pop-culture heroes, save your chat history, and get the full TTR AI experience!</p>
                                    <button className="signin-prompt-btn" onClick={() => navigate('/login')}>
                                        Create Free Account
                                    </button>
                                </div>
                                <div className="path-list preview">
                                    <div className="path-card locked">
                                        <div className="path-emoji">🏹</div>
                                        <h3>Arjuna / Baahubali</h3>
                                        <p className="path-title">The Focused Warrior</p>
                                    </div>
                                    <div className="path-card locked">
                                        <div className="path-emoji">🪈</div>
                                        <h3>Krishna / The Professor</h3>
                                        <p className="path-title">The Mastermind & Strategist</p>
                                    </div>
                                    <div className="path-card locked">
                                        <div className="path-emoji">🔭</div>
                                        <h3>Sahadeva / Iron Man</h3>
                                        <p className="path-title">The Visionary</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
