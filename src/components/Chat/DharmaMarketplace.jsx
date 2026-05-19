import React, { useState } from 'react';

export const DharmaMarketplace = ({ isOpen, onClose, dharmaXP, setDharmaXP }) => {
    if (!isOpen) return null;

    const buyItem = (cost, itemName) => {
        if (dharmaXP >= cost) {
            setDharmaXP((prev) => prev - cost);
            alert(`🎉 Successfully purchased ${itemName}!`);
        } else {
            alert(`❌ Not enough Dharma XP! You need ${cost} points.`);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'var(--bg-card)', padding: '20px', borderRadius: '16px',
                width: '90%', maxWidth: '600px', border: '1px solid var(--accent)',
                boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)', color: 'var(--text-primary)',
                maxHeight: '80vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#ffd700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        ✨ Dharma Marketplace
                    </h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ 
                    padding: '15px', background: 'rgba(255, 215, 0, 0.1)', 
                    borderRadius: '12px', border: '1px dashed #ffd700', marginBottom: '20px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '14px', color: '#ccc' }}>Your Balance</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffd700' }}>{dharmaXP} XP</div>
                </div>

                <h3>Available Upgrades</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* Item 1 */}
                    <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>🚀 24-Hour Tier Bypass</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Remove all hourly AI usage limits for 24 hours.</div>
                        </div>
                        <button onClick={() => buyItem(500, "24-Hour Tier Bypass")} style={{ 
                            padding: '8px 16px', background: '#ffd700', color: '#000', 
                            border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
                        }}>
                            500 XP
                        </button>
                    </div>

                    {/* Item 2 */}
                    <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>🧠 Einstein Mode (Persona)</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Permanently unlock the theoretical physics genius persona.</div>
                        </div>
                        <button onClick={() => buyItem(1200, "Einstein Mode")} style={{ 
                            padding: '8px 16px', background: '#ffd700', color: '#000', 
                            border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
                        }}>
                            1200 XP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
