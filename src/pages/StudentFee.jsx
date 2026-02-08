
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
        if (!userData || !userData.uid) return;

        const fetchFees = async () => {
            try {
                // 1. Find all allotments linked to this student
                const allotQ = query(collection(db, "student_allotments"), where("userId", "==", userData.uid));
                const allotSnap = await getDocs(allotQ);
                const myAllotmentIds = allotSnap.docs.map(d => d.id);

                // 2. Fetch Pending Fees
                // We query by studentId. studentId could be the User UID or the Allotment ID.
                const studentIdsToSearch = [userData.uid, ...myAllotmentIds];

                // Firestore 'in' operator supports up to 10 IDs. Usually a student has 1 or 2 allotments.
                const qPending = query(
                    collection(db, "fees"),
                    where("studentId", "in", studentIdsToSearch),
                    where("status", "==", "pending")
                );
                const pendingSnap = await getDocs(qPending);
                const pendingList = pendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Cleanup: Deduplicate if the same fee shows up twice (unlikely but safe)
                const uniquePending = Array.from(new Map(pendingList.map(item => [item.id, item])).values());
                setFees(uniquePending);

                // 3. Fetch History (Paid)
                const qHist = query(
                    collection(db, "fees"),
                    where("studentId", "in", studentIdsToSearch),
                    where("status", "==", "paid")
                );
                const histSnapshot = await getDocs(qHist);
                const histList = histSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                histList.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));

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
        if (!window.confirm(`Proceed to pay ₹${amount}?`)) return;

        try {
            const feeRef = doc(db, "fees", feeId);
            await updateDoc(feeRef, {
                status: 'paid',
                paidAt: serverTimestamp(),
                transactionId: `TXN-${Date.now()}`,
                // Link payment to the actual User UID if it was marked against Allotment ID
                studentId: userData.uid
            });

            alert("Payment Successful! ✅");

            // Refresh UI
            setFees(prev => prev.filter(f => f.id !== feeId));
            const paidFee = fees.find(f => f.id === feeId);
            if (paidFee) {
                setHistory(prev => [{ ...paidFee, status: 'paid', paidAt: { seconds: Date.now() / 1000 }, transactionId: `TXN-${Date.now()}` }, ...prev]);
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

        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);

        doc.setFontSize(10);
        doc.setTextColor(0);

        const details = [
            ["Transaction ID", rec.transactionId || "N/A"],
            ["Date", rec.paidAt?.seconds ? new Date(rec.paidAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString()],
            ["Student Name", userData.name || `${userData.firstName || ''} ${userData.secondName || ''}`.trim()],
            ["Institution", rec.institutionName || "School"],
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

        doc.setFillColor(241, 242, 246);
        doc.rect(120, 40, 70, 30, "F");
        doc.setFontSize(14);
        doc.setTextColor(46, 204, 113);
        doc.setFont("helvetica", "bold");
        doc.text(`AMOUNT PAID`, 155, 50, null, null, "center");
        doc.setFontSize(20);
        doc.text(`₹${rec.amount}`, 155, 62, null, null, "center");

        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("This is a computer generated receipt.", 105, 280, null, null, "center");

        doc.save(`Receipt_${rec.transactionId}.pdf`);
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f9fa' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #eee', borderTop: '3px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div className="page-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', background: '#f8f9fa', minHeight: '100vh' }}>
            <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'white', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '12px' }}>← Back</button>
            <h2 style={{ textAlign: 'center', marginBottom: '30px', fontWeight: '800', color: '#2d3436' }}>🎓 Student Fee Portal</h2>

            <div className="card" style={{ marginBottom: '30px', padding: '30px', borderRadius: '24px', borderLeft: '6px solid #e74c3c' }}>
                <h3 style={{ marginBottom: '20px', color: '#2d3436' }}>🔴 Pending Payments</h3>
                {fees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <span style={{ fontSize: '3rem' }}>🎉</span>
                        <p style={{ color: '#27ae60', fontWeight: '700', marginTop: '10px' }}>No pending dues! You're all caught up.</p>
                    </div>
                ) : (
                    <div className="fee-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {fees.map(fee => (
                            <div key={fee.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{fee.title}</h4>
                                    <p style={{ margin: '5px 0', fontSize: '13px', color: '#7f8c8d' }}>Due: {new Date(fee.dueDate).toLocaleDateString()}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#e74c3c' }}>₹{fee.amount}</div>
                                    <button
                                        onClick={() => handlePay(fee.id, fee.amount)}
                                        style={{ background: '#2d3436', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', marginTop: '8px', cursor: 'pointer' }}
                                    >
                                        Pay Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '30px', borderRadius: '24px', borderLeft: '6px solid #27ae60' }}>
                <h3 style={{ marginBottom: '20px', color: '#2d3436' }}>📜 Payment History</h3>
                {history.length === 0 ? (
                    <p style={{ color: '#95a5a6', textAlign: 'center' }}>No payment history found.</p>
                ) : (
                    <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {history.map(rec => (
                            <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'white', borderRadius: '16px', opacity: 0.9 }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#34495e' }}>{rec.title}</h4>
                                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#7f8c8d' }}>
                                        Paid: {rec.paidAt?.seconds ? new Date(rec.paidAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#27ae60' }}>₹{rec.amount}</div>
                                    <button onClick={() => downloadReceipt(rec)} style={{ background: '#f1f2f6', border: 'none', padding: '5px 10px', borderRadius: '8px', fontSize: '14px', marginTop: '5px', cursor: 'pointer' }}>
                                        Receipt 📥
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
