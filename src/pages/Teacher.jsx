import React from 'react';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Teacher() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const handleGoToGroups = () => {
        if (!userData) return;

        // Check if teacher has been allotted a class
        if (!userData.assignedClass || !userData.assignedSection) {
            alert("You have not been assigned to a class yet. Please contact your Institution's Admin to allot you a class.");
            return;
        }

        // Construct Group ID based on standard format: SUBJECT_CLASS_SECTION
        // Ensure Subject is available. If strictly mapped, it should be in userData.
        const subject = (userData.subject || 'General').toUpperCase().replace(/\s+/g, "_");
        const cls = userData.assignedClass.toString().toUpperCase();
        const sec = userData.assignedSection.toString().toUpperCase();

        const groupId = `${subject}_${cls}_${sec}`;

        console.log("Navigating to Group:", groupId);
        localStorage.setItem("activeGroupId", groupId);
        navigate('/group');
    };

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AIBadge />
            <AnnouncementBar title="Teacher Dashboard" />

            <div className="container">
                <div className="card text-center" style={{ marginTop: '20px' }}>
                    <h2>Welcome, {userData?.name || 'Teacher'}!</h2>
                    <p>Access your classes, upload notes, and manage attendance.</p>
                    {userData?.assignedClass ? (
                        <p style={{ color: '#0984e3', fontWeight: 'bold' }}>
                            Assigned Class: {userData.assignedClass} - {userData.assignedSection} ({userData.subject})
                        </p>
                    ) : (
                        <p style={{ color: '#d63031', fontSize: '13px' }}>
                            ⚠️ No class assigned yet.
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={handleGoToGroups}>Go to Groups</button>
                        <button className="btn" style={{ backgroundColor: '#0984e3' }} onClick={() => navigate('/attendance')}>Mark Attendance</button>
                        <button className="btn" style={{ backgroundColor: '#d63031' }} onClick={() => navigate('/video-library')}>Video Library</button>
                        <button className="btn" style={{ backgroundColor: '#00cec9', color: 'white' }} onClick={() => navigate('/select-feedback-target')}>Give Feedback</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
