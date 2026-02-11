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
            <FeatureTour tourId="teacher_dashboard_v1" steps={tourSteps} userId={userData?.uid} />
            <AIBadge />
            <VoiceCommandAssistant onAnnouncement={(text) => {
                setAnnouncementText(text);
                setShowModal(true);
            }} />

            {/* Header / Mode Toggle */}
            <div style={{ display: 'flex', padding: '10px 15px', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    id="tour-teacher-announcement"
                    onClick={() => setShowModal(true)}
                    className="teacher-announcement-btn"
                    title="Make Announcement"
                >
                    📢
                </button>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: simpleMode ? '#27ae60' : '#636e72' }}>
                        {simpleMode ? "Easy Mode ON ✅" : "Advanced Mode"}
                    </span>
                    <button
                        onClick={() => {
                            const val = !simpleMode;
                            setSimpleMode(val);
                            localStorage.setItem('teacher_simple_mode', val);
                        }}
                        style={{
                            background: simpleMode ? '#27ae60' : '#dfe6e9',
                            color: simpleMode ? 'white' : '#2d3436',
                            border: 'none', padding: '5px 15px', borderRadius: '20px',
                            fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}
                    >
                        {simpleMode ? "Switch to Pro" : "Go Easy"}
                    </button>
                </div>

                <button
                    onClick={() => navigate('/inspector-mode')}
                    style={{
                        background: '#e74c3c', color: 'white', border: 'none',
                        padding: '10px 15px', borderRadius: '30px', fontWeight: 'bold',
                        boxShadow: '0 4px 10px rgba(231, 76, 60, 0.4)',
                        display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    🔴 {t('inspector_mode')}
                </button>
            </div>

            <div className="container">
                <div className="card text-center" style={{ marginTop: '20px', borderTop: simpleMode ? '6px solid #27ae60' : 'none' }}>
                    <h2 style={{ marginBottom: '5px' }}>{t('teacher_welcome')}, {userData?.name || 'Teacher'}!</h2>

                    {!simpleMode ? (
                        <>
                            {userData?.pid && (
                                <div style={{
                                    background: '#f1f2f6', color: '#2d3436',
                                    display: 'inline-block', padding: '4px 10px',
                                    borderRadius: '20px', fontSize: '12px',
                                    fontWeight: 'bold', marginBottom: '15px',
                                    border: '1px solid #dfe6e9'
                                }}>
                                    ID: {userData.pid}
                                </div>
                            )}
                            <p>{t('teacher_intro')}</p>
                            {allotments.length > 0 ? (
                                <div style={{ marginBottom: '15px' }}>
                                    <h4 style={{ margin: '5px 0', color: '#636e72' }}>{t('my_classes')}:</h4>
                                    <div className="teacher-classes-list">
                                        {allotments.map(a => (
                                            <span key={a.id} className="teacher-class-pill">
                                                {a.classAssigned}-{a.section} ({a.subject})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : userData?.assignedClass ? (
                                <p style={{ color: '#0984e3', fontWeight: 'bold' }}>
                                    Assigned Class: {userData.assignedClass} - {userData.assignedSection} ({userData.subject})
                                </p>
                            ) : (
                                <p style={{ color: '#d63031', fontSize: '13px' }}>
                                    ⚠️ No class assigned yet.
                                </p>
                            )}

                            <div className="teacher-actions-container">
                                <button id="tour-teacher-groups" className="btn btn-primary" onClick={() => { vibrate(); handleGoToGroups(); }}>{t('go_to_groups')}</button>
                                <button id="tour-teacher-attendance" className="btn btn-primary" style={{ background: '#0984e3' }} onClick={() => { vibrate(); handleCardClick('/attendance'); }}>{t('mark_attendance')}</button>
                                <button id="tour-teacher-4way" className="btn" style={{ background: '#e84393', color: 'white' }} onClick={() => { vibrate(); handleCardClick('/4-way-learning'); }}>{t('four_way')}</button>
                                <button id="tour-teacher-library" className="btn btn-primary" style={{ background: '#d63031' }} onClick={() => { vibrate(); handleCardClick('/video-library'); }}>{t('video_library')}</button>
                                <button className="btn btn-primary" style={{ background: '#9b59b6' }} onClick={() => { vibrate(); handleCardClick('/marks'); }}>📊 {t('marks')}</button>
                                <button className="btn btn-primary" style={{ background: '#8e44ad' }} onClick={() => { vibrate(); handleCardClick('/analytics'); }}>📈 {t('analytics')}</button>
                                <button className="btn btn-primary" style={{ background: '#e67e22' }} onClick={() => { vibrate(); handleCardClick('/homework'); }}>📚 {t('homework')}</button>
                                <button className="btn btn-primary" style={{ background: '#00cec9' }} onClick={() => { vibrate(); handleCardClick('/general-feedback'); }}>{t('feedback')}</button>
                                <button className="btn btn-primary" style={{ background: '#fdcb6e', color: '#2d3436' }} onClick={() => { vibrate(); handleCardClick('/timetable'); }}>{t('timetable')}</button>
                                <button className="btn btn-primary" style={{ background: '#16a085' }} onClick={() => { vibrate(); handleCardClick('/attendance-analytics'); }}>📊 {t('attendance_analytics')}</button>
                                <button className="btn btn-primary" style={{ background: '#c0392b' }} onClick={() => { vibrate(); handleCardClick('/view-exam-seating'); }}>🪑 {t('view_exam_seats')}</button>
                                <button className="btn btn-success" onClick={() => { vibrate(); handleCardClick('/gov-reports'); }}>{t('gov_reports')}</button>
                                <button className="btn btn-primary" style={{ background: '#d35400' }} onClick={() => { vibrate(); handleCardClick('/dropout-predictor'); }}>⚠️ {t('dropout_risk')}</button>
                                <button className="btn btn-primary" style={{ background: '#34495e' }} onClick={() => { vibrate(); handleCardClick('/library-management'); }}>📚 Library</button>
                                <button className="btn btn-primary" style={{ background: '#1abc9c' }} onClick={() => { vibrate(); handleCardClick('/universal-scanner'); }}>📄 AI Paper Scan</button>
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
