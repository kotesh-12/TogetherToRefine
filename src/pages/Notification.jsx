import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Notification() {
    const navigate = useNavigate();
    const [announcementText, setAnnouncementText] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [loading, setLoading] = useState(false);

    const handlePostAnnouncement = async () => {
        if (!announcementText.trim()) return alert("Please enter some text.");

        setLoading(true);
        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;

            // You might want to fetch the profile to get the institution name, 
            // but for now we'll rely on what we have or generic fallback, 
            // or fetch it here if strictly needed. 
            // For simplicity, using "Institution Admin" if name not readily available in params.
            // (In a real app, I'd pass it via context or fetch it)

            await addDoc(collection(db, "announcements"), {
                text: announcementText,
                targetClass: selectedClass,
                targetSection: selectedSection,
                subject: 'General',
                authorName: 'Institution Admin', // Ideally fetch user profile
                authorId: uid,
                role: 'institution',
                createdAt: serverTimestamp()
            });

            setAnnouncementText('');
            setSelectedClass('All');
            setSelectedSection('All');
            alert("Announcement Posted Successfully! 📢");
            navigate('/institution'); // Optional: redirect back or stay
        } catch (e) {
            console.error("Error posting announcement", e);
            alert("Failed to post announcement.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>⬅ Back</button>
            </div>
            <div className="card" style={{ padding: '30px', borderRadius: '15px' }}>
                <h2 className="text-center" style={{ color: '#2d3436' }}>📢 Post Notification</h2>
                <p className="text-center text-muted">Create an announcement for students and teachers.</p>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>Class</label>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="All">All Classes</option>
                            <option value="Nursery">Nursery</option>
                            <option value="LKG">LKG</option>
                            <option value="UKG">UKG</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => <option key={c} value={c.toString()}>Class {c}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>Section</label>
                        <select
                            className="input-field"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                        >
                            <option value="All">All Sections</option>
                            <option value="A">Section A</option>
                            <option value="B">Section B</option>
                            <option value="C">Section C</option>
                            <option value="D">Section D</option>
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>Message</label>
                    <textarea
                        className="input-field"
                        rows="6"
                        placeholder="Type your announcement here..."
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <button
                    className="btn"
                    onClick={handlePostAnnouncement}
                    disabled={loading}
                    style={{ width: '100%', backgroundColor: '#6c5ce7', height: '45px', fontSize: '16px' }}
                >
                    {loading ? 'Posting...' : 'Post Announcement'}
                </button>
            </div>
        </div>
    );
}
