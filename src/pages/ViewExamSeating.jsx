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
        fetchExamPlans();
    }, []);

    const fetchExamPlans = async () => {
        setLoading(true);
        try {
            // Fetch all exam seating plans for this institution
            const q = query(
                collection(db, "exam_seating"),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setExamPlans(plans);

            // If student, auto-find their seat in the latest exam
            if (userData?.role === 'student' && plans.length > 0) {
                findMySeat(plans[0]);
                setSelectedPlan(plans[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const findMySeat = (plan) => {
        if (!plan || !plan.seatingPlan) return;

        const studentRoll = userData.rollNumber || userData.pid;
        if (!studentRoll) return;

        // Search through all rooms for this student's roll number
        for (const room of plan.seatingPlan) {
            const seat = (room.seats || []).find(s => s.rollNo.toString() === studentRoll.toString());
            if (seat) {
                setMySeat({
                    roomName: room.roomName,
                    roomNo: room.roomNo,
                    seatNo: seat.seatNo,
                    rollNo: seat.rollNo
                });
                return;
            }
        }
        setMySeat(null);
    };

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        if (userData?.role === 'student') {
            findMySeat(plan);
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
                        {/* Exam Selector */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                Select Exam:
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
                                        {selectedPlan.seatingPlan.map(room => (
                                            <div key={room.roomNo} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                                                <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>
                                                    {room.roomName} - {room.totalSeats} Students
                                                </h4>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                                    gap: '10px'
                                                }}>
                                                    {(room.seats || []).map(seat => {
                                                        // Highlight student's own seat
                                                        const isMySeats = userData?.role === 'student' &&
                                                            mySeat &&
                                                            seat.rollNo.toString() === mySeat.rollNo.toString();

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
                                                    })}
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
