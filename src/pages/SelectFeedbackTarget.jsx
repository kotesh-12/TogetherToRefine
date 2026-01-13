import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';

export default function SelectFeedbackTarget() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [targets, setTargets] = useState([]);
    const [institutionTarget, setInstitutionTarget] = useState(null); // New State
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("Select Person");

    // Teacher Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('All');
    const [filterSection, setFilterSection] = useState('All');

    useEffect(() => {
        const fetchData = async () => {
            if (!userData) return;

            const role = userData.role;
            let list = [];

            try {
                if (role === 'student') {
                    setTitle("Select Teacher for Feedback");
                    const userClass = userData.class || userData.assignedClass;
                    const userSection = userData.section || userData.assignedSection;

                    if (userClass) {
                        const q = query(
                            collection(db, "teacher_allotments"),
                            where("classAssigned", "==", userClass),
                            where("section", "==", userSection)
                        );
                        const snap = await getDocs(q);
                        list = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'Teacher' })); // Teacher ID is usually user ID? Wait. allotments have 'teacherId' field. We should use THAT as actual ID for feedback.
                        // Actually, allotments have 'teacherId' (User UID) and 'teacherName'.
                        // We should map 'id' to 'teacherId' for consistency, OR handle it downstream.
                        // Previous logic used d.id (allotment ID). This might be WRONG for feedback target (User ID).
                        // Let's fix this silently: `id: d.data().teacherId || d.id`
                        list = list.map(item => ({ ...item, id: item.teacherId || item.id, type: 'Teacher' }));
                    }
                }
                else if (role === 'teacher') {
                    setTitle("Select Feedback Target"); // Changed title

                    // 1. Fetch Institution (Robust Logic)
                    let instId = userData.createdBy;

                    // Fallback: If not in profile, check allotments
                    if (!instId) {
                        try {
                            const allotQ = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                            const allotSnap = await getDocs(allotQ);
                            if (!allotSnap.empty) {
                                instId = allotSnap.docs[0].data().createdBy;
                            }
                        } catch (e) { console.error("Error finding inst from allotments", e); }
                    }

                    if (instId) {
                        try {
                            const instDoc = await getDoc(doc(db, "users", instId));
                            if (instDoc.exists()) {
                                setInstitutionTarget({ id: instDoc.id, ...instDoc.data(), type: 'Institution', name: instDoc.data().name || 'Institution' });
                            }
                        } catch (e) { console.error("Error fetching institution", e); }
                    }

                    // 2. Fetch Students
                    // Teacher allotments might be multiple. We need to fetch students for ALL their classes?
                    // Or just the assigned one in profile (legacy)?
                    // Profile has `userData.assignedClass`.
                    const myClass = userData.assignedClass;
                    const mySection = userData.assignedSection;

                    if (myClass) {
                        const q = query(
                            collection(db, "student_allotments"),
                            where("classAssigned", "==", myClass),
                            where("section", "==", mySection)
                        );
                        const snap = await getDocs(q);
                        // Student Allotments usually are 1:1 with headers.
                        // `student_allotments` has `studentId`, `studentName`.
                        list = snap.docs.map(d => ({ id: d.data().studentId || d.id, ...d.data(), type: 'Student' }));
                    }
                }

                setTargets(list);
            } catch (e) {
                console.error("Error fetching targets:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userData]);

    const handleSelect = (person) => {
        navigate('/general-feedback', { state: { target: person } });
    };

    // Extract Unique Options
    const uniqueClasses = [...new Set(targets.filter(t => t.type === 'Student').map(t => t.classAssigned).filter(Boolean))].sort();
    const uniqueSections = [...new Set(targets.filter(t => t.type === 'Student').map(t => t.section).filter(Boolean))].sort();

    // Filter Logic
    const filteredTargets = targets
        .filter(t => {
            if (userData?.role === 'teacher') {
                const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesClass = filterClass === 'All' || t.classAssigned === filterClass;
                const matchesSection = filterSection === 'All' || t.section === filterSection;
                return matchesSearch && matchesClass && matchesSection;
            }
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title={title} leftIcon="back" />

            <div className="container" style={{ maxWidth: '600px', margin: '20px auto' }}>
                <p className="text-center text-muted" style={{ marginBottom: '20px' }}>
                    Who do you want to give feedback to?
                </p>

                {/* Teacher Controls: Search & Filter */}
                {userData?.role === 'teacher' && (
                    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                            className="input-field"
                            placeholder="🔍 Search Student..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ margin: 0 }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                                className="input-field"
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <option value="All">All Classes</option>
                                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                className="input-field"
                                value={filterSection}
                                onChange={(e) => setFilterSection(e.target.value)}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <option value="All">All Sections</option>
                                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center">Loading List...</div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {/* Institution Card for Teachers */}
                        {userData?.role === 'teacher' && institutionTarget && (
                            <div
                                onClick={() => handleSelect(institutionTarget)}
                                className="card"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#d63031', // Red background as requested
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: '0 4px 15px rgba(214, 48, 49, 0.3)',
                                    transform: 'scale(1.02)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{
                                        width: '50px', height: '50px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.2)', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '24px'
                                    }}>
                                        🏛️
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, color: 'white' }}>{institutionTarget.name}</h4>
                                        <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>Give Feedback to Institution</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '20px' }}>➜</span>
                            </div>
                        )}

                        {filteredTargets.length === 0 ? (
                            <div className="card text-center text-muted">
                                {userData?.role === 'teacher'
                                    ? "No students found matching criteria."
                                    : "No teachers found for your class yet."}
                            </div>
                        ) : (
                            filteredTargets.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelect(t)}
                                    className="card"
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'transform 0.2s',
                                        border: '1px solid #dfe6e9'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            width: '50px', height: '50px',
                                            borderRadius: '50%',
                                            background: '#0984e3', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '20px', fontWeight: 'bold'
                                        }}>
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, color: '#2d3436' }}>{t.name}</h4>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#636e72' }}>
                                                {t.type === 'Teacher' ? t.subject : `Student • ${t.classAssigned}-${t.section}`}
                                            </p>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '20px' }}>📝</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
