
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
        if (!userData) return;

        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const announcements = snapshot.docs.map(d => d.data());

                const relevant = announcements.find(a => {
                    if (a.type === 'global') return true;
                    if (!userData) return false;

                    const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
                    if (a.authorId && a.authorId !== instId) return false;

                    if (userData.role === 'student') {
                        const userClass = normalizeClass(userData.class);
                        const targetClass = normalizeClass(a.targetClass);
                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) return true;
                        }
                        return false;
                    }
                    if (userData.role === 'teacher') return true;
                    if (userData.role === 'institution') return true;
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
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [userData]);

    return (
        <div className="ttr-announcement-wrapper">
            <div className="announcement-bar" onClick={() => navigate('/announcements')}>
                <div className="ticker-wrapper">
                    <div className="ticker-item">📢 {announcement}</div>
                </div>
            </div>
        </div>
    );
}
