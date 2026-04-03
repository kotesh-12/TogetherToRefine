import React, { useRef, useEffect, useState } from 'react';
import anime from 'animejs';

export const DevCanvas = ({ data, isOpen, onClose }) => {
    const [view, setView] = useState('preview'); // 'code' or 'preview'
    const iframeRef = useRef(null);
    const canvasRef = useRef(null);
    const [consoleLogs, setConsoleLogs] = useState([]);

    useEffect(() => {
        if (isOpen) {
            anime({
                targets: canvasRef.current,
                scale: [0.98, 1],
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutQuart'
            });
            runCode();
        }
    }, [isOpen, data]);

    const runCode = () => {
        if (!iframeRef.current || !data?.code) return;
        
        const iframe = iframeRef.current;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        let content = '';
        if (data.language === 'html') {
            content = data.code;
        } else if (data.language === 'javascript' || data.language === 'js') {
            content = `
                <html>
                <body style="background: #fff; font-family: sans-serif; padding: 20px;">
                    <div id="output"></div>
                    <script>
                        const output = document.getElementById('output');
                        const oldLog = console.log;
                        console.log = (...args) => {
                            window.parent.postMessage({ type: 'console', log: args.join(' ') }, '*');
                            oldLog(...args);
                        };
                    </script>
                    <script>${data.code}<\/script>
                </body>
                </html>
            `;
        } else if (data.language === 'css') {
            content = `
                <html>
                <head><style>${data.code}</style></head>
                <body style="background: #f0f0f4; padding: 20px;">
                    <h2>CSS Preview</h2>
                    <div class="test-element">Styling applied to this element.</div>
                    <button>Sample Button</button>
                    <div style="margin-top: 20px;">
                       <div style="width: 100px; height: 100px; background: #3b82f6; border-radius: 8px;"></div>
                    </div>
                </body>
                </html>
            `;
        }

        doc.open();
        doc.write(content);
        doc.close();
    };

    // Listen for console logs from iframe
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data.type === 'console') {
                setConsoleLogs(prev => [...prev, event.data.log].slice(-10));
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="devcanvas-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(10, 10, 15, 0.95)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }} onClick={onClose}>
            <div 
                ref={canvasRef}
                className="devcanvas-window" 
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '1200px',
                    height: '90vh',
                    background: '#16161e',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.8)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></div>
                        <div style={{ marginLeft: '10px', display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '13px', color: '#fff', letterSpacing: '0.5px' }}>SIDDH DEVCANVAS</strong>
                            <small style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{data?.language || 'plain text'}</small>
                        </div>
                    </div>

                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px' }}>
                        <button 
                            onClick={() => setView('code')}
                            style={{ 
                                padding: '6px 14px', 
                                background: view === 'code' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                color: view === 'code' ? '#fff' : 'rgba(255,255,255,0.4)',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >CODE</button>
                        <button 
                            onClick={() => setView('preview')}
                            style={{ 
                                padding: '6px 14px', 
                                background: view === 'preview' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                color: view === 'preview' ? '#fff' : 'rgba(255,255,255,0.4)',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >PREVIEW</button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(data?.code);
                                alert("Code copied to clipboard!");
                            }}
                            style={{ background: 'rgba(108, 99, 255, 0.1)', border: '1px solid rgba(108, 99, 255, 0.2)', color: '#6c63ff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}
                        >Copy</button>
                        <button 
                            onClick={onClose}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}
                        >Close</button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                    <div style={{ 
                        flex: 1, 
                        display: view === 'code' ? 'block' : 'none',
                        background: '#1e1e2e',
                        padding: '24px',
                        overflow: 'auto',
                        fontFamily: "'Fira Code', monospace",
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#cdd6f4'
                    }}>
                        <pre style={{ margin: 0 }}><code>{data?.code}</code></pre>
                    </div>

                    <div style={{ 
                        flex: 1, 
                        display: view === 'preview' ? 'block' : 'none',
                        background: '#fff',
                        position: 'relative'
                    }}>
                        <iframe 
                            ref={iframeRef}
                            title="Sandbox Preview"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                    </div>
                </div>

                {/* Console Footer */}
                {view === 'preview' && consoleLogs.length > 0 && (
                    <div style={{
                        height: '120px',
                        background: '#0a0a0f',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        padding: '12px 24px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Console Output</div>
                        {consoleLogs.map((log, i) => (
                            <div key={i} style={{ color: '#22c55e', fontSize: '12px', fontFamily: 'monospace', marginBottom: '4px' }}>
                                <span style={{ opacity: 0.5 }}>{'>'}</span> {log}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
