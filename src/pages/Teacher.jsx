import React, { useState } from 'react';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Teacher() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // Announcement State
    const [showModal, setShowModal] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');

    const handleGoToGroups = () => {
        if (!userData) return;

        // Check if teacher has been allotted a class
        if (!userData.assignedClass || !userData.assignedSection) {
            alert("You have not been assigned to a class yet. Please contact your Institution's Admin to allot you a class.");
            return;
        }

        // Construct Group ID based on standard format: SUBJECT_CLASS_SECTION
        const subject = (userData.subject || 'General').toUpperCase().replace(/\s+/g, "_");
        const cls = userData.assignedClass.toString().toUpperCase();
        const sec = userData.assignedSection.toString().toUpperCase();

        const groupId = `${subject}_${cls}_${sec}`;

        console.log("Navigating to Group:", groupId);
        localStorage.setItem("activeGroupId", groupId);
        navigate('/group');
    };

    const handlePostAnnouncement = async () => {
        if (!announcementText.trim()) return alert("Please enter some text.");
        if (!userData?.assignedClass) return alert("No class assigned to post to.");

        try {
            await addDoc(collection(db, "announcements"), {
                text: announcementText,
                targetClass: userData.assignedClass.toString(),
                targetSection: userData.assignedSection || 'A',
                authorName: userData.name,
                authorId: userData.uid,
                role: 'teacher',
                createdAt: serverTimestamp()
            });
            setAnnouncementText('');
            setShowModal(false);
            alert("Announcement Posted Successfully! 📢");
        } catch (e) {
            console.error("Error posting announcement", e);
            alert("Failed to post announcement.");
        }
    };

    return (
        <div className="page-wrapper">
            <AIBadge />

            {/* Left Top Announcement Button (Opposite to AI Badge) */}
            <button
                onClick={() => setShowModal(true)}
                style={{
                    position: 'fixed', top: '15px', left: '15px', zIndex: 2000,
                    width: '45px', height: '45px', borderRadius: '50%',
                    background: 'white', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer'
                }}
                title="Make Announcement"
            >
                📢
            </button>

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

            {/* Announcement Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                        <h3>📢 Make Announcement</h3>
                        <p style={{ fontSize: '12px', color: '#666' }}>
                            To Class: {userData?.assignedClass}-{userData?.assignedSection}
                        </p>
                        <textarea
                            className="input-field"
                            rows="4"
                            placeholder="Type your announcement here..."
                            value={announcementText}
                            onChange={(e) => setAnnouncementText(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                            <button className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn" onClick={handlePostAnnouncement}>Post</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
