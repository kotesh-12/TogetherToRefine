import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function StudentFee() {
    const { userData } = useUser();
    const [fees, setFees] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!userData) return;

        const fetchFees = async () => {
            try {
                // 1. Fetch Pending Fees
                const q = query(
                    collection(db, "fees"),
                    where("studentId", "==", userData.uid),
                    where("institutionId", "==", userData.institutionId),
                    where("status", "==", "pending")
                );
                const querySnapshot = await getDocs(q);
                const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setFees(list);

                // 2. Fetch History (Paid)
                const qHist = query(
                    collection(db, "fees"),
                    where("studentId", "==", userData.uid),
                    where("institutionId", "==", userData.institutionId),
                    where("status", "==", "paid"),
                    orderBy("paidAt", "desc")
                );
                const histSnapshot = await getDocs(qHist);
                const histList = histSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistory(histList);
            } catch (error) {
                console.error("Error fetching fees:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFees();
    }, [userData]);

    const handlePay = async (feeId, amount) => {
        // MOCK PAYMENT GATEWAY INTEGRATION
        // In real app: Open Razorpay/Stripe -> await success -> update DB
        if (!window.confirm(`Proceed to pay ₹${amount}?`)) return;

        try {
            const feeRef = doc(db, "fees", feeId);
            await updateDoc(feeRef, {
                status: 'paid',
                paidAt: serverTimestamp(),
                transactionId: `TXN-${Date.now()}` // Mock Transaction ID
            });

            alert("Payment Successful! ✅");

            // Refresh local state without full reload
            setFees(prev => prev.filter(f => f.id !== feeId));
            const paidFee = fees.find(f => f.id === feeId);
            if (paidFee) {
                setHistory(prev => [{ ...paidFee, status: 'paid', paidAt: new Date(), transactionId: `TXN-${Date.now()}` }, ...prev]);
            }

        } catch (e) {
            console.error("Payment Error:", e);
            alert("Payment Failed. Please try again.");
        }
    };

    const downloadReceipt = (rec) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(44, 62, 80);
        doc.text("FEE RECEIPT", 105, 20, null, null, "center");

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("Together To Refine Platform", 105, 28, null, null, "center");

        // Draw Line
        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);

        // Details
        doc.setFontSize(10);
        doc.setTextColor(0);

        const details = [
            ["Transaction ID", rec.transactionId || "N/A"],
            ["Date", rec.paidAt?.seconds ? new Date(rec.paidAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString()],
            ["Student Name", userData.name],
            ["Student ID", userData.pid || userData.uid.slice(0, 8)],
            ["Class", `${userData.class || userData.assignedClass} - ${userData.section || 'A'}`],
            ["Fee Type", rec.title],
            ["Status", "PAID"]
        ];

        let y = 45;
        details.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, 20, y);
            doc.setFont("helvetica", "normal");
            doc.text(`${value}`, 60, y);
            y += 8;
        });

        // Amount Box
        doc.setFillColor(241, 242, 246);
        doc.rect(120, 40, 70, 30, "F");
        doc.setFontSize(14);
        doc.setTextColor(46, 204, 113);
        doc.setFont("helvetica", "bold");
        doc.text(`AMOUNT PAID`, 155, 50, null, null, "center");
        doc.setFontSize(20);
        doc.text(`₹${rec.amount}`, 155, 62, null, null, "center");

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("This is a computer generated receipt.", 105, 280, null, null, "center");

        doc.save(`Receipt_${rec.transactionId}.pdf`);
    };

    if (loading) return <div className="p-4 text-center">Loading Fee Details...</div>;

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2c3e50' }}>🎓 Student Fee Portal</h2>

            {/* PENDING FEES SECTION */}
            <div className="card" style={{ marginBottom: '20px', borderLeft: '5px solid #e74c3c' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>⚠️ Pending Dues</h3>
                {fees.length === 0 ? (
                    <p style={{ color: '#27ae60', fontWeight: 'bold' }}>No pending dues! 🎉</p>
                ) : (
                    <div className="fee-list">
                        {fees.map(fee => (
                            <div key={fee.id} style={styles.feeItem}>
                                <div>
                                    <h4 style={{ margin: 0 }}>{fee.title}</h4>
                                    <p style={{ margin: '5px 0', fontSize: '13px', color: '#7f8c8d' }}>Due: {new Date(fee.dueDate).toLocaleDateString()}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>₹{fee.amount}</div>
                                    <button
                                        className="btn"
                                        style={{ background: '#27ae60', padding: '5px 15px', fontSize: '12px' }}
                                        onClick={() => handlePay(fee.id, fee.amount)}
                                    >
                                        Pay Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PAYMENT HISTORY SECTION */}
            <div className="card" style={{ borderLeft: '5px solid #27ae60' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📜 Payment History</h3>
                {history.length === 0 ? (
                    <p style={{ color: '#95a5a6' }}>No payment history found.</p>
                ) : (
                    <div className="history-list">
                        {history.map(rec => (
                            <div key={rec.id} style={{ ...styles.feeItem, opacity: 0.8 }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#34495e' }}>{rec.title}</h4>
                                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#7f8c8d' }}>
                                        Paid on: {rec.paidAt?.seconds ? new Date(rec.paidAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                    </p>
                                    <span style={{ fontSize: '10px', background: '#ecf0f1', padding: '2px 5px', borderRadius: '4px' }}>
                                        Txn: {rec.transactionId}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>₹{rec.amount}</div>
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', marginTop: '5px' }}>
                                        <span style={{ fontSize: '12px', color: '#27ae60' }}>✓ Paid</span>
                                        <button
                                            onClick={() => downloadReceipt(rec)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                            title="Download Receipt"
                                        >
                                            📥
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    feeItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px',
        borderBottom: '1px solid #ecf0f1',
        background: '#fff',
        marginBottom: '5px'
    }
};
