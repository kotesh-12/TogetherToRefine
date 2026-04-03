import React from 'react';
import anime from 'animejs';

export const RoadmapOverlay = ({ data, onClose }) => {
    const nodesRef = React.useRef([]);

    React.useEffect(() => {
        if (data?.steps) {
            anime({
                targets: nodesRef.current,
                opacity: [0, 1],
                translateX: [-20, 0],
                delay: anime.stagger(100),
                easing: 'easeOutQuad',
                duration: 800
            });
        }
    }, [data]);

    if (!data) return null;

    return (
        <div className="roadmap-overlay" style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '40px 20px',
            overflowY: 'auto',
            background: 'var(--bg-primary)',
            position: 'relative'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {data.title || "Your Learning Journey"}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                            {data.description || "Personalized roadmap based on our session."}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                        Back to Chat
                    </button>
                </div>

                <div className="roadmap-timeline" style={{ position: 'relative', paddingLeft: '40px' }}>
                    <div style={{ position: 'absolute', left: '19px', top: '0', bottom: '0', width: '2px', background: 'linear-gradient(to bottom, var(--accent), transparent)', opacity: 0.3 }} />
                    
                    {data.steps?.map((step, idx) => (
                        <div 
                            key={idx} 
                            ref={el => nodesRef.current[idx] = el}
                            className="roadmap-step" 
                            style={{ position: 'relative', marginBottom: '40px', opacity: 0 }}
                        >
                            <div style={{ 
                                position: 'absolute', 
                                left: '-31px', 
                                top: '0', 
                                width: '24px', 
                                height: '24px', 
                                background: 'var(--bg-primary)', 
                                border: '3px solid var(--accent)', 
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1,
                                boxShadow: '0 0 10px var(--accent-glow)'
                            }}>
                                <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }} />
                            </div>

                            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow)', transition: '0.3s' }} className="roadmap-card-inner">
                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>Phase {idx + 1}</span>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '8px 0', color: 'var(--text-primary)' }}>{step.label}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{step.desc}</p>
                                
                                {step.resources && (
                                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {step.resources.map((res, rIdx) => (
                                            <span key={rIdx} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                                                🔗 {res}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Final Goal */}
                <div style={{ textAlign: 'center', marginTop: '60px', padding: '40px', background: 'var(--accent-glow)', borderRadius: '24px', border: '1px dashed var(--accent)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏆</div>
                    <h3 style={{ fontWeight: '800', fontSize: '20px' }}>Ultimate Goal</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '10px auto 0' }}>{data.goal || "Mastery of the subject matter."}</p>
                </div>
            </div>

            <style>{`
                .roadmap-card-inner:hover {
                    border-color: var(--accent);
                    transform: translateX(5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );
};
