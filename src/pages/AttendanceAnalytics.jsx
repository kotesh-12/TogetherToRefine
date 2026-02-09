import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function AttendanceAnalytics() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [heatmapData, setHeatmapData] = useState([]);
    const [classStats, setClassStats] = useState({ avgAttendance: 0, totalDays: 0 });

    useEffect(() => {
        if (userData?.role === 'teacher' || userData?.role === 'institution') {
            // Auto-select first class if teacher
            if (userData.assignedClass) {
                setSelectedClass(userData.assignedClass.toString());
                setSelectedSection(userData.assignedSection || 'A');
            }
        } else if (userData?.role === 'student') {
            // Student sees their own analytics
            setSelectedClass(userData.class || userData.assignedClass);
            setSelectedSection(userData.section || userData.assignedSection);
        }
    }, [userData]);

    useEffect(() => {
        if (selectedClass && selectedSection) {
            fetchAttendanceData();
        }
    }, [selectedClass, selectedSection]);

    const fetchAttendanceData = async () => {
        setLoading(true);
        try {
            // 1. Fetch students in this class
            const studentsQuery = query(
                collection(db, "student_allotments"),
                where("classAssigned", "==", selectedClass),
                where("section", "==", selectedSection)
            );
            const studentsSnap = await getDocs(studentsQuery);
            const studentsList = studentsSnap.docs.map(d => ({
                id: d.data().studentId || d.id,
                name: d.data().studentName || d.data().name
            }));
            setStudents(studentsList);

            // 2. Fetch attendance records
            const attQuery = query(
                collection(db, "attendance"),
                where("class", "==", selectedClass),
                where("section", "==", selectedSection),
                orderBy("date", "desc")
            );
            const attSnap = await getDocs(attQuery);

            // Process attendance data
            const attMap = {};
            const dateSet = new Set();
            let totalPresent = 0;
            let totalRecords = 0;

            attSnap.docs.forEach(doc => {
                const data = doc.data();
                const studentId = data.studentId;
                const date = data.date?.toDate?.()?.toLocaleDateString() || 'Unknown';

                dateSet.add(date);

                if (!attMap[studentId]) {
                    attMap[studentId] = { present: 0, absent: 0, total: 0, dates: {} };
                }

                attMap[studentId].total++;
                attMap[studentId].dates[date] = data.status;

                if (data.status === 'present') {
                    attMap[studentId].present++;
                    totalPresent++;
                } else {
                    attMap[studentId].absent++;
                }
                totalRecords++;
            });

            setAttendanceData(attMap);

            // Calculate class average
            const avgAtt = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0;
            setClassStats({ avgAttendance: avgAtt, totalDays: dateSet.size });

            // Generate heatmap data (last 30 days)
            const dates = Array.from(dateSet).slice(0, 30);
            setHeatmapData(dates);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const sendWhatsAppAlert = (student) => {
        const attRecord = attendanceData[student.id];
        const percentage = attRecord ? ((attRecord.present / attRecord.total) * 100).toFixed(1) : 0;

        const message = `🚨 ATTENDANCE ALERT\n\nDear Parent,\n\nYour child ${student.name} has low attendance:\n- Present: ${attRecord?.present || 0} days\n- Absent: ${attRecord?.absent || 0} days\n- Attendance: ${percentage}%\n\nPlease ensure regular attendance.\n\n- ${userData.name}\n${userData.institutionName || 'School'}`;

        window.open(`https://wa.me/919876543210?text=${encodeURIComponent(message)}`, '_blank');
    };

    const getAttendanceColor = (percentage) => {
        if (percentage >= 75) return '#27ae60';
        if (percentage >= 60) return '#f39c12';
        return '#e74c3c';
    };

    const StatCard = ({ icon, title, value, subtitle, color }) => (
        <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: '1 1 200px',
            borderLeft: `4px solid ${color}`
        }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '13px', color: '#636e72', textTransform: 'uppercase', marginBottom: '5px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3436' }}>{value}</div>
            {subtitle && <div style={{ fontSize: '12px', color: color, marginTop: '5px' }}>{subtitle}</div>}
        </div>
    );

    return (
        <div className="page-wrapper" style={{ background: '#f5f6fa', minHeight: '100vh' }}>
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '20px' }}>
                    <h2>📊 Attendance Analytics</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Class Selector */}
                {(userData?.role === 'teacher' || userData?.role === 'institution') && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <select className="input-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ maxWidth: '150px' }}>
                            <option value="">Select Class</option>
                            {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                        </select>
                        <select className="input-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} style={{ maxWidth: '150px' }}>
                            <option value="">Select Section</option>
                            {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>Loading analytics...</div>
                ) : !selectedClass || !selectedSection ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📅</div>
                        <h3>Select Class & Section</h3>
                    </div>
                ) : (
                    <>
                        {/* Stats Overview */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                            <StatCard
                                icon="📈"
                                title="Class Average"
                                value={`${classStats.avgAttendance}%`}
                                subtitle={classStats.avgAttendance >= 75 ? "Excellent!" : "Needs Improvement"}
                                color={getAttendanceColor(classStats.avgAttendance)}
                            />
                            <StatCard
                                icon="📅"
                                title="Total Days"
                                value={classStats.totalDays}
                                subtitle="Attendance recorded"
                                color="#3498db"
                            />
                            <StatCard
                                icon="👥"
                                title="Students"
                                value={students.length}
                                subtitle={`Class ${selectedClass}-${selectedSection}`}
                                color="#9b59b6"
                            />
                        </div>

                        {/* Student List with Heatmap */}
                        <div className="card">
                            <h3 style={{ marginBottom: '15px' }}>Student Attendance Records</h3>

                            {students.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>No students found</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                                            <tr>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', minWidth: '150px' }}>Student Name</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Present</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Absent</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>%</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map(student => {
                                                const attRecord = attendanceData[student.id] || { present: 0, absent: 0, total: 0 };
                                                const percentage = attRecord.total > 0 ? ((attRecord.present / attRecord.total) * 100).toFixed(1) : 0;
                                                const color = getAttendanceColor(percentage);
                                                const isLow = percentage < 75;

                                                return (
                                                    <tr key={student.id} style={{
                                                        borderBottom: '1px solid #eee',
                                                        background: isLow ? '#fff5f5' : 'white'
                                                    }}>
                                                        <td style={{ padding: '10px' }}>
                                                            {student.name}
                                                            {isLow && <span style={{ marginLeft: '8px', color: '#e74c3c', fontSize: '12px' }}>⚠️ Low</span>}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center', color: '#27ae60', fontWeight: 'bold' }}>
                                                            {attRecord.present}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center', color: '#e74c3c', fontWeight: 'bold' }}>
                                                            {attRecord.absent}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            <span style={{
                                                                background: `${color}20`,
                                                                color: color,
                                                                padding: '4px 10px',
                                                                borderRadius: '20px',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {percentage}%
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            {isLow && (
                                                                <button
                                                                    onClick={() => sendWhatsAppAlert(student)}
                                                                    style={{
                                                                        background: '#25D366', color: 'white',
                                                                        border: 'none', padding: '5px 10px',
                                                                        borderRadius: '4px', cursor: 'pointer',
                                                                        fontSize: '12px', fontWeight: 'bold'
                                                                    }}
                                                                >
                                                                    💬 Alert Parent
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard */}
                        <div className="card" style={{ marginTop: '20px' }}>
                            <h3 style={{ marginBottom: '15px' }}>🏆 Attendance Leaderboard</h3>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {students
                                    .map(s => ({
                                        ...s,
                                        percentage: attendanceData[s.id]?.total > 0
                                            ? ((attendanceData[s.id].present / attendanceData[s.id].total) * 100).toFixed(1)
                                            : 0
                                    }))
                                    .sort((a, b) => b.percentage - a.percentage)
                                    .slice(0, 5)
                                    .map((student, index) => (
                                        <div key={student.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px', background: index === 0 ? '#fff9e6' : '#f8f9fa',
                                            borderRadius: '8px', borderLeft: `4px solid ${index === 0 ? '#f39c12' : '#ddd'}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    fontSize: '20px',
                                                    fontWeight: 'bold',
                                                    color: index === 0 ? '#f39c12' : '#636e72'
                                                }}>
                                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                                </div>
                                                <div>{student.name}</div>
                                            </div>
                                            <div style={{
                                                fontWeight: 'bold',
                                                color: getAttendanceColor(student.percentage),
                                                fontSize: '16px'
                                            }}>
                                                {student.percentage}%
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
