import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AIBadge from '../components/AIBadge';

export default function Announcements() {
    const { userData } = useUser();
    const navigate = useNavigate();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    const normalizeClass = (c) => {
        if (!c) return '';
        let s = String(c).trim().toLowerCase();
        s = s.replace(/(st|nd|rd|th)$/, '');
        if (s === '1') return '1st';
        if (s === '2') return '2nd';
        if (s === '3') return '3rd';
        const num = parseInt(s);
        if (!isNaN(num) && num >= 4 && num <= 12) return num + 'th';
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    useEffect(() => {
        const fetchAnnouncements = async () => {
            if (!userData) return;
            try {
                // Fetch last 50 announcements
                const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(50));
                const snapshot = await getDocs(q);
                const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                // Client-side filtering (same logic as AnnouncementBar)
                const relevant = all.filter(a => {
                    if (a.type === 'global') return true;
                    // If author is same as my institution (for students/teachers)
                    const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;

                    // If matches institution
                    if (a.authorId && a.authorId !== instId && a.role === 'institution') return false;

                    // Role Specific
                    if (userData.role === 'student') {
                        const userClass = normalizeClass(userData.class);
                        const targetClass = normalizeClass(a.targetClass);
                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) return true;
                        }
                        return false;
                    }
                    if (userData.role === 'teacher') return true; // Teachers see all for their school
                    if (userData.role === 'institution') return true; // Institutions see all
                    return false;
                });

                setAnnouncements(relevant);
            } catch (e) {
                console.error("Error fetching announcements:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAnnouncements();
    }, [userData]);

    return (
        <div className="page-wrapper">
            <AIBadge />
            <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                    <button onClick={() => navigate(-1)} className="btn-back-marker" style={{ marginRight: '15px' }}>Back</button>
                    <h2 style={{ margin: 0 }}>📢 Announcements</h2>
                </div>

                {loading ? (
                    <p className="text-center">Loading updates...</p>
                ) : announcements.length === 0 ? (
                    <div className="card text-center" style={{ padding: '40px', color: '#888' }}>
                        <p>No new announcements.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {announcements.map(ann => (
                            <div key={ann.id} className="card" style={{ padding: '20px', borderLeft: '5px solid #6c5ce7', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: 0, color: '#2d3436' }}>
                                        {ann.authorName || 'Institution'}
                                        <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#636e72', marginLeft: '10px', background: '#dfe6e9', padding: '2px 8px', borderRadius: '10px' }}>
                                            {ann.subject || 'General'}
                                        </span>
                                    </h4>
                                    <span style={{ fontSize: '12px', color: '#b2bec3' }}>
                                        {ann.createdAt?.seconds ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', color: '#2d3436' }}>
                                    {ann.text}
                                </p>
                                <div style={{ fontSize: '12px', color: '#a29bfe', textAlign: 'right' }}>
                                    Target: {ann.targetClass || 'All'} - {ann.targetSection || 'All'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
