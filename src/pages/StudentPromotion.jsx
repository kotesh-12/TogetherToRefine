import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

const StudentPromotion = () => {
    const { userData } = useUser();
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [promotionData, setPromotionData] = useState({});
    const [currentYear, setCurrentYear] = useState('2025-2026');
    const [newYear, setNewYear] = useState('2026-2027');

    const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const sections = ['A', 'B', 'C', 'D', 'E'];

    // Fetch students from selected class
    const fetchStudents = async () => {
        if (!selectedClass || !selectedSection || !userData?.uid) return;

        setLoading(true);
        try {
            const studentsRef = collection(db, 'users');
            const q = query(
                studentsRef,
                where('role', '==', 'student'),
                where('institutionId', '==', userData.uid),
                where('class', '==', selectedClass),
                where('section', '==', selectedSection)
            );

            const snapshot = await getDocs(q);
            const studentsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setStudents(studentsList);

            // Initialize promotion data with default next class
            const defaultPromotion = {};
            const nextClass = selectedClass === '10' ? 'Graduated' : String(parseInt(selectedClass) + 1);

            studentsList.forEach(student => {
                defaultPromotion[student.id] = {
                    status: selectedClass === '10' ? 'graduated' : 'promoted',
                    toClass: nextClass,
                    toSection: selectedSection
                };
            });

            setPromotionData(defaultPromotion);
        } catch (error) {
            console.error('Error fetching students:', error);
            alert('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedClass && selectedSection) {
            fetchStudents();
        }
    }, [selectedClass, selectedSection]);

    // Update individual student promotion
    const updatePromotion = (studentId, field, value) => {
        setPromotionData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    };

    // Execute bulk promotion
    const executePromotion = async () => {
        if (students.length === 0) {
            alert('No students to promote!');
            return;
        }

        const confirmMsg = `Are you sure you want to promote ${students.length} students from Class ${selectedClass}-${selectedSection}?\n\nThis action will:\n- Update student class/section\n- Archive current year data\n- This cannot be easily undone!`;

        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            let promotedCount = 0;
            let graduatedCount = 0;
            let detainedCount = 0;

            for (const student of students) {
                const promotion = promotionData[student.id];
                const studentRef = doc(db, 'users', student.id);

                if (promotion.status === 'promoted') {
                    batch.update(studentRef, {
                        class: promotion.toClass,
                        section: promotion.toSection,
                        academicYear: newYear,
                        [`academicHistory.${currentYear}`]: {
                            class: selectedClass,
                            section: selectedSection,
                            promotionStatus: 'promoted',
                            promotedOn: new Date().toISOString()
                        }
                    });
                    promotedCount++;
                } else if (promotion.status === 'graduated') {
                    batch.update(studentRef, {
                        role: 'alumni',
                        graduationYear: currentYear,
                        lastClass: selectedClass,
                        lastSection: selectedSection,
                        graduatedOn: new Date().toISOString(),
                        [`academicHistory.${currentYear}`]: {
                            class: selectedClass,
                            section: selectedSection,
                            promotionStatus: 'graduated',
                            graduatedOn: new Date().toISOString()
                        }
                    });
                    graduatedCount++;
                } else if (promotion.status === 'detained') {
                    batch.update(studentRef, {
                        academicYear: newYear,
                        // Class remains same
                        [`academicHistory.${currentYear}`]: {
                            class: selectedClass,
                            section: selectedSection,
                            promotionStatus: 'detained',
                            detainedOn: new Date().toISOString()
                        }
                    });
                    detainedCount++;
                }
            }

            await batch.commit();

            alert(`✅ Promotion Successful!\n\n` +
                `Promoted: ${promotedCount}\n` +
                `Graduated: ${graduatedCount}\n` +
                `Detained: ${detainedCount}\n\n` +
                `Academic Year: ${currentYear} → ${newYear}`);

            // Refresh the list
            setStudents([]);
            setSelectedClass('');
            setSelectedSection('');
        } catch (error) {
            console.error('Error promoting students:', error);
            alert('Failed to promote students. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (userData?.role !== 'institution') {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-4">Only institutions can access student promotion.</p>
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
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '10px'
                    }}>
                        🎓 Student Promotion
                    </h1>
                    <p style={{ color: '#666', fontSize: '16px' }}>
                        Promote students to the next academic year
                    </p>
                </div>

                {/* Academic Year Settings */}
                <div style={{
                    background: 'white',
                    borderRadius: '15px',
                    padding: '25px',
                    marginBottom: '20px',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
                        📅 Academic Year Transition
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Current Year
                            </label>
                            <input
                                type="text"
                                value={currentYear}
                                onChange={(e) => setCurrentYear(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="2025-2026"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                New Year
                            </label>
                            <input
                                type="text"
                                value={newYear}
                                onChange={(e) => setNewYear(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="2026-2027"
                            />
                        </div>
                    </div>
                </div>

                {/* Class Selection */}
                <div style={{
                    background: 'white',
                    borderRadius: '15px',
                    padding: '25px',
                    marginBottom: '20px',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
                        📚 Select Class to Promote
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Class
                            </label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="">Select Class</option>
                                {classes.map(cls => (
                                    <option key={cls} value={cls}>Class {cls}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Section
                            </label>
                            <select
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="">Select Section</option>
                                {sections.map(sec => (
                                    <option key={sec} value={sec}>Section {sec}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Students List */}
                {students.length > 0 && (
                    <div style={{
                        background: 'white',
                        borderRadius: '15px',
                        padding: '25px',
                        marginBottom: '20px',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
                            👥 Students in Class {selectedClass}-{selectedSection} ({students.length})
                        </h3>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f5f5f5' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Roll No</th>
                                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
                                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>To Class</th>
                                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>To Section</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px' }}>{student.rollNumber || '-'}</td>
                                            <td style={{ padding: '12px', fontWeight: '600' }}>{student.name}</td>
                                            <td style={{ padding: '12px' }}>
                                                <select
                                                    value={promotionData[student.id]?.status || 'promoted'}
                                                    onChange={(e) => updatePromotion(student.id, 'status', e.target.value)}
                                                    style={{
                                                        padding: '8px',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '6px',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    <option value="promoted">✅ Promoted</option>
                                                    <option value="detained">⏸️ Detained</option>
                                                    {selectedClass === '10' && <option value="graduated">🎓 Graduated</option>}
                                                </select>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {promotionData[student.id]?.status === 'graduated' ? (
                                                    <span style={{ color: '#666', fontStyle: 'italic' }}>Alumni</span>
                                                ) : promotionData[student.id]?.status === 'detained' ? (
                                                    <span style={{ color: '#666', fontStyle: 'italic' }}>Same ({selectedClass})</span>
                                                ) : (
                                                    <select
                                                        value={promotionData[student.id]?.toClass || ''}
                                                        onChange={(e) => updatePromotion(student.id, 'toClass', e.target.value)}
                                                        style={{
                                                            padding: '8px',
                                                            border: '1px solid #ddd',
                                                            borderRadius: '6px',
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {classes.map(cls => (
                                                            <option key={cls} value={cls}>Class {cls}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {promotionData[student.id]?.status === 'graduated' ? (
                                                    <span style={{ color: '#666', fontStyle: 'italic' }}>-</span>
                                                ) : promotionData[student.id]?.status === 'detained' ? (
                                                    <span style={{ color: '#666', fontStyle: 'italic' }}>Same ({selectedSection})</span>
                                                ) : (
                                                    <select
                                                        value={promotionData[student.id]?.toSection || ''}
                                                        onChange={(e) => updatePromotion(student.id, 'toSection', e.target.value)}
                                                        style={{
                                                            padding: '8px',
                                                            border: '1px solid #ddd',
                                                            borderRadius: '6px',
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {sections.map(sec => (
                                                            <option key={sec} value={sec}>Section {sec}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Execute Button */}
                        <div style={{ marginTop: '25px', textAlign: 'center' }}>
                            <button
                                onClick={executePromotion}
                                disabled={loading}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    padding: '15px 40px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                {loading ? '⏳ Processing...' : '🚀 Execute Promotion'}
                            </button>
                        </div>
                    </div>
                )}

                {loading && students.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
                        <p style={{ fontSize: '18px' }}>⏳ Loading students...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentPromotion;
