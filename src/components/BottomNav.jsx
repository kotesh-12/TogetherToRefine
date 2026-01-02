import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BottomNav() {
    const navigate = useNavigate();

    // Style for the container
    const navStyle = {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '30px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        padding: '10px 20px',
        display: 'flex',
        gap: '20px',
        zIndex: 1000,
        border: '1px solid rgba(255, 255, 255, 0.5)'
    };

    // Style for individual items
    const itemStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        color: '#2d3436',
        minWidth: '60px',
        transition: 'transform 0.2s',
        fontSize: '12px',
        fontWeight: '600'
    };

    return (
        <div style={navStyle}>
            <div style={itemStyle} onClick={() => navigate('/health')} title="Health Report">
                <span style={{ fontSize: '24px' }}>🏥</span>
                <span>Health</span>
            </div>

            <div style={itemStyle} onClick={() => navigate('/exam')} title="Exams & Opportunities">
                <span style={{ fontSize: '24px' }}>📢</span>
                <span>Exams</span>
            </div>

            {/* Attendance logic for students usually means seeing own attendance. 
                Reusing the main page for now, if institution page has logic to show 'My Stats' 
                User asked for redirect to respective page. */}
            <div style={itemStyle} onClick={() => navigate('/attendance')} title="My Attendance">
                <span style={{ fontSize: '24px' }}>📅</span>
                <span>Attend.</span>
            </div>

            <div style={itemStyle} onClick={() => navigate('/general-feedback')} title="Give Feedback">
                <span style={{ fontSize: '24px' }}>📝</span>
                <span>Feedback</span>
            </div>
        </div>
    );
}
