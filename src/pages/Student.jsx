import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';


import { useUser } from '../context/UserContext';

// Cache object outside component to persist across unmounts/remounts (Back button navigation)
const GROUP_CACHE = {
    data: {},
    timestamp: 0
};

export default function Student() {
    const navigate = useNavigate();
    const { userData } = useUser(); // Global context
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [teacherGroups, setTeacherGroups] = useState({});

    const [myGroups, setMyGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [examResults, setExamResults] = useState([]);

    const isNavigating = useRef(false);

    const handleCardClick = (path) => {
        if (isNavigating.current) return;
        isNavigating.current = true;
        navigate(path);
        // Reset after a delay (e.g., if navigation is cancelled or to allow re-clicking later)
        setTimeout(() => { isNavigating.current = false; }, 2000);
    };

    useEffect(() => {
        if (userData) {
            const fetchResults = async () => {
                try {
                    const snap = await getDocs(collection(db, "results"));
                    const list = snap.docs.map(d => d.data());
                    const myName = userData.name ? userData.name.toLowerCase() : '';
                    if (myName) {
                        const myRes = list.filter(r => r.studentName && r.studentName.toLowerCase().includes(myName));
                        setExamResults(myRes);
                    }
                } catch (e) { console.error("Error loading results", e); }
            };
            fetchResults();
        }
    }, [userData]);

    useEffect(() => {
        const fetchRealGroups = async () => {
            // If user hasn't set class yet, we can't show specific groups
            // We fallback to showing 'Public' groups or nothing
            const userClass = userData?.class || userData?.assignedClass;
            const userSection = userData?.section || userData?.assignedSection;

            if (!userClass) return;

            try {
                setLoadingGroups(true);

                // Normalization for robust matching
                const rawCls = userClass;
                const normalizedCls = rawCls.replace(/(\d+)(st|nd|rd|th)/i, '$1');

                const variants = [rawCls];
                if (normalizedCls !== rawCls) variants.push(normalizedCls);

                // Query Groups matching this Class variants
                const q = query(
                    collection(db, "groups"),
                    where("className", "in", variants)
                );

                const snap = await getDocs(q);
                const list = [];
                snap.forEach(d => {
                    const data = d.data();
                    // Optional: Filter by section client-side if needed or add compound index
                    // Show group if:
                    // 1. Group is not section-specific (data.section is null)
                    // 2. Group matches user's section
                    // 3. User has NO section assigned (show all class groups)
                    if (!data.section || data.section === userSection || !userSection) {
                        list.push({ id: d.id, ...data });
                    }
                });
                setMyGroups(list);
            } catch (e) {
                console.error("Error fetching groups:", e);
            } finally {
                setLoadingGroups(false);
            }
        };

        if (userData) {
            fetchRealGroups();
        }
    }, [userData]);

    const handleSelect = (group) => {
        const val = group.groupName;
        setSelectedPerson(val);
        localStorage.setItem("selectedPerson", val);
        setShowDropdown(false);
    };

    const goToGroup = (e, group) => {
        e.stopPropagation();
        localStorage.setItem("activeGroupId", group.id);
        navigate('/group');
    };

    return (
        <div className="page-wrapper">
            <AIBadge />

            <AnnouncementBar title="" leftIcon={false} />

            {userData?.pid && (
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <div style={{
                        background: '#f1f2f6', color: '#2d3436',
                        display: 'inline-block', padding: '4px 10px',
                        borderRadius: '20px', fontSize: '12px',
                        fontWeight: 'bold', border: '1px solid #dfe6e9'
                    }}>
                        ID: {userData.pid}
                    </div>
                </div>
            )}

            <div className="container">
                <div className="dropdown-container">
                    <div className="dropdown-toggle card" onClick={() => setShowDropdown(!showDropdown)}>
                        {selectedPerson || "Select Person 🤠"}
                    </div>
                    {showDropdown && (
                        <div className="dropdown-list card">
                            {myGroups.length === 0 ? <div style={{ padding: '10px', color: '#777' }}>No classes found for {userData?.assignedClass || userData?.class || "your class"}.</div> :
                                myGroups.map((g, i) => {
                                    return (
                                        <div key={i} className="dropdown-item" onClick={() => handleSelect(g)}>
                                            <div className="t-info">
                                                {/* Use a generic avatar or teacher's photo if we stored it */}
                                                <div className="avatar-small" style={{ background: '#6c5ce7', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {g.subject?.[0] || "C"}
                                                </div>
                                                <span>{g.subject} - {g.teacherName || "No Teacher"}</span>
                                            </div>
                                            <button className="group-indicator" onClick={(e) => goToGroup(e, g)} title="Open Class Group"></button>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {selectedPerson && (
                    <div className="card text-center mt-4">
                        <h2>{selectedPerson}</h2>
                        <button className="btn mt-2" onClick={() => handleCardClick('/profileview')}>Proceed</button>
                    </div>
                )}

                {/* AI Learning Tools */}
                <div className="responsive-grid">
                    <div className="card" onClick={() => handleCardClick('/attendance')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #0984e3, #74b9ff)', color: 'white' }}>
                        <h3>📅 Attendance</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>View your attendance record.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/ttr-ai')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white' }}>
                        <h3>🤖 TTR AI Chat</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>Chat with your personal AI assistant.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/4-way-learning')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #fd79a8, #e84393)', color: 'white' }}>
                        <h3>🧠 4-Way Learning</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>Concept, Indian Mythos, Story, & Dialouge.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/video-library')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #00b894, #55efc4)', color: 'white' }}>
                        <h3>🎬 Video Library</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>Watch class recordings & tutorials.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/select-feedback-target')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #00cec9, #81ecec)', color: 'white' }}>
                        <h3>Give Feedback 🌟</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>Rate teachers & staff.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/timetable')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #e17055, #fab1a0)', color: 'white' }}>
                        <h3>🗓️ Timetable</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>View weekly class schedule.</p>
                    </div>
                    <div className="card" onClick={() => handleCardClick('/upid-history')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #636e72, #2d3436)', color: 'white' }}>
                        <h3>🕵️ UPIDs (Private)</h3>
                        <p style={{ fontSize: '13px', margin: '5px 0 0' }}>View your anonymous ID history.</p>
                    </div>
                </div>

                {/* Exam Results Section (New) */}
                <div className="card" style={{ marginTop: '20px' }}>
                    <h3>📝 Recent Exam Results</h3>
                    <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f5f6fa', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Exam</th>
                                    <th style={{ padding: '8px' }}>Subject</th>
                                    <th style={{ padding: '8px' }}>Marks</th>
                                    <th style={{ padding: '8px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examResults.length === 0 ? (
                                    <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#888' }}>No results found for you yet.</td></tr>
                                ) : (
                                    examResults.map((res, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>{res.exam}</td>
                                            <td style={{ padding: '8px' }}>{res.subject}</td>
                                            <td style={{ padding: '8px' }}>{res.marks}/{res.total}</td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{ color: (res.marks / res.total) >= 0.35 ? 'green' : 'red', fontWeight: 'bold' }}>
                                                    {(res.marks / res.total) >= 0.35 ? 'Pass' : 'Fail'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
