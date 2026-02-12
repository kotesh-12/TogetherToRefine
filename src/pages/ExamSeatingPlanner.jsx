import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ExamSeatingPlanner() {
    const navigate = useNavigate();
    const { userData } = useUser();

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

    // Fetch teachers and available classes on mount
    useEffect(() => {
        const fetchData = async () => {
            if (!userData) return;
            const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
            if (!instId) return;

            try {
                // Fetch Teachers
                // Fetch Teachers from the correct 'teachers' collection
                const qT = query(
                    collection(db, 'teachers'),
                    where('institutionId', '==', instId)
                );
                const snapshotT = await getDocs(qT);
                setTeachers(snapshotT.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    name: doc.data().name || doc.data().firstName || 'Unnamed Teacher'
                })));

                // Fetch Unique Classes (from student_allotments)
                const qS = query(
                    collection(db, "student_allotments"),
                    where("institutionId", "==", instId)
                );
                const snapshotS = await getDocs(qS);
                const classes = new Set();
                snapshotS.forEach(doc => {
                    const data = doc.data();
                    if (data.classAssigned) classes.add(data.classAssigned);
                });
                setAvailableClasses(Array.from(classes).sort());

            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };
        fetchData();
    }, [userData]);

    const [availableClasses, setAvailableClasses] = useState([]);

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
            const students = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().studentName || doc.data().name,
                rollNo: doc.data().rollNo || doc.data().pid || doc.id.slice(-4)
            }));
            setDbStudents(students);
            setTotalStudents(students.length.toString());
            alert(`✅ Loaded ${students.length} students from ${participatingClasses.join(', ')}`);
        } catch (e) {
            console.error(e);
            alert("Error fetching students");
        } finally {
            setIsFetchingStudents(false);
        }
    };

    const handleInvigilatorChange = (roomNo, teacherId) => {
        setRoomInvigilators(prev => ({
            ...prev,
            [roomNo]: teacherId
        }));

        // Also update the seating plan object directly if it exists
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

        if (!studentsCount || !rooms || !seatsPerRm) {
            alert("Please fill all required fields");
            return;
        }

        // Check capacity
        if (studentsCount > rooms * seatsPerRm) {
            alert(`Not enough capacity! You need ${Math.ceil(studentsCount / seatsPerRm)} rooms.`);
            return;
        }

        // Generate data to distribute
        let dataToDistribute = [];
        if (dbStudents.length > 0) {
            dataToDistribute = [...dbStudents];
        } else {
            const startRoll = parseInt(startRollNo) || 1;
            dataToDistribute = Array.from({ length: studentsCount }, (_, i) => ({
                rollNo: (startRoll + i).toString(),
                name: `Student ${startRoll + i}`
            }));
        }

        // Shuffle for randomization (prevent cheating)
        for (let i = dataToDistribute.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dataToDistribute[i], dataToDistribute[j]] = [dataToDistribute[j], dataToDistribute[i]];
        }

        // Distribute across rooms
        const plan = [];
        let studentIndex = 0;

        for (let room = 1; room <= rooms; room++) {
            const roomSeats = [];
            const studentsInRoom = Math.min(seatsPerRm, studentsCount - studentIndex);

            for (let seat = 1; seat <= studentsInRoom; seat++) {
                roomSeats.push({
                    seatNo: seat,
                    rollNo: dataToDistribute[studentIndex].rollNo,
                    studentName: dataToDistribute[studentIndex].name
                });
                studentIndex++;
            }

            // Get existing assigned invigilator if any (for regeneration case)
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

    const downloadSeatingPDF = () => {
        if (!seatingPlan) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(userData?.institutionName || "Examination Hall", 105, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.text("SEATING ARRANGEMENT", 105, 23, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Exam: ${examName || 'Board Examination'}`, 20, 35);
        doc.text(`Date: ${examDate || new Date().toLocaleDateString()}`, 20, 42);
        doc.text(`Total Students: ${totalStudents}`, 20, 49);

        let yPos = 60;

        seatingPlan.forEach((room, index) => {
            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            // Room header with Invigilator
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${room.roomName} (${room.totalSeats} students)`, 20, yPos);

            // Add Invigilator Info in PDF
            if (room.invigilatorName) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text(`Invigilator: ${room.invigilatorName}`, 120, yPos);
            }

            yPos += 10;

            // Seating table
            const tableData = [];
            for (let i = 0; i < room.seats.length; i += 5) {
                const row = room.seats.slice(i, i + 5).map(s => `Seat ${s.seatNo}\nRoll ${s.rollNo}`);
                tableData.push(row);
            }

            doc.autoTable({
                startY: yPos,
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 5, halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 35 }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        });

        // Footer
        doc.setFontSize(9);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, doc.internal.pageSize.height - 10);
        doc.text("Powered by Together To Refine", 140, doc.internal.pageSize.height - 10);

        doc.save(`Exam_Seating_${examName.replace(/\s/g, '_')}.pdf`);
    };

    const downloadRollStickers = () => {
        if (!seatingPlan) return;

        const doc = new jsPDF();
        doc.setFontSize(10);

        let x = 10, y = 10;
        const stickerWidth = 60;
        const stickerHeight = 30;

        seatingPlan.forEach(room => {
            room.seats.forEach(seat => {
                // Draw sticker border
                doc.rect(x, y, stickerWidth, stickerHeight);

                // Content
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(`ROLL NO: ${seat.rollNo}`, x + 5, y + 12);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(`${room.roomName} - Seat ${seat.seatNo}`, x + 5, y + 20);
                doc.text(`${examName || 'Exam'}`, x + 5, y + 26);

                // Move to next position
                x += stickerWidth + 5;
                if (x > 180) {
                    x = 10;
                    y += stickerHeight + 5;
                }
                if (y > 270) {
                    doc.addPage();
                    x = 10;
                    y = 10;
                }
            });
        });

        doc.save(`Roll_Stickers_${examName.replace(/\s/g, '_')}.pdf`);
    };

    const saveSeatingPlan = async () => {
        if (!seatingPlan || !examName) {
            alert("Please generate a seating plan first");
            return;
        }

        try {
            await addDoc(collection(db, "exam_seating"), {
                examName,
                examDate: examDate || null,
                totalStudents: parseInt(totalStudents),
                roomsCount: parseInt(roomsCount),
                seatsPerRoom: parseInt(seatsPerRoom),
                seatingPlan: seatingPlan, // Now includes invigilator info
                createdBy: userData.uid,
                institutionId: userData.institutionId || userData.uid,
                createdAt: serverTimestamp()
            });

            alert("✅ Seating plan saved successfully! Students and teachers can now view it.");
        } catch (e) {
            console.error(e);
            alert("Error saving seating plan");
        }
    };


    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🪑 Exam Hall Seating Planner</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>🧠 Smart Settings</h3>
                    <p style={{ color: '#636e72', fontSize: '14px', marginBottom: '15px' }}>
                        Optionally load students directly from your database by selecting participating classes.
                    </p>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                            Select Participating Classes:
                        </label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {availableClasses.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => {
                                        setParticipatingClasses(prev =>
                                            prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
                                        );
                                    }}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        background: participatingClasses.includes(cls) ? 'var(--primary)' : 'var(--bg-body)',
                                        color: participatingClasses.includes(cls) ? 'white' : 'var(--text-main)',
                                        border: '1px solid var(--divider)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {cls}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={fetchStudentsFromDB}
                        className="btn"
                        style={{
                            background: '#6c5ce7',
                            width: '100%',
                            opacity: isFetchingStudents ? 0.7 : 1
                        }}
                        disabled={isFetchingStudents}
                    >
                        {isFetchingStudents ? '⌛ Fetching...' : `📥 Load ${participatingClasses.length} Classes Data`}
                    </button>
                    {dbStudents.length > 0 && (
                        <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                            ✅ Found {dbStudents.length} Students. Capacity check will be based on this count.
                        </p>
                    )}
                </div>

                <div className="card">
                    <h3>Generate Seating Arrangement</h3>
                    <p style={{ color: '#636e72', marginBottom: '20px' }}>
                        Create randomized seating to prevent malpractice
                    </p>

                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Exam Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={examName}
                                    onChange={(e) => setExamName(e.target.value)}
                                    placeholder="e.g., Board Exam 2026"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Exam Date
                                </label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={examDate}
                                    onChange={(e) => setExamDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Total Students *
                                </label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={totalStudents}
                                    onChange={(e) => setTotalStudents(e.target.value)}
                                    placeholder="e.g., 120"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Number of Rooms *
                                </label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={roomsCount}
                                    onChange={(e) => setRoomsCount(e.target.value)}
                                    placeholder="e.g., 4"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Seats per Room *
                                </label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={seatsPerRoom}
                                    onChange={(e) => setSeatsPerRoom(e.target.value)}
                                    placeholder="e.g., 30"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Start Roll Number
                                </label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={startRollNo}
                                    onChange={(e) => setStartRollNo(e.target.value)}
                                    placeholder="Default: 1"
                                />
                            </div>
                        </div>

                        <button onClick={generateSeatingPlan} className="btn" style={{ marginTop: '10px' }}>
                            ⚡ Generate Seating Plan
                        </button>
                    </div>
                </div>

                {/* Seating Plan Preview */}
                {seatingPlan && (
                    <div className="card" style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Generated Seating Plan</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={saveSeatingPlan} className="btn" style={{ background: '#27ae60' }}>
                                    💾 Save to Database
                                </button>
                                <button onClick={downloadSeatingPDF} className="btn" style={{ background: '#e74c3c' }}>
                                    📄 Download Seating Chart
                                </button>
                                <button onClick={downloadRollStickers} className="btn" style={{ background: '#3498db' }}>
                                    🏷️ Download Stickers
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '20px' }}>
                            {seatingPlan.map(room => (
                                <div key={room.roomNo} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="text"
                                                className="input-field"
                                                style={{ padding: '5px', fontSize: '14px', width: '150px', fontWeight: 'bold' }}
                                                value={room.roomName}
                                                onChange={(e) => {
                                                    const updatedPlan = seatingPlan.map(r =>
                                                        r.roomNo === room.roomNo ? { ...r, roomName: e.target.value } : r
                                                    );
                                                    setSeatingPlan(updatedPlan);
                                                }}
                                            />
                                            <span style={{ fontSize: '14px', color: '#636e72' }}>- {room.totalSeats} Students</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Invigilator:</label>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={() => setActiveRoomAssign(activeRoomAssign === room.roomNo ? null : room.roomNo)}
                                                    className="btn-outline"
                                                    style={{
                                                        padding: '5px 10px',
                                                        fontSize: '13px',
                                                        minWidth: '200px',
                                                        textAlign: 'left',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    {teachers.find(t => t.id === roomInvigilators[room.roomNo])?.name || '-- Assign Teacher --'}
                                                    <span>▼</span>
                                                </button>

                                                {activeRoomAssign === room.roomNo && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        background: 'white',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                                        borderRadius: '8px',
                                                        zIndex: 100,
                                                        marginTop: '5px',
                                                        border: '1px solid #ddd',
                                                        padding: '10px'
                                                    }}>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Search Teacher..."
                                                            className="input-field"
                                                            style={{ marginBottom: '10px', padding: '6px' }}
                                                            value={teacherSearch}
                                                            onChange={(e) => setTeacherSearch(e.target.value)}
                                                        />
                                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                            <div
                                                                style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                                                onClick={() => {
                                                                    handleInvigilatorChange(room.roomNo, '');
                                                                    setActiveRoomAssign(null);
                                                                    setTeacherSearch('');
                                                                }}
                                                            >
                                                                -- None --
                                                            </div>
                                                            {teachers
                                                                .filter(t => (t.name || '').toLowerCase().includes(teacherSearch.toLowerCase()))
                                                                .map(t => (
                                                                    <div
                                                                        key={t.id}
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            borderBottom: '1px solid #f8f9fa',
                                                                            background: roomInvigilators[room.roomNo] === t.id ? '#f0edff' : 'transparent'
                                                                        }}
                                                                        onClick={() => {
                                                                            handleInvigilatorChange(room.roomNo, t.id);
                                                                            setActiveRoomAssign(null);
                                                                            setTeacherSearch('');
                                                                        }}
                                                                    >
                                                                        {t.name}
                                                                    </div>
                                                                ))
                                                            }
                                                            {teachers.filter(t => (t.name || '').toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                                                                <div style={{ padding: '10px', color: '#999', fontSize: '12px', textAlign: 'center' }}>
                                                                    No teachers found
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                        gap: '10px'
                                    }}>
                                        {room.seats.map(seat => (
                                            <div key={seat.seatNo} style={{
                                                border: '2px solid #3498db',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                textAlign: 'center',
                                                background: '#ecf0f1'
                                            }}>
                                                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>Seat {seat.seatNo}</div>
                                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                                                    {seat.rollNo}
                                                </div>
                                                {seat.studentName && (
                                                    <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {seat.studentName}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
