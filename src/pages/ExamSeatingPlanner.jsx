import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ExamSeatingPlanner() {
    const navigate = useNavigate();
    const { userData } = useUser();

    // Setup State
    const [participatingClasses, setParticipatingClasses] = useState([]);
    const [dbStudents, setDbStudents] = useState([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [examName, setExamName] = useState('');
    const [examDate, setExamDate] = useState('');
    const [totalStudents, setTotalStudents] = useState('');
    const [roomsCount, setRoomsCount] = useState('');
    const [seatsPerRoom, setSeatsPerRoom] = useState('');
    const [startRollNo, setStartRollNo] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [roomInvigilators, setRoomInvigilators] = useState({});
    const [seatingPlan, setSeatingPlan] = useState(null);
    const [teacherSearch, setTeacherSearch] = useState('');
    const [activeRoomAssign, setActiveRoomAssign] = useState(null);
    const [availableClasses, setAvailableClasses] = useState([]);

    // History State
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch teachers, classes and history on mount
    useEffect(() => {
        if (userData?.uid) {
            fetchInitialData();
            fetchHistory();
        }
    }, [userData]);

    const fetchInitialData = async () => {
        const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
        if (!instId) return;

        try {
            // 1. Fetch Teachers
            const qT = query(collection(db, 'teachers'), where('institutionId', '==', instId));
            const snapT = await getDocs(qT);
            setTeachers(snapT.docs.map(d => ({
                id: d.id,
                ...d.data(),
                name: d.data().name || d.data().firstName || 'Unnamed Teacher'
            })));

            // 2. Fetch Unique Classes
            const qS = query(collection(db, "student_allotments"), where("institutionId", "==", instId));
            const snapS = await getDocs(qS);
            const classes = new Set();
            snapS.forEach(d => { if (d.data().classAssigned) classes.add(d.data().classAssigned); });
            setAvailableClasses(Array.from(classes).sort());
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchHistory = async () => {
        const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
        if (!instId) return;
        try {
            const q = query(
                collection(db, "exam_seating"),
                where("institutionId", "==", instId),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("History error:", e);
        }
    };

    const fetchStudentsFromDB = async () => {
        const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
        if (!instId || participatingClasses.length === 0) {
            alert("Please select participating classes first");
            return;
        }

        setIsFetchingStudents(true);
        try {
            const q = query(
                collection(db, "student_allotments"),
                where("institutionId", "==", instId),
                where("classAssigned", "in", participatingClasses)
            );
            const snapshot = await getDocs(q);
            const students = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    userId: data.userId || null,
                    name: data.studentName || data.name || 'Unknown Student',
                    rollNo: data.rollNumber || data.rollNo || data.pid || `STU-${doc.id.slice(-4)}`
                };
            });
            setDbStudents(students);
            setTotalStudents(students.length.toString());
            alert(`✅ Loaded ${students.length} students.`);
        } catch (e) {
            console.error(e);
            alert("Error fetching students");
        } finally {
            setIsFetchingStudents(false);
        }
    };

    const handleInvigilatorChange = (roomNo, teacherId) => {
        setRoomInvigilators(prev => ({ ...prev, [roomNo]: teacherId }));
        if (seatingPlan) {
            const updatedPlan = seatingPlan.map(room => {
                if (room.roomNo === roomNo) {
                    const teacher = teachers.find(t => t.id === teacherId);
                    return { ...room, invigilatorId: teacherId, invigilatorName: teacher?.name || '' };
                }
                return room;
            });
            setSeatingPlan(updatedPlan);
        }
    };

    const generateSeatingPlan = () => {
        const studentsCount = parseInt(totalStudents);
        const rooms = parseInt(roomsCount);
        const seatsPerRm = parseInt(seatsPerRoom);

        if (!studentsCount || !rooms || !seatsPerRm) return alert("Please fill all required fields");
        if (studentsCount > rooms * seatsPerRm) return alert(`Capacity exceeded! You need more rooms.`);

        let dataToDistribute = dbStudents.length > 0 ? [...dbStudents] : Array.from({ length: studentsCount }, (_, i) => ({
            rollNo: (parseInt(startRollNo || 1) + i).toString(),
            name: `Student ${parseInt(startRollNo || 1) + i}`
        }));

        // Shuffle
        for (let i = dataToDistribute.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dataToDistribute[i], dataToDistribute[j]] = [dataToDistribute[j], dataToDistribute[i]];
        }

        const plan = [];
        let studentIndex = 0;

        for (let room = 1; room <= rooms; room++) {
            const roomSeats = [];
            const studentsInRoom = Math.min(seatsPerRm, studentsCount - studentIndex);

            for (let seat = 1; seat <= studentsInRoom; seat++) {
                const student = dataToDistribute[studentIndex];
                roomSeats.push({
                    seatNo: seat,
                    rollNo: student.rollNo,
                    studentName: student.name,
                    userId: student.userId
                });
                studentIndex++;
            }

            const assignedTeacherId = roomInvigilators[room] || '';
            const assignedTeacher = teachers.find(t => t.id === assignedTeacherId);

            plan.push({
                roomNo: room,
                roomName: `Room ${room}`,
                seats: roomSeats,
                totalSeats: studentsInRoom,
                invigilatorId: assignedTeacherId,
                invigilatorName: assignedTeacher?.name || ''
            });

            if (studentIndex >= studentsCount) break;
        }
        setSeatingPlan(plan);
    };

    const saveSeatingPlan = async () => {
        if (!seatingPlan || !examName) return alert("Please generate a seating plan first");

        const missingTeachers = seatingPlan.filter(r => !r.invigilatorId);
        if (missingTeachers.length > 0) return alert(`⚠️ Assign invigilators to all rooms before saving.`);

        setIsSaving(true);
        try {
            const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
            const docData = {
                examName: examName.trim(),
                examDate: examDate || null,
                totalStudents: parseInt(totalStudents),
                roomsCount: parseInt(roomsCount),
                seatsPerRoom: parseInt(seatsPerRoom),
                seatingPlan: seatingPlan,
                institutionId: instId,
                createdBy: userData.uid,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "exam_seating"), docData);
            alert("✅ Seating plan live! Teachers & Students can now view it.");
            fetchHistory();
        } catch (e) {
            alert("Save Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deletePlan = async (id) => {
        if (!window.confirm("Delete this plan?")) return;
        try {
            await deleteDoc(doc(db, "exam_seating", id));
            setHistory(prev => prev.filter(p => p.id !== id));
        } catch (e) { alert("Error deleting"); }
    };

    const loadPastPlan = (plan) => {
        setExamName(plan.examName);
        setExamDate(plan.examDate || '');
        setTotalStudents(plan.totalStudents.toString());
        setRoomsCount(plan.roomsCount.toString());
        setSeatsPerRoom(plan.seatsPerRoom.toString());
        setSeatingPlan(plan.seatingPlan);
        const invigilators = {};
        plan.seatingPlan.forEach(r => { if (r.invigilatorId) invigilators[r.roomNo] = r.invigilatorId; });
        setRoomInvigilators(invigilators);
        setShowHistory(false);
    };

    // PDF logic (minimal check)
    const downloadSeatingPDF = () => {
        if (!seatingPlan) return;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(userData?.institutionName || "Exam Seating", 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Exam: ${examName}`, 20, 30);
        let y = 50;
        seatingPlan.forEach(room => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${room.roomName} - Invigilator: ${room.invigilatorName}`, 20, y);
            y += 10;
            const rows = room.seats.map(s => [`Seat ${s.seatNo}`, s.rollNo, s.studentName]);
            doc.autoTable({ startY: y, head: [['Seat', 'Roll No', 'Name']], body: rows });
            y = doc.lastAutoTable.finalY + 15;
            if (y > 250) { doc.addPage(); y = 20; }
        });
        doc.save(`${examName}_Seating.pdf`);
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🪑 Exam Seating Planner</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowHistory(!showHistory)} className="btn-outline">
                            {showHistory ? "← Back to Planner" : "📜 View History"}
                        </button>
                        <button onClick={() => navigate(-1)} className="btn-outline">Exit</button>
                    </div>
                </div>

                {showHistory ? (
                    <div className="card">
                        <h3>Past Allotments</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa', fontSize: '12px' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Created</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Exam</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Total</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', fontSize: '13px' }}>{p.createdAt?.toDate()?.toLocaleDateString()}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.examName}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>{p.totalStudents}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => loadPastPlan(p)} style={{ padding: '4px 8px', background: '#e3f2fd', color: '#0984e3', border: 'none', borderRadius: '4px' }}>Load</button>
                                                <button onClick={() => deletePlan(p.id)} style={{ padding: '4px 8px', background: '#ffeef0', color: '#e74c3c', border: 'none', borderRadius: '4px' }}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No history found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h3>1. Select Participating Classes</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
                                {availableClasses.map(cls => (
                                    <button key={cls} onClick={() => setParticipatingClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls])}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', background: participatingClasses.includes(cls) ? 'var(--primary)' : '#f1f3f4', color: participatingClasses.includes(cls) ? 'white' : 'black', border: 'none' }}>
                                        {cls}
                                    </button>
                                ))}
                            </div>
                            <button onClick={fetchStudentsFromDB} className="btn" style={{ width: '100%', background: '#6c5ce7' }} disabled={isFetchingStudents}>
                                {isFetchingStudents ? 'Fetching...' : `Load (${participatingClasses.length}) Classes`}
                            </button>
                        </div>

                        <div className="card">
                            <h3>2. Generation Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <input type="text" className="input-field" placeholder="Exam Name" value={examName} onChange={e => setExamName(e.target.value)} />
                                <input type="date" className="input-field" value={examDate} onChange={e => setExamDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                <input type="number" className="input-field" placeholder="Total Students" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} />
                                <input type="number" className="input-field" placeholder="Rooms" value={roomsCount} onChange={e => setRoomsCount(e.target.value)} />
                                <input type="number" className="input-field" placeholder="Seats/Room" value={seatsPerRoom} onChange={e => setSeatsPerRoom(e.target.value)} />
                            </div>
                            <button onClick={generateSeatingPlan} className="btn" style={{ width: '100%' }}>⚡ Generate Plan</button>
                        </div>

                        {seatingPlan && (
                            <div className="card" style={{ marginTop: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3>Review & Assign Teachers</h3>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={saveSeatingPlan} className="btn" style={{ background: '#27ae60' }} disabled={isSaving}>
                                            {isSaving ? 'Saving...' : '🚀 Submit & Post Live'}
                                        </button>
                                        <button onClick={downloadSeatingPDF} className="btn-outline">PDF</button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gap: '15px' }}>
                                    {seatingPlan.map(room => (
                                        <div key={room.roomNo} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <strong>{room.roomName} ({room.totalSeats} seats)</strong>
                                                <select value={roomInvigilators[room.roomNo] || ''} onChange={(e) => handleInvigilatorChange(room.roomNo, e.target.value)}
                                                    style={{ padding: '4px', borderRadius: '4px', borderColor: roomInvigilators[room.roomNo] ? '#27ae60' : '#ddd' }}>
                                                    <option value="">Assign Teacher</option>
                                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                                {room.seats.map(s => (
                                                    <div key={s.seatNo} style={{
                                                        padding: '8px',
                                                        background: '#f8f9fa',
                                                        border: '1px solid #3498db',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '2px'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>Seat {s.seatNo}</div>
                                                        <div style={{ color: '#3498db', fontSize: '10px' }}>Roll: {s.rollNo}</div>
                                                        <div style={{ color: '#7f8c8d', fontSize: '10px' }}>{s.studentName}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
