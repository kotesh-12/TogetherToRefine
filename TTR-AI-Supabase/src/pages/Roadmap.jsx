import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const roadmapData = [
    {
        title: "Enhancing Emotional Range",
        icon: "🧠",
        description: "Training on nuanced emotional expressions and interpersonal interactions. Incorporating sentiment analysis to better respond to human emotions.",
        source: "Ref: Daniel Goleman's Emotional Intelligence"
    },
    {
        title: "Improving Data Quality",
        icon: "✨",
        description: "Continuous curation of training data to remove biases and inaccuracies. Regular integration of new information and diverse data sources.",
        source: "Action: Real-time Data Audits"
    },
    {
        title: "Simulating Real-World Experience",
        icon: "🌍",
        description: "Training on simulations and virtual environments to learn from a wider range of scenarios and improve handling of novel situations.",
        source: "Tech: Reinforcement Learning"
    },
    {
        title: "Fostering Lateral Thinking",
        icon: "💡",
        description: "Explicit training on brainstorming, mind mapping, and reverse thinking to stimulus creative problem-solving and unconventional ideas.",
        source: "Concept: Creative Mastery"
    },
    {
        title: "Deepening Understanding",
        icon: "📚",
        description: "Using knowledge graphs and semantic networks to model relationships between entities and develop causal reasoning capabilities.",
        source: "Model: Knowledge Graphs"
    },
    {
        title: "Security Protocols",
        icon: "🛡️",
        description: "Robust input validation, adversarial training, and anomaly detection to protect against manipulation and attacks.",
        source: "Status: Continuous Auditing"
    },
    {
        title: "Mitigating Bias",
        icon: "⚖️",
        description: "Implementing fairness-aware algorithms and data re-sampling to reduce bias amplification in AI outputs.",
        source: "Goal: Total Equity"
    },
    {
        title: "Calibrating Confidence",
        icon: "🎯",
        description: "Providing uncertainty estimates and disclaimers. Using Platt scaling to avoid overconfidence in reasoning.",
        source: "Feature: Uncertainty Estimates"
    },
    {
        title: "Contextual Mastery",
        icon: "🔍",
        description: "Improving NLP models to disambiguate inputs and incorporate user history for better intent understanding.",
        source: "Tech: Transformer Attention"
    },
    {
        title: "Novelty Handling",
        icon: "🚀",
        description: "Developing meta-learning techniques to adapt quickly to new, unprecedented scenarios and generalize from limited data.",
        source: "Goal: Adaptive Meta-Learning"
    }
];

export default function Roadmap() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f0f14',
            color: 'white',
            padding: '40px 20px',
            fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
            {/* Header Area */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', marginBottom: '60px' }}>
                <button 
                    onClick={() => navigate('/')}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        marginBottom: '30px',
                        fontSize: '14px'
                    }}
                >
                    ← Back to Chat
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                    <img src={logo} alt="TTRAI" style={{ height: '60px', width: 'auto' }} />
                    <h1 style={{ fontSize: '42px', fontWeight: '800', background: 'linear-gradient(135deg, #fff 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                        Platform Evolution
                    </h1>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '18px', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6' }}>
                    Inspired by the discipline of Arjuna, we are transforming every technological challenge into a pillar of strength. This is the roadmap for TTRAI's continuous refinement.
                </p>
            </div>

            {/* Grid Area */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px'
            }}>
                {roadmapData.map((item, idx) => (
                    <div key={idx} className="roadmap-card" style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '24px',
                        padding: '30px',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ 
                            fontSize: '32px', 
                            marginBottom: '20px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            width: '60px',
                            height: '60px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '16px'
                        }}>
                            {item.icon}
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: '#fff' }}>
                            {item.title}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' }}>
                            {item.description}
                        </p>
                        <div style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            letterSpacing: '1px', 
                            color: '#8b5cf6', 
                            textTransform: 'uppercase',
                            background: 'rgba(139, 92, 246, 0.05)',
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '6px'
                        }}>
                            {item.source}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Medal */}
            <div style={{ 
                maxWidth: '600px', 
                margin: '80px auto 40px auto', 
                textAlign: 'center',
                padding: '30px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0) 100%)',
                borderRadius: '32px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎗️</div>
                <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 10px 0' }}>Dharma Points: +15</h2>
                <p style={{ color: '#94a3b8', margin: 0 }}>Resilience & Growth Mastery Certification</p>
            </div>

            <style>{`
                .roadmap-card:hover {
                    transform: translateY(-5px);
                    background: rgba(255,255,255,0.04);
                    border-color: rgba(139, 92, 246, 0.3);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
}
