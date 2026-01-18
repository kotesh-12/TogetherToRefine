import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', background: '#f1f2f6'
        }}>
            <div style={{ fontSize: '60px' }}>🚫</div>
            <h1 style={{ color: '#d63031', marginBottom: '10px' }}>Access Denied</h1>
            <p style={{ color: '#636e72', marginBottom: '30px' }}>
                You do not have permission to view this page.
            </p>
            <button
                className="btn"
                onClick={() => navigate('/')}
                style={{ padding: '10px 20px', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
                Go Home
            </button>
        </div>
    );
}
