import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

// ─── HERO DATA ────────────────────────────────────────────────────────────────
export const GURUKUL_HEROES = [
    {
        id: 'arjuna',
        name: 'Arjuna',
        emoji: '🏹',
        title: 'The Focused Warrior',
        color: '#FF6B35',
        gradient: 'linear-gradient(135deg, #FF6B35, #F7931E)',
        shadow: 'rgba(255, 107, 53, 0.4)',
        trait: 'Laser Focus & Mastery',
        description: 'Arjuna could hit a target reflected in water — eyes only for the goal. You will master one topic completely before moving to the next.',
        aiStyle: 'My TTR AI will challenge you like Dronacharya — never satisfied until your answer is perfect.',
        qualities: ['📍 Deep Focus', '🎯 Mastery over shortcuts', '🧘 Discipline above distraction'],
        quote: '"I see only the eye of the bird." — Arjuna'
    },
    {
        id: 'ekalavya',
        name: 'Ekalavya',
        emoji: '🙏',
        title: 'The Self-Made Scholar',
        color: '#6C63FF',
        gradient: 'linear-gradient(135deg, #6C63FF, #3F3D56)',
        shadow: 'rgba(108, 99, 255, 0.4)',
        trait: 'Self-Learning & Devotion',
        description: 'Ekalavya became a master without a physical Guru — only pure devotion. You are proof that where there is will, there is a way.',
        aiStyle: 'My TTR AI will be your clay Dronacharya — always present, guiding you when no physical teacher is there.',
        qualities: ['🔥 Learning without excuses', '💪 No dependency on others', '🌱 Growing in silence'],
        quote: '"A student who wants to learn will always find a way." — Ekalavya\'s story'
    },
    {
        id: 'krishna',
        name: 'Krishna',
        emoji: '🪈',
        title: 'The Strategic Thinker',
        color: '#00B4D8',
        gradient: 'linear-gradient(135deg, #00B4D8, #0077B6)',
        shadow: 'rgba(0, 180, 216, 0.4)',
        trait: 'Wisdom & Emotional Intelligence',
        description: 'Krishna never fought a single battle with weapons — he won through strategy and wisdom. You will learn to outthink problems, not brute-force them.',
        aiStyle: 'My TTR AI will think with you like Krishna on the battlefield — giving you the strategy, not just the answer.',
        qualities: ['🧠 Think before you act', '♟️ Strategy over strength', '❤️ Emotional Intelligence'],
        quote: '"You have the right to perform your actions, not to the fruits." — Bhagavad Gita'
    },
    {
        id: 'rama',
        name: 'Rama',
        emoji: '⚡',
        title: 'The Dharma Keeper',
        color: '#52B788',
        gradient: 'linear-gradient(135deg, #52B788, #1B4332)',
        shadow: 'rgba(82, 183, 136, 0.4)',
        trait: 'Righteousness & Duty',
        description: 'Rama chose duty over personal comfort every single time. Whatever the cost. You will always do the right thing — even when it\'s hard.',
        aiStyle: 'My TTR AI will always remind you of the ethical choice — because Dharma is the highest intelligence.',
        qualities: ['⚖️ Integrity above all', '🫡 Duty over desire', '🌟 Ideal in conduct'],
        quote: '"Dharmo rakshati rakshitah — Dharma protects those who protect Dharma."'
    },
    {
        id: 'karna',
        name: 'Karna',
        emoji: '☀️',
        title: 'The Resilient Fighter',
        color: '#F4A261',
        gradient: 'linear-gradient(135deg, #F4A261, #E76F51)',
        shadow: 'rgba(244, 162, 97, 0.4)',
        trait: 'Resilience & Generosity',
        description: 'Karna was rejected, insulted, and disadvantaged — yet he never stopped giving, never stopped fighting. Your circumstances do not define your destiny.',
        aiStyle: 'My TTR AI will never judge your starting point — only your direction. Like the sun, rise every day regardless.',
        qualities: ['🌅 Rise despite setbacks', '🤝 Generosity of spirit', '💎 Character under pressure'],
        quote: '"I was born in the dark, but I chose to live in the light." — Karna'
    },
    {
        id: 'dharmaraj',
        name: 'Dharmaraj',
        emoji: '⚖️',
        title: 'The Truth Seeker',
        color: '#9B5DE5',
        gradient: 'linear-gradient(135deg, #9B5DE5, #F15BB5)',
        shadow: 'rgba(155, 93, 229, 0.4)',
        trait: 'Truth & Justice Always',
        description: 'Yudhishthira never lied — not even to save his life. In a world full of half-truths, you will be someone who can be completely trusted.',
        aiStyle: 'My TTR AI will always present the full truth — multiple perspectives, no bias — just like Dharmaraj himself.',
        qualities: ['📢 Truth even when it hurts', '⚖️ Justice over victory', '🔮 Integrity under pressure'],
        quote: '"Satya (Truth) is the highest Dharma." — Yudhishthira'
    }
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function GurukullPathSelector({ onClose, onSelect }) {
    const { user: authUser } = useUser();
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState('choose'); // 'choose' | 'confirm'

    const handleConfirm = async () => {
        if (!selected || !authUser) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', authUser.uid), {
                gurukul_path: selected.id
            });
            onSelect(selected);
        } catch (e) {
            console.error('Failed to save Gurukul path:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.4s ease'
        }}>
            <div style={{
                background: 'linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '32px 24px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
                position: 'relative'
            }}>
                {/* Close button */}
                {onClose && (
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'rgba(255,255,255,0.08)', border: 'none',
                        borderRadius: '50%', width: '36px', height: '36px',
                        color: '#fff', cursor: 'pointer', fontSize: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>✕</button>
                )}

                {step === 'choose' && (
                    <>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏛️</div>
                            <h2 style={{
                                color: '#fff', fontSize: '22px', fontWeight: '900',
                                margin: '0 0 8px', letterSpacing: '-0.5px'
                            }}>Choose Your Gurukul Path</h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
                                Ancient heroes. Modern learning. Who will you become?
                            </p>
                        </div>

                        {/* Hero Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '12px',
                            marginBottom: '24px'
                        }}>
                            {GURUKUL_HEROES.map(hero => (
                                <div
                                    key={hero.id}
                                    onClick={() => setSelected(hero)}
                                    style={{
                                        background: selected?.id === hero.id
                                            ? hero.gradient
                                            : 'rgba(255,255,255,0.04)',
                                        border: selected?.id === hero.id
                                            ? `2px solid ${hero.color}`
                                            : '2px solid rgba(255,255,255,0.07)',
                                        borderRadius: '16px',
                                        padding: '18px 14px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.25s ease',
                                        boxShadow: selected?.id === hero.id
                                            ? `0 8px 30px ${hero.shadow}`
                                            : 'none',
                                        transform: selected?.id === hero.id ? 'translateY(-3px)' : 'none'
                                    }}
                                >
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>{hero.emoji}</div>
                                    <div style={{
                                        color: '#fff', fontWeight: '800', fontSize: '15px', marginBottom: '4px'
                                    }}>{hero.name}</div>
                                    <div style={{
                                        color: 'rgba(255,255,255,0.7)', fontSize: '10px',
                                        fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}>{hero.trait}</div>
                                </div>
                            ))}
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => selected && setStep('confirm')}
                            disabled={!selected}
                            style={{
                                width: '100%', padding: '16px',
                                background: selected ? selected.gradient : 'rgba(255,255,255,0.1)',
                                border: 'none', borderRadius: '14px',
                                color: '#fff', fontWeight: '800', fontSize: '15px',
                                cursor: selected ? 'pointer' : 'default',
                                opacity: selected ? 1 : 0.5,
                                transition: 'all 0.3s ease',
                                boxShadow: selected ? `0 8px 25px ${selected?.shadow}` : 'none'
                            }}
                        >
                            {selected ? `Become ${selected.name} →` : 'Select Your Path First'}
                        </button>
                    </>
                )}

                {step === 'confirm' && selected && (
                    <>
                        {/* Hero Detail View */}
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px', height: '80px', borderRadius: '50%',
                                background: selected.gradient,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '40px', margin: '0 auto 16px',
                                boxShadow: `0 12px 35px ${selected.shadow}`
                            }}>{selected.emoji}</div>
                            <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '900', margin: '0 0 4px' }}>
                                The {selected.title}
                            </h2>
                            <div style={{
                                display: 'inline-block',
                                background: selected.gradient,
                                color: '#fff', fontWeight: '700',
                                fontSize: '11px', padding: '4px 12px',
                                borderRadius: '20px', marginBottom: '16px',
                                textTransform: 'uppercase', letterSpacing: '1px'
                            }}>{selected.trait}</div>
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>
                                {selected.description}
                            </p>
                        </div>

                        {/* Qualities */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: '14px', padding: '16px',
                            marginBottom: '16px'
                        }}>
                            <p style={{
                                color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700',
                                textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px'
                            }}>
                                Your Core Qualities
                            </p>
                            {selected.qualities.map((q, i) => (
                                <div key={i} style={{
                                    color: '#fff', fontSize: '13px', padding: '6px 0',
                                    borderBottom: i < selected.qualities.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none'
                                }}>{q}</div>
                            ))}
                        </div>

                        {/* AI Style */}
                        <div style={{
                            background: `linear-gradient(135deg, ${selected.color}22, ${selected.color}11)`,
                            border: `1px solid ${selected.color}44`,
                            borderRadius: '14px', padding: '14px',
                            marginBottom: '20px'
                        }}>
                            <p style={{
                                color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700',
                                textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px'
                            }}>
                                🤖 Your AI Will Teach You Like...
                            </p>
                            <p style={{ color: '#fff', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                                {selected.aiStyle}
                            </p>
                        </div>

                        {/* Quote */}
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <p style={{
                                color: 'rgba(255,255,255,0.4)', fontSize: '12px',
                                fontStyle: 'italic', margin: 0
                            }}>{selected.quote}</p>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setStep('choose')}
                                style={{
                                    flex: 1, padding: '14px',
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px', color: '#fff',
                                    fontWeight: '700', cursor: 'pointer', fontSize: '14px'
                                }}
                            >← Go Back</button>
                            <button
                                onClick={handleConfirm}
                                disabled={saving}
                                style={{
                                    flex: 2, padding: '14px',
                                    background: selected.gradient,
                                    border: 'none', borderRadius: '12px',
                                    color: '#fff', fontWeight: '900',
                                    cursor: saving ? 'default' : 'pointer',
                                    fontSize: '15px',
                                    boxShadow: `0 8px 25px ${selected.shadow}`,
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                {saving ? '⏳ Saving...' : `✅ I am ${selected.name}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
