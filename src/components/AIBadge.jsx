import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AIBadge() {
    const navigate = useNavigate();
    return (
        <div
            onClick={() => navigate('/ttr-ai')}
            style={{
                position: 'fixed',
                top: '140px',
                right: '20px',
                width: '50px',
                height: '50px',
                backgroundColor: '#6c5ce7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                zIndex: 1000,
                fontSize: '24px',
                transition: 'transform 0.2s',
                animation: 'pulse 2s infinite'
            }}
            title="Chat with TTR AI"
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            ✨
            <style>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(108, 92, 231, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(108, 92, 231, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(108, 92, 231, 0); }
                }
            `}</style>
        </div>
    );
}
