
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import './AnnouncementBar.css';
import { useNavigate } from 'react-router-dom';

export default function AnnouncementBar() {
    const { userData } = useUser();
    const [announcement, setAnnouncement] = useState('Welcome to Together To Refine!');
    const navigate = useNavigate();

    // Helper to normalize class names for matching (e.g. "1" -> "1st")
    const normalizeClass = (c) => {
        if (!c) return '';
        const s = String(c).trim();
        if (s === '1') return '1st';
        if (s === '2') return '2nd';
        if (s === '3') return '3rd';
        if (s >= '4' && s <= '10') return s + 'th';
        return s;
    };

    useEffect(() => {
        if (!userData) return;

        // Fetch multiple recent announcements to filter client-side
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const announcements = snapshot.docs.map(d => d.data());

                const relevant = announcements.find(a => {
                    if (a.type === 'global') return true;
                    if (!userData) return false;

                    // Role-based filtering
                    if (userData.role === 'admin' || userData.email === 'admin@ttr.com') return false;

                    // Institution scoping
                    const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
                    if (a.authorId && a.authorId !== instId) return false;

                    if (userData.role === 'student') {
                        const userClass = normalizeClass(userData.class);
                        if (!userClass) return false;

                        const targetClass = normalizeClass(a.targetClass);
                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) return true;
                        }
                        return false;
                    }

                    if (userData.role === 'teacher') {
                        // Teachers see what their institution posts
                        return true;
                    }

                    if (userData.role === 'institution') {
                        // Institutions see what they themselves post
                        return true;
                    }

                    return false;
                });

                if (relevant) {
                    let text = relevant.text;
                    if (relevant.authorName) text = `${relevant.authorName}: ${text}`;
                    setAnnouncement(text);
                } else {
                    const latestGlobal = announcements.find(a => a.type === 'global');
                    if (latestGlobal) {
                        let text = latestGlobal.text;
                        if (latestGlobal.authorName) text = `${latestGlobal.authorName}: ${text}`;
                        setAnnouncement(text);
                    } else {
                        setAnnouncement('Welcome to Together To Refine!');
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [userData]);

    return (
        <div className="ttr-announcement-wrapper">
            <div className="announcement-bar" onClick={() => navigate('/announcements')}>
                <div className="scrolling-text">
                    <span>📢 {announcement} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 📢 {announcement}</span>
                </div>
            </div>
        </div>
    );
}
