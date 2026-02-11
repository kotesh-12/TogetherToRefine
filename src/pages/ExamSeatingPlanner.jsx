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

    const [examName, setExamName] = useState('');
    const [examDate, setExamDate] = useState('');
    const [totalStudents, setTotalStudents] = useState('');
    const [roomsCount, setRoomsCount] = useState('');
    const [seatsPerRoom, setSeatsPerRoom] = useState('');
    const [startRollNo, setStartRollNo] = useState('');

    // Teacher Assignment State
    const [teachers, setTeachers] = useState([]);
    const [roomInvigilators, setRoomInvigilators] = useState({}); // { roomNo: teacherId }

    const [seatingPlan, setSeatingPlan] = useState(null);

    // Fetch teachers on mount
    useEffect(() => {
        const fetchTeachers = async () => {
            if (!userData?.uid) return;
            try {
                const q = query(
                    collection(db, 'users'),
                    where('role', '==', 'teacher'),
                    where('institutionId', '==', userData.uid)
                );
                const snapshot = await getDocs(q);
                const teacherList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setTeachers(teacherList);
            } catch (error) {
                console.error("Error fetching teachers:", error);
            }
        };
        fetchTeachers();
    }, [userData]);

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
        if (!totalStudents || !roomsCount || !seatsPerRoom) {
            alert("Please fill all required fields");
            return;
        }

        const students = parseInt(totalStudents);
        const rooms = parseInt(roomsCount);
        const seatsPerRm = parseInt(seatsPerRoom);
        const startRoll = parseInt(startRollNo) || 1;

        // Check capacity
        if (students > rooms * seatsPerRm) {
            alert(`Not enough capacity! You need ${Math.ceil(students / seatsPerRm)} rooms.`);
            return;
        }

        // Generate randomized seating
        const rollNumbers = Array.from({ length: students }, (_, i) => startRoll + i);

        // Shuffle for randomization (prevent cheating)
        for (let i = rollNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rollNumbers[i], rollNumbers[j]] = [rollNumbers[j], rollNumbers[i]];
        }

        // Distribute across rooms
        const plan = [];
        let studentIndex = 0;

        for (let room = 1; room <= rooms; room++) {
            const roomSeats = [];
            const studentsInRoom = Math.min(seatsPerRm, students - studentIndex);

            for (let seat = 1; seat <= studentsInRoom; seat++) {
                roomSeats.push({
                    seatNo: seat,
                    rollNo: rollNumbers[studentIndex]
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

            if (studentIndex >= students) break;
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Invigilator:</label>
                                            <select
                                                className="input-field"
                                                style={{ padding: '5px', fontSize: '13px', width: '200px' }}
                                                value={roomInvigilators[room.roomNo] || ''}
                                                onChange={(e) => handleInvigilatorChange(room.roomNo, e.target.value)}
                                            >
                                                <option value="">-- Assign Teacher --</option>
                                                {teachers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
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
