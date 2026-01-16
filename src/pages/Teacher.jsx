import React, { useState } from 'react';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export default function Teacher() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // Announcement State
    const [showModal, setShowModal] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');
    const [allotments, setAllotments] = useState([]);

    // Selection State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('All');

    // Fetch Allotments when Modal opens
    React.useEffect(() => {
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
        if (!userData) return;

        // Check if teacher has been allotted a class
        if (!userData.assignedClass || !userData.assignedSection) {
            alert("You have not been assigned to a class yet. Please contact your Institution's Admin to allot you a class.");
            return;
        }

        // Construct Group ID based on standard format: SUBJECT_CLASS_SECTION
        const subject = (userData.subject || 'General').toUpperCase().replace(/\s+/g, "_");
        const cls = userData.assignedClass.toString().toUpperCase();
        const sec = userData.assignedSection.toString().toUpperCase();

        const groupId = `${subject}_${cls}_${sec}`;

        console.log("Navigating to Group:", groupId);
        localStorage.setItem("activeGroupId", groupId);
        navigate('/group');
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
            <AIBadge />



            <AnnouncementBar title="Teacher Dashboard" />

            {/* Announcement Button (Relative) */}
            <div style={{ display: 'flex', padding: '10px 15px', justifyContent: 'flex-start' }}>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        width: '45px', height: '45px', borderRadius: '50%',
                        background: 'white', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer',
                        color: '#0984e3'
                    }}
                    title="Make Announcement"
                >
                    📢
                </button>
            </div>

            <div className="container">
                <div className="card text-center" style={{ marginTop: '20px' }}>
                    <h2>Welcome, {userData?.name || 'Teacher'}!</h2>
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
                    <p>Access your classes, upload notes, and manage attendance.</p>
                    {allotments.length > 0 ? (
                        <div style={{ marginBottom: '15px' }}>
                            <h4 style={{ margin: '5px 0', color: '#636e72' }}>My Classes:</h4>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {allotments.map(a => (
                                    <span key={a.id} style={{ background: '#dfe6e9', padding: '5px 10px', borderRadius: '15px', fontSize: '14px', border: '1px solid #b2bec3' }}>
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

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={handleGoToGroups}>Go to Groups</button>
                        <button className="btn" style={{ backgroundColor: '#0984e3' }} onClick={() => navigate('/attendance')}>Mark Attendance</button>
                        <button className="btn" style={{ backgroundColor: '#d63031' }} onClick={() => navigate('/video-library')}>Video Library</button>
                        <button className="btn" style={{ backgroundColor: '#00cec9', color: 'white' }} onClick={() => navigate('/general-feedback')}>Feedback</button>
                        <button className="btn" style={{ backgroundColor: '#fdcb6e', color: '#2d3436' }} onClick={() => navigate('/timetable')}>Timetable</button>
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
                                {uniqueClasses.length > 0 ? (
                                    <select
                                        className="input-field"
                                        value={selectedClass}
                                        onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection('All'); }}
                                        style={{ margin: 0 }}
                                    >
                                        {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <p>{userData?.assignedClass || 'N/A'}</p>
                                )}
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
