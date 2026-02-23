import React from 'react';
import logo from '../assets/logo.png';

const GlobalLoader = () => {
    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(160deg, #f0f2ff 0%, #ffffff 100%)',
        }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-ring {
                    0%   { transform: scale(0.95); opacity: 0.7; }
                    50%  { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.7; }
                }
            `}</style>

            {/* Logo */}
            <div style={{
                animation: 'pulse-ring 2s ease-in-out infinite',
                marginBottom: '32px'
            }}>
                <img
                    src={logo}
                    alt="Together To Refine"
                    style={{
                        width: '110px',
                        height: '110px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 8px 24px rgba(108,92,231,0.25))'
                    }}
                />
            </div>

            {/* Spinner ring */}
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '3px solid rgba(108,92,231,0.15)',
                borderTop: '3px solid #6c5ce7',
                animation: 'spin 0.85s linear infinite',
            }} />
        </div>
    );
};

export default GlobalLoader;
