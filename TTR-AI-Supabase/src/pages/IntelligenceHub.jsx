import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import logo from '../assets/logo.png';

const MODULES = [
    {
        id: 'physics_lab',
        title: 'Physics Lab',
        emoji: '🔬',
        desc: 'Advanced formula derivations, first-principles simulations, and conceptual mastery.',
        color: '#3b82f6',
        hero: 'Arjuna'
    },
    {
        id: 'coding_war_room',
        title: 'Code War Room',
        emoji: '💻',
        desc: 'Weaponized debugging, architectural audits, and performance profiling.',
        color: '#10b981',
        hero: 'Abhimanyu'
    },
    {
        id: 'upsc_strategy',
        title: 'Statecraft Hub',
        emoji: '📜',
        desc: 'Strategic planning, essay structures, and policy analysis for aspirants.',
        color: '#f59e0b',
        hero: 'Chanakya'
    },
    {
        id: 'creative_dimension',
        title: 'Mythos Dimension',
        emoji: '🌌',
        desc: 'Analogies from Indian mythology used to explain modern scientific concepts.',
        color: '#8b5cf6',
        hero: 'Sahadeva'
    }
];

const IntelligenceHub = () => {
    const navigate = useNavigate();

    useEffect(() => {
        anime({
            targets: '.module-card',
            translateY: [20, 0],
            opacity: [0, 1],
            delay: anime.stagger(100),
            easing: 'easeOutQuad',
            duration: 800
        });
    }, []);

    const enterModule = (id) => {
        // We will pass the module ID to the chat via state
        navigate('/', { state: { activeModule: id } });
    };

    return (
        <div className="hub-container" style={{
            minHeight: '100vh',
            background: '#0f0f14',
            color: '#e8e8f0',
            padding: '40px 20px',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img src={logo} alt="TTRAI" style={{ height: '40px', width: 'auto' }} />
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Intelligence Hub</h1>
                    </div>
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#e8e8f0',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        Back to Chat
                    </button>
                </header>

                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '32px', color: '#a78bfa' }}>Select Your Strategic Arena</h2>
                    <p style={{ color: '#94a3b8', fontSize: '18px' }}>
                        The TTR Intelligence Engine adapts its core DNA based on the arena you choose.
                    </p>
                </div>

                <div className="modules-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px'
                }}>
                    {MODULES.map(module => (
                        <div 
                            key={module.id} 
                            className="module-card"
                            onClick={() => enterModule(module.id)}
                            style={{
                                background: 'rgba(22, 22, 30, 0.8)',
                                border: `1px solid ${module.color}33`,
                                borderRadius: '16px',
                                padding: '30px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.border = `1px solid ${module.color}`;
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = `0 10px 40px ${module.color}22`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.border = `1px solid ${module.color}33`;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ fontSize: '40px', marginBottom: '20px' }}>{module.emoji}</div>
                            <h3 style={{ fontSize: '22px', marginBottom: '10px', color: module.color }}>{module.title}</h3>
                            <p style={{ color: '#94a3b8', lineHeight: '1.6', fontSize: '14px', marginBottom: '20px' }}>{module.desc}</p>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontSize: '12px', 
                                color: '#a78bfa',
                                background: 'rgba(167, 139, 250, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                alignSelf: 'flex-start'
                            }}>
                                <span>🛡️</span> {module.hero} Core Protocol
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '60px', padding: '40px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ fontSize: '40px' }}>🧠</div>
                        <div>
                            <h4 style={{ fontSize: '20px', marginBottom: '5px' }}>Dynamic Protocol Injection</h4>
                            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                                Your selected Arena will automatically inject specialized instructions into the TTR Intelligence Engine, forcing a 99.9% accuracy loop for that specific domain.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntelligenceHub;
