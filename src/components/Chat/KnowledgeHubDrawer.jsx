import React from 'react';
import anime from 'animejs';
import useChatStore from '../../store/useChatStore';

export const KnowledgeHubDrawer = ({ isOpen, onClose }) => {
    const { knowledgeBase, setKnowledgeBase } = useChatStore();
    const panelRef = React.useRef(null);

    React.useEffect(() => {
        if (isOpen) {
            anime({
                targets: panelRef.current,
                translateX: ['100%', '0%'],
                easing: 'easeOutExpo',
                duration: 600
            });
        } else {
            anime({
                targets: panelRef.current,
                translateX: '100%',
                easing: 'easeInExpo',
                duration: 400
            });
        }
    }, [isOpen]);

    const clearKnowledge = () => {
        if (confirm("Clear your personalized memory bank?")) {
            setKnowledgeBase([]);
        }
    };

    return (
        <div 
            ref={panelRef}
            className="knowledge-hub-drawer"
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '320px',
                height: '100dvh',
                background: 'var(--bg-card)',
                borderLeft: '1px solid var(--border)',
                zIndex: 2000,
                transform: 'translateX(100%)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)'
            }}
        >
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--accent)' }}>🧠 Knowledge Nexus</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {knowledgeBase.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🌑</div>
                        <p style={{ fontSize: '14px' }}>Your memory bank is empty. Start learning to record key insights.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {knowledgeBase.map((node, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    background: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid var(--border)', 
                                    borderRadius: '12px', 
                                    padding: '16px',
                                    transition: '0.3s'
                                }}
                                className="knowledge-node"
                            >
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>💎</span>
                                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{node.concept}</strong>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>{node.summary}</p>
                                <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold' }}>#{node.module || 'general-intel'}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
                    {knowledgeBase.length} Nodes in Long-term Context
                </div>
                <button 
                    onClick={clearKnowledge}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                    Wipe Memory Bank
                </button>
            </div>

            <style>{`
                .knowledge-node:hover {
                    background: rgba(var(--accent-rgb), 0.05);
                    border-color: var(--accent);
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
};
