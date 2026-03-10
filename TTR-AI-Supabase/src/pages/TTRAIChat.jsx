import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ReactMarkdown from 'react-markdown';
import { markdownCodeRenderers } from '../components/CodeBlock';
import { isDocumentFile, isImageFile, getFileTypeInfo, processDocument } from '../utils/documentProcessor';
import { useSpeech } from '../hooks/useSpeech';
import anime from 'animejs';
import logo from '../assets/logo.png';
import { THEMES, THEME_CATEGORIES } from '../themeData';

// Optimized UI Components
import {
    BreathingOrb,
    AnimatedMessage,
    MagneticSubmitButton,
    TypewriterMessage
} from '../components/ChatComponents';

// Constants & Data
import {
    GURUKUL_HEROES,
    SECURE_HEROES,
    FOUR_WAY_HEROES,
    WELCOME_MSG
} from '../constants/chatData';

// The main view exported for the application
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

    // Debug Mode
    const [isDebugMode, setIsDebugMode] = useState(false);

    // Incognito Mode
    const [incognitoMode, setIncognitoMode] = useState(() => sessionStorage.getItem('ttr_incognito') === 'true');

    // Like/Dislike feedback tracking { [messageIndex]: 'liked' | 'disliked' }
    const [feedback, setFeedback] = useState({});

    // Gurukul Path State
    const [currentPath, setCurrentPath] = useState(localStorage.getItem('ttr_guest_path') || '');
    const [currentDomain, setCurrentDomain] = useState(localStorage.getItem('ttr_guest_domain') || null);
    const [showPathModal, setShowPathModal] = useState(false);

    const [fourWayMode, setFourWayMode] = useState(null);
    const [showFourWayMenu, setShowFourWayMenu] = useState(false);

    // Theme State
    const [theme, setTheme] = useState(localStorage.getItem('ttr_theme') || 'dark');
    const [showThemeGallery, setShowThemeGallery] = useState(false);
    const curtainRef = useRef(null);
    const fourWayMenuRef = useRef(null);
    const langMenuRef = useRef(null);

    // Apply theme properties to the document
    const applyTheme = useCallback((themeId) => {
        const selectedTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
        const root = document.documentElement;

        // Transition animation with curtain
        anime({
            targets: curtainRef.current,
            scaleY: [0, 1],
            duration: 400,
            easing: 'easeInOutQuad',
            complete: () => {
                // Set theme-specific colors
                const c = selectedTheme.colors;
                const isLight = selectedTheme.mode === 'light';

                root.style.setProperty('--bg-primary', c.primary);
                root.style.setProperty('--bg-secondary', isLight ? '#f8fafc' : '#16161e');
                root.style.setProperty('--bg-tertiary', isLight ? '#f1f5f9' : '#1e1e2a');
                root.style.setProperty('--bg-card', isLight ? '#ffffff' : '#1c1c28');
                root.style.setProperty('--bg-hover', isLight ? '#e2e8f0' : '#252535');
                root.style.setProperty('--text-primary', isLight ? '#0f172a' : '#e8e8f0');
                root.style.setProperty('--text-secondary', isLight ? '#475569' : '#9898b0');
                root.style.setProperty('--text-muted', isLight ? '#94a3b8' : '#6a6a85');
                root.style.setProperty('--accent', c.accent);
                root.style.setProperty('--accent-glow', isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(108, 99, 255, 0.15)');
                root.style.setProperty('--border', isLight ? '#e2e8f0' : '#2a2a3d');
                root.style.colorScheme = isLight ? 'light' : 'dark';

                setTheme(themeId);

                anime({
                    targets: curtainRef.current,
                    scaleY: [1, 0],
                    delay: 200,
                    duration: 400,
                    easing: 'easeInOutQuad'
                });
            }
        });
    }, []);

    // aggresively set theme variables on the first render to avoid flash
    const initTheme = () => {
        const savedTheme = localStorage.getItem('ttr_theme') || 'dark';
        const current = THEMES.find(t => t.id === savedTheme) || THEMES[0];
        const root = document.documentElement;
        const isLight = current.mode === 'light';
        const c = current.colors;

        root.style.setProperty('--bg-primary', c.primary);
        root.style.setProperty('--bg-secondary', isLight ? '#f8fafc' : '#16161e');
        root.style.setProperty('--bg-tertiary', isLight ? '#f1f5f9' : '#1e1e2a');
        root.style.setProperty('--bg-card', isLight ? '#ffffff' : '#1c1c28');
        root.style.setProperty('--bg-hover', isLight ? '#e2e8f0' : '#252535');
        root.style.setProperty('--text-primary', isLight ? '#0f172a' : '#e8e8f0');
        root.style.setProperty('--text-secondary', isLight ? '#475569' : '#9898b0');
        root.style.setProperty('--text-muted', isLight ? '#94a3b8' : '#6a6a85');
        root.style.setProperty('--accent', c.accent);
        root.style.setProperty('--accent-glow', isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(108, 99, 255, 0.15)');
        root.style.setProperty('--border', isLight ? '#e2e8f0' : '#2a2a3d');
        root.style.colorScheme = isLight ? 'light' : 'dark';
    };

    // run immediately
    const once = useRef(false);
    if (!once.current) {
        initTheme();
        once.current = true;
    }

    // Persist path, domain, theme, and incognito
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
        localStorage.setItem('ttr_theme', theme);
        // Incognito uses sessionStorage (clears when tab closes, like real incognito)
        if (incognitoMode) {
            sessionStorage.setItem('ttr_incognito', 'true');
        } else {
            sessionStorage.removeItem('ttr_incognito');
        }
    }, [currentPath, currentDomain, theme, incognitoMode]);

    // Handle clicks outside dropdowns to close them
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fourWayMenuRef.current && !fourWayMenuRef.current.contains(event.target)) {
                setShowFourWayMenu(false);
            }
            if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
                setShowLangMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const activeHeroes = useMemo(() =>
        currentDomain === 'secure' ? SECURE_HEROES : GURUKUL_HEROES
        , [currentDomain]);

    // File upload
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedDocs, setSelectedDocs] = useState([]); // array: { id, file, text, pages, type, fileName, processing, error, color, icon }
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [motherTongue, setMotherTongue] = useState('Hindi');

    const [showLangMenu, setShowLangMenu] = useState(false);
    const { speak, listen, isListening, speakingText } = useSpeech();

    const handleMicClick = useCallback(() => {
        let lang = 'en-US';
        if (fourWayMode === 'teaching') {
            const map = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
            lang = map[motherTongue] || 'en-US';
        }
        listen((text) => {
            setInput(prev => (prev + ' ' + text).trim());
        }, lang);
    }, [fourWayMode, motherTongue, listen]);

    // Welcome message
    const WELCOME_MSG = { text: "Hello! I'm **TTR AI** 🧠 — your intelligent learning companion.\n\nAsk me anything about academics, coding, science, math, or just have a conversation!", sender: 'ai' };

    // Set welcome message on mount
    useEffect(() => {
        setMessages([WELCOME_MSG]);
    }, []);

    /* ── Load all sessions ── */
    const loadSessions = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(100);
        if (!error && data) setSessions(data);
    }, [user]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Derived list of sessions (Sorted & Filtered)
    const filteredSessions = useMemo(() => {
        return sessions.filter(s => {
            if (fourWayMode) return s.title?.startsWith(`[${fourWayMode}] `);
            return !['[conceptual]', '[fictional]', '[storytelling]', '[teaching]'].some(pref => s.title?.includes(pref));
        }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }, [sessions, fourWayMode]);

    /* ── Load messages when session changes ── */
    const loadMessages = useCallback(async (sessionId) => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
            setMessages(data.map(m => ({ text: m.content, sender: m.role === 'user' ? 'user' : 'ai', image: m.image_url })));
        }
    }, []);

    useEffect(() => {
        if (!currentSessionId) {
            setMessages([WELCOME_MSG]);
            return;
        }
        loadMessages(currentSessionId);
    }, [currentSessionId, user, loadMessages]);

    /* ── Save message to DB ── */
    const saveMessage = useCallback(async (content, role, sessionId, imageUrl = null) => {
        if (!user) return;
        await supabase.from('chat_messages').insert({
            session_id: sessionId,
            user_id: user.id,
            role,
            content,
            image_url: imageUrl,
        });
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
        loadSessions(); // Refresh list to update 'updated_at'
    }, [user, loadSessions]);

    /* ── Auto scroll ── */
    const scrollToBottom = useCallback(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
    useEffect(() => scrollToBottom(), [messages, scrollToBottom]);

    /* ── Animation: Modal Spring-In ── */
    useEffect(() => {
        if (showPathModal) {
            anime({
                targets: '.path-modal',
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 800,
                easing: 'easeOutElastic(1, .8)'
            });
        }
    }, [showPathModal]);

    useEffect(() => {
        if (showThemeGallery) {
            anime({
                targets: '.gallery-container',
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 800,
                easing: 'easeOutElastic(1, .8)'
            });
        }
    }, [showThemeGallery]);

    /* ── Sidebar Actions ── */
    const startNewChat = useCallback(() => {
        setCurrentSessionId(null);
        setMessages([WELCOME_MSG]);
        setInput('');
        setShowSidebar(false);
    }, []);

    /* ── Load a session ── */
    const loadSession = useCallback((session) => {
        setCurrentSessionId(session.id);
        setShowSidebar(false);
    }, []);

    /* ── File handling (images + documents) ── */
    const handleFileChange = useCallback(async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        // Reset input so same file can be re-selected
        e.target.value = '';

        for (const file of files) {
            if (isImageFile(file)) {
                // Handle as image (Gemini vision usually best with 1 image at a time right now)
                const reader = new FileReader();
                reader.onloadend = () => setSelectedImage(reader.result);
                reader.readAsDataURL(file);
            } else if (isDocumentFile(file) || true) {
                // Handle as document
                setSelectedImage(null);
                const docId = Date.now() + Math.random();
                const newDoc = { id: docId, file, fileName: file.name, processing: true, ...getFileTypeInfo(file) };
                setSelectedDocs(prev => [...prev, newDoc]);

                try {
                    const result = await processDocument(file);
                    setSelectedDocs(prev => prev.map(d => d.id === docId ? { ...d, ...result, processing: false } : d));
                } catch (err) {
                    setSelectedDocs(prev => prev.map(d => d.id === docId ? { ...d, processing: false, error: err.message } : d));
                }
            }
        }
    }, []);

    /* ── Send Message ── */
    const handleSend = useCallback(async (e, overrideText = null) => {
        const text = (overrideText || input).trim();
        if (!text && !selectedImage && selectedDocs.length === 0) return;

        setInput('');
        const imgData = selectedImage;
        const docsData = [...selectedDocs];
        setSelectedImage(null);
        setSelectedDocs([]);
        setLoading(true);

        const isImage = imgData?.startsWith('data:image/');
        const hasDocs = docsData.length > 0;

        // Build user message display
        let userMsgText = text;
        if (hasDocs) {
            const names = docsData.map(d => d.fileName).join(', ');
            userMsgText = text || `Analyze document${docsData.length > 1 ? 's' : ''}: ${names}`;
        } else if (!text) {
            userMsgText = isImage ? 'Image uploaded' : 'File uploaded';
        }

        const userMsg = {
            text: userMsgText,
            image: imgData,
            sender: 'user',
            isNew: true,
            docInfo: hasDocs ? docsData.map(d => ({ fileName: d.fileName, type: d.type, pages: d.pages, icon: d.icon })) : null,
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            // Create session if logged in and needed (skip in incognito)
            let sessionId = currentSessionId;
            if (user && !sessionId && !incognitoMode) {
                const sessionPrefix = fourWayMode ? `[${fourWayMode}] ` : '';
                const baseTitle = text ? text.substring(0, 40) : (hasDocs ? `Docs: ${docsData.map(d => d.fileName).join(', ')}`.substring(0, 40) : 'New Chat');
                const { data: newSession, error } = await supabase
                    .from('chat_sessions')
                    .insert({ user_id: user.id, title: sessionPrefix + baseTitle })
                    .select()
                    .single();
                if (error) throw error;
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
                loadSessions(); // update list
            }

            // Save user message (only if logged in and NOT incognito)
            if (user && sessionId && !incognitoMode) {
                await saveMessage(text || 'Image uploaded', 'user', sessionId, imgData);
            }

            // Build history
            let historyForApi = messages.slice(-10).map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text || '' }]
            }));
            while (historyForApi.length > 0 && historyForApi[0].role !== 'user') historyForApi.shift();

            const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';

            // Auto-detect if the user is pasting an error/code to debug
            const errorKeywords = ['error', 'exception', 'stack trace', 'traceback', 'failed', 'unexpected', 'not defined', 'null pointer', 'segmentation fault'];
            const containsError = errorKeywords.some(k => text.toLowerCase().includes(k));
            const shouldDebug = isDebugMode || containsError;

            let docContentText = '';
            if (hasDocs) {
                docContentText = docsData.map((d, i) => `\n\n📄 DOCUMENT ${i + 1}: "${d.fileName}" (${d.type}, ${d.pages || '?'} pages)\n--- DOCUMENT CONTENT ---\n${d.text}\n--- END OF DOCUMENT ${i + 1} ---`).join('');
            }

            const payload = {
                history: historyForApi,
                message: hasDocs
                    ? `${text || 'Analyze these documents'}${docContentText}`
                    : text,
                userContext: {
                    name: displayName,
                    gurukul_path: currentPath,
                    domain: currentDomain || 'gurukul',
                    fourWayMode: fourWayMode,
                    motherTongue: fourWayMode === 'teaching' ? motherTongue : null,
                    isDebugMode: shouldDebug, // Signal to AI to focus on debugging
                },
                image: (imgData && !hasDocs) ? imgData.split(',')[1] : null,
                mimeType: (imgData && !hasDocs) ? imgData.match(/:(.*?);/)?.[1] : null,
            };

            // Reset debug mode after sending if it was manual
            if (isDebugMode) setIsDebugMode(false);

            // Determine the correct API endpoint
            let API_URL = '/api/chat';

            // If running in Native App (Capacitor) or different protocol, use absolute URL
            if (!window.location.protocol.startsWith('http')) {
                API_URL = 'https://ttrai.in/api/chat';
            } else {
                const host = window.location.hostname;
                const port = window.location.port;

                if (host === 'localhost' || host === '127.0.0.1') {
                    // Local dev (Vite) uses full URL to hit production or local server
                    API_URL = port.includes('517') ? 'https://ttrai.in/api/chat' : 'http://localhost:5000/api/chat';
                }
            }

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

            const aiMsg = { text: responseText, sender: 'ai', isNew: true, question: text };
            setMessages(prev => [...prev, aiMsg]);

            // Save AI response (only if logged in and NOT incognito)
            if (user && sessionId && !incognitoMode) {
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
    }, [input, selectedImage, selectedDoc, user, currentSessionId, messages, currentPath, currentDomain, fourWayMode, motherTongue, loadSessions, saveMessage, incognitoMode]);

    /* ── Save training data (liked Q&A) ── */
    const saveTrainingData = useCallback(async (question, answer) => {
        if (incognitoMode) return; // Never save in incognito
        try {
            await supabase.from('training_data').insert({
                question,
                answer,
                user_id: user?.id || null,
                category: fourWayMode || 'general',
                language: fourWayMode === 'teaching' ? motherTongue : 'en',
                gurukul_path: currentPath || null,
                four_way_mode: fourWayMode || null,
                quality_score: 1,
            });
        } catch (err) {
            console.error('Failed to save training data:', err);
        }
    }, [user, fourWayMode, motherTongue, currentPath, incognitoMode]);

    /* ── Handle Like/Dislike ── */
    const handleFeedback = useCallback((msgIndex, type, msg) => {
        setFeedback(prev => ({ ...prev, [msgIndex]: type }));
        if (type === 'liked' && msg.question) {
            saveTrainingData(msg.question, msg.text);
        }
    }, [saveTrainingData]);

    /* ── Toggle Incognito ── */
    const toggleIncognito = useCallback(() => {
        setIncognitoMode(prev => {
            const next = !prev;
            if (next) {
                // Entering incognito — start fresh
                setCurrentSessionId(null);
                setMessages([WELCOME_MSG]);
                setInput('');
                setFeedback({});
            }
            return next;
        });
    }, []);

    /* ── Drag and Drop Handlers ── */
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileChange({ target: { files } });
        }
    }, [handleFileChange]);

    /* ── UG & Professional Toolkits ── */
    const handleStudyAction = useCallback((actionType) => {
        if (selectedDocs.length === 0 || selectedDocs.some(d => d.processing)) return;

        const actionPrompts = {
            // UG Suite
            quiz: "Based on the uploaded document, please generate a Practice Quiz with Multiple Choice Questions (MCQs). The number of questions should dynamically depend on the depth and number of concepts provided in the document. Format the quiz clearly and provide the correct answers at the end so I can check my knowledge.",
            summary: "Please provide a 'Flash Summary' of this document. The length and detail of this summary should dynamically depend on the document's concepts and importance (e.g. if it is a 50-page PDF with many key concepts, provide a multi-page detailed summary). Use bullet points and focus on the most important concepts a student needs to know for an upcoming exam.",
            questions: "Analyze this document and identify the top 5 'Most Likely Exam Questions' that a professor would ask. Provide a clear, detailed answer for each question to help me prepare.",

            // Professional Suite
            email: "Draft a highly professional business email based on the contents and findings of this document. It should be ready to send to a client or executive team.",
            report: "Extract the core business value, logic, and key data points from this document. Format this into a sharp, professional Executive Summary/Report.",
            simplify: "Rewrite the key concepts of this document so they can be easily understood by a non-technical stakeholder or client. Use simple analogies and remove jargon."
        };

        const prompt = actionPrompts[actionType];

        // Auto-send the request
        handleSend(null, prompt);
    }, [selectedDocs, handleSend]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
        }
    }, []);

    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';

    const currentThemeData = THEMES.find(t => t.id === theme) || THEMES[0];

    return (
        <div
            className={`chat-page theme-${theme} ux-${currentThemeData.ux || 'standard'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div ref={curtainRef} className="theme-transition-curtain" />

            {isDragging && (
                <div className="drop-zone-overlay">
                    <div className="drop-zone-content">
                        <div className="drop-icon-pulse">📤</div>
                        <h2>Drop to analyze</h2>
                        <p>PDF, PPTX, DOCX, or Images</p>
                    </div>
                </div>
            )}

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
                            {filteredSessions.map((s, idx) => (
                                <div
                                    key={s.id}
                                    className={`session-item animate-in ${currentSessionId === s.id ? 'active' : ''}`}
                                    onClick={() => loadSession(s)}
                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                >
                                    <span className="session-title">{s.title || 'Untitled'}</span>
                                </div>
                            ))}
                            {filteredSessions.length === 0 && <p className="no-sessions">No conversations yet</p>}
                        </div>

                        <div className="sidebar-footer">
                            <small style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block', textAlign: 'center' }}>Theme Gallery</small>
                            <div className="theme-selector-mini" onClick={() => setShowThemeGallery(true)}>
                                <div className="theme-dot dark"></div>
                                <div className="theme-dot white"></div>
                                <div className="theme-dot purple"></div>
                                <div className="gallery-btn"><span>✨</span></div>
                            </div>
                            <div className="user-info">
                                <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
                                <span className="user-name">{displayName}</span>
                            </div>
                            <button
                                className="download-sidebar-btn"
                                onClick={() => navigate('/download-app')}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                    marginBottom: '10px', fontSize: '13px', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <span>📲</span> Download App
                            </button>
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
                            <small style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block', textAlign: 'center' }}>Theme Gallery</small>
                            <div className="theme-selector-mini" onClick={() => setShowThemeGallery(true)}>
                                <div className="theme-dot dark"></div>
                                <div className="theme-dot white"></div>
                                <div className="theme-dot purple"></div>
                                <div className="gallery-btn"><span>✨</span></div>
                            </div>
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
                    <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={logo} alt="TTR" style={{ height: '32px', width: 'auto', display: 'block', marginRight: '6px' }} />
                        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>TTR AI</span>
                    </div>
                    <div className="header-actions">
                        <button
                            className="path-header-btn"
                            onClick={() => setShowPathModal(true)}
                            title="Choose AI Experience Path"
                        >
                            {currentPath && activeHeroes[currentPath] ? activeHeroes[currentPath].emoji : '🕉️'}
                        </button>
                        <button className="path-header-btn" onClick={() => navigate('/download-app')} title="Download App">
                            📲
                        </button>
                        <button
                            className={`path-header-btn incognito-btn ${incognitoMode ? 'active' : ''}`}
                            onClick={toggleIncognito}
                            title={incognitoMode ? 'Incognito Mode ON — Nothing is saved' : 'Enable Incognito Mode'}
                        >
                            {incognitoMode ? '🕶️' : '👁️'}
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

                {/* Incognito Banner */}
                {incognitoMode && (
                    <div className="incognito-banner">
                        <span>🕶️</span>
                        <div>
                            <strong>Incognito Mode</strong>
                            <small>Chat won't be saved. No training data collected.</small>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="messages-container">
                    {messages.map((msg, i) => (
                        <AnimatedMessage key={i} msg={msg}>
                            {msg.sender === 'ai' && (
                                <div className="msg-avatar ai-avatar">
                                    <img src={logo} alt="TTR AI" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                                </div>
                            )}
                            <div className="msg-content">
                                {msg.image && (
                                    msg.image.startsWith('data:image/') ? (
                                        <img src={msg.image} alt="upload" className="msg-image" />
                                    ) : msg.image.startsWith('data:audio/') ? (
                                        <audio controls src={msg.image} className="msg-audio" style={{ maxWidth: '100%', marginBottom: '10px' }} />
                                    ) : (
                                        <div className="msg-file-icon" style={{ fontSize: '30px', marginBottom: '10px' }}>📄 PDF/Doc</div>
                                    )
                                )}
                                {msg.docInfo && (Array.isArray(msg.docInfo) ? msg.docInfo : [msg.docInfo]).map((doc, idx) => (
                                    <div key={idx} className="msg-doc-badge" style={{ marginBottom: '8px' }}>
                                        <span>{doc.icon}</span>
                                        <div>
                                            <strong>{doc.fileName}</strong>
                                            <small>{doc.type} • {doc.pages} page{doc.pages !== 1 ? 's' : ''}</small>
                                        </div>
                                    </div>
                                ))}
                                <ReactMarkdown components={markdownCodeRenderers}>{msg.text}</ReactMarkdown>
                            </div>

                            {msg.sender === 'ai' && (
                                <div className="ai-msg-actions">
                                    <button onClick={() => {
                                        const langMap = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
                                        const lang = fourWayMode === 'teaching' ? (langMap[motherTongue] || 'en-US') : 'en-US';
                                        speak(msg.text, lang);
                                    }} className="msg-action-btn" title="Read Aloud">
                                        {speakingText === msg.text ? '🔇' : '🔊'}
                                    </button>
                                    {!incognitoMode && i > 0 && (
                                        <>
                                            <button
                                                className={`msg-action-btn ${feedback[i] === 'liked' ? 'liked' : ''}`}
                                                onClick={() => handleFeedback(i, 'liked', msg)}
                                                title="Good response — save for training"
                                                disabled={!!feedback[i]}
                                            >
                                                {feedback[i] === 'liked' ? '👍' : '👍🏻'}
                                            </button>
                                            <button
                                                className={`msg-action-btn ${feedback[i] === 'disliked' ? 'disliked' : ''}`}
                                                onClick={() => handleFeedback(i, 'disliked', msg)}
                                                title="Bad response — won't save"
                                                disabled={!!feedback[i]}
                                            >
                                                {feedback[i] === 'disliked' ? '�' : '�🏻'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {msg.sender === 'user' && (
                                <div className="msg-avatar user-avatar">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </AnimatedMessage>
                    ))}

                    {loading && (
                        <div className="message ai">
                            <div className="msg-avatar ai-avatar">
                                <img src={logo} alt="TTR AI" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                            </div>
                            <BreathingOrb />
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
                    {selectedDocs.length > 0 && (
                        <div className="docs-preview-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
                                {selectedDocs.map(doc => (
                                    <div key={doc.id} className="doc-preview" style={{ flex: '0 0 auto', minWidth: '200px', maxWidth: '250px', marginBottom: 0 }}>
                                        <div className="doc-preview-info">
                                            <span className="doc-preview-icon" style={{ color: doc.color }}>{doc.icon}</span>
                                            <div style={{ overflow: 'hidden' }}>
                                                <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{doc.fileName}</strong>
                                                {doc.processing ? (
                                                    <small className="doc-processing">Processing...</small>
                                                ) : doc.error ? (
                                                    <small className="doc-error">⚠️ {doc.error}</small>
                                                ) : (
                                                    <small>{doc.type} • {doc.pages} page{doc.pages !== 1 ? 's' : ''}</small>
                                                )}
                                            </div>
                                        </div>
                                        <button className="doc-preview-close" onClick={() => setSelectedDocs(prev => prev.filter(d => d.id !== doc.id))}>✕</button>
                                    </div>
                                ))}
                            </div>

                            {/* Wait until all docs process before showing study buttons */}
                            {!selectedDocs.some(d => d.processing) && !selectedDocs.some(d => d.error) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px', paddingLeft: '4px' }}>
                                    {currentPath === 'professional' ? (
                                        <>
                                            <button className="study-tool-tag pro" onClick={() => handleStudyAction('email')}>📧 Draft Email</button>
                                            <button className="study-tool-tag pro" onClick={() => handleStudyAction('report')}>📊 Exec Report</button>
                                            <button className="study-tool-tag pro" onClick={() => handleStudyAction('simplify')}>🛠️ Simplify</button>
                                        </>
                                    ) : (
                                        <>
                                            <button className="study-tool-tag" onClick={() => handleStudyAction('quiz')}>📝 Practice Quiz</button>
                                            <button className="study-tool-tag" onClick={() => handleStudyAction('summary')}>📑 Quick Summary</button>
                                            <button className="study-tool-tag" onClick={() => handleStudyAction('questions')}>🧠 Exam Questions</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className={`input-bar ${loading ? 'thinking' : ''}`} style={{ position: 'relative' }}>
                        {/* 4-Way Learning Menu Toggler */}
                        <div style={{ position: 'relative' }} ref={fourWayMenuRef}>
                            <button
                                className={`attach-btn ${fourWayMode ? 'active-hero' : ''}`}
                                onClick={() => setShowFourWayMenu(!showFourWayMenu)}
                                title="4-Way Learning Modes"
                                style={{ color: fourWayMode ? 'var(--accent)' : 'inherit' }}
                            >
                                {fourWayMode ? Object.values(FOUR_WAY_HEROES).find(h => h.id === fourWayMode)?.emoji : '🧭'}
                            </button>
                            {showFourWayMenu && (
                                <div style={{
                                    position: 'absolute', bottom: '100%', left: '0', marginBottom: '10px',
                                    background: 'var(--bg-card)', border: '1px solid var(--accent)',
                                    borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column',
                                    gap: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 100,
                                    width: '220px', animation: 'fadeIn 0.2s ease'
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent)', padding: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>4-Way Learning</div>
                                    <button
                                        onClick={() => { setFourWayMode(null); setShowFourWayMenu(false); setCurrentSessionId(null); setMessages([WELCOME_MSG]); setInput(''); }}
                                        style={{ textAlign: 'left', padding: '10px', background: !fourWayMode ? 'var(--accent-glow)' : 'transparent', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', transition: '0.2s', fontSize: '14px' }}
                                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                                        onMouseLeave={(e) => e.target.style.background = !fourWayMode ? 'var(--accent-glow)' : 'transparent'}
                                    >
                                        🧠 Standard TTR AI
                                    </button>
                                    {Object.values(FOUR_WAY_HEROES).map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => { setFourWayMode(mode.id); setShowFourWayMenu(false); setCurrentSessionId(null); setMessages([WELCOME_MSG]); setInput(''); }}
                                            style={{ textAlign: 'left', padding: '10px', background: fourWayMode === mode.id ? 'var(--accent-glow)' : 'transparent', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', transition: '0.2s', fontSize: '14px' }}
                                            onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={(e) => e.target.style.background = fourWayMode === mode.id ? 'var(--accent-glow)' : 'transparent'}
                                            title={mode.title}
                                        >
                                            <span style={{ marginRight: '8px' }}>{mode.emoji}</span>
                                            {mode.name.replace(mode.emoji, '').trim()}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleMicClick}
                            className={`attach-btn voice-button ${isListening ? 'listening' : ''}`}
                            title="Click to Speak"
                            style={{ color: isListening ? '#ff4757' : 'inherit' }}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>

                        <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach Document/Image">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            accept="image/*,application/pdf,.pdf,.pptx,.docx,.txt,.csv,.md,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        <div style={{ position: 'relative' }} ref={langMenuRef}>
                            {fourWayMode === 'teaching' && (
                                <>
                                    <button
                                        className="attach-btn"
                                        onClick={() => setShowLangMenu(!showLangMenu)}
                                        style={{
                                            height: '38px', minWidth: '40px', background: 'var(--bg-tertiary)',
                                            color: 'var(--accent)', borderRadius: '8px', border: '1px solid var(--border)',
                                            fontSize: '11px', fontWeight: 'bold'
                                        }}
                                    >
                                        {{ 'Hindi': 'HI', 'Telugu': 'TE', 'Tamil': 'TA', 'Spanish': 'ES', 'French': 'FR' }[motherTongue] || 'EN'}
                                    </button>
                                    {showLangMenu && (
                                        <div style={{
                                            position: 'absolute', bottom: '100%', right: '0', marginBottom: '10px',
                                            background: 'var(--bg-card)', border: '1px solid var(--accent)',
                                            borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column',
                                            gap: '5px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 110, width: '120px'
                                        }}>
                                            <div style={{ fontSize: '10px', color: 'var(--accent)', padding: '5px', fontWeight: 'bold' }}>Languages</div>
                                            {['Hindi', 'Telugu', 'Tamil', 'Spanish', 'French'].map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => { setMotherTongue(lang); setShowLangMenu(false); }}
                                                    style={{
                                                        textAlign: 'left', padding: '10px', background: motherTongue === lang ? 'var(--accent-glow)' : 'transparent',
                                                        border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px'
                                                    }}
                                                >
                                                    {lang}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask TTR AI anything..."
                            rows="1"
                            disabled={loading}
                        />
                        <button
                            className={`attach-btn ${isDebugMode ? 'active-hero' : ''}`}
                            onClick={() => setIsDebugMode(!isDebugMode)}
                            title="Debug Mode: Focus AI on fixing code errors"
                            style={{
                                color: isDebugMode ? '#ef4444' : 'inherit',
                                background: isDebugMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                borderRadius: '8px'
                            }}
                        >
                            🐞
                        </button>
                        <MagneticSubmitButton
                            loading={loading}
                            disabled={!input.trim() && !selectedImage && !selectedDoc}
                            onClick={handleSend}
                            onStop={handleStop}
                        />
                    </div>
                    <p className="input-hint">TTR AI can make mistakes. Verify important information.</p>
                </div>
            </div>

            {/* ── Gurukul Path Modal ── */}
            {
                showPathModal && (
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
                )
            }

            {/* ── Theme Gallery Modal ── */}
            {showThemeGallery && (
                <div className="theme-gallery-overlay" onClick={() => setShowThemeGallery(false)}>
                    <div className="theme-gallery" onClick={e => e.stopPropagation()}>
                        <div className="gallery-header">
                            <h2>Visual Universe</h2>
                            <p>Select from 50+ custom aesthetics to transform your AI.</p>
                            <button className="sidebar-close" onClick={() => setShowThemeGallery(false)}>✕</button>
                        </div>
                        <div className="gallery-content">
                            {Object.entries(THEME_CATEGORIES).map(([slug, catName]) => (
                                <div key={slug} className="category-section">
                                    <h3 className="category-title">{catName}</h3>
                                    <div className="theme-grid">
                                        {THEMES.filter(t => t.category === slug).map(t => (
                                            <div
                                                key={t.id}
                                                className={`theme-card ${theme === t.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    applyTheme(t.id);
                                                    setShowThemeGallery(false);
                                                }}
                                            >
                                                <div
                                                    className="theme-preview"
                                                    style={{
                                                        backgroundColor: t.colors.primary,
                                                        border: `2px solid ${t.colors.accent}`
                                                    }}
                                                >
                                                    <span style={{ color: t.colors.accent }}>A</span>
                                                </div>
                                                <span>{t.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
