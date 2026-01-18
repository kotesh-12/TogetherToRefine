import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import AnnouncementBar from '../components/AnnouncementBar';

export default function FacultyFeedback() {
    const navigate = useNavigate();
    const [teachers, setTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                // Fetch teachers from teacher_allotments or users collection
                // Assuming we want to see all teachers linked to this institution?
                // For now, let's fetch all 'teacher' roles. In production, filter by Institution ID.
                const q = query(collection(db, "teacher_allotments")); // Actually, better to fetch unique teachers
                // Or assuming Institution Dashboard links here, we can fetch all teachers who are targets of feedback?
                // Let's fetch all teachers first to show the list.
                const teacherQ = query(collection(db, "teacher_allotments"));
                const snap = await getDocs(teacherQ);

                // Deduplicate teachers
                const uniqueTeachers = new Map();
                snap.forEach(d => {
                    const data = d.data();
                    const name = data.name || data.teacherName;
                    const id = data.userId || data.teacherId || d.id;
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
    }, []);

    const handleSelectTeacher = async (teacher) => {
        setSelectedTeacher(teacher);
        setLoadingFeedbacks(true);
        try {
            // Fetch last 1 year feedbacks for this teacher
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const q = query(
                collection(db, "general_feedback"),
                where("targetId", "==", teacher.id),
                orderBy("timestamp", "desc")
            );

            const snap = await getDocs(q);
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(f => f.timestamp && f.timestamp.toDate() >= oneYearAgo); // Client-side date filter if compound index is missing

            setFeedbacks(list);
        } catch (e) {
            console.error("Error fetching feedback details", e);
        } finally {
            setLoadingFeedbacks(false);
        }
    };

    return (
        <div className="page-wrapper">
            <AnnouncementBar title="Faculty Feedback Review" leftIcon="back" backPath="/institution" />

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
                                            {feedbacks.map(f => (
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
                                            ))}
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
