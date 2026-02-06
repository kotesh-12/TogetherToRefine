import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        // Timeline of animation
        // 0ms: Start (Middle T visible)
        // 500ms: T and R start moving out
        // 1500ms: TTR fully placed
        // 1500ms: Tagline starts entering
        // 2500ms: Animation Complete

        const timer1 = setTimeout(() => setStep(1), 500); // Start spreading
        const timer2 = setTimeout(() => setStep(2), 1500); // Tagline enters

        // Optional: If we want to guarantee the splash shows for a min time
        // The parent (UserContext) controls removal, but we can animate nicely.

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#ffffff', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{ position: 'relative', height: '100px', width: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

                {/* Left T */}
                <h1 style={{
                    position: 'absolute',
                    fontSize: '80px', margin: 0, color: '#1a73e8',
                    opacity: step >= 1 ? 1 : 0,
                    transform: step >= 1 ? 'translateX(-60px)' : 'translateX(0)',
                    transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>T</h1>

                {/* Middle T (Anchor) */}
                <h1 style={{
                    position: 'absolute',
                    fontSize: '80px', margin: 0, color: '#1a73e8',
                    zIndex: 2
                }}>T</h1>

                {/* Right R */}
                <h1 style={{
                    position: 'absolute',
                    fontSize: '80px', margin: 0, color: '#1a73e8',
                    opacity: step >= 1 ? 1 : 0,
                    transform: step >= 1 ? 'translateX(60px)' : 'translateX(0)',
                    transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>R</h1>

            </div>

            {/* Tagline */}
            <div style={{
                overflow: 'hidden', height: '40px', marginTop: '10px',
                display: 'flex', alignItems: 'center'
            }}>
                <p style={{
                    fontSize: '18px', color: '#5f6368', letterSpacing: '2px', textTransform: 'uppercase',
                    transform: step >= 2 ? 'translateX(0)' : 'translateX(100%)',
                    opacity: step >= 2 ? 1 : 0,
                    transition: 'all 0.8s ease-out'
                }}>
                    for a right future
                </p>
            </div>
        </div>
    );
}
