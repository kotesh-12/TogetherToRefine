import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        if (!instId || !classParam || !titleParam) {
            console.log('Missing required params:', { instId, classParam, titleParam });
            return;
        }

        const fetchPaymentStatus = async () => {
            setLoading(true);
            try {
                console.log('Fetching fees with params:', { instId, classParam, sectionParam, titleParam });

                // Fetch all fee records for this class and title
                const feesRef = collection(db, 'fees');
                const q = query(
                    feesRef,
                    where('institutionId', '==', instId),
                    where('class', '==', classParam),
                    where('title', '==', titleParam)
                );

                const snapshot = await getDocs(q);
                console.log('Total fee records found:', snapshot.docs.length);

                const feeRecords = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('Fee records:', feeRecords);

                // Filter by section if needed
                const filteredRecords = sectionParam && sectionParam !== 'All'
                    ? feeRecords.filter(f => f.section === sectionParam)
                    : feeRecords;

                console.log('Filtered records:', filteredRecords.length);

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

                console.log('Paid students:', paid.length);
                console.log('Unpaid students:', unpaid.length);

                setPaidStudents(paid);
                setUnpaidStudents(unpaid);
            } catch (error) {
                console.error('Error fetching payment status:', error);
                alert('Failed to load payment details: ' + error.message);
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

    const downloadUnpaidReport = () => {
        if (unpaidStudents.length === 0) {
            alert("No unpaid students to report!");
            return;
        }

        const doc = new jsPDF();

        // Header
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("CONFIDENTIAL - FOR OFFICE USE ONLY", 14, 10);

        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text("Pending Fee Report", 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Fee: ${feeInfo?.title}`, 14, 30);
        doc.text(`Class: ${feeInfo?.class} - ${feeInfo?.section}`, 14, 36);
        doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 42);

        // Add a note about privacy
        doc.setFontSize(10);
        doc.setTextColor(220, 53, 69); // Red color for warning
        doc.text("⚠️ PRIVACY NOTICE: This document is for administrative communication with parents only.", 14, 52);
        doc.text("Do not display this list publicly or discuss with students to protect their dignity.", 14, 57);

        // Table
        const tableColumn = ["#", "Student Name", "Amount Due", "Due Date", "Parent Contact (Use for Reminders)"];
        const tableRows = [];

        unpaidStudents.forEach((student, index) => {
            const studentData = [
                index + 1,
                student.studentName || "Unknown",
                `Rs. ${student.amount}`,
                student.dueDate || "N/A",
                "___________________" // Placeholder for manual notes if phone not available
            ];
            tableRows.push(studentData);
        });

        autoTable(doc, {
            startY: 65,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] }, // Red header for unpaid
            styles: { fontSize: 10 },
        });

        // Summary Footer
        const finalY = (doc).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Pending: ${unpaidStudents.length} Students`, 14, finalY);
        doc.text(`Total Amount Pending: Rs. ${pendingAmount.toLocaleString()}`, 14, finalY + 6);

        doc.save(`${feeInfo?.title}_Pending_Report.pdf`);
    };

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
                        💰 {feeInfo?.title || titleParam || 'Fee Details'}
                    </h1>
                    <p style={{ color: '#666', fontSize: '16px' }}>
                        Class {feeInfo?.class || classParam} - Section {feeInfo?.section || sectionParam}
                    </p>
                </div>

                {/* No Data Message */}
                {totalStudents === 0 && !loading && (
                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '40px',
                        marginBottom: '20px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📭</div>
                        <h3 style={{ fontSize: '24px', marginBottom: '10px', color: '#2d3436' }}>
                            No Fee Records Found
                        </h3>
                        <p style={{ color: '#666', marginBottom: '20px' }}>
                            No fee records found for this class and fee title.
                        </p>
                        <div style={{
                            background: '#f8f9fa',
                            padding: '20px',
                            borderRadius: '10px',
                            textAlign: 'left',
                            maxWidth: '500px',
                            margin: '0 auto'
                        }}>
                            <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Possible reasons:</p>
                            <ul style={{ paddingLeft: '20px', color: '#666' }}>
                                <li>Fee hasn't been assigned to this class yet</li>
                                <li>Class or section name doesn't match</li>
                                <li>Fee title is different</li>
                            </ul>
                            <p style={{ marginTop: '15px', fontSize: '14px', color: '#999' }}>
                                Try assigning the fee from Fee Management page first.
                            </p>
                        </div>
                    </div>
                )}

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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#e74c3c',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                margin: 0
                            }}>
                                ⏳ Pending ({unpaidStudents.length})
                            </h3>
                            {unpaidStudents.length > 0 && (
                                <button
                                    onClick={downloadUnpaidReport}
                                    style={{
                                        background: '#2d3436',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 15px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    📥 Download Report
                                </button>
                            )}
                        </div>

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
