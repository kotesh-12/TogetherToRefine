import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AIBadge from '../components/AIBadge';
import FeatureTour from '../components/FeatureTour';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import GurukullPathSelector, { GURUKUL_HEROES } from '../components/GurukullPathSelector';

// Cache object outside component to persist across unmounts/remounts (Back button navigation)
const GROUP_CACHE = {
    data: {},
    timestamp: 0
};

export default function Student() {
    const navigate = useNavigate();
    const { userData } = useUser(); // Global context
    const { t } = useLanguage();
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // ── Gurukul Path ──
    const [showGurukul, setShowGurukul] = useState(false);
    const gurukulPath = userData?.gurukul_path
        ? GURUKUL_HEROES.find(h => h.id === userData.gurukul_path)
        : null;

    const [myGroups, setMyGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [examResults, setExamResults] = useState([]);

    const isNavigating = useRef(false);

    // Feature Tour Steps
    const tourSteps = [
        {
            target: 'tour-card-ai',
            title: '🤖 Your AI Teacher',
            content: 'Meet your personal AI tutor! Ask doubts, get explanations, and practice concepts anytime, 24/7.'
        },
        {
            target: 'tour-card-attendance',
            title: '📅 Track Attendance',
            content: 'Check your daily attendance records here. Stay consistent to maintain your streak!'
        },
        {
            target: 'tour-card-4way',
            title: '🧠 4-Way Learning',
            content: 'Explore topics through 4 lenses: Conceptual, Mythological, Story-based, and Dialogue-based learning.'
        },
        {
            target: 'tour-card-video',
            title: '🎬 Video Library',
            content: 'Missed a class? Watch recorded sessions and curated educational videos here.'
        },
        {
            target: 'tour-exam-results',
            title: '📝 Exam Results',
            content: 'View your performance in recent exams and track your academic progress.'
        }
    ];

    const handleCardClick = (path, state = null) => {
        if (isNavigating.current) return;
        isNavigating.current = true;
        navigate(path, { state });
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
                const rawCls = userClass.toString().toLocaleLowerCase().trim();
                const baseVal = rawCls.replace(/[^0-9]/g, '');

                const variants = new Set([rawCls, baseVal]);
                if (baseVal) {
                    variants.add(`${baseVal}th`);
                    variants.add(`${baseVal}st`);
                    variants.add(`${baseVal}nd`);
                    variants.add(`${baseVal}rd`);
                    variants.add(parseInt(baseVal));
                    variants.add(`class ${baseVal}`);
                    variants.add(`class ${baseVal}th`);
                }
                const uniqueVariants = Array.from(variants).filter(v => v !== '');

                const instId = userData.institutionId;
                let rawGroups = [];

                if (instId) {
                    // Strategy: Query by Institution (Satisfies Security Rules)
                    const q1 = query(collection(db, "groups"), where("institutionId", "==", instId));
                    const q2 = query(collection(db, "groups"), where("createdBy", "==", instId));

                    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                    const merged = new Map();
                    snap1.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
                    snap2.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
                    rawGroups = Array.from(merged.values());
                } else {
                    // Fallback to class query if profile is incomplete
                    const qFallback = query(collection(db, "groups"), where("className", "in", uniqueVariants.slice(0, 10)));
                    const snapFallback = await getDocs(qFallback);
                    snapFallback.forEach(d => rawGroups.push({ id: d.id, ...d.data() }));
                }

                const list = [];
                rawGroups.forEach(data => {
                    // 1. CLASS MATCHING (Memory-based, very flexible)
                    const gCls = (data.className || '').toString().toLocaleLowerCase().trim();
                    const gBase = gCls.replace(/[^0-9]/g, '');

                    const classMatches = uniqueVariants.some(v => v.toString().toLocaleLowerCase() === gCls) ||
                        (baseVal && baseVal === gBase);

                    if (!classMatches) return;

                    // 2. SECTION MATCHING
                    const gSec = (data.section || 'All').toString().toUpperCase();
                    const uSec = (userSection || 'All').toString().toUpperCase();

                    if (!userSection || gSec === 'ALL' || gSec === uSec) {
                        list.push(data);
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
        setSelectedGroup(group);
        localStorage.setItem("selectedPerson", val);
        setShowDropdown(false);
    };

    const goToGroup = (e, group) => {
        e.stopPropagation();
        localStorage.setItem("activeGroupId", group.id);
        navigate('/group');
    };

    return (
        <div className="page-wrapper" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <FeatureTour tourId="student_dashboard_v1" steps={tourSteps} userData={userData} />
            <AIBadge />

            {/* Gurukul Path Selector Modal */}
            {showGurukul && (
                <GurukullPathSelector
                    onClose={() => setShowGurukul(false)}
                    onSelect={() => setShowGurukul(false)}
                />
            )}

            {/* Clean Dashboard Greeting */}
            <div className="dash-greeting-bar">
                <div className="dash-greeting-left">
                    <div
                        className="dash-avatar"
                        style={gurukulPath ? { background: gurukulPath.gradient, boxShadow: `0 4px 15px ${gurukulPath.shadow}` } : {}}
                    >
                        {gurukulPath ? gurukulPath.emoji : (userData?.name?.charAt(0).toUpperCase() || 'S')}
                    </div>
                    <div>
                        <p className="dash-welcome-label">{t('student_welcome') || 'Welcome back'}</p>
                        <h1 className="dash-name">{userData?.name || 'Student'}</h1>

                        {gurukulPath && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '4px 10px', borderRadius: '12px', marginTop: '4px',
                                fontSize: '10px', fontWeight: '700',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                                color: gurukulPath.color
                            }}>
                                {gurukulPath.emoji} {gurukulPath.title}
                            </div>
                        )}
                    </div>
                </div>
                <div className="dash-greeting-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <span className="dash-role-pill">📚 {userData?.class || 'Class'} | {userData?.section || 'Sec'}</span>

                    <div
                        onClick={() => setShowGurukul(true)}
                        title="Change Learning Path"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: gurukulPath ? gurukulPath.gradient : 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: '#fff', padding: '6px 12px', borderRadius: '20px',
                            fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                            boxShadow: gurukulPath ? `0 3px 12px ${gurukulPath.shadow}` : 'none'
                        }}
                    >
                        {gurukulPath ? `${gurukulPath.emoji} Path` : '🏛️ Choose Path'}
                    </div>
                </div>
            </div>

            <div className="container">
                {/* Person Selection Dropdown Refined */}
                <div className="dropdown-container" style={{ marginBottom: '24px' }}>
                    <div className="dropdown-toggle card" style={{ borderRadius: '15px', border: '1px solid var(--divider)' }} onClick={() => setShowDropdown(!showDropdown)}>
                        {selectedPerson || t('select_person')}
                    </div>
                    {showDropdown && (
                        <div className="dropdown-list card fade-in">
                            {myGroups.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No classes found.</div> :
                                myGroups.map((g, i) => (
                                    <div key={i} className="dropdown-item" onClick={() => handleSelect(g)}>
                                        <div className="t-info">
                                            <div className="profile-avatar-mini" style={{ background: 'var(--primary)', color: 'white' }}>
                                                {g.subject?.[0] || "C"}
                                            </div>
                                            <span>{g.subject} - {g.teacherName || "No Teacher"}</span>
                                        </div>
                                        <button className="group-indicator" onClick={(e) => goToGroup(e, g)}></button>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {selectedPerson && (
                    <div className="card text-center mt-4 fade-in" style={{ padding: '30px', border: '1px solid var(--primary-light)' }}>
                        <h2 style={{ marginBottom: '15px' }}>{selectedPerson}</h2>
                        <button className="btn pulse-btn" onClick={() => handleCardClick('/profile-view', { target: { id: selectedGroup?.teacherId, name: selectedGroup?.teacherName, type: 'Teacher' } })}>{t('proceed')}</button>
                    </div>
                )}

                {/* Gurukul Invite Banner — shown only if no path chosen */}
                {!gurukulPath && (
                    <div
                        onClick={() => setShowGurukul(true)}
                        style={{
                            background: 'linear-gradient(135deg, #667eea22, #764ba222)',
                            border: '1px dashed rgba(102, 126, 234, 0.5)',
                            borderRadius: '16px', padding: '18px 20px',
                            marginBottom: '20px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '14px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '32px' }}>🏛️</span>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                                Choose Your Gurukul Path
                            </h3>
                            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                                Select an ancient hero's philosophy for how the AI will teach you.
                            </p>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '18px' }}>→</span>
                    </div>
                )}

                {/* Gurukul Active Banner — shown when path is chosen */}
                {gurukulPath && (
                    <div
                        style={{
                            background: gurukulPath.gradient,
                            borderRadius: '16px', padding: '14px 18px',
                            marginBottom: '20px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            boxShadow: `0 6px 20px ${gurukulPath.shadow}`
                        }}
                    >
                        <span style={{ fontSize: '28px' }}>{gurukulPath.emoji}</span>
                        <div style={{ padding: '0 16px', flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: '900', fontSize: '15px' }}>
                                {`${gurukulPath.name} Path`} Active
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontStyle: 'italic' }}>
                                {gurukulPath.quote}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGurukul(true)}
                            style={{
                                background: 'rgba(255,255,255,0.2)', border: 'none',
                                borderRadius: '8px', color: '#fff',
                                fontSize: '10px', padding: '4px 8px', cursor: 'pointer'
                            }}
                        >Change</button>
                    </div>
                )}

                {/* Main Action Grid */}
                <div className="student-grid mt-4">
                    <div id="tour-card-ai" className="student-action-card" onClick={() => handleCardClick('/ttr-ai')}>
                        <span className="card-vibe-icon">🤖</span>
                        <h3 className="card-vibe-title">{t('ai_chat')}</h3>
                        <p className="card-vibe-desc">{t('ai_chat_desc')}</p>
                    </div>

                    <div id="tour-card-4way" className="student-action-card" onClick={() => handleCardClick('/4-way-learning')}>
                        <span className="card-vibe-icon">🧠</span>
                        <h3 className="card-vibe-title">{t('four_way')}</h3>
                        <p className="card-vibe-desc">{t('four_way_desc')}</p>
                    </div>

                    <div className="student-action-card" onClick={() => {
                        localStorage.removeItem("activeGroupId"); // Force generic selector view
                        handleCardClick('/group');
                    }}>
                        <span className="card-vibe-icon">👥</span>
                        <h3 className="card-vibe-title">{t('groups') || 'Groups'}</h3>
                        <p className="card-vibe-desc">Class Discussions</p>
                    </div>

                    <div id="tour-card-attendance" className="student-action-card" onClick={() => handleCardClick('/attendance')}>
                        <span className="card-vibe-icon">📅</span>
                        <h3 className="card-vibe-title">{t('attendance')}</h3>
                        <p className="card-vibe-desc">{t('attendance_desc')}</p>
                    </div>

                    <div id="tour-card-video" className="student-action-card" onClick={() => handleCardClick('/video-library')}>
                        <span className="card-vibe-icon">🎬</span>
                        <h3 className="card-vibe-title">{t('video_library')}</h3>
                        <p className="card-vibe-desc">{t('video_lib_desc')}</p>
                    </div>

                    <div className="student-action-card" onClick={() => handleCardClick('/homework')}>
                        <span className="card-vibe-icon">📚</span>
                        <h3 className="card-vibe-title">{t('homework')}</h3>
                        <p className="card-vibe-desc">Assignments & Homework</p>
                    </div>

                    <div className="student-action-card" onClick={() => handleCardClick('/analytics')}>
                        <span className="card-vibe-icon">📊</span>
                        <h3 className="card-vibe-title">{t('performance')}</h3>
                        <p className="card-vibe-desc">Track progress</p>
                    </div>

                    <div className="student-action-card" onClick={() => handleCardClick('/timetable')}>
                        <span className="card-vibe-icon">🗓️</span>
                        <h3 className="card-vibe-title">{t('timetable')}</h3>
                        <p className="card-vibe-desc">Class Schedule</p>
                    </div>

                    <div className="student-action-card" onClick={() => handleCardClick('/select-feedback-target')}>
                        <span className="card-vibe-icon">💬</span>
                        <h3 className="card-vibe-title">{t('feedback')}</h3>
                        <p className="card-vibe-desc">Share thoughts</p>
                    </div>

                    <div className="student-action-card" onClick={() => handleCardClick('/view-exam-seating')}>
                        <span className="card-vibe-icon">🪑</span>
                        <h3 className="card-vibe-title">Exam Seats</h3>
                        <p className="card-vibe-desc">View your room/seat</p>
                    </div>
                </div>

                {/* Exam Results Module */}
                <div id="tour-exam-results" className="results-glass-wrapper">
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '800' }}>
                        📝 {t('recent_results') || 'Recent Exam Results'}
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="results-table">
                            <thead>
                                <tr>
                                    <th>Exam</th>
                                    <th>Subject</th>
                                    <th>Marks</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examResults.length === 0 ? (
                                    <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No results found yet.</td></tr>
                                ) : (
                                    examResults.map((res, i) => (
                                        <tr key={i} className="fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                                            <td><strong>{res.exam}</strong></td>
                                            <td>{res.subject}</td>
                                            <td>{res.marks} / {res.total}</td>
                                            <td>
                                                <span className={`status-pill ${(res.marks / res.total) >= 0.35 ? 'status-pass' : 'status-fail'}`}>
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
