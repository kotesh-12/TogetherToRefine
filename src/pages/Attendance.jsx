import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useUser } from '../context/UserContext';

export default function Attendance() {
    const { userData } = useUser();
    const role = userData?.role;

    // View State
    const [view, setView] = useState('students');
    const [cls, setCls] = useState('');
    const [subject, setSubject] = useState(''); // New: Subject Context
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Student Stats State
    const [mySubjectStats, setMySubjectStats] = useState([]);
    const [myOverallStats, setMyOverallStats] = useState({ present: 0, total: 0, percent: 0 });
    const [myHistory, setMyHistory] = useState([]); // New: History State

    useEffect(() => {
        if (role) {
            if (role === 'institution') setView('teachers');
            else setView('students');

            if (role === 'student' || role === 'teacher') {
                fetchMyStats();
            }
        }
    }, [role, userData]);

    useEffect(() => {
        if (role === 'student') return;
        fetchData();
    }, [view, cls, subject, selectedDate, role]);

    const fetchMyStats = async () => {
        if (!userData?.uid) return;
        try {
            const q = query(collection(db, "attendance"), where("userId", "==", userData.uid));
            const snapshot = await getDocs(q);

            const subjectsObj = {};
            let globalTotal = 0;
            let globalPresent = 0;
            const historyList = [];

            snapshot.forEach(d => {
                const data = d.data();
                historyList.push({ id: d.id, ...data });

                const subj = data.subject || 'General';

                if (!subjectsObj[subj]) subjectsObj[subj] = { total: 0, present: 0 };

                subjectsObj[subj].total++;
                globalTotal++;

                if (data.status === 'present') {
                    subjectsObj[subj].present++;
                    globalPresent++;
                }
            });

            // Sort history by date descending
            historyList.sort((a, b) => new Date(b.date) - new Date(a.date));
            setMyHistory(historyList);

            // Convert to Array
            const statsArr = Object.keys(subjectsObj).map(key => ({
                subject: key,
                present: subjectsObj[key].present,
                total: subjectsObj[key].total,
                percent: subjectsObj[key].total > 0 ? ((subjectsObj[key].present / subjectsObj[key].total) * 100).toFixed(0) : 0
            }));

            setMySubjectStats(statsArr);
            setMyOverallStats({
                present: globalPresent,
                total: globalTotal,
                percent: globalTotal > 0 ? ((globalPresent / globalTotal) * 100).toFixed(0) : 0
            });

        } catch (e) {
            console.error("Error fetching stats", e);
        }
    };

    const fetchData = async () => {
        if (view === 'students' && !cls) {
            setList([]);
            return;
        }

        setLoading(true);
        setList([]);
        try {
            const colName = view === 'teachers' ? 'teacher_allotments' : 'student_allotments';
            let q;

            if (view === 'students') {
                const [classNum, sec] = cls.split('-');
                if (sec) {
                    q = query(collection(db, colName), where('classAssigned', '==', classNum), where('section', '==', sec));
                } else {
                    q = query(collection(db, colName), where('classAssigned', '==', cls));
                }
            } else {
                // Fetch All Allotments to find Teachers linked to this Institution
                q = query(collection(db, colName), where('createdBy', '==', userData.uid));
            }

            const snapshot = await getDocs(q);
            let rawList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Deduplicate Teachers if view is 'teachers'
            let fetched = rawList;
            if (view === 'teachers') {
                const uniqueMap = new Map();
                rawList.forEach(item => {
                    if (!item.teacherId) return;
                    if (!uniqueMap.has(item.teacherId)) {
                        uniqueMap.set(item.teacherId, {
                            id: item.teacherId, // Use User UID as ID
                            name: item.teacherName || 'Unknown Teacher',
                            classAssigned: 'Teacher', // Label
                            ...item
                        });
                    }
                });
                fetched = Array.from(uniqueMap.values());
            }

            // Fetch Attendance for Date
            let attQuery = query(collection(db, "attendance"), where("date", "==", selectedDate));
            if (view === 'students' && subject) {
                attQuery = query(collection(db, "attendance"), where("date", "==", selectedDate), where("subject", "==", subject));
            }

            const attendanceSnap = await getDocs(attQuery);
            const attendanceMap = {};
            attendanceSnap.docs.forEach(d => {
                attendanceMap[d.data().userId] = d.data().status;
            });

            // Calculate Stats (Example: Consistency)
            const stats = await Promise.all(fetched.map(async (p) => {
                try {
                    const allAtt = await getDocs(query(collection(db, "attendance"), where("userId", "==", p.id)));
                    let total = 0, present = 0;
                    allAtt.forEach(doc => { total++; if (doc.data().status === 'present') present++; });
                    return { userId: p.id, percent: total > 0 ? ((present / total) * 100).toFixed(0) : 0 };
                } catch { return { userId: p.id, percent: 0 }; }
            }));
            const statsMap = {};
            stats.forEach(s => statsMap[s.userId] = s.percent);

            const merged = fetched.map(p => ({
                ...p,
                status: attendanceMap[p.id] || 'pending',
                percentage: statsMap[p.id] || 0
            }));

            setList(merged);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const markAttendance = async (id, status) => {
        // Validation: If marking students, Subject is required (User Request)
        if (view === 'students' && !subject) {
            alert("Please enter/select a Subject first (e.g., Maths, Science).");
            return;
        }

        try {
            const finalSubject = view === 'teachers' ? 'General' : subject; // Teachers don't have subject-wise attendance usually
            const docId = `${selectedDate}_${id}_${finalSubject}`;

            await setDoc(doc(db, "attendance", docId), {
                userId: id,
                date: selectedDate,
                subject: finalSubject,
                status: status,
                role: view === 'teachers' ? 'teacher' : 'student',
                updater: userData.uid,
                timestamp: new Date()
            });
            setList(prev => prev.map(item => item.id === id ? { ...item, status } : item));
        } catch (e) {
            alert("Error marking attendance");
        }
    };

    // --- STUDENT VIEW ---
    if (role === 'student') {
        return (
            <div className="page-wrapper">
                <AIBadge />
                <AnnouncementBar title="My Attendance" leftIcon="back" />
                <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>

                    {/* Overall Score Card */}
                    <div className="card text-center" style={{ padding: '30px', marginBottom: '20px', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white' }}>
                        <h2 style={{ margin: 0, color: 'white' }}>Overall Attendance</h2>
                        <div style={{ fontSize: '3.5rem', fontWeight: 'bold', margin: '10px 0' }}>
                            {myOverallStats.percent}%
                        </div>
                        <p style={{ opacity: 0.9 }}>
                            {myOverallStats.present} / {myOverallStats.total} Classes Attended
                        </p>
                    </div>

                    {/* Subject-Wise Breakdown */}
                    <h3 style={{ marginLeft: '10px' }}>Subject-Wise Breakdown</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                        {mySubjectStats.length > 0 ? mySubjectStats.map((stat, idx) => (
                            <div key={idx} className="card" style={{ padding: '20px', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px', color: '#2d3436' }}>{stat.subject}</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: stat.percent >= 75 ? '#00b894' : '#d63031' }}>
                                    {stat.percent}%
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#636e72', marginTop: '5px' }}>
                                    {stat.present} / {stat.total} Classes
                                </div>
                            </div>
                        )) : (
                            <p className="text-muted" style={{ padding: '20px' }}>No subject records found yet.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- TEACHER & INSTITUTION VIEW ---
    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title={role === 'institution' ? "Institution Attendance" : "Attendance Manager"} leftIcon="back" />

            <div className="container" style={{ maxWidth: '900px', margin: '20px auto' }}>

                {/* Teacher's Own Stats */}
                {role === 'teacher' && (
                    <div className="card" style={{ background: 'linear-gradient(to right, #74b9ff, #a29bfe)', color: 'white', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'white' }}>My Attendance</h3>
                                <p style={{ margin: 0, opacity: 0.9 }}>Overall</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{myOverallStats.percent}%</div>
                                <div style={{ fontSize: '0.9rem' }}>{myOverallStats.present}/{myOverallStats.total} Days</div>
                            </div>
                        </div>

                        {/* Recent History Toggle/View */}
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '5px' }}>Recent History</h4>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {myHistory.length > 0 ? myHistory.map(h => (
                                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '4px' }}>
                                        <span>{h.date}</span>
                                        <span style={{ fontWeight: 'bold', color: h.status === 'present' ? '#55efc4' : '#fab1a0' }}>
                                            {h.status.toUpperCase()}
                                        </span>
                                    </div>
                                )) : <div style={{ fontSize: '12px' }}>No records yet.</div>}
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <h3 className="text-center" style={{ marginBottom: '20px' }}>Manage Attendance</h3>

                    {/* Controls Row */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px', alignItems: 'center' }}>

                        <input type="date" className="input-field" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 'auto', margin: 0 }} />

                        {view === 'students' && (
                            <>
                                <select className="input-field" value={cls} onChange={(e) => setCls(e.target.value)} style={{ width: '150px', margin: 0 }}>
                                    <option value="">- Class -</option>
                                    {['Nursery-A', 'LKG-A', 'UKG-A', '1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '10-B'].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>

                                {/* Subject Input */}
                                <input
                                    className="input-field"
                                    placeholder="Subject (e.g. Maths)"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    style={{ width: '180px', margin: 0 }}
                                    list="subjects-list"
                                />
                                <datalist id="subjects-list">
                                    <option value="Telugu" />
                                    <option value="Hindi" />
                                    <option value="English" />
                                    <option value="Mathematics" />
                                    <option value="Science" />
                                    <option value="Social Studies" />
                                    <option value="Physical Science" />
                                    <option value="Natural Science" />
                                    <option value="Environmental Science (EVS)" />
                                    <option value="Sanskrit" />
                                </datalist>
                            </>
                        )}

                        {role === 'institution' && (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button className={`btn`} style={{ padding: '10px', background: view === 'students' ? '#0984e3' : '#b2bec3' }} onClick={() => setView('students')}>Students</button>
                                <button className={`btn`} style={{ padding: '10px', background: view === 'teachers' ? '#e17055' : '#b2bec3' }} onClick={() => setView('teachers')}>Teachers</button>
                            </div>
                        )}
                    </div>

                    {/* List */}
                    <div className="list-container">
                        {loading && <p className="text-center">Loading...</p>}
                        {!loading && list.length === 0 && (
                            <div className="text-center text-muted">
                                {view === 'students' && (!cls || !subject) ? "Select a Class & Subject." : "No records found."}
                            </div>
                        )}

                        {list.map(item => (
                            <div key={item.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px', borderBottom: '1px solid #eee',
                                background: item.status === 'present' ? '#e6ffec' : (item.status === 'absent' ? '#ffe6e6' : 'white')
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dfe6e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {item.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{item.name}</div>
                                        <div style={{ fontSize: '13px', color: '#636e72' }}>{item.classAssigned}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {/* Overall Consistency (Optional to show here) */}
                                    <div style={{ fontSize: '12px', marginRight: '10px', color: '#888' }} title="Overall Attendance">
                                        {item.percentage}%
                                    </div>

                                    <button
                                        onClick={() => markAttendance(item.id, 'present')}
                                        style={{
                                            padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            background: item.status === 'present' ? '#00b894' : '#ecf0f1', color: item.status === 'present' ? 'white' : '#2d3436'
                                        }}>
                                        P
                                    </button>
                                    <button
                                        onClick={() => markAttendance(item.id, 'absent')}
                                        style={{
                                            padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            background: item.status === 'absent' ? '#d63031' : '#ecf0f1', color: item.status === 'absent' ? 'white' : '#2d3436'
                                        }}>
                                        A
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
