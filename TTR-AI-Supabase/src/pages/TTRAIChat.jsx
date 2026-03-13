import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownCode, MarkdownTable } from '../components/CodeBlock';
import { isDocumentFile, isImageFile, getFileTypeInfo, processDocument } from '../utils/documentProcessor';
import { useSpeech } from '../hooks/useSpeech';
import anime from 'animejs/lib/anime.es.js';
import logo from '../assets/logo.png';
import { THEMES, THEME_CATEGORIES } from '../themeData';
import mermaid from 'mermaid';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import pLimit from 'p-limit';
import JSZip from 'jszip';


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


// Admin-only stats badge (only rendered for admin email)
function AdminStatsBadge() {
    const [stats, setStats] = useState({ users: '...', sessions: '...' });

    useEffect(() => {
        async function fetchStats() {
            try {
                // Count total chat sessions (proxy for active users)
                const { count: sessionCount } = await supabase
                    .from('chat_sessions')
                    .select('*', { count: 'exact', head: true });

                // Count distinct users from sessions
                const { data: userData } = await supabase
                    .from('chat_sessions')
                    .select('user_id');

                const uniqueUsers = new Set(userData?.map(s => s.user_id)).size;

                setStats({ users: uniqueUsers || 0, sessions: sessionCount || 0 });
            } catch {
                setStats({ users: '?', sessions: '?' });
            }
        }
        fetchStats();
    }, []);

    return (
        <div style={{
            width: '100%', padding: '12px', borderRadius: '10px',
            background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)',
            marginBottom: '10px', display: 'flex', justifyContent: 'space-around', textAlign: 'center'
        }}>
            <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a78bfa' }}>{stats.users}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Users</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(139,92,246,0.2)', paddingLeft: '15px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a78bfa' }}>{stats.sessions}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chats</div>
            </div>
        </div>
    );
}

// Mermaid Diagram Component
const MermaidDiagram = ({ chart }) => {
    const chartRef = useRef(null);
    const [svg, setSvg] = useState('');

    useEffect(() => {
        if (chartRef.current && chart) {
            try {
                mermaid.render('mermaid-chart', chart)
                    .then(({ svg }) => {
                        setSvg(svg);
                    })
                    .catch(error => {
                        console.error("Mermaid rendering failed:", error);
                        setSvg(`<pre style="color: red;">Mermaid rendering failed: ${error.message}</pre>`);
                    });
            } catch (error) {
                console.error("Mermaid parsing failed:", error);
                setTimeout(() => setSvg(`<pre style="color: red;">Mermaid parsing failed: ${error.message}</pre>`), 0);
            }
        }
    }, [chart]);

    return (
        <div ref={chartRef} dangerouslySetInnerHTML={{ __html: svg }} style={{ overflowX: 'auto', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }} />
    );
};

// Helper for safe storage access
const getSafeStorage = (key, fallback = null, useSession = false) => {
    try {
        const storage = useSession ? sessionStorage : localStorage;
        return storage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
};

const setSafeStorage = (key, value, useSession = false) => {
    try {
        const storage = useSession ? sessionStorage : localStorage;
        storage.setItem(key, value);
    } catch (e) {
        console.warn('Storage set failed:', e);
    }
};

const removeSafeStorage = (key, useSession = false) => {
    try {
        const storage = useSession ? sessionStorage : localStorage;
        storage.removeItem(key);
    } catch (e) {
        console.warn('Storage remove failed:', e);
    }
};

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
    const curtainRef = useRef(null);
    const fourWayMenuRef = useRef(null);


    // Auto-adjust textarea height
    const adjustHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    useEffect(() => {
        adjustHeight();
    }, [input, adjustHeight]);

    // Session state (only for logged-in users)
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Debug Mode
    const [isDebugMode, setIsDebugMode] = useState(false);

    // Incognito Mode
    const [incognitoMode, setIncognitoMode] = useState(() => getSafeStorage('ttr_incognito', 'false', true) === 'true');

    // Premium Features State
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [highlightPopup, setHighlightPopup] = useState({ text: '', x: 0, y: 0, show: false });
    const [showSlashMenu, setShowSlashMenu] = useState(false);

    // Like/Dislike feedback tracking { [messageIndex]: 'liked' | 'disliked' }
    const [feedback, setFeedback] = useState({});
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Gurukul Path State
    const [currentPath, setCurrentPath] = useState(getSafeStorage('ttr_guest_path', ''));
    const [currentDomain, setCurrentDomain] = useState(getSafeStorage('ttr_guest_domain', null));
    const [showPathModal, setShowPathModal] = useState(false);

    const [fourWayMode, setFourWayMode] = useState(null);
    const [showFourWayMenu, setShowFourWayMenu] = useState(false);

    // Theme State
    const [theme, setTheme] = useState(() => getSafeStorage('ttr_theme', 'dark'));
    const [showThemeGallery, setShowThemeGallery] = useState(false);
    const langMenuRef = useRef(null);

    // Sandbox State
    const [sandboxData, setSandboxData] = useState({ open: false, code: '', lang: '' });
    const sandboxIframeRef = useRef(null);

    const handleRunCode = useCallback((code, lang) => {
        setSandboxData({ open: true, code, lang });
    }, []);

    const customMarkdownComponents = useMemo(() => ({
        table: MarkdownTable,
        code: (props) => {
            const { inline, className, children } = props;
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match && match[1] === 'mermaid') {
                return <MermaidDiagram chart={String(children)} />;
            }
            return <MarkdownCode {...props} onRun={handleRunCode} />;
        }
    }), [handleRunCode]);

    // Dharma XP State
    const [dharmaXP, setDharmaXP] = useState(() => Number(getSafeStorage('ttr_dharma_xp', '0')) || 0);
    useEffect(() => {
        setSafeStorage('ttr_dharma_xp', dharmaXP);
    }, [dharmaXP]);

    // Initialize mermaid on mount
    useEffect(() => {
        mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
    }, []);

    // Handle Sandbox Iframe Injection
    useEffect(() => {
        if (sandboxData.open && sandboxIframeRef.current) {
            const doc = sandboxIframeRef.current.contentDocument;
            let html = '';
            const code = sandboxData.code;
            const lang = sandboxData.lang.toLowerCase();

            if (lang === 'html') html = code;
            else if (lang === 'css') html = `<style>${code}</style><div style="padding:20px; font-family:sans-serif;"><h1>CSS Preview</h1><p>Your styles are applied here.</p></div>`;
            else html = `<!DOCTYPE html><html><body><div id="output"></div><script>
                const log = console.log;
                console.log = (...args) => {
                    document.getElementById('output').innerHTML += args.join(' ') + '<br/>';
                    log(...args);
                };
                try { ${code} } catch(e) { document.getElementById('output').innerHTML += '<span style="color:red">'+e.message+'</span>'; }
            </script></body></html>`;

            doc.open();
            doc.write(html);
            doc.close();
        }
    }, [sandboxData]);

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
        const savedTheme = getSafeStorage('ttr_theme', 'dark');
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
            setSafeStorage('ttr_guest_path', currentPath);
        } else {
            removeSafeStorage('ttr_guest_path');
        }
        if (currentDomain) {
            setSafeStorage('ttr_guest_domain', currentDomain);
        } else {
            removeSafeStorage('ttr_guest_domain');
        }
        setSafeStorage('ttr_theme', theme);
        // Incognito uses sessionStorage (clears when tab closes, like real incognito)
        if (incognitoMode) {
            setSafeStorage('ttr_incognito', 'true', true);
        } else {
            removeSafeStorage('ttr_incognito', true);
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

    // Handle Text Highlighting for "Act & Explain" feature
    useEffect(() => {
        const handleMouseUp = (_e) => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim() !== '') {
                // Ensure selection is inside a message content
                let node = selection.anchorNode;
                while (node && node !== document.body) {
                    if (node?.classList?.contains('msg-content') || node?.classList?.contains('ai-message-body')) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        setHighlightPopup({
                            text: selection.toString().trim(),
                            x: rect.left + rect.width / 2,
                            y: rect.top - 10,
                            show: true
                        });
                        return;
                    }
                    node = node.parentNode;
                }
            }
        };

        const hidePopup = (e) => {
            if (e.target.closest('.highlight-popup')) return; // Allow clicking buttons
            const selection = window.getSelection();
            if (!selection || selection.toString().trim() === '') {
                setHighlightPopup(p => ({ ...p, show: false }));
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousedown', hidePopup);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousedown', hidePopup);
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

    // Set welcome message on mount and remove root loader
    useEffect(() => {
        setMessages([WELCOME_MSG]);
        
        // Remove the initial loading screen from index.html
        const loader = document.getElementById('root-loading');
        if (loader) {
            loader.style.transition = 'opacity 0.5s ease';
            loader.style.opacity = '0';
            setTimeout(() => {
                const el = document.getElementById('root-loading');
                if (el) el.remove();
            }, 500);
        }
    }, [WELCOME_MSG]);

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
        e.target.value = '';

        // TTR Tier Verification
        const currentPlan = getSafeStorage('ttr_subscription_plan') || 'free';
        const LIMITS = {
            free: { docs: 1, pgs: 10 },
            basic: { docs: 3, pgs: 15 },
            bright: { docs: 10, pgs: 30 },
            premium: { docs: 999, pgs: 9999 }
        };
        const maxDocs = LIMITS[currentPlan].docs;
        const maxPgs = LIMITS[currentPlan].pgs;

        if (selectedDocs.length + files.length > maxDocs) {
            alert(`Your ${currentPlan.toUpperCase()} plan only allows up to ${maxDocs} document(s). Please upgrade your plan to attach more files.`);
            return;
        }

        for (const file of files) {
            if (isImageFile(file)) {
                // Handle as image (Gemini vision usually best with 1 image at a time right now)
                const reader = new FileReader();
                reader.onloadend = () => setSelectedImage(reader.result);
                reader.readAsDataURL(file);
            } else if (isDocumentFile(file)) {
                // Handle as document
                setSelectedImage(null);
                const docId = Date.now() + Math.random();
                const newDoc = { id: docId, file, fileName: file.name, processing: true, ...getFileTypeInfo(file) };
                setSelectedDocs(prev => [...prev, newDoc]);

                try {
                    const result = await processDocument(file);

                    if (result.pages && result.pages > maxPgs) {
                        setSelectedDocs(prev => prev.filter(d => d.id !== docId));
                        alert(`File "${file.name}" has ${result.pages} pages. Your ${currentPlan.toUpperCase()} plan is limited to ${maxPgs} pages per document. Upgrade your plan to unlock larger documents.`);
                        continue;
                    }

                    setSelectedDocs(prev => prev.map(d => d.id === docId ? { ...d, ...result, processing: false } : d));
                } catch (err) {
                    setSelectedDocs(prev => prev.map(d => d.id === docId ? { ...d, processing: false, error: err.message } : d));
                }
            }
        }
    }, [selectedDocs]);

    /* ── Send Message ── */
    const handleSend = useCallback(async (e, overrideText = null) => {
        const text = (overrideText || input).trim();
        if (!text && !selectedImage && selectedDocs.length === 0) return;

        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
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

            let apiMessageContent = hasDocs
                ? `${text || 'Analyze these documents'}${docContentText}`
                : text;

            // Auto-detect intent to build a PPT natively and enforce formatting dynamically
            const lowerText = text.toLowerCase();
            if (lowerText.includes('generate ppt') || lowerText.includes('create ppt') || lowerText.includes('make ppt') || lowerText.includes('generate presentation') || lowerText.includes('create presentation')) {
                apiMessageContent += "\n\nCRITICAL SYSTEM TRIGGER: The user heavily implies they want a PowerPoint. Please generate a highly professional, slide-by-slide presentation about this topic. Format it STRICTLY as follows for each slide:\n\nSlide: [Slide Title]\nContent:\n- [Bullet Point 1]\n- [Bullet Point 2]\nNotes: [What the speaker should say out loud regarding this slide]\n\nDo not add extra text outside this format.";
            }

            const payload = {
                history: historyForApi,
                message: apiMessageContent,
                userContext: {
                    name: displayName,
                    email: user?.email || 'Guest',
                    gurukul_path: currentPath,
                    domain: currentDomain || 'gurukul',
                    fourWayMode: fourWayMode,
                    motherTongue: fourWayMode === 'teaching' ? motherTongue : null,
                    isDebugMode: shouldDebug, // Signal to AI to focus on debugging
                },
                image: (imgData && !hasDocs) ? imgData.split(',')[1] : null,
                mimeType: (imgData && !hasDocs) ? imgData.match(/:(.*?);/)?.[1] : null,
                userId: user?.id || null, // For rate limiting track
                plan: getSafeStorage('ttr_subscription_plan') || 'free', // Current tier for backend logic
            };

            // Reset debug mode after sending if it was manual
            if (isDebugMode) setIsDebugMode(false);

            // Determine the correct API endpoint
            let API_URL = '/api/chat';

            // If running in Native App (Capacitor) or different protocol, use absolute URL
            if (!window.location.protocol.startsWith('http')) {
                API_URL = 'https://ttrai.in/api/chat';
            }
            // In web environments, relative path '/api/chat' is preferred on Vercel 
            // as it automatically handles the environment (localhost vs production)

            abortControllerRef.current = new AbortController();

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Rate limit or plan limit exceeded. Please wait or upgrade your plan.');
                }
                throw new Error(`Server error: ${response.status}`);
            }
            const result = await response.json();
            const responseText = result.response || result.text;
            // ─── Extract Dharma XP ───
            const xpMatch = responseText.match(/\[Dharma Points: \+(\d+)\]/);
            if (xpMatch) {
                const points = parseInt(xpMatch[1]);
                setDharmaXP(prev => prev + points);
            }

            const sources = result.sources || null;
            const toolCalled = result.toolCalled || null;

            const aiMsg = { 
                text: responseText, 
                sender: 'ai', 
                isNew: true, 
                question: text,
                sources: sources,
                toolCalled: toolCalled
            };
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
    }, [input, selectedImage, selectedDocs, user, currentSessionId, messages, currentPath, currentDomain, fourWayMode, motherTongue, loadSessions, saveMessage, incognitoMode]);

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

    const handleCopy = useCallback((text, index) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        });
    }, []);

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

    /* ── Export Functions ── */
    const exportChatAsPDF = async () => {
        const chatElement = document.querySelector('.messages-container');
        if (!chatElement || messages.length <= 1) {
            alert('No chat history to export.');
            return;
        }
        setLoading(true);
        try {
            const canvas = await html2canvas(chatElement, {
                scale: 1.5,
                useCORS: true,
                backgroundColor: theme === 'dark' ? '#0f0f14' : '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`TTR_AI_Chat_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Failed to export chat as PDF.');
        } finally { setLoading(false); }
    };

    const exportMessageAsDoc = (msgText) => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.setFontSize(22);
        pdf.setTextColor(139, 92, 246); // TTR Accent
        pdf.text("TTR AI Premium Document", 20, 20);

        pdf.setFontSize(12);
        pdf.setTextColor(40, 40, 40);
        const cleanText = msgText.replace(/[*~_`#]/g, '');
        const splitText = pdf.splitTextToSize(cleanText, 170);

        let y = 35;
        for (let i = 0; i < splitText.length; i++) {
            if (y > 280) {
                pdf.addPage();
                y = 20;
            }
            pdf.text(splitText[i], 20, y);
            y += 7; // Line spacing
        }
        pdf.save(`TTR_Doc_${Date.now()}.pdf`);
    };

    const exportMessageAsPPT = async (msgText) => {
        setLoading(true);
        try {
            const pres = new pptxgen();
            pres.layout = 'LAYOUT_16x9';
            pres.author = 'TTR AI';

            let slide1 = pres.addSlide();
            slide1.background = { color: 'FFFFFF' };
            slide1.addText('TTR AI Presentation', { x: 1, y: 1.5, w: '100%', h: 1.5, fontSize: 44, color: '000000', align: 'center', bold: true });

            // Clean up the entire text before splitting to avoid markdown artifacts breaking the parser
            let cleanMsg = msgText.replace(/\*\*/g, '').replace(/__/g, '').replace(/###/g, '').replace(/##/g, '');

            // STRICT SPLITTING: Split only when "Slide [Number]:" appears, usually at the start of a block
            // We use a regex that looks for "Slide" at the start of the string or after a newline
            const slideRegex = /(?:^|\n)Slide\s*\d*[:\n]/gi;
            
            // Get all slide content blocks by splitting
            // Using filter(b => b.length > 30) to ignore tiny fragments
            let rawBlocks = cleanMsg.split(slideRegex).map(b => b.trim()).filter(b => b.length > 30);

            // Fallback: If no "Slide:" markers found, split by double newlines but insist on large blocks
            if (rawBlocks.length <= 1) {
                rawBlocks = cleanMsg.split(/\n\n+/g).map(b => b.trim()).filter(b => b.length > 50);
            }

            const limit = pLimit(2); // Only allow 2 simultaneous requests

            const slidePromises = rawBlocks.map((block, index) => limit(async () => {
                let slide = pres.addSlide();
                slide.background = { color: 'FFFFFF' };

                let title = `Topic ${index + 1}`;
                let content = '';
                let notes = '';

                let blockText = block;
                
                // Extract Notes first (usually at the end of the block)
                if (blockText.toLowerCase().includes('notes:')) {
                    const notesIndex = blockText.toLowerCase().lastIndexOf('notes:');
                    notes = blockText.substring(notesIndex + 6).trim();
                    blockText = blockText.substring(0, notesIndex).trim();
                }

                // Extract Content (if the AI used specific "Content:" labels)
                if (blockText.toLowerCase().includes('content:')) {
                    const contentIndex = blockText.toLowerCase().indexOf('content:');
                    title = blockText.substring(0, contentIndex).trim();
                    content = blockText.substring(contentIndex + 8).trim();
                } else {
                    // Title is the first line, content is the rest
                    const lines = blockText.split('\n');
                    title = lines[0].trim();
                    content = lines.slice(1).join('\n').trim();
                }

                title = title.replace(/^[0-9.\-:]+\s*/, '').substring(0, 100);
                if (!title) title = "Key Concept";

                slide.addText(title, { x: 0.5, y: 0.5, w: 9.0, h: 1, fontSize: 26, bold: true, color: '000000' });

                if (content) {
                    const bulletLines = content.split('\n')
                        .map(line => line.replace(/^[*-•]\s*/, '').trim())
                        .filter(line => line.length > 0);

                    const bulletObjects = bulletLines.map(line => {
                        return { text: line, options: { bullet: true, color: '000000', paraSpaceAfter: 12 } };
                    });

                    if (bulletObjects.length > 0) {
                        slide.addText(bulletObjects, { x: 0.5, y: 1.6, w: 9.0, h: 4.5, fontSize: 16, valign: 'top' });
                    }
                }

                if (notes) {
                    slide.addNotes(notes);
                }
            }));

            // Wait until ALL slides have resolved
            await Promise.all(slidePromises);

            await pres.writeFile({ fileName: `TTR_AI_Enterprise_PPT_${Date.now()}.pptx` });
        } catch (error) {
            console.error('PPTX Generation Failed:', error);
            alert('Failed to generate visual presentation. Formatting was too complex.');
        } finally {
            setLoading(false);
        }
    };

    const exportChatAsExcel = () => {
        if (messages.length <= 1) {
            alert('No chat history to export.');
            return;
        }
        try {
            const exportData = messages.filter(m => m.text).map(msg => ({
                Sender: msg.sender === 'ai' ? 'TTR AI' : 'You',
                Message: msg.text,
                Time: new Date().toLocaleString()
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Chat History");
            XLSX.writeFile(workbook, `TTR_AI_Chat_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
        } catch (err) {
            console.error(err);
            alert('Failed to export Excel.');
        }
    };

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

    /* ── Highlight Menu Handlers ── */
    const handleHighlightAction = useCallback((action) => {
        const text = highlightPopup.text;
        setHighlightPopup(prev => ({ ...prev, show: false }));

        let prompt = "";
        if (action === 'explain') prompt = `Please explain the following concept much simpler, like I'm a beginner: "${text}"`;
        if (action === 'summarize') prompt = `Please summarize the following text in a few short bullet points: "${text}"`;
        if (action === 'code') prompt = `Please write the corresponding code for the following logic/concept: "${text}"`;

        if (action === 'read') {
            const langMap = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
            const lang = fourWayMode === 'teaching' ? (langMap[motherTongue] || 'en-US') : 'en-US';
            speak(text, lang);
            return;
        }

        handleSend(null, prompt);
    }, [highlightPopup.text, handleSend, speak, fourWayMode, motherTongue]);

    /* ── Slash Menu Handlers ── */
    const handleSlashCommand = useCallback((command) => {
        setShowSlashMenu(false);
        setInput('');

        if (command === 'clear') {
            setMessages([WELCOME_MSG]);
            setCurrentSessionId(null);
            return;
        }

        let prompt = "";
        if (command === 'quiz') prompt = "Generate a multiple-choice quiz with 3 questions based on our most recent topic. Do not provide the answers until I respond.";
        if (command === 'table') prompt = "Please take all the key information from your last response and format it into a comprehensive, easy-to-read comparison table.";
        if (command === 'interview') prompt = "I want you to act like a strict job interviewer for my field. Ask me one technical interview question right now, and wait for my answer before grading it and asking the next one.";
        if (command === 'doc') prompt = "Please generate a highly professional, textbook-quality document about the current topic. Use a clear Title, Executive Summary, structured paragraphs, and a Conclusion.";
        if (command === 'ppt') prompt = "Please generate a highly professional, slide-by-slide presentation about the current topic. Format it STRICTLY as follows for each slide:\n\nSlide: [Slide Title]\nContent:\n- [Bullet Point 1]\n- [Bullet Point 2]\nNotes: [What the speaker should say out loud regarding this slide]\n\nDo not add extra text outside this format.";

        handleSend(null, prompt);
    }, [handleSend]);

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
            className={`chat-page theme-${theme} ux-${currentThemeData.ux || 'standard'} ${isFocusMode ? 'focus-mode-active' : ''}`}
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

                <div style={{ display: 'flex', gap: '8px', padding: '0 20px', marginBottom: '15px' }}>
                    <button onClick={exportChatAsPDF} style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                        📄 PDF
                    </button>
                    <button onClick={exportChatAsExcel} style={{ flex: 1, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                        📊 Excel
                    </button>
                </div>

                {/* Dharma XP Stat */}
                <div className="dharma-xp-stat" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', margin: '0 20px 15px 20px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#ffd700', fontWeight: 'bold' }}>🕉️ DHARMA XP</span>
                        <span style={{ fontSize: '11px', color: '#fff' }}>{dharmaXP} PTS</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((dharmaXP % 1000) / 10, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #ffd700, #ff8c00)', borderRadius: '10px' }} />
                    </div>
                </div>

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
                                onClick={() => navigate('/pricing')}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '10px',
                                    background: 'linear-gradient(90deg, #bb86fc, #8b5cf6)', color: '#fff',
                                    border: 'none', cursor: 'pointer',
                                    marginBottom: '10px', fontSize: '13px', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    fontWeight: 'bold', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
                                    transition: 'transform 0.2s',
                                }}
                            >
                                <span>💎</span> Upgrade Plan ({getSafeStorage('ttr_subscription_plan')?.toUpperCase() || 'FREE'})
                            </button>

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

                            {/* Admin-Only Section — visible only to koteshbitra789@gmail.com */}
                            {user?.email === 'koteshbitra789@gmail.com' && (
                                <>
                                    <AdminStatsBadge />
                                    <button
                                        onClick={() => navigate('/admin-ttrai-hq')}
                                        style={{
                                            width: '100%', padding: '10px', borderRadius: '10px',
                                            background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa',
                                            border: '1px dashed rgba(139, 92, 246, 0.3)', cursor: 'pointer',
                                            marginBottom: '10px', fontSize: '13px', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span>🛡️</span> Data Exporter
                                    </button>
                                </>
                            )}

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
                            className={`path-header-btn ${isFocusMode ? 'active' : ''}`}
                            onClick={() => setIsFocusMode(!isFocusMode)}
                            title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode (Zen UI)'}
                        >
                            {isFocusMode ? '🔍' : '🧘‍♂️'}
                        </button>
                        <button
                            className="path-header-btn"
                            onClick={() => setShowPathModal(true)}
                            title="Choose AI Experience Path"
                        >
                            {currentPath && activeHeroes[currentPath] ? activeHeroes[currentPath].emoji : '🎗️'}
                        </button>
                        <button
                            className={`path-header-btn incognito-btn ${incognitoMode ? 'active' : ''}`}
                            onClick={toggleIncognito}
                            title={incognitoMode ? 'Incognito Mode ON — Nothing is saved' : 'Enable Incognito Mode'}
                        >
                            {incognitoMode ? '🕶️' : '🥷'}
                        </button>
                        {!user && (
                            <button className="signin-header-btn" onClick={() => navigate('/login')}>
                                Sign In
                            </button>
                        )}
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
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={customMarkdownComponents}>{msg.text}</ReactMarkdown>

                                {msg.sender === 'ai' && (
                                    <div className="ai-msg-actions">
                                        <button onClick={() => {
                                            const langMap = { 'Hindi': 'hi-IN', 'Telugu': 'te-IN', 'Tamil': 'ta-IN', 'Spanish': 'es-ES', 'French': 'fr-FR' };
                                            const lang = fourWayMode === 'teaching' ? (langMap[motherTongue] || 'en-US') : 'en-US';
                                            speak(msg.text, lang);
                                        }} className="msg-action-btn" title="Read Aloud">
                                            {speakingText === msg.text ? '🔇' : '🔊'}
                                        </button>
                                        <button 
                                            onClick={() => handleCopy(msg.text, i)} 
                                            className="msg-action-btn" 
                                            title="Copy to Clipboard"
                                        >
                                            {copiedIndex === i ? '✅' : '📋'}
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
                                                    {feedback[i] === 'disliked' ? '👎' : '👎🏻'}
                                                </button>
                                                <button
                                                    className="msg-action-btn pdf-dl"
                                                    onClick={() => exportMessageAsDoc(msg.text)}
                                                    title="Download Output as PDF Document"
                                                    style={{ marginLeft: '10px', fontSize: '11px', fontWeight: 'bold' }}
                                                >
                                                    📄 PDF
                                                </button>
                                                <button
                                                    className="msg-action-btn ppt-dl"
                                                    onClick={() => exportMessageAsPPT(msg.text)}
                                                    title="Download Output as PowerPoint PPTX"
                                                    style={{ fontSize: '11px', fontWeight: 'bold' }}
                                                >
                                                    📽️ PPTX
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {msg.sender === 'ai' && !loading && (
                                    <div className="study-nexus-shelf" style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button onClick={() => { setInput('/quiz based on your last response'); setTimeout(() => handleSend(), 100); }} className="nexus-tag">📝 Practice Quiz</button>
                                        <button onClick={() => { setInput('/flashcards for this content'); setTimeout(() => handleSend(), 100); }} className="nexus-tag">📇 Flashcards</button>
                                        <button onClick={() => { setInput('/mindmap to visualize this'); setTimeout(() => handleSend(), 100); }} className="nexus-tag">🗺️ Concept Map</button>
                                        <button onClick={() => { setInput('/debate on alternate views'); setTimeout(() => handleSend(), 100); }} className="nexus-tag">⚔️ Gurukul Debate</button>
                                    </div>
                                )}

                                {/* ─── RESEARCH SOURCE CARDS ───────────── */}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="research-sources">
                                        <div className="sources-header">
                                            <i className={msg.toolCalled === 'youtubeSearch' ? 'fab fa-youtube' : msg.toolCalled === 'academicSearch' ? 'fas fa-graduation-cap' : 'fas fa-globe'}></i>
                                            Sources Found:
                                        </div>
                                        <div className="sources-grid">
                                            {msg.sources.map((src, sIdx) => (
                                                <a key={sIdx} href={src.url} target="_blank" rel="noopener noreferrer" className="source-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div className="source-title">{src.title}</div>
                                                        {src.type === 'academic' && <span className="verify-badge" title="TTR Deep Verification Passed">✨</span>}
                                                    </div>
                                                    <div className="source-meta">
                                                        {src.channel ? <span>{src.channel}</span> : <span>{new URL(src.url).hostname}</span>}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

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
                    {/* Highlight Popup Menu */}
                    {highlightPopup.show && (
                        <div
                            className="highlight-popup"
                            style={{
                                left: `${highlightPopup.x}px`,
                                top: `${highlightPopup.y}px`,
                                transform: 'translate(-50%, -100%)'
                            }}
                        >
                            <button onClick={() => handleHighlightAction('explain')}>✨ Explain</button>
                            <button onClick={() => handleHighlightAction('summarize')}>📝 Summarize</button>
                            <button onClick={() => handleHighlightAction('code')}>💻 Code</button>
                            <button onClick={() => handleHighlightAction('read')}>🔊 Read</button>
                        </div>
                    )}

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

                        {/* Interactive Slash Menu */}
                        {showSlashMenu && (
                            <div className="slash-command-menu">
                                <div className="slash-menu-header">Quick Commands</div>
                                <button onClick={() => handleSlashCommand('doc')}><span>📄</span> <div><strong>/doc</strong><small>Generate Document (PDF)</small></div></button>
                                <button onClick={() => handleSlashCommand('ppt')}><span>📽️</span> <div><strong>/ppt</strong><small>Generate Presentation (PPTX)</small></div></button>
                                <button onClick={() => handleSlashCommand('quiz')}><span>📝</span> <div><strong>/quiz</strong><small>Test my knowledge</small></div></button>
                                <button onClick={() => handleSlashCommand('table')}><span>📊</span> <div><strong>/table</strong><small>Format last answer as table</small></div></button>
                                <button onClick={() => handleSlashCommand('interview')}><span>🎤</span> <div><strong>/interview</strong><small>Start mock interview</small></div></button>
                                <button onClick={() => handleSlashCommand('clear')}><span>🧹</span> <div><strong>/clear</strong><small>Wipe conversation</small></div></button>
                            </div>
                        )}

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInput(val);
                                if (val === '/') setShowSlashMenu(true);
                                else if (showSlashMenu && val !== '/') setShowSlashMenu(false);
                                adjustHeight();
                            }}
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
                            disabled={!input.trim() && !selectedImage && selectedDocs.length === 0}
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

            {/* ─── CODE SANDBOX OVERLAY ───────────── */}
            {sandboxData.open && (
                <div className="sandbox-overlay" onClick={() => setSandboxData({ ...sandboxData, open: false })}>
                    <div className="sandbox-window" onClick={e => e.stopPropagation()}>
                        <div className="sandbox-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '18px' }}>🚀</span>
                                <div>
                                    <strong style={{ fontSize: '14px', display: 'block' }}>TTR CODE RUNNER</strong>
                                    <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Language: {sandboxData.lang.toUpperCase()}</small>
                                </div>
                            </div>
                            <button className="close-modal" onClick={() => setSandboxData({ ...sandboxData, open: false })}>&times;</button>
                        </div>
                        <div className="sandbox-body">
                            <iframe 
                                ref={sandboxIframeRef} 
                                title="Code Preview" 
                                style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
