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

    // NEW: Room Configuration State
    const [roomConfigs, setRoomConfigs] = useState([]);
    const [showRoomConfig, setShowRoomConfig] = useState(false);
    const [editingPlan, setEditingPlan] = useState(false);
    const [editingSeat, setEditingSeat] = useState(null); // {roomNo, seatNo}

    // NEW: Step-by-Step Assignment State
    const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
    const [selectedClassForAssignment, setSelectedClassForAssignment] = useState(null);
    const [selectedRoomForAssignment, setSelectedRoomForAssignment] = useState(null);
    const [assignmentSide, setAssignmentSide] = useState(null); // 'left', 'right', or 'both'

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
                where("institutionId", "==", instId)
            );
            const snap = await getDocs(q);
            const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Client-side sort to bypass Firestore missing composite index failure
            results.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            setHistory(results);
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

    const handleRoomConfigSetup = () => {
        const rooms = parseInt(roomsCount);
        if (!rooms || rooms < 1) return alert("Please enter number of rooms first");

        // Initialize room configs
        const configs = Array.from({ length: rooms }, (_, i) => ({
            roomNo: i + 1,
            roomName: `Room ${i + 1}`,
            rows: 5,
            columns: 6,
            totalSeats: 30,
            excludedSeats: [] // Array of seat numbers to exclude
        }));
        setRoomConfigs(configs);
        setShowRoomConfig(true);
    };

    const updateRoomConfig = (roomNo, field, value) => {
        setRoomConfigs(prev => prev.map(room => {
            if (room.roomNo === roomNo) {
                const updated = { ...room, [field]: value };
                if (field === 'rows' || field === 'columns') {
                    updated.totalSeats = parseInt(updated.rows || 0) * parseInt(updated.columns || 0);
                }
                return updated;
            }
            return room;
        }));
    };

    const generateSeatingPlan = () => {
        const studentsCount = parseInt(totalStudents);

        if (!studentsCount) return alert("Please fill total students");

        // Use room configs if available, otherwise use simple mode
        const useRoomConfigs = roomConfigs.length > 0;

        if (!useRoomConfigs) {
            const rooms = parseInt(roomsCount);
            const seatsPerRm = parseInt(seatsPerRoom);
            if (!rooms || !seatsPerRm) return alert("Please configure rooms first");
            if (studentsCount > rooms * seatsPerRm) return alert(`Capacity exceeded! You need more rooms.`);
        } else {
            const totalCapacity = roomConfigs.reduce((sum, r) => sum + (r.totalSeats - (r.excludedSeats?.length || 0)), 0);
            if (studentsCount > totalCapacity) return alert(`Capacity exceeded! Total available seats: ${totalCapacity}`);
        }

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

        if (useRoomConfigs) {
            // Use configured rooms with row/column layout
            roomConfigs.forEach(config => {
                const roomSeats = [];
                const excludedSet = new Set(config.excludedSeats || []);

                for (let row = 1; row <= config.rows; row++) {
                    for (let col = 1; col <= config.columns; col++) {
                        const seatNo = (row - 1) * config.columns + col;

                        // Skip excluded seats
                        if (excludedSet.has(seatNo)) continue;

                        // Stop if we've assigned all students
                        if (studentIndex >= studentsCount) break;

                        const student = dataToDistribute[studentIndex];
                        roomSeats.push({
                            seatNo: seatNo,
                            row: row,
                            column: col,
                            rollNo: student.rollNo,
                            studentName: student.name,
                            userId: student.userId
                        });
                        studentIndex++;
                    }
                    if (studentIndex >= studentsCount) break;
                }

                const assignedTeacherId = roomInvigilators[config.roomNo] || '';
                const assignedTeacher = teachers.find(t => t.id === assignedTeacherId);

                plan.push({
                    roomNo: config.roomNo,
                    roomName: config.roomName,
                    rows: config.rows,
                    columns: config.columns,
                    seats: roomSeats,
                    totalSeats: roomSeats.length,
                    invigilatorId: assignedTeacherId,
                    invigilatorName: assignedTeacher?.name || ''
                });
            });
        } else {
            // Simple mode (backward compatibility)
            const rooms = parseInt(roomsCount);
            const seatsPerRm = parseInt(seatsPerRoom);

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
        }

        setSeatingPlan(plan);
        setShowRoomConfig(false);
    };

    // NEW: Step-by-Step Assignment Functions
    const startClassAssignment = (className) => {
        setSelectedClassForAssignment(className);
        setShowAssignmentDialog(true);
    };

    const checkRoomAvailability = (roomNo) => {
        if (!seatingPlan) return { leftAvailable: true, rightAvailable: true, fullyOccupied: false };

        const room = seatingPlan.find(r => r.roomNo === roomNo);
        if (!room) return { leftAvailable: true, rightAvailable: true, fullyOccupied: false };

        const leftOccupied = room.assignments?.left != null;
        const rightOccupied = room.assignments?.right != null;

        return {
            leftAvailable: !leftOccupied,
            rightAvailable: !rightOccupied,
            fullyOccupied: leftOccupied && rightOccupied,
            leftClass: room.assignments?.left?.className,
            rightClass: room.assignments?.right?.className
        };
    };

    const getAssignedTeachers = () => {
        if (!seatingPlan) return [];

        const assignedTeachers = [];
        seatingPlan.forEach(room => {
            if (room.assignments) {
                if (room.assignments.left) {
                    assignedTeachers.push({
                        teacherId: room.assignments.left.teacherId,
                        teacherName: room.assignments.left.teacherName,
                        className: room.assignments.left.className,
                        roomName: room.roomName,
                        side: 'LEFT'
                    });
                }
                if (room.assignments.right) {
                    assignedTeachers.push({
                        teacherId: room.assignments.right.teacherId,
                        teacherName: room.assignments.right.teacherName,
                        className: room.assignments.right.className,
                        roomName: room.roomName,
                        side: 'RIGHT'
                    });
                }
            }
        });

        return assignedTeachers;
    };


    const assignClassToRoom = (roomNo, className, side, teacherId) => {
        const classStudents = dbStudents.filter(s => {
            // Filter students by class - you'll need to add class field to student data
            return participatingClasses.includes(className);
        });

        if (classStudents.length === 0) {
            alert(`No students found for ${className}. Please load students first.`);
            return;
        }

        const room = seatingPlan?.find(r => r.roomNo === roomNo);
        if (!room) {
            alert("Room not found. Please generate rooms first.");
            return;
        }

        const availability = checkRoomAvailability(roomNo);

        // Check if selected side is available
        if (side === 'left' && !availability.leftAvailable) {
            alert(`LEFT side is already occupied by ${availability.leftClass}`);
            return;
        }
        if (side === 'right' && !availability.rightAvailable) {
            alert(`RIGHT side is already occupied by ${availability.rightClass}`);
            return;
        }

        const teacher = teachers.find(t => t.id === teacherId);
        const benchCount = room.totalSeats / 2; // Each bench has 2 seats
        const studentsToAssign = classStudents.slice(0, benchCount);

        // Update seating plan with assignment
        setSeatingPlan(prev => prev.map(r => {
            if (r.roomNo === roomNo) {
                const assignments = r.assignments || {};
                assignments[side] = {
                    className,
                    students: studentsToAssign,
                    teacherId,
                    teacherName: teacher?.name || ''
                };

                // Generate bench-wise seating
                const benches = [];
                const leftStudents = assignments.left?.students || [];
                const rightStudents = assignments.right?.students || [];
                const maxBenches = Math.max(leftStudents.length, rightStudents.length, benchCount);

                for (let i = 0; i < maxBenches; i++) {
                    benches.push({
                        benchNo: i + 1,
                        leftSeat: leftStudents[i] || null,
                        rightSeat: rightStudents[i] || null
                    });
                }

                return {
                    ...r,
                    assignments,
                    benches,
                    invigilators: [
                        assignments.left && { ...assignments.left, side: 'LEFT' },
                        assignments.right && { ...assignments.right, side: 'RIGHT' }
                    ].filter(Boolean)
                };
            }
            return r;
        }));

        setShowAssignmentDialog(false);
        alert(`✅ ${className} assigned to ${side.toUpperCase()} side of ${room.roomName}`);
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
                totalStudents: parseInt(totalStudents) || 0,
                roomsCount: parseInt(roomsCount) || 0,
                seatsPerRoom: parseInt(seatsPerRoom) || 0,
                seatingPlan: JSON.parse(JSON.stringify(seatingPlan)), // Strips out 'undefined' values (like empty userId)
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

                            {/* Show Assign to Room buttons after students are loaded */}
                            {dbStudents.length > 0 && seatingPlan && (
                                <div style={{ marginTop: '15px', padding: '12px', background: '#e8f5e9', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#27ae60' }}>
                                        ✓ {dbStudents.length} students loaded. Assign classes to rooms:
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {participatingClasses.map(cls => (
                                            <button
                                                key={cls}
                                                onClick={() => startClassAssignment(cls)}
                                                className="btn"
                                                style={{
                                                    fontSize: '12px',
                                                    padding: '6px 12px',
                                                    background: '#27ae60'
                                                }}
                                            >
                                                📍 Assign {cls} to Room
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h3>2. Generation Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <input type="text" className="input-field" placeholder="Exam Name" value={examName} onChange={e => setExamName(e.target.value)} />
                                <input type="date" className="input-field" value={examDate} onChange={e => setExamDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                                <input type="number" className="input-field" placeholder="Total Students" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} />
                                <input type="number" className="input-field" placeholder="Number of Rooms" value={roomsCount} onChange={e => setRoomsCount(e.target.value)} />
                                <input type="number" className="input-field" placeholder="Seats/Room (Optional)" value={seatsPerRoom} onChange={e => setSeatsPerRoom(e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button onClick={handleRoomConfigSetup} className="btn-outline" style={{ width: '100%' }}>🏫 Configure Rooms</button>
                                <button onClick={generateSeatingPlan} className="btn" style={{ width: '100%' }}>⚡ Generate Plan</button>
                            </div>
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

                {/* Room Configuration Modal */}
                {showRoomConfig && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '20px'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '800px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>🏫 Configure Rooms</h3>
                                <button onClick={() => setShowRoomConfig(false)} style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)'
                                }}>×</button>
                            </div>

                            <div style={{ display: 'grid', gap: '15px' }}>
                                {roomConfigs.map(room => (
                                    <div key={room.roomNo} style={{
                                        border: '1px solid var(--divider)',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        background: 'var(--bg-surface)'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--primary)' }}>
                                            Room {room.roomNo}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Room Name/Number</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={room.roomName}
                                                    onChange={(e) => updateRoomConfig(room.roomNo, 'roomName', e.target.value)}
                                                    placeholder="e.g., Room 101, Lab A"
                                                    style={{ fontSize: '13px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rows</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={room.rows}
                                                    onChange={(e) => updateRoomConfig(room.roomNo, 'rows', e.target.value)}
                                                    min="1"
                                                    style={{ fontSize: '13px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Columns</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={room.columns}
                                                    onChange={(e) => updateRoomConfig(room.roomNo, 'columns', e.target.value)}
                                                    min="1"
                                                    style={{ fontSize: '13px' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Total Capacity: <strong>{room.totalSeats} seats</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button onClick={() => setShowRoomConfig(false)} className="btn-outline" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button onClick={generateSeatingPlan} className="btn" style={{ flex: 1, background: '#27ae60' }}>
                                    ✓ Apply & Generate
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step-by-Step Assignment Dialog */}
                {showAssignmentDialog && seatingPlan && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '20px'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '700px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>📍 Assign {selectedClassForAssignment} to Room</h3>
                                <button onClick={() => setShowAssignmentDialog(false)} style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)'
                                }}>×</button>
                            </div>

                            <div style={{ display: 'grid', gap: '15px' }}>
                                {seatingPlan.map(room => {
                                    const availability = checkRoomAvailability(room.roomNo);

                                    return (
                                        <div key={room.roomNo} style={{
                                            border: '1px solid var(--divider)',
                                            borderRadius: '8px',
                                            padding: '15px',
                                            background: availability.fullyOccupied ? '#f8f9fa' : 'var(--bg-surface)'
                                        }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--primary)' }}>
                                                {room.roomName} ({room.totalSeats} seats, {room.totalSeats / 2} benches)
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                                <div style={{
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    background: availability.leftAvailable ? '#e8f5e9' : '#ffebee',
                                                    fontSize: '12px'
                                                }}>
                                                    <strong>LEFT Side:</strong><br />
                                                    {availability.leftAvailable ? (
                                                        <span style={{ color: '#27ae60' }}>✓ Available</span>
                                                    ) : (
                                                        <span style={{ color: '#e74c3c' }}>✗ Occupied by {availability.leftClass}</span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    background: availability.rightAvailable ? '#e8f5e9' : '#ffebee',
                                                    fontSize: '12px'
                                                }}>
                                                    <strong>RIGHT Side:</strong><br />
                                                    {availability.rightAvailable ? (
                                                        <span style={{ color: '#27ae60' }}>✓ Available</span>
                                                    ) : (
                                                        <span style={{ color: '#e74c3c' }}>✗ Occupied by {availability.rightClass}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {!availability.fullyOccupied && (
                                                <div>
                                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                        Select Teacher:
                                                    </label>
                                                    <select
                                                        className="input-field"
                                                        style={{ marginBottom: '10px', fontSize: '13px' }}
                                                        onChange={(e) => setSelectedRoomForAssignment({ roomNo: room.roomNo, teacherId: e.target.value })}
                                                    >
                                                        <option value="">-- Select Teacher --</option>
                                                        {teachers.map(t => {
                                                            const assignedTeachers = getAssignedTeachers();
                                                            const assignment = assignedTeachers.find(at => at.teacherId === t.id);

                                                            return (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}
                                                                    {assignment ? ` (Assigned: ${assignment.roomName} ${assignment.side} - ${assignment.className})` : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>

                                                    <div style={{ display: 'grid', gridTemplateColumns: availability.leftAvailable && availability.rightAvailable ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                                                        <button
                                                            onClick={() => {
                                                                if (!selectedRoomForAssignment?.teacherId) {
                                                                    alert("Please select a teacher first");
                                                                    return;
                                                                }
                                                                assignClassToRoom(room.roomNo, selectedClassForAssignment, 'left', selectedRoomForAssignment.teacherId);
                                                            }}
                                                            disabled={!availability.leftAvailable}
                                                            className="btn"
                                                            style={{
                                                                fontSize: '12px',
                                                                padding: '8px',
                                                                background: availability.leftAvailable ? '#3498db' : '#ccc',
                                                                cursor: availability.leftAvailable ? 'pointer' : 'not-allowed'
                                                            }}
                                                        >
                                                            Assign to LEFT
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!selectedRoomForAssignment?.teacherId) {
                                                                    alert("Please select a teacher first");
                                                                    return;
                                                                }
                                                                assignClassToRoom(room.roomNo, selectedClassForAssignment, 'right', selectedRoomForAssignment.teacherId);
                                                            }}
                                                            disabled={!availability.rightAvailable}
                                                            className="btn"
                                                            style={{
                                                                fontSize: '12px',
                                                                padding: '8px',
                                                                background: availability.rightAvailable ? '#9b59b6' : '#ccc',
                                                                cursor: availability.rightAvailable ? 'pointer' : 'not-allowed'
                                                            }}
                                                        >
                                                            Assign to RIGHT
                                                        </button>
                                                        {availability.leftAvailable && availability.rightAvailable && (
                                                            <button
                                                                onClick={() => {
                                                                    if (!selectedRoomForAssignment?.teacherId) {
                                                                        alert("Please select a teacher first");
                                                                        return;
                                                                    }
                                                                    assignClassToRoom(room.roomNo, selectedClassForAssignment, 'both', selectedRoomForAssignment.teacherId);
                                                                }}
                                                                className="btn"
                                                                style={{
                                                                    fontSize: '12px',
                                                                    padding: '8px',
                                                                    background: '#27ae60'
                                                                }}
                                                            >
                                                                Assign to BOTH
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {availability.fullyOccupied && (
                                                <div style={{ textAlign: 'center', padding: '10px', color: '#e74c3c', fontSize: '13px' }}>
                                                    ❌ Room fully occupied
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
