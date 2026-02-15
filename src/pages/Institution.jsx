import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import FeatureTour from '../components/FeatureTour';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import SmartAdmission from '../components/SmartAdmission';

export default function Institution() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [submissions, setSubmissions] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [showSmartAdmission, setShowSmartAdmission] = useState(false);

    const isNavigating = useRef(false);

    // Feature Tour Steps
    const tourSteps = [
        {
            target: 'tour-inst-import',
            title: '📤 Bulk Import',
            content: 'Register hundreds of students at once using a CSV file. Credentials will be generated automatically.'
        },
        {
            target: 'tour-inst-announcement',
            title: '📢 Announcements',
            content: 'Broadcast messages to the entire institution or specific classes.'
        },
        {
            target: 'tour-inst-allotment',
            title: '📘 Teacher Allotments',
            content: 'Assign teachers to classes and subjects here.'
        },
        {
            target: 'tour-inst-admission',
            title: '📝 New Admissions',
            content: 'Manually register individual students.'
        },
        {
            target: 'tour-inst-fees',
            title: '💰 Fee Management',
            content: 'Track fee payments and manage dues.'
        }
    ];

    const handleCardClick = (path) => {
        if (isNavigating.current) return;
        isNavigating.current = true;
        navigate(path);
        // Reset after delay
        setTimeout(() => { isNavigating.current = false; }, 2000);
    };

    const handlePostAnnouncement = async () => {
        if (!announcementText.trim()) return alert("Please enter some text.");
        try {
            // Use userData from context instead of getAuth() directly for consistency
            const uid = userData?.uid;
            if (!uid) { alert("User not identified"); return; }

            await addDoc(collection(db, "announcements"), {
                text: announcementText,
                targetClass: selectedClass,
                targetSection: selectedSection,
                subject: 'General',
                authorName: profile?.institutionName || 'Institution Admin',
                authorId: uid,
                institutionId: uid, // Added
                role: 'institution',
                createdAt: serverTimestamp()
            });
            setAnnouncementText('');
            setSelectedClass('All');
            setSelectedSection('All');
            setShowModal(false);
            alert("Announcement Posted Successfully! 📢");
        } catch (e) {
            console.error("Error posting announcement", e);
            alert("Failed to post announcement: " + e.message);
        }
    };

    const registerStudents = async (students) => {
        if (students.length === 0) return;

        const confirm = window.confirm(`Ready to import ${students.length} students?`);
        if (!confirm) return;

        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch('/api/batch-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ students })
            });

            const data = await res.json();
            setLoading(false);

            if (data.results) {
                const successCount = data.results.success.length;
                const failedCount = data.results.failed.length;

                alert(`Import Complete!\nSuccess: ${successCount}\nFailed: ${failedCount}\n\nA credentials file will now download.`);

                if (successCount > 0) {
                    generateReport(data.results.success);
                }
            } else {
                alert("Import failed: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            alert("Error sending request.");
            setLoading(false);
        }
    };

    const generateReport = (successList) => {
        let reportContent = "STUDENT CREDENTIALS REPORT\n" +
            "==================================\n" +
            `Date: ${new Date().toLocaleString()}\n` +
            "Note: Distribute these credentials securely to students.\n\n";

        successList.forEach(s => {
            reportContent += `----------------------------------\n`;
            reportContent += `Name:     ${s.name}\n`;
            reportContent += `Class:    ${s.class}\n`;
            reportContent += `PID:      ${s.pid}\n`;
            reportContent += `Login ID: ${s.email}\n`;
            reportContent += `Password: ${s.password}\n`;
        });

        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Student_Credentials_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleBulkImport = async (csvText) => {
        try {
            const rows = csvText.trim().split('\n');
            const students = rows.map(row => {
                const [name, email, password, className] = row.split(',').map(s => s.trim());
                return { name, email, password, class: className };
            });

            if (students.length === 0) return alert("Invalid CSV format.");
            registerStudents(students);

        } catch (e) {
            console.error(e);
            alert("Error parsing CSV.");
        }
    };

    const handleSmartImport = (scannedData) => {
        setShowSmartAdmission(false);
        registerStudents(scannedData);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch Institution Profile
                try {
                    const docSnap = await getDoc(doc(db, "institutions", user.uid));
                    if (docSnap.exists()) {
                        setProfile(docSnap.data());
                    }
                } catch (e) {
                    console.error("Error fetching profile:", e);
                }

                // Fetch submissions
                try {
                    const q = query(
                        collection(db, "submissions"),
                        where("institutionId", "==", user.uid)
                    );
                    const snap = await getDocs(q);
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setSubmissions(list);
                } catch (e) {
                    console.error("Error fetching submissions:", e);
                    if (e.code === 'permission-denied') {
                        setError("Missing Permissions: Please update Firestore Security Rules in Firebase Console.");
                    } else {
                        setError("Error fetching data. Check console.");
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="container">Loading...</div>;

    if (error) return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
            <h2>⚠️ Action Required</h2>
            <p>{error}</p>
            <p style={{ fontSize: '14px', color: '#555' }}>Go to Firebase Console &rarr; Firestore Database &rarr; Rules and set them to allow read/write.</p>
        </div>
    );

    const handleGoToGroups = () => {
        localStorage.removeItem("activeGroupId");
        handleCardClick('/group');
    };

    return (
        <div className="page-wrapper">
            <FeatureTour tourId="institution_dashboard_v1" steps={tourSteps} userData={userData} />
            <AIBadge />

            <div className="container">
                {/* Elite Institution Hero */}
                <div className="institution-hero-card">
                    <div className="institution-hero-sparkle">🏛️</div>
                    <div className="institution-hero-pill">🏫 {userData?.role || 'Institution Administrator'}</div>
                    <h1 className="institution-name-title">
                        {profile?.institutionName || 'Our Institution'}
                    </h1>

                    {profile?.principalName && (
                        <p className="institution-meta-desc">
                            Principal: {profile.principalName} | Est: {profile.estYear}
                        </p>
                    )}

                    {profile?.pid && (
                        <div style={{ marginTop: '15px' }} className="institution-hero-pill">
                            ID: {profile.pid}
                        </div>
                    )}
                </div>

                {/* Administrative Fast Actions - Centered for Elite Balance */}
                <div style={{
                    marginBottom: '32px',
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <button
                        id="tour-inst-announcement"
                        onClick={() => setShowModal(true)}
                        className="teacher-announcement-btn"
                        style={{
                            background: 'var(--bg-surface)',
                            color: 'var(--primary)',
                            boxShadow: 'var(--shadow-sm)',
                            width: '50px',
                            height: '50px',
                            fontSize: '24px'
                        }}
                        title="Broadcast Message"
                    >
                        📢
                    </button>
                    <button
                        id="tour-inst-import"
                        className="btn btn-success"
                        style={{
                            borderRadius: '30px',
                            padding: '12px 28px',
                            boxShadow: '0 6px 15px rgba(39, 174, 96, 0.25)',
                            fontSize: '14px',
                            fontWeight: '800'
                        }}
                        onClick={() => {
                            const csv = prompt("Paste CSV Data (Name, Email, Password, Class)\nExample:\nJohn Doe,john@test.com,Pass123,10th");
                            if (csv) handleBulkImport(csv);
                        }}
                    >
                        📤 Bulk Import
                    </button>
                    <button
                        onClick={() => setShowSmartAdmission(true)}
                        className="btn"
                        style={{
                            background: 'white',
                            color: '#e056fd',
                            border: '2px solid #e056fd',
                            borderRadius: '30px',
                            padding: '12px 28px',
                            fontSize: '14px',
                            fontWeight: '800'
                        }}
                    >
                        📸 AI Smart Admission
                    </button>
                </div>

                {showSmartAdmission && (
                    <SmartAdmission
                        onClose={() => setShowSmartAdmission(false)}
                        onScanComplete={handleSmartImport}
                    />
                )}

                <div className="teacher-grid-system" style={{ marginBottom: '32px' }}>
                    <div className="teacher-vibe-card" style={{ borderColor: '#6c5ce7' }} onClick={() => handleCardClick('/allotment')}>
                        <span className="teacher-vibe-icon">📘</span>
                        <span className="teacher-vibe-label">Allotments</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#0984e3' }} onClick={() => handleCardClick('/attendance')}>
                        <span className="teacher-vibe-icon">📅</span>
                        <span className="teacher-vibe-label">Attendance</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#00b894' }} onClick={handleGoToGroups}>
                        <span className="teacher-vibe-icon">👥</span>
                        <span className="teacher-vibe-label">Groups</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#e84393' }} onClick={() => handleCardClick('/general-feedback')}>
                        <span className="teacher-vibe-icon">📊</span>
                        <span className="teacher-vibe-label">Feedback</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#ff7675' }} onClick={() => handleCardClick('/health')}>
                        <span className="teacher-vibe-icon">🏥</span>
                        <span className="teacher-vibe-label">Health</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#d63031' }} onClick={() => handleCardClick('/video-library')}>
                        <span className="teacher-vibe-icon">📺</span>
                        <span className="teacher-vibe-label">Video Lib</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#fdcb6e' }} onClick={() => handleCardClick('/timetable')}>
                        <span className="teacher-vibe-icon">🗓️</span>
                        <span className="teacher-vibe-label">Timetable</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#6c5ce7' }} onClick={() => handleCardClick('/faculty-feedback')}>
                        <span className="teacher-vibe-icon">👨‍🏫</span>
                        <span className="teacher-vibe-label">Faculty</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#2c3e50' }} onClick={() => handleCardClick('/fees/institution')}>
                        <span className="teacher-vibe-icon">💰</span>
                        <span className="teacher-vibe-label">Fee Mgmt</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#8e44ad' }} onClick={() => handleCardClick('/exam-seating')}>
                        <span className="teacher-vibe-icon">🪑</span>
                        <span className="teacher-vibe-label">Exam Seating</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#c0392b' }} onClick={() => handleCardClick('/library')}>
                        <span className="teacher-vibe-icon">📚</span>
                        <span className="teacher-vibe-label">Library</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#e74c3c' }} onClick={() => handleCardClick('/inspection-readiness')}>
                        <span className="teacher-vibe-icon">🔴</span>
                        <span className="teacher-vibe-label">Inspection</span>
                    </div>
                    <div className="teacher-vibe-card" style={{ borderColor: '#16a085' }} onClick={() => handleCardClick('/student-promotion')}>
                        <span className="teacher-vibe-icon">🎓</span>
                        <span className="teacher-vibe-label">Promotion</span>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', borderRadius: '15px' }}>
                    <h3 className="text-center" style={{ marginTop: 0 }}>Submissions</h3>
                    <p className="text-center text-muted" style={{ marginBottom: '20px' }}>Student & Teacher Excel View</p>

                    {submissions.length === 0 ? (
                        <p className="text-center">No submissions yet.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Role</th>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Name</th>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Gender</th>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Class/Exp</th>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Sub. Date</th>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map(sub => (
                                        <tr key={sub.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                            <td style={{ padding: '12px' }}>{sub.role}</td>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{sub.firstName} {sub.secondName}</td>
                                            <td style={{ padding: '12px' }}>{sub.gender}</td>
                                            <td style={{ padding: '12px' }}>{sub.role === 'student' ? sub.class : `${sub.expYears || 0}y ${sub.expMonths || 0}m`}</td>
                                            <td style={{ padding: '12px' }}>{sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    backgroundColor: sub.status === 'pending' ? '#fff3cd' : '#d4edda',
                                                    color: sub.status === 'pending' ? '#856404' : '#155724',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Announcement Modal */}
            {
                showModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                            <h3>📢 Make Institution Announcement</h3>
                            <p className="text-muted" style={{ fontSize: '12px' }}>This will be visible to all students and teachers.</p>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', color: '#666', display: 'block' }}>Class:</label>
                                    <select
                                        className="input-field"
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                        style={{ margin: 0 }}
                                    >
                                        <option value="All">All Classes</option>
                                        <option value="Nursery">Nursery</option>
                                        <option value="LKG">LKG</option>
                                        <option value="UKG">UKG</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => <option key={c} value={c.toString()}>Class {c}</option>)}
                                    </select>
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
                                        <option value="A">Section A</option>
                                        <option value="B">Section B</option>
                                        <option value="C">Section C</option>
                                        <option value="D">Section D</option>
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
                                <button className="btn-outline" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', background: 'transparent', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                <button className="btn" onClick={handlePostAnnouncement}>Post</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
