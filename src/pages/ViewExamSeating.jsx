import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function ViewExamSeating() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [examPlans, setExamPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [mySeat, setMySeat] = useState(null);

    useEffect(() => {
        if (userData?.uid) {
            fetchExamPlans();
        }
    }, [userData]);

    const fetchExamPlans = async () => {
        setLoading(true);
        try {
            // Standardize Institution ID lookup
            const instId = userData.institutionId || userData.createdBy || (userData.role === 'institution' ? userData.uid : null);

            if (!instId) {
                console.warn("No institution ID found for user:", userData.uid);
                setExamPlans([]);
                setLoading(false);
                return;
            }

            // Fetch all seating plans for this institution
            const q = query(
                collection(db, "exam_seating"),
                where("institutionId", "==", instId),
                orderBy("createdAt", "desc")
            );

            const snap = await getDocs(q);
            const allPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // For Students/Teachers, we show ALL plans but track their specific assignment
            setExamPlans(allPlans);

            // Auto-select latest plan and find assignment
            if (allPlans.length > 0) {
                const latest = allPlans[0];
                setSelectedPlan(latest);
                if (userData?.role === 'student' || userData?.role === 'teacher') {
                    findMyAssignment(latest);
                }
            }

        } catch (e) {
            console.error("Error fetching exam plans:", e);
        } finally {
            setLoading(false);
        }
    };

    const findMyAssignment = (plan) => {
        if (!plan || !plan.seatingPlan) return;

        if (userData?.role === 'teacher') {
            const room = (plan.seatingPlan || []).find(r =>
                r.invigilatorId === userData.uid ||
                (r.invigilators && r.invigilators.some(inv => inv.teacherId === userData.uid))
            );
            if (room) {
                setMySeat({ isTeacher: true, roomName: room.roomName });
            } else {
                setMySeat(null);
            }
        } else if (userData?.role === 'student') {
            const myRoll = (userData.rollNumber || userData.pid || userData.rollNo || '').toString().trim();
            const myUid = userData.uid;

            for (const room of plan.seatingPlan) {
                // Check simple/auto mode seats
                if (room.seats) {
                    const seat = room.seats.find(s =>
                        (s.userId === myUid && s.userId != null) ||
                        (s.rollNo?.toString().trim() === myRoll && myRoll !== '')
                    );
                    if (seat) {
                        setMySeat({ roomName: room.roomName, seatNo: seat.seatNo, rollNo: seat.rollNo });
                        return;
                    }
                }

                // Check Step-by-Step Assignment mode
                if (room.benches) {
                    for (const bench of room.benches) {
                        if (bench.leftSeat && ((bench.leftSeat.userId === myUid && myUid != null) || (bench.leftSeat.rollNo?.toString().trim() === myRoll && myRoll !== ''))) {
                            setMySeat({ roomName: room.roomName, seatNo: `${bench.benchNo}L`, rollNo: bench.leftSeat.rollNo });
                            return;
                        }
                        if (bench.rightSeat && ((bench.rightSeat.userId === myUid && myUid != null) || (bench.rightSeat.rollNo?.toString().trim() === myRoll && myRoll !== ''))) {
                            setMySeat({ roomName: room.roomName, seatNo: `${bench.benchNo}R`, rollNo: bench.rightSeat.rollNo });
                            return;
                        }
                    }
                }
            }
            setMySeat(null);
        }
    };

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        if (userData?.role === 'student' || userData?.role === 'teacher') {
            findMyAssignment(plan);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🪑 Exam Seating Arrangement</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>Loading...</div>
                ) : examPlans.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
                        <h3>No Exam Seating Plans Yet</h3>
                        <p style={{ color: '#999' }}>
                            The institution hasn't created any exam seating arrangements yet.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Institution View: History Table */}
                        {userData?.role === 'institution' && !selectedPlan && (
                            <div className="card">
                                <h3>📜 Exam Seating History</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                                                <th style={{ padding: '12px', textAlign: 'left', color: '#636e72' }}>Date Created</th>
                                                <th style={{ padding: '12px', textAlign: 'left', color: '#636e72' }}>Exam Name</th>
                                                <th style={{ padding: '12px', textAlign: 'left', color: '#636e72' }}>Exam Date</th>
                                                <th style={{ padding: '12px', textAlign: 'center', color: '#636e72' }}>Students</th>
                                                <th style={{ padding: '12px', textAlign: 'center', color: '#636e72' }}>Rooms</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: '#636e72' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {examPlans.map((plan) => (
                                                <tr key={plan.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        {plan.createdAt?.seconds ? new Date(plan.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#2d3436' }}>
                                                        {plan.examName}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        {plan.examDate ? new Date(plan.examDate).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <span style={{ background: '#e3f2fd', color: '#0984e3', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                                                            {plan.totalStudents}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{plan.roomsCount}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleSelectPlan(plan)}
                                                            style={{
                                                                background: '#6c5ce7',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px'
                                                            }}
                                                        >
                                                            👁️ View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Student View (or selected plan view): Dropdown */}
                        {(userData?.role !== 'institution' || selectedPlan) && (
                            <div className="card" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                            Select Exam to View:
                                        </label>
                                        <select
                                            className="input-field"
                                            value={selectedPlan?.id || ''}
                                            onChange={(e) => {
                                                const plan = examPlans.find(p => p.id === e.target.value);
                                                handleSelectPlan(plan);
                                            }}
                                            style={{ maxWidth: '400px' }}
                                        >
                                            <option value="">Choose an exam</option>
                                            {examPlans.map(plan => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.examName} - {plan.examDate ? new Date(plan.examDate).toLocaleDateString() : 'Date TBD'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Back to History Button for Institution */}
                                    {userData?.role === 'institution' && selectedPlan && (
                                        <button
                                            onClick={() => setSelectedPlan(null)}
                                            style={{
                                                background: '#f1f2f6',
                                                color: '#2d3436',
                                                border: '1px solid #dfe6e9',
                                                padding: '8px 15px',
                                                borderRadius: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            📜 Back to History
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Student's Seat Highlight */}
                        {userData?.role === 'student' && selectedPlan && (
                            <div className="card" style={{
                                marginBottom: '20px',
                                background: mySeat ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                                color: mySeat ? 'white' : '#636e72',
                                borderLeft: mySeat ? '5px solid #f39c12' : 'none'
                            }}>
                                {mySeat ? (
                                    <>
                                        <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>📍 Your Seat Assignment</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', fontSize: '16px' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', opacity: 0.9 }}>Room</div>
                                                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{mySeat.roomName}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', opacity: 0.9 }}>Seat Number</div>
                                                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{mySeat.seatNo}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', opacity: 0.9 }}>Roll Number</div>
                                                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{mySeat.rollNo}</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>❓</div>
                                        <div>Your seat is not assigned for this exam</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Teacher/Incharge Assignment Highlight */}
                        {userData?.role === 'teacher' && selectedPlan && (
                            <div className="card" style={{
                                marginBottom: '20px',
                                background: mySeat?.isTeacher ? 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)' : '#f8f9fa',
                                color: mySeat?.isTeacher ? 'white' : '#636e72',
                                borderLeft: mySeat?.isTeacher ? '5px solid #219150' : 'none'
                            }}>
                                {mySeat?.isTeacher ? (
                                    <>
                                        <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>👮‍♂️ Your Invigilation Duty</h3>
                                        <div style={{ fontSize: '18px' }}>
                                            You are assigned to <strong>{mySeat.roomName}</strong> for this exam.
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '10px' }}>
                                        <h3 style={{ margin: '0 0 5px 0' }}>📋 Duty Status</h3>
                                        <div>You are not assigned to any room for this exam.</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Seating Plan Display */}
                        {selectedPlan && (
                            <div className="card">
                                <div style={{ marginBottom: '20px' }}>
                                    <h3 style={{ margin: '0 0 5px 0' }}>{selectedPlan.examName}</h3>
                                    <div style={{ fontSize: '14px', color: '#636e72' }}>
                                        Date: {selectedPlan.examDate ? new Date(selectedPlan.examDate).toLocaleDateString() : 'TBD'} •
                                        Total Students: {selectedPlan.totalStudents}
                                    </div>
                                </div>

                                {selectedPlan.seatingPlan && selectedPlan.seatingPlan.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '20px' }}>
                                        {selectedPlan.seatingPlan
                                            .filter(room => {
                                                if (userData?.role === 'teacher') {
                                                    return room.invigilatorId === userData.uid ||
                                                        (room.invigilators && room.invigilators.some(inv => inv.teacherId === userData.uid));
                                                }
                                                return true;
                                            })
                                            .map(room => (
                                                <div key={room.roomNo} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                                        <div>
                                                            <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>
                                                                {room.roomName} - {room.totalSeats || 0} Students
                                                            </h4>
                                                            {room.invigilatorName && (
                                                                <div style={{ fontSize: '13px', color: '#2d3436', background: '#e0ece4', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                                    👮‍♂️ Invigilator: <strong>{room.invigilatorName}</strong>
                                                                </div>
                                                            )}
                                                            {room.invigilators && room.invigilators.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                                                                    {room.invigilators.map((inv, idx) => (
                                                                        <div key={idx} style={{ fontSize: '12px', color: '#2d3436', background: '#e0ece4', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                                            👮‍♂️ [{inv.side}] <strong>{inv.teacherName}</strong>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                                        gap: '10px'
                                                    }}>
                                                        {(() => {
                                                            let renderSeats = room.seats || [];
                                                            if (room.benches) {
                                                                renderSeats = [];
                                                                room.benches.forEach(bench => {
                                                                    if (bench.leftSeat) renderSeats.push({ seatNo: `${bench.benchNo}L`, rollNo: bench.leftSeat.rollNo, userId: bench.leftSeat.userId });
                                                                    if (bench.rightSeat) renderSeats.push({ seatNo: `${bench.benchNo}R`, rollNo: bench.rightSeat.rollNo, userId: bench.rightSeat.userId });
                                                                });
                                                            }

                                                            return renderSeats.map(seat => {
                                                                // Highlight student's own seat
                                                                const isMySeats = userData?.role === 'student' &&
                                                                    mySeat &&
                                                                    seat.rollNo?.toString() === mySeat.rollNo?.toString();

                                                                return (
                                                                    <div key={seat.seatNo} style={{
                                                                        border: isMySeats ? '3px solid #f39c12' : '2px solid #3498db',
                                                                        borderRadius: '8px',
                                                                        padding: '10px',
                                                                        textAlign: 'center',
                                                                        background: isMySeats ? '#fff9e6' : '#ecf0f1',
                                                                        position: 'relative'
                                                                    }}>
                                                                        {isMySeats && (
                                                                            <div style={{
                                                                                position: 'absolute',
                                                                                top: '-8px',
                                                                                right: '-8px',
                                                                                background: '#f39c12',
                                                                                color: 'white',
                                                                                borderRadius: '50%',
                                                                                width: '24px',
                                                                                height: '24px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                fontSize: '14px'
                                                                            }}>
                                                                                ★
                                                                            </div>
                                                                        )}
                                                                        <div style={{ fontSize: '11px', color: '#7f8c8d' }}>Seat {seat.seatNo}</div>
                                                                        <div style={{
                                                                            fontSize: '16px',
                                                                            fontWeight: 'bold',
                                                                            color: isMySeats ? '#f39c12' : '#2c3e50'
                                                                        }}>
                                                                            {seat.rollNo}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                        No seating arrangement available
                                    </div>
                                )}

                                {/* Legend for Students */}
                                {userData?.role === 'student' && mySeat && (
                                    <div style={{
                                        marginTop: '20px',
                                        padding: '15px',
                                        background: '#fff9e6',
                                        borderRadius: '8px',
                                        borderLeft: '4px solid #f39c12'
                                    }}>
                                        <div style={{ fontSize: '13px', color: '#856404' }}>
                                            <strong>★ Legend:</strong> Your assigned seat is highlighted with a gold border and star
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
