import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownCode, MarkdownTable } from './CodeBlock';
import anime from 'animejs';
import logo from '../assets/logo.png';

/**
 * BreathingOrb: Animated logo for loading state
 */
export const BreathingOrb = memo(() => {
    const orbRef = useRef(null);

    useEffect(() => {
        anime({
            targets: orbRef.current,
            scale: [0.85, 1.05],
            opacity: [0.7, 1],
            filter: [
                'drop-shadow(0 0 5px var(--accent))',
                'drop-shadow(0 0 20px var(--accent))'
            ],
            duration: 1500,
            direction: 'alternate',
            easing: 'easeInOutSine',
            loop: true
        });
    }, []);

    return (
        <div className="msg-content" style={{ background: 'transparent', border: 'none', padding: '10px 5px', boxShadow: 'none' }}>
            <img
                ref={orbRef}
                src="/apple-touch-icon.png"
                alt="Thinking"
                style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '50%' }}
            />
        </div>
    );
});

export const AnimatedMessage = memo(({ msg, children }) => {
    const msgRef = useRef(null);

    useEffect(() => {
        if (msg?.isNew) {
            anime({
                targets: msgRef.current,
                translateY: [40, 0],
                scale: [0.9, 1],
                opacity: [0, 1],
                filter: ['blur(15px)', 'blur(0px)'],
                duration: 1200,
                easing: 'easeOutElastic(1, .8)',
                delay: msg?.sender === 'ai' ? 150 : 0
            });
        }
    }, [msg?.isNew, msg?.sender]);

    return (
        <div 
            ref={msgRef} 
            className={`message ${msg?.sender || ''} glass-modern`} 
            style={{ 
                opacity: msg?.isNew ? 0 : 1,
                marginBottom: '20px',
                borderRadius: msg?.sender === 'ai' ? '20px 20px 20px 5px' : '20px 20px 5px 20px',
                background: msg?.sender === 'ai' ? 'rgba(255,255,255,0.03)' : 'rgba(108, 99, 255, 0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                padding: '16px 20px',
                boxShadow: msg?.sender === 'ai' ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(108, 99, 255, 0.1)',
                animation: msg?.sender === 'ai' ? 'bionicBreathe 8s infinite alternate' : 'none'
            }}
        >
            {children}
        </div>
    );
});


/**
 * MagneticSubmitButton: Interactive send/stop button
 */
export const MagneticSubmitButton = memo(({ onClick, disabled, loading, onStop, type = "button" }) => {
    const btnRef = useRef(null);

    const handlePress = (e) => {
        anime({
            targets: btnRef.current,
            scale: [1, 0.8, 1.1, 1],
            duration: 600,
            easing: 'easeOutElastic(1, .5)'
        });
        if (loading) {
            onStop();
        } else {
            onClick(e);
        }
    };

    return loading ? (
        <button
            type="button"
            ref={btnRef}
            className="send-btn stop"
            onClick={handlePress}
            title="Stop"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
        </button>
    ) : (
        <button
            type={type}
            ref={btnRef}
            className="send-btn"
            onClick={handlePress}
            disabled={disabled}
            title="Send"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
        </button>
    );
});

/**
 * BrainInsights: Expandable reasoning trail for AI transparency
 */
export const BrainInsights = memo(({ thought, confidence, debugMode, containerClass = '', headerClass = '' }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Auto-expand in debug mode
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (debugMode) setExpanded(true);
    }, [debugMode]);

    if (!thought && !confidence) return null;

    const getConfidenceColor = (score) => {
        if (score >= 90) return '#10b981'; // Green
        if (score >= 70) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };

    return (
        <div className={`brain-insights-container ${containerClass}`} style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: debugMode ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            border: debugMode ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(5px)',
            boxShadow: 'inset 0 0 20px rgba(255,255,255,0.01)',
            minWidth: 0,
            overflowX: 'hidden'
        }}>

            <div className={`brain-insights-header ${headerClass}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '5px' }}>
                    <button 
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: debugMode ? '#ef4444' : 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            letterSpacing: '0.5px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: 0,
                            textTransform: 'uppercase'
                        }}
                    >
                        <span style={{ fontSize: '14px', transition: '0.3s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>{expanded ? '▾' : '▸'}</span> 
                        {debugMode ? '🛡️ SIDDH DEBUG TRACE' : '🧠 SIDDH AGENT REASONING'}
                    </button>
                    
                    {confidence !== undefined && confidence !== null && (
                        <div style={{ 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: getConfidenceColor(confidence),
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            Confidence: {confidence}%
                        </div>
                    )}
                </div>

                {/* Autonomous Confidence Meter */}
                {confidence !== undefined && confidence !== null && (
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                            width: `${confidence}%`, 
                            height: '100%', 
                            background: getConfidenceColor(confidence),
                            transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: `0 0 10px ${getConfidenceColor(confidence)}88`
                        }} />
                    </div>
                )}
            </div>

            {expanded && (
                <div style={{ 
                    marginTop: '15px',
                    fontStyle: 'italic', 
                    lineHeight: '1.6',
                    opacity: 0.9,
                    borderLeft: debugMode ? '2px solid #ef4444' : '2px solid var(--accent)',
                    paddingLeft: '14px',
                    fontSize: '12.5px',
                    color: 'rgba(255,255,255,0.85)'
                }}>
                    <div style={{ marginBottom: '8px', color: 'var(--accent)', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>Autonomous Logic Pathway:</div>
                    {thought || "Autonomous reasoning trace finalized."}
                    {debugMode && (
                        <div style={{ marginTop: '12px', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            [System Patch: TTR-X2 | Mode: Autonomous | Trace: Sentinel-Alpha]
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export const TypewriterMessage = memo(({ text, onComplete }) => {
    const [displayed, setDisplayed] = useState('');
    const idx = useRef(0);


    useEffect(() => {
        idx.current = 0;
        // Reset displayed text on text change
        setTimeout(() => setDisplayed(''), 0);
        
        const iv = setInterval(() => {
            setDisplayed(prev => {
                if (idx.current < text.length) {
                    const ch = text.charAt(idx.current);
                    idx.current++;
                    const next = prev + ch;
                    // If we just finished, call the callback
                    if (idx.current === text.length && onComplete) {
                        onComplete();
                    }
                    return next;
                }
                clearInterval(iv);
                return prev;
            });
        }, 5);
        return () => clearInterval(iv);
    }, [text, onComplete]);

    const renderers = useMemo(() => ({
        code: MarkdownCode,
        table: MarkdownTable
    }), []);

    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>{displayed}</ReactMarkdown>;
});
