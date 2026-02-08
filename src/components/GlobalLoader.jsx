import React, { useEffect, useState } from 'react';

const GlobalLoader = () => {
    const [showReset, setShowReset] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowReset(true);
        }, 5000); // 5 seconds timeout before showing reset
        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div className="spinner" style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
            }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

            <h3>Loading Application...</h3>

            {showReset && (
                <div className="fade-in" style={{ marginTop: '20px', textAlign: 'center' }}>
                    <p style={{ color: '#666', marginBottom: '10px' }}>Taking longer than expected?</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#0984e3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Reload Page
                    </button>

                    <div style={{ marginTop: '15px' }}>
                        <button
                            onClick={() => {
                                sessionStorage.clear();
                                localStorage.clear();
                                window.location.reload();
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#d63031',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Clear Cache & Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalLoader;
