import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownCode, MarkdownTable } from './CodeBlock';
import anime from 'animejs/lib/anime.es.js';
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
                src={logo}
                alt="Thinking"
                style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '50%' }}
            />
        </div>
    );
});

/**
 * AnimatedMessage: Wrapper for fluid message entrance
 */
export const AnimatedMessage = memo(({ msg, children }) => {
    const msgRef = useRef(null);

    useEffect(() => {
        if (msg.isNew) {
            anime({
                targets: msgRef.current,
                translateY: [30, 0],
                scale: [0.95, 1],
                opacity: [0, 1],
                duration: 900,
                easing: 'easeOutElastic(1, .8)',
                delay: msg.sender === 'ai' ? 100 : 0
            });
        }
    }, [msg.isNew, msg.sender]);

    return (
        <div ref={msgRef} className={`message ${msg.sender}`} style={{ opacity: msg.isNew ? 0 : 1 }}>
            {children}
        </div>
    );
});

/**
 * MagneticSubmitButton: Interactive send/stop button
 */
export const MagneticSubmitButton = memo(({ onClick, disabled, loading, onStop }) => {
    const btnRef = useRef(null);

    const handlePress = () => {
        anime({
            targets: btnRef.current,
            scale: [1, 0.8, 1.1, 1],
            duration: 600,
            easing: 'easeOutElastic(1, .5)'
        });
        if (loading) {
            onStop();
        } else {
            onClick();
        }
    };

    return loading ? (
        <button
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
 * TypewriterMessage: Progressive text reveal
 */
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
