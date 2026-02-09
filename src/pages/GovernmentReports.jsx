import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useUser } from '../context/UserContext';

export default function GovernmentReports() {
    const { userData } = useUser();
    const [reportType, setReportType] = useState('');
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const generateReport = () => {
        const doc = new jsPDF();

        // --- HEADER (Government Style) ---
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("GOVERNMENT OF INDIA - MINISTRY OF EDUCATION", 105, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.text("MONTHLY SCHOOL REPORT (FORMAT-A)", 105, 25, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`School: ${userData?.institutionName || "Kendriya Vidyalaya No. 1"}`, 15, 40);
        doc.text(`Teacher: ${userData?.name || "Amit Kumar"}`, 15, 48);
        doc.text(`Month: ${month}`, 150, 40);
        doc.text(`District: New Delhi`, 150, 48);

        // --- TABLE (Mock Data for now, real data integration next) ---
        const head = [['Roll No', 'Student Name', 'Attendance (%)', 'MDM Taken (Days)', 'Remarks']];
        const body = [
            ['101', 'Aarav Sharma', '85%', '22', 'Satisfactory'],
            ['102', 'Bhavya Singh', '92%', '24', 'Excellent'],
            ['103', 'Chaitanya R', '78%', '20', 'Needs Improvement'],
            ['104', 'Divya K', '95%', '24', 'Excellent'],
            ['105', 'Esha Gupta', '88%', '23', 'Good']
        ];

        doc.autoTable({
            startY: 55,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] }, // Government Green
        });

        // --- FOOTER ---
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.text("Signature of Teacher", 15, finalY);
        doc.text("Signature of Principal", 150, finalY);

        doc.save(`Govt_Report_${month}.pdf`);
    };

    return (
        <div className="page-wrapper">
            <div className="container" style={{ maxWidth: '600px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>📄 Government Report Generator</h2>

                <div className="card">
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                        Generate official monthly reports in one click. No manual writing required.
                    </p>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Select Report Type:</label>
                        <select
                            className="input-field"
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                        >
                            <option value="">-- Select --</option>
                            <option value="attendance">Monthly Attendance (Format A)</option>
                            <option value="mdm">Mid-Day Meal Register</option>
                            <option value="marks">CCE Marks Sheet</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Select Month:</label>
                        <input
                            type="month"
                            className="input-field"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>

                    <button
                        className="btn"
                        style={{ width: '100%', background: '#27ae60' }}
                        onClick={generateReport}
                        disabled={!reportType}
                    >
                        ⬇️ Download Official PDF
                    </button>

                    {reportType && (
                        <p style={{ fontSize: '12px', color: '#27ae60', marginTop: '10px', textAlign: 'center' }}>
                            ✅ Ready to print for BEO inspection.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
