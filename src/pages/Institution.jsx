import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import FeatureTour from '../components/FeatureTour';
import { useNavigate } from 'react-router-dom';

export default function Institution() {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');

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
            const auth = getAuth();
            const uid = auth.currentUser?.uid;

            await addDoc(collection(db, "announcements"), {
                text: announcementText,
                targetClass: selectedClass,
                targetSection: selectedSection,
                subject: 'General',
                authorName: profile?.institutionName || 'Institution Admin',
                authorId: uid,
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
            alert("Failed to post announcement.");
        }
    };

    const handleBulkImport = async (csvText) => {
        try {
            const rows = csvText.trim().split('\n');
            const students = rows.map(row => {
                const [name, email, password, className] = row.split(',').map(s => s.trim());
                return { name, email, password, class: className };
            });

            if (students.length === 0) return alert("Invalid CSV format.");

            const confirm = window.confirm(`Ready to import ${students.length} students?`);
            if (!confirm) return;

            setLoading(true);
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
                    // Generate Credentials Report
                    let reportContent = "STUDENT CREDENTIALS REPORT\n" +
                        "==================================\n" +
                        `Date: ${new Date().toLocaleString()}\n` +
                        "Note: Distribute these credentials securely to students.\n\n";

                    data.results.success.forEach(s => {
                        reportContent += `----------------------------------\n`;
                        reportContent += `Name:     ${s.name}\n`;
                        reportContent += `Class:    ${s.class}\n`;
                        reportContent += `PID:      ${s.pid}\n`;
                        reportContent += `Login ID: ${s.email}\n`;
                        reportContent += `Password: ${s.password}\n`;
                    });

                    // Trigger Download
                    const blob = new Blob([reportContent], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Student_Credentials_${new Date().toISOString().slice(0, 10)}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            } else {
                alert("Import failed: " + (data.error || "Unknown error"));
            }

        } catch (e) {
            console.error(e);
            alert("Error parsing CSV or sending request.");
            setLoading(false);
        }
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

    return (
        <div className="page-wrapper">
            <FeatureTour tourId="institution_dashboard_v1" steps={tourSteps} />
            <AIBadge />

            <div style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>

                {/* Bulk Import Button */}
                <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                    <button
                        id="tour-inst-announcement"
                        onClick={() => setShowModal(true)}
                        style={{
                            width: '45px', height: '45px', borderRadius: '50%',
                            background: 'white', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer',
                            color: '#6c5ce7'
                        }}
                        title="Make Announcement"
                    >
                        📢
                    </button>
                    <button
                        id="tour-inst-import"
                        onClick={() => {
                            const csv = prompt("Paste CSV Data (Name, Email, Password, Class)\nExample:\nJohn Doe,john@test.com,Pass123,10th");
                            if (csv) handleBulkImport(csv);
                        }}
                        style={{
                            padding: '0 20px', borderRadius: '25px',
                            background: '#00b894', border: 'none', color: 'white',
                            fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}
                    >
                        📤 Bulk Import Students
                    </button>
                </div>

                <div className="card" style={{ marginBottom: '20px', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        {/* PID Badge */}
                        {profile?.pid && (
                            <div style={{
                                background: '#f1f2f6', color: '#2d3436',
                                display: 'inline-block', padding: '6px 14px',
                                borderRadius: '20px', fontSize: '14px',
                                fontWeight: 'bold', border: '1px solid #dfe6e9'
                            }}>
                                ID: {profile.pid}
                            </div>
                        )}
                        {profile && (
                            <div style={{ textAlign: 'right', fontSize: '15px', color: '#666' }}>
                                <div style={{ fontWeight: '600', marginBottom: '2px' }}>{profile.principalName} (Principal)</div>
                                <div style={{ fontSize: '13px' }}>Est: {profile.estYear}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                    <button id="tour-inst-allotment" className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6c5ce7' }} onClick={() => handleCardClick('/allotment')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📘</span>
                        <span>Allotments</span>
                    </button>
                    <button id="tour-inst-admission" className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d3436' }} onClick={() => handleCardClick('/admission')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📝</span>
                        <span>Admission</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0984e3' }} onClick={() => handleCardClick('/attendance')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📅</span>
                        <span>Attendance</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00b894' }} onClick={() => handleCardClick('/group')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>👥</span>
                        <span>Groups</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e67e22' }} onClick={() => handleCardClick('/notification')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📢</span>
                        <span>Notify</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e84393' }} onClick={() => handleCardClick('/general-feedback')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📊</span>
                        <span>Feedback</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff7675' }} onClick={() => handleCardClick('/health')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>🏥</span>
                        <span>Health</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#636e72' }} onClick={() => handleCardClick('/waiting-list')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>🕒</span>
                        <span>Waiting List</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d63031' }} onClick={() => handleCardClick('/video-library')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>🎬</span>
                        <span>Video Lib</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdcb6e', color: '#2d3436' }} onClick={() => handleCardClick('/timetable')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>🗓️</span>
                        <span>Timetable</span>
                    </button>
                    <button className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6c5ce7', color: 'white' }} onClick={() => handleCardClick('/faculty-feedback')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>👨‍🏫</span>
                        <span>Teachers</span>
                    </button>
                    <button id="tour-inst-fees" className="btn" style={{ height: '110px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2c3e50', color: 'white' }} onClick={() => handleCardClick('/fees/institution')}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>💰</span>
                        <span>Fee Mgmt</span>
                    </button>
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
