import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import AnnouncementBar from '../components/AnnouncementBar';

import { useUser } from '../context/UserContext';

export default function FacultyFeedback() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [teachers, setTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

    useEffect(() => {
        const fetchTeachers = async () => {
            if (!userData) return;

            try {
                // Include Institution (Self) in the list
                const selfEntry = { id: userData.uid, name: 'Institution (Me)', isInstitution: true };

                // Fetch teachers from teacher_allotments 
                // We should ideally filter by 'createdBy' == userData.uid
                const q = query(collection(db, "teacher_allotments"), where("createdBy", "==", userData.uid));
                const snap = await getDocs(q);

                // Deduplicate teachers
                const uniqueTeachers = new Map();

                // Add Self first
                uniqueTeachers.set(selfEntry.id, selfEntry);

                snap.forEach(d => {
                    const data = d.data();
                    const name = data.name || data.teacherName;
                    // FIX: Prioritize teacherId to match SelectFeedbackTarget logic
                    const id = data.teacherId || data.userId || d.id;
                    if (name && !uniqueTeachers.has(id)) {
                        uniqueTeachers.set(id, { id, name });
                    }
                });

                setTeachers(Array.from(uniqueTeachers.values()));
            } catch (e) {
                console.error("Error fetching teachers", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTeachers();
    }, [userData]);

    const handleSelectTeacher = async (teacher) => {
        setSelectedTeacher(teacher);
        setLoadingFeedbacks(true);
        try {
            // Fetch last 1 year feedbacks for this teacher
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const queries = [
                getDocs(query(collection(db, "general_feedback"), where("targetId", "==", teacher.id)))
            ];

            // If viewing Institution, also fetch Emergency Reports
            if (teacher.isInstitution) {
                queries.push(
                    getDocs(query(collection(db, "emergency_reports"), where("institutionId", "==", teacher.id)))
                );
            }

            const snapshots = await Promise.all(queries);
            const feedbackSnap = snapshots[0];
            const reportSnap = snapshots[1]; // Undefined if not institution

            let list = feedbackSnap.docs
                .map(d => ({ id: d.id, ...d.data(), isReport: false }))
                .filter(f => f.timestamp && f.timestamp.toDate() >= oneYearAgo);

            if (reportSnap) {
                const reports = reportSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    isReport: true,
                    timestamp: d.data().createdAt // normalize timestamp for sort
                }));
                // Filter reports by date too if needed? Let's show all recent ones.
                list = [...list, ...reports];
            }

            // Client-side Sort
            list.sort((a, b) => {
                const tA = a.timestamp?.seconds || 0;
                const tB = b.timestamp?.seconds || 0;
                return tB - tA;
            });

            setFeedbacks(list);
        } catch (e) {
            console.error("Error fetching feedback details", e);
        } finally {
            setLoadingFeedbacks(false);
        }
    };

    return (
        <div className="page-wrapper">
            <AnnouncementBar title="Faculty Feedback Review" leftIcon={false} backPath="/institution" />

            <div className="container" style={{ maxWidth: '1000px', margin: '20px auto' }}>
                {!selectedTeacher ? (
                    <div className="card">
                        <h2 className="text-center">Select Faculty Member</h2>
                        <p className="text-center text-muted">View feedback analytics for the past year.</p>

                        {loading ? <div className="text-center">Loading Faculty List...</div> : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' }}>
                                {teachers.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleSelectTeacher(t)}
                                        className="card"
                                        style={{
                                            cursor: 'pointer', textAlign: 'center', padding: '20px',
                                            border: '1px solid #eee', transition: 'transform 0.2s',
                                            background: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>👨‍🏫</div>
                                        <h3 style={{ fontSize: '16px', margin: '0', color: '#2d3436' }}>{t.name}</h3>
                                        <div style={{ fontSize: '12px', color: '#636e72', marginTop: '5px' }}>Click to View Report</div>
                                    </div>
                                ))}
                                {teachers.length === 0 && <div className="text-center text-muted" style={{ gridColumn: '1/-1' }}>No faculty members found.</div>}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <button className="btn" style={{ marginBottom: '20px', background: '#b2bec3' }} onClick={() => setSelectedTeacher(null)}>← Back to List</button>

                        <div className="card">
                            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
                                <h2 style={{ margin: 0 }}>Feedback Report: {selectedTeacher.name}</h2>
                                <p style={{ color: '#666', margin: '5px 0' }}>Showing feedback from the last 1 year.</p>
                            </div>

                            {loadingFeedbacks ? <div className="text-center">Loading Feedback Data...</div> : (
                                <>
                                    {feedbacks.length === 0 ? (
                                        <div className="text-center" style={{ padding: '40px', color: '#b2bec3' }}>No feedback received in the last year.</div>
                                    ) : (
                                        <div className="list-container">
                                            {feedbacks.map(f => {
                                                if (f.isReport) {
                                                    return (
                                                        <div key={f.id} style={{
                                                            padding: '20px', border: '2px solid #ff7675', marginBottom: '15px',
                                                            borderRadius: '12px', background: '#fff0f0'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                                <div>
                                                                    <strong style={{ color: '#d63031', fontSize: '16px' }}>
                                                                        {f.type === 'sexual_harassment' ? '🚨 SEXUAL HARASSMENT REPORT' : '⚠️ MISBEHAVIOR REPORT'}
                                                                    </strong>
                                                                    <span style={{ display: 'block', fontSize: '13px', color: '#636e72', marginTop: '4px' }}>
                                                                        From: {f.authorName || 'Anonymous'} ({f.authorRole || 'Student'})
                                                                    </span>
                                                                </div>
                                                                <span style={{ fontSize: '12px', color: '#b2bec3' }}>
                                                                    {f.timestamp?.seconds ? new Date(f.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                                                                </span>
                                                            </div>

                                                            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#2d3436' }}>
                                                                <span style={{ fontWeight: 'bold' }}>Accused:</span> {f.accusedName}
                                                            </div>
                                                            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#2d3436' }}>
                                                                <span style={{ fontWeight: 'bold' }}>Location:</span> {f.location}
                                                            </div>

                                                            <p style={{ margin: '5px 0', background: 'white', padding: '10px', border: '1px solid #ffdcdc', borderRadius: '5px', color: '#d63031' }}>
                                                                "{f.description}"
                                                            </p>

                                                            {f.evidence && (
                                                                <div style={{ marginTop: '10px' }}>
                                                                    <a href={f.evidence} target="_blank" rel="noreferrer" style={{ color: '#0984e3', textDecoration: 'underline', fontSize: '14px' }}>View Evidence</a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div key={f.id} style={{
                                                            padding: '15px', borderBottom: '1px solid #f1f2f6',
                                                            display: 'flex', flexDirection: 'column', gap: '10px'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                                                <div>
                                                                    <span style={{ fontWeight: 'bold', color: '#0984e3' }}>
                                                                        {f.authorPid ? (<span>🕵️ {f.authorPid}</span>) : (<span>👤 {f.authorName}</span>)}
                                                                    </span>
                                                                    <span style={{ color: '#636e72', marginLeft: '5px' }}>({f.authorRole})</span>
                                                                </div>
                                                                <div style={{ color: '#b2bec3', fontSize: '12px' }}>
                                                                    {f.timestamp?.toDate().toLocaleDateString()}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#2d3436' }}>
                                                                <span><strong>Behavior:</strong> {f.behavior?.stars}★</span>
                                                                <span><strong>Comm:</strong> {f.communication?.stars}★</span>
                                                                <span><strong>Body Lang:</strong> {f.bodyLanguage?.stars}★</span>
                                                                <span><strong>Hardwork:</strong> {f.hardworking?.stars}★</span>
                                                            </div>

                                                            {f.comment && (
                                                                <div style={{
                                                                    background: '#fff3cd', padding: '10px', borderRadius: '6px',
                                                                    fontSize: '13px', color: '#856404', fontStyle: 'italic'
                                                                }}>
                                                                    "{f.comment}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
