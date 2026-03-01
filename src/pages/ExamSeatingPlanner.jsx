import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function ExamSeatingPlanner() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [dbStudents, setDbStudents] = useState([]);

    const [examName, setExamName] = useState('');
    const [examDate, setExamDate] = useState('');
    const [totalStudents, setTotalStudents] = useState('');
    const [roomsCount, setRoomsCount] = useState('');
    const [seatsPerRoom, setSeatsPerRoom] = useState('');

    const [roomConfigs, setRoomConfigs] = useState([]); // { roomNo, roomName, teacherId }
    const [teachers, setTeachers] = useState([]);

    const [seatingPlan, setSeatingPlan] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);

    // Initial Fetch (teachers)
    useEffect(() => {
        if (userData?.uid) {
            fetchInitialData();
        }
    }, [userData]);

    const fetchInitialData = async () => {
        const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
        if (!instId) return;

        try {
            // Fetch Teachers
            const qT = query(collection(db, 'teachers'), where('institutionId', '==', instId));
            const snapT = await getDocs(qT);
            setTeachers(snapT.docs.map(d => ({
                id: d.id,
                ...d.data(),
                name: d.data().name || d.data().firstName || 'Unnamed Teacher'
            })));
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    // When a class or section changes, fetch students automatically
    useEffect(() => {
        if (selectedClass && selectedSection) {
            fetchStudents(selectedClass, selectedSection);
        } else {
            setDbStudents([]);
            setTotalStudents('');
            setSeatingPlan(null);
        }
    }, [selectedClass, selectedSection]);

    const fetchStudents = async (cls, sec) => {
        const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
        setIsFetchingStudents(true);
        setSeatingPlan(null);
        try {
            const q = query(
                collection(db, "student_allotments"),
                where("institutionId", "==", instId),
                where("classAssigned", "==", cls)
            );
            const snapshot = await getDocs(q);
            const students = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(d => (d.section || '').trim().toLowerCase() === sec.trim().toLowerCase())
                .map(data => ({
                    id: data.id,
                    userId: data.userId || null,
                    name: data.studentName || data.name || 'Unknown Student',
                    rollNo: data.rollNumber || data.rollNo || data.pid || `STU-${data.id.slice(-4)}`
                }));
            setDbStudents(students);
            setTotalStudents(students.length.toString());
        } catch (error) {
            console.error(error);
            alert("Error fetching students");
        } finally {
            setIsFetchingStudents(false);
        }
    };

    // When roomsCount changes, generate the roomConfigs array
    const handleRoomsCountChange = (e) => {
        const count = parseInt(e.target.value) || 0;
        setRoomsCount(count.toString());

        const newConfigs = [];
        for (let i = 1; i <= count; i++) {
            // Preserve existing config if it exists
            const existing = roomConfigs.find(r => r.roomNo === i);
            newConfigs.push(existing || { roomNo: i, roomName: `Room ${i}`, teacherId: '' });
        }
        setRoomConfigs(newConfigs);
    };

    const updateRoomConfig = (roomNo, field, value) => {
        setRoomConfigs(prev => prev.map(r => r.roomNo === roomNo ? { ...r, [field]: value } : r));
    };

    const generateSeatingPlan = () => {
        if (!selectedClass || !selectedSection) return alert("Please select a class and section first.");
        if (!examName || !examDate) return alert("Please provide an Exam Name and Date.");

        const studentsCount = parseInt(totalStudents);
        const rooms = parseInt(roomsCount);
        const seatsPerRm = parseInt(seatsPerRoom);

        if (!studentsCount || studentsCount <= 0) return alert("No students available. Check total students.");
        if (!rooms || rooms <= 0) return alert("Please enter the number of rooms.");
        if (!seatsPerRm || seatsPerRm <= 0) return alert("Please enter seats per room.");

        if (studentsCount > (rooms * seatsPerRm)) {
            return alert(`Capacity exceeded! ${rooms} rooms with ${seatsPerRm} seats can only hold ${rooms * seatsPerRm} students, but you have ${studentsCount} students.`);
        }

        // Validate Teachers assigned
        const unassignedRoom = roomConfigs.find(r => !r.teacherId);
        if (unassignedRoom) {
            return alert(`Please assign a teacher to ${unassignedRoom.roomName || 'Room ' + unassignedRoom.roomNo}.`);
        }

        // Shuffle students
        let dataToDistribute = [...dbStudents];
        for (let i = dataToDistribute.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dataToDistribute[i], dataToDistribute[j]] = [dataToDistribute[j], dataToDistribute[i]];
        }

        const plan = [];
        let studentIndex = 0;

        for (let i = 0; i < roomConfigs.length; i++) {
            const config = roomConfigs[i];
            const roomSeats = [];

            // Fill seats up to seatsPerRm or remaining students
            const studentsInRoom = Math.min(seatsPerRm, dataToDistribute.length - studentIndex);

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

            const assignedTeacher = teachers.find(t => t.id === config.teacherId);

            plan.push({
                roomNo: config.roomNo,
                roomName: config.roomName,
                seats: roomSeats,
                totalSeats: studentsInRoom,
                invigilatorId: config.teacherId,
                invigilatorName: assignedTeacher?.name || ''
            });

            if (studentIndex >= dataToDistribute.length) break;
        }

        setSeatingPlan(plan);
    };

    const saveSeatingPlan = async () => {
        if (!seatingPlan) return;
        setIsSaving(true);
        try {
            const instId = userData.role === 'institution' ? userData.uid : userData.institutionId;
            const docData = {
                examName: examName.trim(),
                examDate: examDate,
                totalStudents: parseInt(totalStudents),
                roomsCount: parseInt(roomsCount),
                seatsPerRoom: parseInt(seatsPerRoom),
                seatingPlan: seatingPlan,
                institutionId: instId,
                createdBy: userData.uid,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "exam_seating"), docData);
            alert("✅ Seating plan generated and published live! Teachers & Students can now view it.");
            navigate('/institution');
        } catch (e) {
            alert("Save Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🪑 AI Exam Seating Wizard</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => navigate('/view-exam-seating')} className="btn-outline">
                            📜 View History
                        </button>
                        <button onClick={() => navigate(-1)} className="btn-outline">Exit</button>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '15px' }}>Step 1: Select Class</h3>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Class</label>
                            <select
                                className="input-field"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="">-- Select Class --</option>
                                {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Section</label>
                            <select
                                className="input-field"
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                            >
                                <option value="">-- Select Section --</option>
                                {SECTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                            </select>
                        </div>
                    </div>

                    {isFetchingStudents && <div style={{ color: '#888', fontSize: '12px', marginTop: '10px' }}>Fetching student data for {selectedClass} - {selectedSection}...</div>}

                    {selectedClass && selectedSection && !isFetchingStudents && (
                        <div style={{ background: '#e8f5e9', padding: '10px', borderRadius: '8px', color: '#27ae60', fontSize: '13px', marginTop: '10px' }}>
                            ✓ Located <strong>{totalStudents}</strong> students in {selectedClass} - {selectedSection}.
                        </div>
                    )}
                </div>

                {selectedClass && selectedSection && !isFetchingStudents && dbStudents.length > 0 && (
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <h3 style={{ marginBottom: '15px' }}>Step 2: Exam & Room Setup</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Exam Name</label>
                                <input type="text" className="input-field" placeholder="e.g., Midterm Maths" value={examName} onChange={e => setExamName(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Date</label>
                                <input type="date" className="input-field" value={examDate} onChange={e => setExamDate(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>No. of Students per Class</label>
                                <input type="number" className="input-field" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>No. of Rooms</label>
                                <input type="number" className="input-field" placeholder="e.g., 3" value={roomsCount} onChange={handleRoomsCountChange} min="1" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Seats per Room</label>
                                <input type="number" className="input-field" placeholder="e.g., 30" value={seatsPerRoom} onChange={e => setSeatsPerRoom(e.target.value)} min="1" />
                            </div>
                        </div>

                        {roomConfigs.length > 0 && (
                            <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', background: '#f8f9fa' }}>
                                <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Room & Teacher Assignments</h4>
                                {roomConfigs.map((room, index) => (
                                    <div key={room.roomNo} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ fontWeight: 'bold', width: '20px', color: '#7f8c8d' }}>{index + 1}.</div>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Room Number/Name"
                                            value={room.roomName}
                                            onChange={(e) => updateRoomConfig(room.roomNo, 'roomName', e.target.value)}
                                            style={{ flex: 1, minWidth: '150px' }}
                                        />
                                        <select
                                            className="input-field"
                                            value={room.teacherId}
                                            onChange={(e) => updateRoomConfig(room.roomNo, 'teacherId', e.target.value)}
                                            style={{ flex: 1, minWidth: '150px' }}
                                        >
                                            <option value="">-- Assign Teacher from Dropdown --</option>
                                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: '20px' }}>
                            <button onClick={generateSeatingPlan} className="btn" style={{ width: '100%', padding: '12px', fontSize: '16px', background: '#6c5ce7' }}>
                                ⚡ Generate AI Seating Plan
                            </button>
                        </div>
                    </div>
                )}

                {seatingPlan && (
                    <div className="card" style={{ marginTop: '20px', borderTop: '4px solid #27ae60' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ color: '#27ae60', margin: 0 }}>🎉 Success! Verify & Publish</h3>
                            <button onClick={saveSeatingPlan} className="btn" style={{ background: '#27ae60' }} disabled={isSaving}>
                                {isSaving ? 'Publishing...' : '🚀 Publish Live'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {seatingPlan.map(room => (
                                <div key={room.roomNo} style={{ border: '1px solid #dfe6e9', borderRadius: '8px', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '16px', color: '#2c3e50' }}>{room.roomName} ({room.totalSeats} seats)</strong>
                                        <div style={{ background: '#e0ece4', color: '#2d3436', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}>
                                            👮‍♂️ Invigilator: <strong>{room.invigilatorName}</strong>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {room.seats.map(s => (
                                            <div key={s.seatNo} style={{
                                                padding: '6px 10px', background: '#ecf0f1', borderRadius: '6px', fontSize: '11px', minWidth: '80px', textAlign: 'center', border: '1px solid #bdc3c7'
                                            }}>
                                                <div style={{ color: '#7f8c8d' }}>Seat {s.seatNo}</div>
                                                <div style={{ fontWeight: 'bold', color: '#34495e' }}>{s.rollNo}</div>
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
