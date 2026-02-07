import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import './AnnouncementBar.css';
import { useNavigate } from 'react-router-dom';

export default function AnnouncementBar() {
    const { userData, user } = useUser();
    const [announcement, setAnnouncement] = useState('Welcome to Together To Refine!');
    const navigate = useNavigate();

    useEffect(() => {
        if (!userData) return;

        // Fetch multiple recent announcements to filter client-side
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const announcements = snapshot.docs.map(d => d.data());

                // Find the first relevant announcement
                const relevant = announcements.find(a => {
                    // 1. Global announcements are for everyone (Priority)
                    if (a.type === 'global') return true;

                    // If no user data (e.g. new user just signed up), only show global
                    if (!userData) return false;

                    // Filtering based on Role
                    if (userData.role === 'admin' || userData.email === 'admin@ttr.com') {
                        return false; // Admins don't need to see specific school announcements here usually
                    }

                    // 2. Institution Scoping:
                    // If announcement has an authorId (Institution SCoped), User MUST have matching institutionId
                    if (a.authorId) {
                        if (!userData.institutionId) return false; // User has no institution assigned -> Hide Inst posts
                        if (a.authorId !== userData.institutionId) return false; // IDs don't match -> Hide
                    }

                    if (userData.role === 'student') {
                        // Matches Class AND (Section is 'All' OR Section Matches)
                        const userClass = userData.class?.toString();

                        // New User Safety: If I don't have a class assigned, I can't match specific class announcements
                        // Only allow 'All' if it's GLOBAL (handled above). But here, 'All' usually means 'All classes in this school'
                        if (!userClass) return false;

                        // SCOPING: If it's an institution post, it MUST match my institution
                        if (a.role === 'institution' || a.authorId) {
                            if (a.authorId !== userData.institutionId) return false;
                        }

                        const targetClass = a.targetClass?.toString();

                        if (a.targetClass === 'All' || targetClass === userClass) {
                            if (a.targetSection === 'All' || a.targetSection === userData.section) {
                                return true;
                            }
                        }
                        return false;
                    }

                    if (userData.role === 'teacher') {
                        // Teachers seeing announcements from their institution
                        if (a.role === 'institution' || a.authorId === userData.institutionId) return true;
                        if (a.authorId === userData.uid) return true; // Own posts
                        return false;
                    }

                    if (userData.role === 'institution') {
                        // Institution sees what they posted
                        if (a.authorId === userData.uid) return true;
                        return false;
                    }

                    return false;
                });

                if (relevant) {
                    let text = relevant.text;
                    if (relevant.authorName) text = `${relevant.authorName}: ${text}`;
                    setAnnouncement(text);
                } else {
                    // Fallback to latest GLobal if none found, or default
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
    }, [userData, user]);

    return (
        <div className="announcement-bar" onClick={() => navigate('/announcements')}>
            <div className="scrolling-content">
                <span>📢 {announcement}</span>
            </div>
        </div>
    );
}

// Ensure CSS for scrolling exists
/*
.announcement-bar {
  background: #2c3e50;
  color: white;
  padding: 10px 0;
  overflow: hidden;
  white-space: nowrap;
  position: relative;
  cursor: pointer;
  z-index: 1000;
}

.scrolling-content {
  display: inline-block;
  padding-left: 100%;
  animation: scroll-left 20s linear infinite;
}

@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}

.scrolling-content:hover {
  animation-play-state: paused;
}
*/
