import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function InspectionReadiness() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const [loading, setLoading] = useState(true);
    const [checklist, setChecklist] = useState({});
    const [complianceScore, setComplianceScore] = useState(0);
    const [lastInspection, setLastInspection] = useState(null);

    // Comprehensive document checklist (50+ items)
    const documentCategories = {
        "Legal & Registration": [
            "School Registration Certificate",
            "Affiliation Certificate (CBSE/State Board)",
            "Society Registration",
            "Trust Deed",
            "NOC from Local Authority",
            "Building Safety Certificate",
            "Fire Safety Certificate",
            "Sanitation Certificate"
        ],
        "Infrastructure": [
            "Building Plan Approval",
            "Playground Certificate",
            "Laboratory Equipment List",
            "Library Catalog",
            "Computer Lab Inventory",
            "Furniture Inventory",
            "Drinking Water Test Report",
            "Electricity Safety Certificate"
        ],
        "Academic": [
            "Curriculum Framework",
            "Lesson Plans (All Subjects)",
            "Examination Records",
            "Student Progress Reports",
            "Teacher Qualification Certificates",
            "Teacher Training Certificates",
            "Class Timetables",
            "Academic Calendar"
        ],
        "Student Records": [
            "Admission Register",
            "Student Attendance Records",
            "Transfer Certificates",
            "Character Certificates",
            "Medical Records",
            "Fee Receipts",
            "Scholarship Records",
            "Student ID Cards"
        ],
        "Staff Records": [
            "Teacher Appointment Letters",
            "Staff Attendance Register",
            "Salary Registers",
            "PF/ESI Records",
            "Police Verification Certificates",
            "Medical Fitness Certificates",
            "Staff ID Cards",
            "Leave Records"
        ],
        "Financial": [
            "Audited Financial Statements",
            "Fee Structure Approval",
            "Income Tax Returns",
            "GST Registration",
            "Bank Statements",
            "Budget Documents",
            "Donation Receipts",
            "Expenditure Records"
        ],
        "Safety & Welfare": [
            "CCTV Installation Certificate",
            "First Aid Kit Inventory",
            "Emergency Contact List",
            "Disaster Management Plan",
            "Anti-Ragging Policy",
            "Child Protection Policy",
            "Transport Safety Records",
            "Insurance Policies"
        ]
    };

    useEffect(() => {
        fetchInspectionData();
    }, [userData]);

    const fetchInspectionData = async () => {
        try {
            const docRef = doc(db, "inspection_readiness", userData.institutionId || userData.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setChecklist(data.checklist || {});
                setLastInspection(data.lastInspection);
                calculateCompliance(data.checklist || {});
            } else {
                // Initialize empty checklist
                const emptyChecklist = {};
                Object.entries(documentCategories).forEach(([category, items]) => {
                    items.forEach(item => {
                        emptyChecklist[item] = false;
                    });
                });
                setChecklist(emptyChecklist);
                calculateCompliance(emptyChecklist);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const calculateCompliance = (checklistData) => {
        const total = Object.keys(checklistData).length;
        const completed = Object.values(checklistData).filter(v => v === true).length;
        const score = total > 0 ? Math.round((completed / total) * 100) : 0;
        setComplianceScore(score);
    };

    const toggleDocument = async (docName) => {
        const newChecklist = { ...checklist, [docName]: !checklist[docName] };
        setChecklist(newChecklist);
        calculateCompliance(newChecklist);

        // Save to database
        try {
            await setDoc(doc(db, "inspection_readiness", userData.institutionId || userData.uid), {
                checklist: newChecklist,
                lastUpdated: serverTimestamp(),
                updatedBy: userData.uid
            }, { merge: true });
        } catch (e) {
            console.error(e);
        }
    };

    const recordInspection = async () => {
        const score = prompt("Enter inspection score (0-100):");
        if (!score) return;

        try {
            await updateDoc(doc(db, "inspection_readiness", userData.institutionId || userData.uid), {
                lastInspection: {
                    date: new Date().toISOString(),
                    score: parseInt(score),
                    complianceAtTime: complianceScore
                }
            });
            alert("✅ Inspection record saved!");
            fetchInspectionData();
        } catch (e) {
            console.error(e);
            alert("Error saving inspection record");
        }
    };

    const generateReport = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(userData?.institutionName || "School Inspection Report", 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text("INSPECTION READINESS REPORT", 105, 30, { align: 'center' });

        // Compliance Score
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Compliance Score: ${complianceScore}%`, 20, 45);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 52);

        if (lastInspection) {
            doc.text(`Last Inspection: ${new Date(lastInspection.date).toLocaleDateString()}`, 20, 59);
            doc.text(`Last Score: ${lastInspection.score}%`, 20, 66);
        }

        let yPos = 80;

        // Document Checklist by Category
        Object.entries(documentCategories).forEach(([category, items]) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(category, 20, yPos);
            yPos += 10;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);

            items.forEach(item => {
                const status = checklist[item] ? '✓' : '✗';
                const color = checklist[item] ? [39, 174, 96] : [231, 76, 60];
                doc.setTextColor(...color);
                doc.text(`${status} ${item}`, 25, yPos);
                yPos += 7;

                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            });

            doc.setTextColor(0, 0, 0);
            yPos += 5;
        });

        // Footer
        doc.setFontSize(9);
        doc.text("Powered by Together To Refine", 20, 285);

        doc.save(`Inspection_Readiness_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const getMissingDocuments = () => {
        return Object.entries(checklist)
            .filter(([_, completed]) => !completed)
            .map(([doc]) => doc);
    };

    const getCompletedDocuments = () => {
        return Object.entries(checklist)
            .filter(([_, completed]) => completed)
            .map(([doc]) => doc);
    };

    if (loading) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔴</div>
                    <div>Loading inspection data...</div>
                </div>
            </div>
        );
    }

    const missingDocs = getMissingDocuments();
    const completedDocs = getCompletedDocuments();

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>🔴 Inspection Readiness</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Compliance Score Card */}
                <div className="card" style={{
                    marginBottom: '20px',
                    background: complianceScore >= 90 ? 'linear-gradient(135deg, #27ae60 0%, #229954 100%)' :
                        complianceScore >= 75 ? 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' :
                            'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Compliance Score</h3>
                            <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{complianceScore}%</div>
                            <div style={{ fontSize: '14px', opacity: 0.9 }}>
                                {complianceScore >= 90 ? "✅ Excellent! Ready for inspection" :
                                    complianceScore >= 75 ? "⚠️ Good, but needs improvement" :
                                        "❌ Critical! Immediate action required"}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>Documents</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {completedDocs.length} / {Object.keys(checklist).length}
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>Completed</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button onClick={generateReport} className="btn" style={{ background: '#3498db' }}>
                        📄 Download Report
                    </button>
                    <button onClick={recordInspection} className="btn" style={{ background: '#9b59b6' }}>
                        📝 Record Inspection
                    </button>
                    {lastInspection && (
                        <div style={{
                            padding: '10px 20px',
                            background: '#ecf0f1',
                            borderRadius: '8px',
                            fontSize: '13px'
                        }}>
                            Last Inspection: {new Date(lastInspection.date).toLocaleDateString()} - Score: {lastInspection.score}%
                        </div>
                    )}
                </div>

                {/* Missing Documents Alert */}
                {missingDocs.length > 0 && (
                    <div className="card" style={{
                        marginBottom: '20px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderLeft: '5px solid #ffc107'
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Missing Documents ({missingDocs.length})</h4>
                        <div style={{ fontSize: '14px', color: '#856404' }}>
                            Priority items to complete before next inspection:
                            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                                {missingDocs.slice(0, 5).map(doc => (
                                    <li key={doc}>{doc}</li>
                                ))}
                                {missingDocs.length > 5 && <li>...and {missingDocs.length - 5} more</li>}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Document Checklist by Category */}
                <div className="card">
                    <h3>Document Checklist</h3>
                    <p style={{ color: '#636e72', marginBottom: '20px' }}>
                        Check off documents as you complete them. Click to toggle status.
                    </p>

                    {Object.entries(documentCategories).map(([category, items]) => {
                        const categoryCompleted = items.filter(item => checklist[item]).length;
                        const categoryTotal = items.length;
                        const categoryPercent = Math.round((categoryCompleted / categoryTotal) * 100);

                        return (
                            <div key={category} style={{ marginBottom: '25px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0 }}>{category}</h4>
                                    <div style={{
                                        background: categoryPercent === 100 ? '#27ae60' : categoryPercent >= 50 ? '#f39c12' : '#e74c3c',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}>
                                        {categoryCompleted}/{categoryTotal} ({categoryPercent}%)
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {items.map(item => (
                                        <div
                                            key={item}
                                            onClick={() => toggleDocument(item)}
                                            style={{
                                                padding: '12px 15px',
                                                background: checklist[item] ? '#d4edda' : '#f8d7da',
                                                border: `1px solid ${checklist[item] ? '#c3e6cb' : '#f5c6cb'}`,
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(5px)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                                        >
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: checklist[item] ? '#28a745' : '#dc3545',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}>
                                                {checklist[item] ? '✓' : '✗'}
                                            </div>
                                            <div style={{
                                                flex: 1,
                                                color: checklist[item] ? '#155724' : '#721c24',
                                                fontWeight: checklist[item] ? 'normal' : 'bold'
                                            }}>
                                                {item}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
