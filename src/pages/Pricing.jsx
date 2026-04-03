import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Pricing() {
    const navigate = useNavigate();
    const currentPlan = localStorage.getItem('ttr_subscription_plan') || 'free';

    const handleSubscribe = (_planId) => {
        alert('Upgrades are coming soon! Until then, please use your current plan.');
    };

    const plans = [
        {
            id: 'free',
            name: 'Free Plan',
            price: '₹0',
            duration: 'forever',
            features: [
                '75 Messages per Hour',
                '549 Messages per Day',
                'Upload 1 PDF at a time',
                'Max 10 Pages per PDF',
                'Basic AI Answers'
            ],
            color: '#6c757d'
        },
        {
            id: 'basic',
            name: 'Basic Plan',
            price: '₹100',
            duration: '/month',
            features: [
                '250 Messages per Hour',
                '4,500 Messages per Day',
                'Upload 3 PDFs at once',
                'Max 15 Pages per PDF',
                'Priority Response Time'
            ],
            color: '#4dabf7'
        },
        {
            id: 'bright',
            name: 'Bright Plan',
            price: '₹250',
            duration: '/month',
            features: [
                'Unlimited Messages Daily',
                'No Hourly Limits',
                'Upload 10 PDFs at once',
                'Max 30 Pages per PDF',
                'Deeper Document Analysis'
            ],
            color: '#fab005',
            popular: true
        },
        {
            id: 'premium',
            name: 'Premium',
            price: '₹499',
            duration: '/month',
            features: [
                'Completely Unlimited Messages',
                'Unlimited PDF Sharing',
                'Unlimited Page Limits',
                'Most Effective AI Answers',
                'First Access to New Features'
            ],
            color: '#845ef7'
        }
    ];

    return (
        <div style={{
            height: '100vh',
            overflowY: 'auto',
            background: 'linear-gradient(135deg, #0f0f14 0%, #1a1a2e 100%)',
            color: 'white',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '40px 20px'
        }}>
            <button
                onClick={() => navigate('/')}
                style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                    padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '40px', transition: 'background 0.2s'
                }}
            >
                ← Back to Chat
            </button>

            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '3rem', margin: '0 0 15px 0', background: 'linear-gradient(90deg, #bb86fc, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Choose Your Path
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#a0a0b0', maxWidth: '600px', margin: '0 auto' }}>
                    Unlock the full potential of TTR AI with higher limits, multiple document analysis, and smarter answers. Connect deeper with the knowledge you need.
                </p>
                <div style={{ marginTop: '20px', display: 'inline-block', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '10px 20px', borderRadius: '20px', color: '#a78bfa', fontSize: '0.9rem' }}>
                    <strong>Current Plan:</strong> {currentPlan.toUpperCase()}
                </div>
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '30px',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                {plans.map((p) => (
                    <div key={p.id} style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${p.id === currentPlan ? p.color : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '24px',
                        padding: '40px 30px',
                        width: '280px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.3s, box-shadow 0.3s',
                        boxShadow: p.id === currentPlan ? `0 0 20px ${p.color}30` : 'none',
                    }} className="pricing-card">

                        {p.popular && (
                            <div style={{
                                position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                                background: 'linear-gradient(90deg, #f59f00, #fcc419)', color: '#000',
                                padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                                boxShadow: '0 5px 15px rgba(245, 159, 0, 0.4)'
                            }}>
                                MOST POPULAR
                            </div>
                        )}

                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', color: p.color }}>{p.name}</h3>
                        <div style={{ marginBottom: '30px' }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{p.price}</span>
                            <span style={{ color: '#888', fontSize: '1rem' }}>{p.duration}</span>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', flex: 1 }}>
                            {p.features.map((feature, idx) => (
                                <li key={idx} style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#e0e0e0', fontSize: '0.95rem' }}>
                                    <span style={{ color: p.color, fontWeight: 'bold' }}>✓</span>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSubscribe(p.id)}
                            disabled={p.id === currentPlan}
                            style={{
                                width: '100%',
                                padding: '15px',
                                borderRadius: '12px',
                                border: 'none',
                                background: p.id === currentPlan ? 'rgba(255,255,255,0.1)' : `linear-gradient(45deg, ${p.color}, ${p.color}dd)`,
                                color: p.id === currentPlan ? '#888' : '#fff',
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                cursor: p.id === currentPlan ? 'default' : 'pointer',
                                transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => { if (p.id !== currentPlan) e.target.style.opacity = '0.9' }}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                        >
                            {p.id === currentPlan ? 'Current Plan' : 'Select Plan'}
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                .pricing-card:hover {
                    transform: translateY(-10px);
                }
            `}</style>
        </div>
    );
}
