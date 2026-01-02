import React from 'react';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';

export default function Teacher() {
    const navigate = useNavigate();
    return (
        <div className="page-wrapper">
            <AIBadge />
            <AIBadge />
            <AnnouncementBar title="Teacher Dashboard" />

            <div className="container">
                <div className="card text-center" style={{ marginTop: '20px' }}>
                    <h2>Welcome, Teacher!</h2>
                    <p>Access your classes, upload notes, and manage attendance.</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                        <button className="btn" onClick={() => navigate('/group')}>Go to Groups</button>
                        <button className="btn" style={{ backgroundColor: '#0984e3' }} onClick={() => navigate('/attendance')}>Mark Attendance</button>
                        <button className="btn" style={{ backgroundColor: '#d63031' }} onClick={() => navigate('/video-library')}>Video Library</button>
                    </div>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
