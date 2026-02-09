import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function PerformanceAnalytics() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [studentMarks, setStudentMarks] = useState([]);
    const [subjectStats, setSubjectStats] = useState({});
    const [classRank, setClassRank] = useState(null);
    const [totalStudents, setTotalStudents] = useState(0);

    // For Teachers: Select student to view
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentsList, setStudentsList] = useState([]);

    useEffect(() => {
        if (userData?.role === 'student') {
            fetchStudentData(userData.uid);
        } else if (userData?.role === 'teacher' || userData?.role === 'institution') {
            fetchStudentsList();
        }
    }, [userData]);

    const fetchStudentsList = async () => {
        try {
            const q = query(
                collection(db, "student_allotments"),
                where("createdBy", "==", userData.institutionId || userData.uid)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.data().studentId || d.id,
                name: d.data().studentName || d.data().name,
                class: d.data().classAssigned,
                section: d.data().section
            }));
            setStudentsList(list);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const fetchStudentData = async (studentId) => {
        setLoading(true);
        try {
            // Fetch all marks for this student
            const q = query(
                collection(db, "marks"),
                where("studentId", "==", studentId),
                orderBy("createdAt", "asc")
            );
            const snap = await getDocs(q);
            const marks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudentMarks(marks);

            // Calculate subject-wise stats
            const stats = {};
            marks.forEach(mark => {
                if (!stats[mark.subject]) {
                    stats[mark.subject] = { total: 0, count: 0, marks: [] };
                }
                stats[mark.subject].total += mark.marks;
                stats[mark.subject].count += 1;
                stats[mark.subject].marks.push({ exam: mark.examType, marks: mark.marks, max: mark.maxMarks });
            });

            // Calculate averages
            Object.keys(stats).forEach(subject => {
                stats[subject].average = (stats[subject].total / stats[subject].count).toFixed(1);
            });

            setSubjectStats(stats);

            // Calculate class rank (simplified - based on total marks)
            if (marks.length > 0) {
                const studentTotal = marks.reduce((sum, m) => sum + m.marks, 0);
                const classId = marks[0].class;
                const sectionId = marks[0].section;

                // Fetch all students' marks in same class
                const classQuery = query(
                    collection(db, "marks"),
                    where("class", "==", classId),
                    where("section", "==", sectionId)
                );
                const classSnap = await getDocs(classQuery);

                // Group by student and calculate totals
                const studentTotals = {};
                classSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (!studentTotals[data.studentId]) {
                        studentTotals[data.studentId] = 0;
                    }
                    studentTotals[data.studentId] += data.marks;
                });

                const totalsArray = Object.values(studentTotals).sort((a, b) => b - a);
                const rank = totalsArray.findIndex(total => total <= studentTotal) + 1;

                setClassRank(rank);
                setTotalStudents(totalsArray.length);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const generateReportCard = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(userData?.institutionName || "Together To Refine", 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text("STUDENT REPORT CARD", 105, 30, { align: 'center' });

        // Student Info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const studentName = selectedStudent?.name || userData?.name || "Student";
        const studentClass = studentMarks[0]?.class || "N/A";
        const studentSection = studentMarks[0]?.section || "N/A";

        doc.text(`Name: ${studentName}`, 20, 45);
        doc.text(`Class: ${studentClass} - ${studentSection}`, 20, 52);
        doc.text(`Academic Year: 2025-26`, 20, 59);
        doc.text(`Rank: ${classRank || 'N/A'} / ${totalStudents}`, 150, 52);

        // Marks Table
        const tableData = [];
        Object.entries(subjectStats).forEach(([subject, stats]) => {
            tableData.push([
                subject,
                stats.count,
                stats.total,
                stats.average,
                stats.average >= 75 ? 'A+' : stats.average >= 60 ? 'A' : stats.average >= 45 ? 'B' : 'C'
            ]);
        });

        doc.autoTable({
            startY: 70,
            head: [['Subject', 'Tests Taken', 'Total Marks', 'Average', 'Grade']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
        });

        // Performance Summary
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("Performance Summary:", 20, finalY);

        doc.setFont('helvetica', 'normal');
        const overallAvg = (Object.values(subjectStats).reduce((sum, s) => sum + parseFloat(s.average), 0) / Object.keys(subjectStats).length).toFixed(1);
        doc.text(`Overall Average: ${overallAvg}%`, 20, finalY + 7);
        doc.text(`Class Rank: ${classRank || 'N/A'} out of ${totalStudents}`, 20, finalY + 14);

        // Footer
        doc.setFontSize(9);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 280);
        doc.text("Powered by Together To Refine", 150, 280);

        doc.save(`Report_Card_${studentName.replace(/\s/g, '_')}.pdf`);
    };

    // UI Helper Components
    const StatCard = ({ title, value, subtitle, color, icon }) => (
        <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: '1 1 200px',
            borderTop: `4px solid ${color}`
        }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '13px', color: '#636e72', textTransform: 'uppercase', marginBottom: '5px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3436' }}>{value}</div>
            {subtitle && <div style={{ fontSize: '12px', color: color, marginTop: '5px' }}>{subtitle}</div>}
        </div>
    );

    const SubjectCard = ({ subject, stats }) => {
        const percentage = parseFloat(stats.average);
        const color = percentage >= 75 ? '#27ae60' : percentage >= 60 ? '#f39c12' : percentage >= 45 ? '#e67e22' : '#e74c3c';

        return (
            <div style={{ background: 'white', borderRadius: '8px', padding: '15px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0 }}>{subject}</h4>
                    <div style={{
                        background: `${color}20`,
                        color: color,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}>
                        {stats.average}%
                    </div>
                </div>

                {/* Mini bar chart */}
                <div style={{ display: 'flex', gap: '5px', height: '60px', alignItems: 'flex-end' }}>
                    {stats.marks.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: '100%',
                                background: color,
                                height: `${(m.marks / m.max) * 100}%`,
                                borderRadius: '4px 4px 0 0',
                                minHeight: '5px'
                            }}></div>
                            <div style={{ fontSize: '9px', color: '#999', marginTop: '3px' }}>{m.exam.split(' ')[0]}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
                    <div>Loading analytics...</div>
                </div>
            </div>
        );
    }

    // Teacher/Institution View: Select Student
    if ((userData?.role === 'teacher' || userData?.role === 'institution') && !selectedStudent) {
        return (
            <div className="page-wrapper">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>📊 Performance Analytics</h2>
                        <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                    </div>

                    <div className="card">
                        <h3>Select a Student</h3>
                        <p style={{ color: '#636e72', marginBottom: '20px' }}>Choose a student to view their detailed performance report</p>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {studentsList.map(student => (
                                <div
                                    key={student.id}
                                    onClick={() => {
                                        setSelectedStudent(student);
                                        fetchStudentData(student.id);
                                    }}
                                    style={{
                                        padding: '15px', border: '1px solid #eee', borderRadius: '8px',
                                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                >
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{student.name}</div>
                                        <div style={{ fontSize: '12px', color: '#999' }}>Class {student.class} - {student.section}</div>
                                    </div>
                                    <div style={{ color: '#0984e3' }}>→</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main Analytics View
    const overallAvg = Object.keys(subjectStats).length > 0
        ? (Object.values(subjectStats).reduce((sum, s) => sum + parseFloat(s.average), 0) / Object.keys(subjectStats).length).toFixed(1)
        : 0;

    return (
        <div className="page-wrapper" style={{ background: '#f5f6fa', minHeight: '100vh' }}>
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>📊 Performance Analytics</h2>
                        {selectedStudent && (
                            <p style={{ margin: '5px 0 0 0', color: '#636e72' }}>{selectedStudent.name} - Class {selectedStudent.class}</p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {selectedStudent && (
                            <button onClick={() => setSelectedStudent(null)} className="btn-outline">← Change Student</button>
                        )}
                        <button onClick={() => navigate(-1)} className="btn-outline">✕ Close</button>
                    </div>
                </div>

                {studentMarks.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
                        <h3>No Performance Data Yet</h3>
                        <p style={{ color: '#999' }}>Marks will appear here once teachers enter them.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Overview */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                            <StatCard
                                title="Overall Average"
                                value={`${overallAvg}%`}
                                subtitle={overallAvg >= 75 ? "Excellent!" : overallAvg >= 60 ? "Good" : "Needs Improvement"}
                                color={overallAvg >= 75 ? '#27ae60' : overallAvg >= 60 ? '#f39c12' : '#e74c3c'}
                                icon="📈"
                            />
                            <StatCard
                                title="Class Rank"
                                value={classRank || 'N/A'}
                                subtitle={`Out of ${totalStudents} students`}
                                color="#3498db"
                                icon="🏆"
                            />
                            <StatCard
                                title="Subjects"
                                value={Object.keys(subjectStats).length}
                                subtitle={`${studentMarks.length} tests taken`}
                                color="#9b59b6"
                                icon="📚"
                            />
                        </div>

                        {/* Subject-wise Performance */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>Subject-wise Performance</h3>
                                <button onClick={generateReportCard} className="btn" style={{ background: '#e74c3c' }}>
                                    📄 Download Report Card
                                </button>
                            </div>

                            {Object.entries(subjectStats).map(([subject, stats]) => (
                                <SubjectCard key={subject} subject={subject} stats={stats} />
                            ))}
                        </div>

                        {/* Recent Tests */}
                        <div className="card">
                            <h3>Recent Test Results</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Subject</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Exam</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Marks</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentMarks.slice().reverse().map(mark => {
                                            const percentage = (mark.marks / mark.maxMarks) * 100;
                                            const color = percentage >= 75 ? '#27ae60' : percentage >= 60 ? '#f39c12' : '#e74c3c';

                                            return (
                                                <tr key={mark.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '10px', fontSize: '13px' }}>
                                                        {mark.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>{mark.subject}</td>
                                                    <td style={{ padding: '10px', fontSize: '13px', color: '#636e72' }}>{mark.examType}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                                        {mark.marks}/{mark.maxMarks}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                                        <span style={{
                                                            background: `${color}20`,
                                                            color: color,
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {percentage.toFixed(0)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
