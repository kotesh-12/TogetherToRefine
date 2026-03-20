import React, { useState, useEffect } from 'react';
import anime from 'animejs';

/**
 * DharmaChallenge: A gamified "Daily Mission" component that 
 * encourages users to explore deeper concepts for massive XP.
 */
export const DharmaChallenge = ({ role, onStart }) => {
    const [challenge, setChallenge] = useState(null);
    const [claimed, setClaimed] = useState(false);

    const CHALLENGES = {
        student: [
            { text: "Solve a complex calculus derivation", points: 100, icon: "📐" },
            { text: "Summarize a research paper via AI Audit", points: 150, icon: "📜" },
            { text: "Find a conceptual 'hallucination' and fix it", points: 200, icon: "🧠" }
        ],
        teacher: [
            { text: "Generate a 10-slide pedagogy roadmap", points: 150, icon: "📽️" },
            { text: "Analyze student performance trends", points: 200, icon: "📊" }
        ],
        admin: [
            { text: "Perform a system architecture audit", points: 250, icon: "🛡️" },
            { text: "Optimize a knowledge nexus branch", points: 300, icon: "🌳" }
        ]
    };

    useEffect(() => {
        const pool = CHALLENGES[role] || CHALLENGES.student;
        const random = pool[Math.floor(Math.random() * pool.length)];
        setChallenge(random);

        // Standard AnimeJS call
        anime({
            targets: '.challenge-card',
            scale: [0.8, 1],
            opacity: [0, 1],
            rotate: [-5, 0],
            duration: 1000,
            easing: 'easeOutElastic(1, .8)'
        });
    }, [role]);

    const handleClaim = () => {
        setClaimed(true);
        if (onStart) onStart(challenge.text);
    };

    if (!challenge) return null;

    return (
        <div className="challenge-card" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(30, 30, 45, 0.9))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '15px',
            marginTop: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }}>{challenge.icon}</span>
                <div>
                    <div style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Divine Challenge</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{challenge.text}</div>
                </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '12px' }}>+{challenge.points} XP Available</div>
                <button 
                    onClick={handleClaim}
                    disabled={claimed}
                    style={{
                        background: claimed ? 'rgba(255,255,255,0.05)' : 'var(--accent)',
                        border: 'none', color: '#fff', fontSize: '10px', fontWeight: 'bold',
                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                        boxShadow: claimed ? 'none' : '0 5px 15px rgba(108, 99, 255, 0.4)'
                    }}
                >
                    {claimed ? 'CLAIMED' : 'ACCEPT'}
                </button>
            </div>
            
            <div style={{
                position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                animation: 'shimmer-challenge 3s infinite'
            }} />
            <style>{`
                @keyframes shimmer-challenge {
                    100% { left: 200%; }
                }
            `}</style>
        </div>
    );
};
