import React, { useState, useRef, useEffect } from 'react';

/**
 * FocusSoundscape: Uses Web Audio API to generate low-frequency 
 * binaural beats for psychological focus entrainment.
 */
export const FocusSoundscape = () => {
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('Zen'); // Zen, Focus, Deep
    const audioContext = useRef(null);
    const oscillators = useRef([]);

    const toggleSound = () => {
        if (!isActive) {
            // Start Audio
            if (!audioContext.current) {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'balanced'
                });
            }

            const ctx = audioContext.current;
            const merger = ctx.createChannelMerger(2);
            merger.connect(ctx.destination);

            let freqL = 432;
            let freqR = 437; // 5Hz Theta wave gap for Zen

            if (mode === 'Focus') {
                freqL = 300;
                freqR = 310; // 10Hz Alpha wave for Focus 
            } else if (mode === 'Deep') {
                freqL = 200;
                freqR = 240; // 40Hz Gamma wave for Intense Problem Solving
            }

            // Left Ear
            const oscL = ctx.createOscillator();
            const gainL = ctx.createGain();
            oscL.frequency.value = freqL;
            gainL.gain.value = 0.04; 
            oscL.connect(gainL);
            gainL.connect(merger, 0, 0);

            // Right Ear
            const oscR = ctx.createOscillator();
            const gainR = ctx.createGain();
            oscR.frequency.value = freqR;
            gainR.gain.value = 0.04;
            oscR.connect(gainR);
            gainR.connect(merger, 0, 1);

            oscL.start();
            oscR.start();
            oscillators.current = [oscL, oscR, gainL, gainR];
            setIsActive(true);
        } else {
            // Stop Audio
            oscillators.current.forEach(node => node.stop?.());
            oscillators.current = [];
            setIsActive(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            // Hot swap frequency if mode changes while playing
            closeAudio();
            toggleSound();
        }
    }, [mode]);

    const closeAudio = () => {
        oscillators.current.forEach(node => node.stop?.());
        oscillators.current = [];
        setIsActive(false);
    };

    useEffect(() => {
        return () => closeAudio();
    }, []);

    return (
        <div style={{ display: 'flex', gap: '5px' }}>
            <button
                onClick={toggleSound}
                style={{
                    background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    color: isActive ? '#10b981' : '#94a3b8',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.3s ease',
                    fontWeight: 'bold'
                }}
            >
                {isActive ? '⏸' : '🎧'} {mode} {isActive ? 'On' : ''}
            </button>
            
            {isActive && (
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
                    {['Zen', 'Focus', 'Deep'].map(m => (
                        <button 
                            key={m}
                            onClick={() => setMode(m)}
                            style={{
                                background: mode === m ? 'var(--accent)' : 'transparent',
                                border: 'none',
                                color: mode === m ? 'white' : '#64748b',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '10px'
                            }}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

