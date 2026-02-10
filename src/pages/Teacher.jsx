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

    return (
        <div className="page-wrapper">
            <FeatureTour tourId="teacher_dashboard_v1" steps={tourSteps} userId={userData?.uid} />
            <AIBadge />
            <VoiceCommandAssistant onAnnouncement={(text) => {
                setAnnouncementText(text);
                setShowModal(true);
            }} />

            {/* Announcement Button (Relative) */}
            <div style={{ display: 'flex', padding: '10px 15px', justifyContent: 'flex-start' }}>
                <button
                    id="tour-teacher-announcement"
                    onClick={() => setShowModal(true)}
                    className="teacher-announcement-btn"
                    title="Make Announcement"
                >
                    📢
                </button>
                <div style={{ flex: 1 }}></div>
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
                    🔴 INSPECTOR MODE
                </button>
            </div>

            <div className="container">
                <div className="card text-center" style={{ marginTop: '20px' }}>
                    <h2>{t('teacher_welcome')}, {userData?.name || 'Teacher'}!</h2>
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
                        <button id="tour-teacher-groups" className="btn" onClick={handleGoToGroups}>{t('go_to_groups')}</button>
                        <button id="tour-teacher-attendance" className="btn btn-attendance" onClick={() => handleCardClick('/attendance')}>{t('mark_attendance')}</button>
                        <button id="tour-teacher-4way" className="btn" style={{ background: '#e84393', color: 'white' }} onClick={() => handleCardClick('/4-way-learning')}>{t('four_way')}</button>
                        <button id="tour-teacher-library" className="btn btn-library" onClick={() => handleCardClick('/video-library')}>{t('video_library')}</button>
                        <button className="btn" style={{ background: '#9b59b6', color: 'white' }} onClick={() => handleCardClick('/marks')}>📊 {t('marks')}</button>
                        <button className="btn" style={{ background: '#8e44ad', color: 'white' }} onClick={() => handleCardClick('/analytics')}>📈 {t('analytics')}</button>
                        <button className="btn" style={{ background: '#e67e22', color: 'white' }} onClick={() => handleCardClick('/homework')}>📚 {t('homework')}</button>
                        <button className="btn btn-feedback" onClick={() => handleCardClick('/general-feedback')}>{t('feedback')}</button>
                        <button className="btn btn-timetable" onClick={() => handleCardClick('/timetable')}>{t('timetable')}</button>
                        <button className="btn" style={{ background: '#16a085', color: 'white' }} onClick={() => handleCardClick('/attendance-analytics')}>📊 {t('attendance_analytics')}</button>
                        <button className="btn" style={{ background: '#c0392b', color: 'white' }} onClick={() => handleCardClick('/view-exam-seating')}>🪑 {t('view_exam_seats')}</button>
                        <button className="btn" style={{ background: '#27ae60', color: 'white' }} onClick={() => handleCardClick('/gov-reports')}>{t('gov_reports')}</button>
                        <button className="btn" style={{ background: '#d35400', color: 'white' }} onClick={() => handleCardClick('/dropout-predictor')}>⚠️ {t('dropout_risk')}</button>
                    </div>
                </div>
            </div>

            {/* Announcement Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                        <h3>📢 Make Announcement</h3>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#666', display: 'block' }}>Class:</label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#666', display: 'block' }}>Section:</label>
                                <select
                                    className="input-field"
                                    value={selectedSection}
                                    onChange={(e) => setSelectedSection(e.target.value)}
                                    style={{ margin: 0 }}
                                >
                                    <option value="All">All Sections</option>
                                    {sectionsForClass.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Class Dropdown inside Modal if needed, simplified here based on state check logic in original code */}
                        {uniqueClasses.length > 0 && (
                            <div style={{ marginBottom: '10px', textAlign: 'left' }}>
                                <label style={{ fontSize: '12px', color: '#666' }}>Target Class:</label>
                                <select
                                    className="input-field"
                                    value={selectedClass}
                                    onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection('All'); }}
                                    style={{ margin: 0 }}
                                >
                                    {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        <textarea
                            className="input-field"
                            rows="4"
                            placeholder="Type your announcement here..."
                            value={announcementText}
                            onChange={(e) => setAnnouncementText(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                            <button className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn" onClick={handlePostAnnouncement}>Post</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
