import React, { useState, useRef, useEffect } from 'react';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import FeatureTour from '../components/FeatureTour';
import VoiceCommandAssistant from '../components/VoiceCommandAssistant';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export default function Teacher() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const { t } = useLanguage();

    // Announcement State
    const [showModal, setShowModal] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');
    const [allotments, setAllotments] = useState([]);
    const [simpleMode, setSimpleMode] = useState(localStorage.getItem('teacher_simple_mode') === 'true');
    const [currentTask, setCurrentTask] = useState(null);

    // Selection State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('All');

    const isNavigating = useRef(false);

    // Feature Tour Steps
    const tourSteps = [
        {
            target: 'tour-teacher-announcement',
            title: '📢 Announcements',
            content: 'Click here to post announcements to your classes. You can target specific sections or all students.'
        },
        {
            target: 'tour-teacher-groups',
            title: '👥 Class Groups',
            content: 'Access your student groups here. View profiles, manage learning, and interact with your class.'
        },
        {
            target: 'tour-teacher-attendance',
            title: '✅ Mark Attendance',
            content: 'Take attendance for your assigned classes quickly and easily.'
        },
        {
            target: 'tour-teacher-library',
            title: '📚 Video Library',
            content: 'Upload and manage educational videos and class recordings.'
        }
    ];

    const handleCardClick = (path) => {
        if (isNavigating.current) return;
        isNavigating.current = true;
        navigate(path);
        // Reset after delay
        setTimeout(() => { isNavigating.current = false; }, 2000);
    };

    // Fetch Allotments when Modal opens
    useEffect(() => {
        if (userData?.uid) {
            const fetchAllotments = async () => {
                try {
                    const q = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                    const snap = await getDocs(q);
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAllotments(list);
                    if (list.length > 0 && !selectedClass) setSelectedClass(list[0].classAssigned);
                } catch (e) { console.error(e); }
            };
            fetchAllotments();
        }
    }, [userData, showModal]);

    // Derived Data
    const uniqueClasses = [...new Set(allotments.map(a => a.classAssigned))].sort();
    const sectionsForClass = allotments
        .filter(a => a.classAssigned === selectedClass)
        .map(a => a.section)
        .sort();

    const handleGoToGroups = () => {
        // User requested: "first show them list of groups"
        // So we prevent auto-entry and force selection mode in Group.jsx
        localStorage.removeItem("activeGroupId");
        handleCardClick('/group');
    };

    const handlePostAnnouncement = async () => {
        if (!announcementText.trim()) return alert("Please enter some text.");
        // If no allotments found via fetch, fallback to userData if available, else block
        // Fix: Use state variables if allotments exist
        let targetClass = selectedClass;
        let targetSection = selectedSection;
        let subject = userData?.subject || 'General';

        // Fallback if no allotments loaded but user has direct assignment
        if (allotments.length === 0 && userData?.assignedClass) {
            targetClass = userData.assignedClass.toString();
            targetSection = userData.assignedSection || 'A';
            subject = userData.subject || 'General';
        }

        if (!targetClass) return alert("Please select a class.");

        try {
            await addDoc(collection(db, "announcements"), {
                text: announcementText,
                targetClass: targetClass,
                targetSection: targetSection || 'A',
                subject: subject || 'General',
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

    // --- ACCESSIBILITY HELPERS ---
    const vibrate = () => {
        if ('vibrate' in navigator) navigator.vibrate(50);
    };

    const speak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop current speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    };

    // --- DAILY ROUTINE WIZARD (Recommendation 4) ---
    useEffect(() => {
        const updateTask = () => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const timeVal = hour * 100 + minute; // 9:15 -> 915

            // Standard Indian School Schedule (Sample)
            const schedule = [
                { start: 830, end: 915, name: 'Period 1' },
                { start: 915, end: 1000, name: 'Period 2' },
                { start: 1000, end: 1045, name: 'Period 3' },
                { start: 1045, end: 1115, name: 'Short Break' },
                { start: 1115, end: 1200, name: 'Period 4' },
                { start: 1200, end: 1245, name: 'Period 5' },
                { start: 1245, end: 1330, name: 'Lunch Break' },
                { start: 1330, end: 1415, name: 'Period 6' },
                { start: 1415, end: 1500, name: 'Period 7' }
            ];

            const current = schedule.find(s => timeVal >= s.start && timeVal < s.end);

            if (current) {
                // Find if teacher has an allotment for this period
                // We'd ideally fetch the actual timetable, but as a quick wizard:
                // Let's show the "Best Guess" or just the period name
                setCurrentTask({
                    name: current.name,
                    timeRange: `${Math.floor(current.start / 100)}:${current.start % 100 || '00'} - ${Math.floor(current.end / 100)}:${current.end % 100 || '00'}`,
                    isBreak: current.name.includes('Break')
                });
            } else {
                setCurrentTask(null);
            }
        };

        updateTask();
        const interval = setInterval(updateTask, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="page-wrapper">
            <FeatureTour tourId="teacher_dashboard_v1" steps={tourSteps} userData={userData} />
            <AIBadge />
            <VoiceCommandAssistant onAnnouncement={(text) => {
                setAnnouncementText(text);
                setShowModal(true);
            }} />

            {/* Header / Mode Toggle Centered for Balance */}
            <div className="teacher-action-cluster" style={{
                display: 'flex',
                padding: '16px',
                justifyContent: 'center',
                gap: '15px',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <button
                    id="tour-teacher-announcement"
                    onClick={() => { vibrate(); setShowModal(true); }}
                    className="teacher-announcement-btn"
                    title="Make Announcement"
                >
                    📢
                </button>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-surface)', padding: '4px 12px', borderRadius: '24px', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: simpleMode ? '#27ae60' : 'var(--text-muted)' }}>
                        {simpleMode ? "SIMPLE" : "PRO"}
                    </span>
                    <button
                        onClick={() => {
                            vibrate();
                            const val = !simpleMode;
                            setSimpleMode(val);
                            localStorage.setItem('teacher_simple_mode', val);
                        }}
                        style={{
                            background: simpleMode ? '#27ae60' : 'var(--divider)',
                            color: simpleMode ? 'white' : 'var(--text-main)',
                            border: 'none', padding: '6px 14px', borderRadius: '20px',
                            fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                        }}
                    >
                        {simpleMode ? "GO PRO" : "GO EASY"}
                    </button>
                </div>

                <button
                    onClick={() => { vibrate(); navigate('/inspector-mode'); }}
                    className="btn btn-error"
                    style={{
                        background: '#e74c3c', color: 'white', border: 'none',
                        padding: '10px 18px', borderRadius: '30px', fontWeight: '800',
                        boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)',
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    🔴 {t('inspector_mode')}
                </button>
            </div>

            <div className="container">
                {/* Elite Teacher Hero */}
                <div className="teacher-hero-card">
                    <div className="teacher-hero-sparkle">🍏</div>
                    <div className="teacher-hero-pill">🍎 {userData?.role || 'Professional Teacher'}</div>
                    <h1 className="teacher-welcome-title">
                        {t('teacher_welcome')}, {userData?.name || 'Academician'}!
                    </h1>
                    <p className="student-subtext" style={{ opacity: 1 }}>{t('teacher_intro')}</p>

                    {userData?.pid && (
                        <div style={{ marginTop: '15px' }} className="teacher-hero-pill">
                            ID: {userData.pid}
                        </div>
                    )}
                </div>

                <div className="card shadow-sm" style={{ borderTop: simpleMode ? '6px solid #27ae60' : 'none' }}>
                    {!simpleMode ? (
                        <>
                            {allotments.length > 0 ? (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {t('my_classes')}:
                                    </h4>
                                    <div className="teacher-classes-list">
                                        {allotments.map(a => (
                                            <span key={a.id} className="teacher-class-pill">
                                                {a.classAssigned}-{a.section} ({a.subject})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : userData?.assignedClass ? (
                                <div className="teacher-hero-pill" style={{ color: 'var(--primary)', background: 'rgba(108, 92, 231, 0.1)', border: 'none', marginBottom: '15px' }}>
                                    🎯 {userData.assignedClass}-{userData.assignedSection} | {userData.subject}
                                </div>
                            ) : (
                                <div className="status-fail" style={{ padding: '10px', borderRadius: '12px', marginBottom: '20px', fontSize: '12px' }}>
                                    ⚠️ No active teaching allotments found.
                                </div>
                            )}

                            <div className="teacher-grid-system">
                                <div className="teacher-vibe-card" onClick={() => { vibrate(); handleGoToGroups(); }}>
                                    <span className="teacher-vibe-icon">👥</span>
                                    <span className="teacher-vibe-label">{t('go_to_groups')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#0984e3' }} onClick={() => { vibrate(); handleCardClick('/attendance'); }}>
                                    <span className="teacher-vibe-icon">✅</span>
                                    <span className="teacher-vibe-label">{t('mark_attendance')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#e84393' }} onClick={() => { vibrate(); handleCardClick('/4-way-learning'); }}>
                                    <span className="teacher-vibe-icon">🤝</span>
                                    <span className="teacher-vibe-label">{t('four_way')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#d63031' }} onClick={() => { vibrate(); handleCardClick('/video-library'); }}>
                                    <span className="teacher-vibe-icon">📺</span>
                                    <span className="teacher-vibe-label">{t('video_library')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#9b59b6' }} onClick={() => { vibrate(); handleCardClick('/marks'); }}>
                                    <span className="teacher-vibe-icon">📊</span>
                                    <span className="teacher-vibe-label">{t('marks')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#8e44ad' }} onClick={() => { vibrate(); handleCardClick('/analytics'); }}>
                                    <span className="teacher-vibe-icon">📈</span>
                                    <span className="teacher-vibe-label">{t('analytics')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#e67e22' }} onClick={() => { vibrate(); handleCardClick('/homework'); }}>
                                    <span className="teacher-vibe-icon">📚</span>
                                    <span className="teacher-vibe-label">{t('homework')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#00cec9' }} onClick={() => { vibrate(); handleCardClick('/general-feedback'); }}>
                                    <span className="teacher-vibe-icon">💬</span>
                                    <span className="teacher-vibe-label">{t('feedback')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#fdcb6e' }} onClick={() => { vibrate(); handleCardClick('/timetable'); }}>
                                    <span className="teacher-vibe-icon">🕒</span>
                                    <span className="teacher-vibe-label">{t('timetable')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#c0392b' }} onClick={() => { vibrate(); handleCardClick('/view-exam-seating'); }}>
                                    <span className="teacher-vibe-icon">🪑</span>
                                    <span className="teacher-vibe-label">Exam Seats</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#27ae60' }} onClick={() => { vibrate(); handleCardClick('/gov-reports'); }}>
                                    <span className="teacher-vibe-icon">📋</span>
                                    <span className="teacher-vibe-label">{t('gov_reports')}</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#1abc9c' }} onClick={() => { vibrate(); handleCardClick('/universal-scanner'); }}>
                                    <span className="teacher-vibe-icon">📄</span>
                                    <span className="teacher-vibe-label">AI Scanner</span>
                                </div>
                                <div className="teacher-vibe-card" style={{ borderColor: '#c0392b', background: 'rgba(192, 57, 43, 0.05)' }} onClick={() => { vibrate(); handleCardClick('/early-warning'); }}>
                                    <span className="teacher-vibe-icon">⚠️</span>
                                    <span className="teacher-vibe-label" style={{ color: '#c0392b', fontWeight: 'bold' }}>Risk Detector</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ marginTop: '30px' }}>
                            {/* Recommendation 4: Daily Routine Wizard */}
                            {currentTask && (
                                <div className="routine-wizard-card">
                                    <div className="routine-icon-bg">
                                        {currentTask.isBreak ? '☕' : '📖'}
                                    </div>
                                    <div className="routine-label">🎯 Your Current Task</div>
                                    <h2 className="routine-title">
                                        {currentTask.name} {currentTask.isBreak ? 'Break' : 'is Live'}
                                    </h2>
                                    <p className="routine-time">Time: {currentTask.timeRange}</p>

                                    {!currentTask.isBreak && (
                                        <button
                                            className="btn btn-primary routine-action-btn"
                                            onClick={() => { vibrate(); handleCardClick('/attendance'); }}
                                        >
                                            ✅ Mark Attendance Now
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="ai-assistant-banner card">
                                <div className="ai-banner-icon">🎙️</div>
                                <div className="ai-banner-info">
                                    <h3 className="ai-banner-title">AI Teacher Assistant</h3>
                                    <p className="ai-banner-text">Just talk to me! I can mark attendance, show marks, or play videos.</p>
                                </div>
                                <button
                                    className="btn btn-primary pulse-btn"
                                    onClick={() => { vibrate(); speak("I am listening. Please speak your command."); }}
                                >
                                    Click to Speak
                                </button>
                            </div>

                            <div className="simple-cards-grid">
                                <div
                                    onClick={() => { vibrate(); handleGoToGroups(); }}
                                    onContextMenu={(e) => { e.preventDefault(); speak("View my students and class groups"); }}
                                    className="simple-action-card card shadow-sm"
                                    style={{ borderTop: '4px solid #0984e3' }}
                                >
                                    <span className="simple-card-icon">👥</span>
                                    <div className="simple-card-label">My Students</div>
                                </div>
                                <div
                                    onClick={() => { vibrate(); handleCardClick('/attendance'); }}
                                    onContextMenu={(e) => { e.preventDefault(); speak("Mark or view student attendance"); }}
                                    className="simple-action-card card shadow-sm"
                                    style={{ borderTop: '4px solid #00b894' }}
                                >
                                    <span className="simple-card-icon">✅</span>
                                    <div className="simple-card-label">Attendance</div>
                                </div>
                                <div
                                    onClick={() => { vibrate(); handleCardClick('/universal-scanner'); }}
                                    onContextMenu={(e) => { e.preventDefault(); speak("Scan lesson plans or paper notices to digital format"); }}
                                    className="simple-action-card card shadow-sm"
                                    style={{ borderTop: '4px solid #6c5ce7' }}
                                >
                                    <span className="simple-card-icon">📄</span>
                                    <div className="simple-card-label">Scan Paper</div>
                                </div>
                                <div
                                    onClick={() => { vibrate(); handleCardClick('/timetable'); }}
                                    onContextMenu={(e) => { e.preventDefault(); speak("View my class timetable and schedule"); }}
                                    className="simple-action-card card shadow-sm"
                                    style={{ borderTop: '4px solid #f39c12' }}
                                >
                                    <span className="simple-card-icon">🕒</span>
                                    <div className="simple-card-label">My Classes</div>
                                </div>
                            </div>

                            <div className="simple-mode-footer">
                                <p className="tip-text">💡 Tip: Long-press any button to hear what it does.</p>
                                <p className="mode-toggle-text">
                                    Not finding what you need? <span className="mode-switch-link" onClick={() => { vibrate(); setSimpleMode(false); }}>Switch to Advanced Mode</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Announcement Modal Professional */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-card card shadow-lg">
                        <div className="modal-header">
                            <h3 className="modal-title">📢 Make Announcement</h3>
                            <button onClick={() => setShowModal(false)} className="modal-close">×</button>
                        </div>

                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label className="form-label">Class</label>
                                    <select
                                        className="input-field"
                                        value={selectedClass}
                                        onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection('All'); }}
                                    >
                                        {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group flex-1">
                                    <label className="form-label">Section</label>
                                    <select
                                        className="input-field"
                                        value={selectedSection}
                                        onChange={(e) => setSelectedSection(e.target.value)}
                                    >
                                        <option value="All">All Sections</option>
                                        {sectionsForClass.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Announcement Text</label>
                                <textarea
                                    className="input-field"
                                    rows="4"
                                    placeholder="Type your message..."
                                    value={announcementText}
                                    onChange={(e) => setAnnouncementText(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handlePostAnnouncement}>Post Message</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
