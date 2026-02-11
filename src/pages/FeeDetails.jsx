import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

const FeeDetails = () => {
    const { feeId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [paidStudents, setPaidStudents] = useState([]);
    const [unpaidStudents, setUnpaidStudents] = useState([]);
    const [feeInfo, setFeeInfo] = useState(null);

    const classParam = searchParams.get('class');
    const sectionParam = searchParams.get('section');
    const titleParam = searchParams.get('title');

    const instId = userData?.role === 'institution' ? userData?.uid : userData?.institutionId;

    useEffect(() => {
        if (!instId || !classParam || !titleParam) return;

        const fetchPaymentStatus = async () => {
            setLoading(true);
            try {
                // Fetch all fee records for this class and title
                const feesRef = collection(db, 'fees');
                const q = query(
                    feesRef,
                    where('institutionId', '==', instId),
                    where('class', '==', classParam),
                    where('title', '==', titleParam)
                );

                if (sectionParam && sectionParam !== 'All') {
                    // Filter by section if specified
                }

                const snapshot = await getDocs(q);
                const feeRecords = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter by section if needed
                const filteredRecords = sectionParam && sectionParam !== 'All'
                    ? feeRecords.filter(f => f.section === sectionParam)
                    : feeRecords;

                // Get fee info from first record
                if (filteredRecords.length > 0) {
                    setFeeInfo({
                        title: filteredRecords[0].title,
                        amount: filteredRecords[0].amount,
                        class: filteredRecords[0].class,
                        section: filteredRecords[0].section || sectionParam,
                        dueDate: filteredRecords[0].dueDate
                    });
                }

                // Separate paid and unpaid
                const paid = filteredRecords.filter(f => f.status === 'paid' || f.status === 'approved');
                const unpaid = filteredRecords.filter(f => f.status === 'pending' || !f.status);

                setPaidStudents(paid);
                setUnpaidStudents(unpaid);
            } catch (error) {
                console.error('Error fetching payment status:', error);
                alert('Failed to load payment details');
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentStatus();
    }, [instId, classParam, sectionParam, titleParam]);

    const totalStudents = paidStudents.length + unpaidStudents.length;
    const collectedAmount = paidStudents.length * (feeInfo?.amount || 0);
    const pendingAmount = unpaidStudents.length * (feeInfo?.amount || 0);
    const collectionPercentage = totalStudents > 0 ? ((paidStudents.length / totalStudents) * 100).toFixed(1) : 0;

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <p style={{ color: 'white', fontSize: '18px' }}>⏳ Loading payment details...</p>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            paddingBottom: '100px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    background: 'white',
                    borderRadius: '15px',
                    padding: '30px',
                    marginBottom: '20px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: '#f1f2f6',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginBottom: '15px',
                            fontWeight: '600'
                        }}
                    >
                        ← Back
                    </button>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '10px'
                    }}>
                        💰 {feeInfo?.title || 'Fee Details'}
                    </h1>
                    <p style={{ color: '#666', fontSize: '16px' }}>
                        Class {feeInfo?.class} - Section {feeInfo?.section}
                    </p>
                </div>

                {/* Stats Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Students</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2d3436' }}>{totalStudents}</div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Paid</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#27ae60' }}>
                            {paidStudents.length}
                            <span style={{ fontSize: '16px', marginLeft: '10px', color: '#666' }}>
                                ({collectionPercentage}%)
                            </span>
                        </div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Pending</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#e74c3c' }}>{unpaidStudents.length}</div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Collected</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#27ae60' }}>
                            ₹{collectedAmount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                            Pending: ₹{pendingAmount.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Paid Students */}
                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            marginBottom: '15px',
                            color: '#27ae60',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            ✅ Paid ({paidStudents.length})
                        </h3>

                        {paidStudents.length === 0 ? (
                            <p style={{ color: '#999', fontStyle: 'italic' }}>No payments received yet</p>
                        ) : (
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                {paidStudents.map((student, index) => (
                                    <div
                                        key={student.id}
                                        style={{
                                            padding: '12px',
                                            borderBottom: '1px solid #f0f0f0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '15px' }}>
                                                {index + 1}. {student.studentName || 'Student'}
                                            </div>
                                            {student.paidAt && (
                                                <div style={{ fontSize: '12px', color: '#999' }}>
                                                    Paid on: {new Date(student.paidAt.seconds * 1000).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{
                                            background: '#d4edda',
                                            color: '#155724',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            ₹{student.amount}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Unpaid Students */}
                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            marginBottom: '15px',
                            color: '#e74c3c',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            ⏳ Pending ({unpaidStudents.length})
                        </h3>

                        {unpaidStudents.length === 0 ? (
                            <p style={{ color: '#27ae60', fontStyle: 'italic' }}>🎉 All students have paid!</p>
                        ) : (
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                {unpaidStudents.map((student, index) => (
                                    <div
                                        key={student.id}
                                        style={{
                                            padding: '12px',
                                            borderBottom: '1px solid #f0f0f0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '15px' }}>
                                                {index + 1}. {student.studentName || 'Student'}
                                            </div>
                                            {student.dueDate && (
                                                <div style={{ fontSize: '12px', color: '#999' }}>
                                                    Due: {student.dueDate}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{
                                            background: '#f8d7da',
                                            color: '#721c24',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            ₹{student.amount}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeDetails;
