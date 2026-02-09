import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function TimetableGenerator() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [mode, setMode] = useState('view'); // 'view' or 'generate'
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    // Generation State
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState(['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer', 'Physical Education']);
    const [periodsPerDay, setPeriodsPerDay] = useState(7);
    const [generatedTimetable, setGeneratedTimetable] = useState(null);

    // View State
    const [existingTimetable, setExistingTimetable] = useState(null);
    const [loading, setLoading] = useState(false);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periodTimes = [
        '8:00-8:45', '8:45-9:30', '9:30-10:15', '10:15-11:00',
        '11:15-12:00', '12:00-12:45', '12:45-1:30'
    ];

    useEffect(() => {
        if (userData?.role === 'institution' || userData?.role === 'teacher') {
            fetchTeachers();
        }
    }, [userData]);

    useEffect(() => {
        if (selectedClass && selectedSection && mode === 'view') {
            fetchExistingTimetable();
        }
    }, [selectedClass, selectedSection, mode]);

    const fetchTeachers = async () => {
        try {
            const q = query(
                collection(db, "teacher_allotments"),
                where("createdBy", "==", userData.institutionId || userData.uid)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                name: d.data().teacherName,
                subject: d.data().subject,
                teacherId: d.data().teacherId
            }));
            setTeachers(list);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchExistingTimetable = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "timetables"),
                where("class", "==", selectedClass),
                where("section", "==", selectedSection)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const data = snap.docs[0].data();
                setExistingTimetable({ id: snap.docs[0].id, ...data });
            } else {
                setExistingTimetable(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const generateSmartTimetable = () => {
        if (!selectedClass || !selectedSection) {
            alert("Please select class and section");
            return;
        }

        // AI-like algorithm: Distribute subjects evenly, avoid consecutive same subjects
        const timetable = {};
        const teacherLoad = {}; // Track teacher's periods per day

        days.forEach(day => {
            timetable[day] = [];
            const daySubjects = [...subjects].sort(() => Math.random() - 0.5); // Shuffle

            for (let period = 0; period < periodsPerDay; period++) {
                // Break time after 3rd period
                if (period === 3) {
                    timetable[day].push({ subject: 'BREAK', teacher: '-', time: '10:15-11:15' });
                    continue;
                }

                // Select subject ensuring variety
                let selectedSubject = daySubjects[period % daySubjects.length];

                // Avoid same subject consecutively
                if (period > 0 && timetable[day][period - 1]?.subject === selectedSubject) {
                    selectedSubject = daySubjects[(period + 1) % daySubjects.length];
                }

                // Find teacher for this subject
                const availableTeachers = teachers.filter(t => t.subject === selectedSubject);
                const teacher = availableTeachers.length > 0
                    ? availableTeachers[Math.floor(Math.random() * availableTeachers.length)]
                    : { name: 'TBD', teacherId: null };

                timetable[day].push({
                    subject: selectedSubject,
                    teacher: teacher.name,
                    teacherId: teacher.teacherId,
                    time: periodTimes[period]
                });
            }
        });

        setGeneratedTimetable(timetable);
    };

    const saveTimetable = async () => {
        if (!generatedTimetable) return;

        try {
            // Delete existing timetable if any
            if (existingTimetable?.id) {
                await deleteDoc(doc(db, "timetables", existingTimetable.id));
            }

            // Save new timetable
            await addDoc(collection(db, "timetables"), {
                class: selectedClass,
                section: selectedSection,
                schedule: generatedTimetable,
                createdBy: userData.uid,
                createdAt: serverTimestamp(),
                institutionId: userData.institutionId || userData.uid
            });

            alert("✅ Timetable saved successfully!");
            setMode('view');
            fetchExistingTimetable();
        } catch (e) {
            console.error(e);
            alert("Error saving timetable");
        }
    };

    const downloadPDF = () => {
        const tt = existingTimetable?.schedule || generatedTimetable;
        if (!tt) return;

        const doc = new jsPDF('landscape');

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(userData?.institutionName || "School Timetable", 148, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Class ${selectedClass} - Section ${selectedSection}`, 148, 22, { align: 'center' });
        doc.text(`Academic Year: 2025-26`, 148, 28, { align: 'center' });

        // Prepare table data
        const tableData = [];
        const maxPeriods = Math.max(...days.map(day => tt[day]?.length || 0));

        for (let period = 0; period < maxPeriods; period++) {
            const row = [periodTimes[period] || '-'];
            days.forEach(day => {
                const slot = tt[day]?.[period];
                if (slot) {
                    row.push(slot.subject === 'BREAK' ? 'BREAK' : `${slot.subject}\n(${slot.teacher})`);
                } else {
                    row.push('-');
                }
            });
            tableData.push(row);
        }

        doc.autoTable({
            startY: 35,
            head: [['Time', ...days]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            styles: { cellPadding: 3, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 25, fontStyle: 'bold' }
            }
        });

        // Footer
        doc.setFontSize(9);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, doc.internal.pageSize.height - 10);
        doc.text("Powered by Together To Refine", 230, doc.internal.pageSize.height - 10);

        doc.save(`Timetable_Class${selectedClass}_${selectedSection}.pdf`);
    };

    const TimetableView = ({ schedule }) => (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#3498db', color: 'white' }}>
                    <tr>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Time</th>
                        {days.map(day => (
                            <th key={day} style={{ padding: '10px', border: '1px solid #ddd' }}>{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: periodsPerDay }).map((_, periodIndex) => (
                        <tr key={periodIndex}>
                            <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8f9fa' }}>
                                {periodTimes[periodIndex]}
                            </td>
                            {days.map(day => {
                                const slot = schedule[day]?.[periodIndex];
                                const isBreak = slot?.subject === 'BREAK';

                                return (
                                    <td key={day} style={{
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        background: isBreak ? '#fff3cd' : 'white',
                                        textAlign: 'center'
                                    }}>
                                        {slot ? (
                                            <>
                                                <div style={{ fontWeight: 'bold', color: isBreak ? '#856404' : '#2c3e50' }}>
                                                    {slot.subject}
                                                </div>
                                                {!isBreak && (
                                                    <div style={{ fontSize: '11px', color: '#636e72', marginTop: '3px' }}>
                                                        {slot.teacher}
                                                    </div>
                                                )}
                                            </>
                                        ) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🗓️ Smart Timetable Generator</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Mode Toggle */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
                    <button
                        onClick={() => setMode('view')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none',
                            borderBottom: mode === 'view' ? '3px solid #0984e3' : 'none',
                            fontWeight: mode === 'view' ? 'bold' : 'normal',
                            cursor: 'pointer', color: mode === 'view' ? '#0984e3' : '#636e72'
                        }}
                    >
                        👁️ View Timetable
                    </button>
                    {(userData?.role === 'institution' || userData?.role === 'teacher') && (
                        <button
                            onClick={() => setMode('generate')}
                            style={{
                                padding: '10px 20px', background: 'none', border: 'none',
                                borderBottom: mode === 'generate' ? '3px solid #0984e3' : 'none',
                                fontWeight: mode === 'generate' ? 'bold' : 'normal',
                                cursor: 'pointer', color: mode === 'generate' ? '#0984e3' : '#636e72'
                            }}
                        >
                            ⚡ Generate New
                        </button>
                    )}
                </div>

                {/* Class Selector */}
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

                {/* VIEW MODE */}
                {mode === 'view' && (
                    <div className="card">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
                        ) : !selectedClass || !selectedSection ? (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📅</div>
                                <h3>Select Class & Section</h3>
                            </div>
                        ) : existingTimetable ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0 }}>Class {selectedClass} - Section {selectedSection}</h3>
                                    <button onClick={downloadPDF} className="btn" style={{ background: '#e74c3c' }}>
                                        📄 Download PDF
                                    </button>
                                </div>
                                <TimetableView schedule={existingTimetable.schedule} />
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px' }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
                                <h3>No Timetable Found</h3>
                                <p style={{ color: '#999', marginBottom: '20px' }}>
                                    No timetable has been created for Class {selectedClass} - {selectedSection} yet.
                                </p>
                                {(userData?.role === 'institution' || userData?.role === 'teacher') && (
                                    <button onClick={() => setMode('generate')} className="btn">
                                        ⚡ Generate Timetable
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* GENERATE MODE */}
                {mode === 'generate' && (
                    <div className="card">
                        <h3>Generate Smart Timetable</h3>
                        <p style={{ color: '#636e72', marginBottom: '20px' }}>
                            AI will automatically distribute subjects evenly and avoid conflicts
                        </p>

                        {!selectedClass || !selectedSection ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                Please select class and section first
                            </div>
                        ) : (
                            <>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Periods per day:
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={periodsPerDay}
                                        onChange={(e) => setPeriodsPerDay(parseInt(e.target.value))}
                                        min="5"
                                        max="8"
                                        style={{ maxWidth: '150px' }}
                                    />
                                </div>

                                <button onClick={generateSmartTimetable} className="btn" style={{ marginBottom: '20px' }}>
                                    ⚡ Generate Timetable
                                </button>

                                {generatedTimetable && (
                                    <>
                                        <div style={{ marginBottom: '15px', padding: '10px', background: '#d4edda', borderRadius: '4px', color: '#155724' }}>
                                            ✅ Timetable generated successfully! Review and save.
                                        </div>

                                        <TimetableView schedule={generatedTimetable} />

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                            <button onClick={saveTimetable} className="btn" style={{ background: '#27ae60' }}>
                                                💾 Save Timetable
                                            </button>
                                            <button onClick={downloadPDF} className="btn" style={{ background: '#e74c3c' }}>
                                                📄 Download PDF
                                            </button>
                                            <button onClick={generateSmartTimetable} className="btn-outline">
                                                🔄 Regenerate
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
