import React from 'react';

const GlobalLoader = () => {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#ffffff'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
            }}></div>

            <h3 style={{ margin: 0, color: '#333' }}>Loading...</h3>
        </div>
    );
};

export default GlobalLoader;
