
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import './AnnouncementBar.css';
import { useNavigate } from 'react-router-dom';

export default function AnnouncementBar() {
    const { userData } = useUser();
    const [scrollingText, setScrollingText] = useState('Welcome to Together To Refine!');
    const navigate = useNavigate();

    useEffect(() => {
        if (!userData) return;

        // Fetch multiple recent announcements to filter client-side
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const announcements = snapshot.docs.map(d => d.data());

                // Filter for ALL relevant announcements
                const relevantList = announcements.filter(a => {
                    if (a.type === 'global') return true;
                    if (!userData) return false;

                    if (userData.role === 'admin' || userData.email === 'admin@ttr.com') return false;

                    if (a.authorId && a.authorId !== userData.institutionId) return false;

                    if (userData.role === 'student') {
                        const userClass = userData.class?.toString();
                        if (!userClass) return false;
                        const targetClass = a.targetClass?.toString();
                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) return true;
                        }
                        return false;
                    }

                    if (userData.role === 'teacher') {
                        if (a.role === 'institution' || a.authorId === userData.institutionId) return true;
                        return false;
                    }

                    if (userData.role === 'institution') {
                        if (a.authorId === userData.uid) return true;
                        return false;
                    }

                    return false;
                });

                if (relevantList.length > 0) {
                    // Join them for a continuous scrolling effect
                    const joinedText = relevantList.map(a => {
                        let text = a.text;
                        if (a.authorName) text = `${a.authorName}: ${text}`;
                        return `📢 ${text}`;
                    }).join(' \u00A0\u00A0\u00A0\u00A0 | \u00A0\u00A0\u00A0\u00A0 ');

                    setScrollingText(joinedText);
                } else {
                    const latestGlobal = announcements.find(a => a.type === 'global');
                    if (latestGlobal) {
                        let text = latestGlobal.text;
                        if (latestGlobal.authorName) text = `${latestGlobal.authorName}: ${text}`;
                        setScrollingText(`📢 ${text}`);
                    } else {
                        setScrollingText('Welcome to Together To Refine!');
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
                    <span>{scrollingText}</span>
                </div>
            </div>
        </div>
    );
}
