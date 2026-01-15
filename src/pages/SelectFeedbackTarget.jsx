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
    // Initialize filter to default Class/Section if available, else 'All'
    const [filterClass, setFilterClass] = useState(userData?.assignedClass ? userData.assignedClass.toString() : 'All');
    const [filterSection, setFilterSection] = useState((userData?.assignedSection && userData.assignedSection !== 'All') ? userData.assignedSection.toString() : 'All');
    // Institution Filter State
    const [institutionFilter, setInstitutionFilter] = useState('Teacher'); // 'Teacher' or 'Student'

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
                    setTitle("Select Feedback Target");

                    // 1. Fetch Institution ID
                    let instId = userData.createdBy;
                    if (!instId) {
                        // Fallback: Check allotments
                        try {
                            const allotQ = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                            const allotSnap = await getDocs(allotQ);
                            if (!allotSnap.empty) instId = allotSnap.docs[0].data().createdBy;
                        } catch (e) { }
                    }
                    // Fallback 2: Any Institution (Demo)
                    if (!instId) {
                        try {
                            const qInst = query(collection(db, "users"), where("role", "==", "institution"));
                            const qSnap = await getDocs(qInst);
                            if (!qSnap.empty) instId = qSnap.docs[0].id;
                        } catch (e) { }
                    }

                    if (instId) {
                        // Add Institution as Target
                        try {
                            const instDoc = await getDoc(doc(db, "users", instId));
                            if (instDoc.exists()) {
                                setInstitutionTarget({ id: instDoc.id, ...instDoc.data(), type: 'Institution', name: instDoc.data().name || 'Institution' });
                            }
                        } catch (e) { }

                        // 2. Fetch ALL Students from this Institution
                        try {
                            const q = query(collection(db, "student_allotments"), where("createdBy", "==", instId));
                            const snap = await getDocs(q);
                            list = snap.docs.map(d => ({ id: d.data().studentId || d.id, ...d.data(), type: 'Student' }));
                        } catch (e) { console.error(e); }
                    }
                }
                else if (role === 'institution') {
                    setTitle("Select Person for Feedback");
                    const colName = institutionFilter === 'Teacher' ? 'teacher_allotments' : 'student_allotments';

                    // Fetch all allotments created by this institution
                    const q = query(collection(db, colName), where('createdBy', '==', userData.uid));
                    const snap = await getDocs(q);
                    const rawList = snap.docs.map(d => ({ ...d.data(), docId: d.id }));

                    if (institutionFilter === 'Teacher') {
                        // Deduplicate Teachers by teacherId
                        const uniqueMap = new Map();
                        rawList.forEach(item => {
                            // Fallback: Use docId if teacherId missing (should not happen in valid data)
                            const tId = item.teacherId || item.docId;
                            if (!uniqueMap.has(tId)) {
                                uniqueMap.set(tId, {
                                    id: tId,
                                    name: item.teacherName || item.name || 'Unknown Teacher',
                                    type: 'Teacher',
                                    subject: item.subject || 'General'
                                });
                            }
                        });
                        list = Array.from(uniqueMap.values());
                    } else {
                        // Students
                        list = rawList.map(item => ({
                            id: item.studentId || item.docId,
                            name: item.studentName || item.name,
                            type: 'Student',
                            classAssigned: item.classAssigned,
                            section: item.section
                        }));
                    }
                }

                setTargets(list);
            } catch (e) {
                console.error("Error fetching targets:", e);
            } finally {
                setLoading(false);
            }
        };

        setLoading(true);
        fetchData();
    }, [userData, institutionFilter]);

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

                {/* Institution Controls */}
                {userData?.role === 'institution' && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#ececec', padding: '5px', borderRadius: '10px' }}>
                        <button
                            onClick={() => setInstitutionFilter('Teacher')}
                            style={{
                                flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: institutionFilter === 'Teacher' ? 'white' : 'transparent',
                                boxShadow: institutionFilter === 'Teacher' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: 'bold', color: '#2d3436'
                            }}
                        >
                            👨‍🏫 Teachers
                        </button>
                        <button
                            onClick={() => setInstitutionFilter('Student')}
                            style={{
                                flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: institutionFilter === 'Student' ? 'white' : 'transparent',
                                boxShadow: institutionFilter === 'Student' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: 'bold', color: '#2d3436'
                            }}
                        >
                            🎓 Students
                        </button>
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
