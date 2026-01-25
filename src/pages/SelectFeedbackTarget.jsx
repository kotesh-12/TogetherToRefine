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
    const [filterClass, setFilterClass] = useState('All');
    const [filterSection, setFilterSection] = useState('All');
    // Institution Filter State
    const [institutionFilter, setInstitutionFilter] = useState('Teacher'); // 'Teacher' or 'Student'

    useEffect(() => {
        const fetchData = async () => {
            if (!userData) return;

            const role = userData.role;
            let list = [];

            try {
                if (role === 'student') {
                    setTitle("Select Feedback Target"); // Changed title to generic
                    // 1. Add Institution
                    if (userData.institutionId) {
                        try {
                            const instDoc = await getDoc(doc(db, "institutions", userData.institutionId));
                            if (instDoc.exists()) {
                                list.push({
                                    id: instDoc.id,
                                    ...instDoc.data(),
                                    type: 'Institution',
                                    name: instDoc.data().schoolName || instDoc.data().name || 'Your School'
                                });
                            }
                        } catch (e) {
                            console.error("Error fetching institution for student", e);
                        }
                    }

                    // 2. Add Teachers
                    const userClass = userData.class || userData.assignedClass;
                    const userSection = userData.section || userData.assignedSection;

                    if (userClass) {
                        const q = query(
                            collection(db, "teacher_allotments"),
                            where("classAssigned", "==", userClass),
                            where("section", "==", userSection),
                            // Filter by Institution ID to prevent cross-institution bleed
                            // Note: Teacher Allotments should have 'createdBy' (inst ID) or we rely on 'userId' matching an institution check.
                            // Better: Teacher Allotments already have 'createdBy' which IS the institution ID.
                            where("createdBy", "==", userData.institutionId)
                        );
                        const snap = await getDocs(q);
                        const teachers = snap.docs.map(d => ({
                            ...d.data(),
                            id: d.data().teacherId || d.id,
                            type: 'Teacher'
                        }));
                        list = [...list, ...teachers];
                    }
                }
                else if (role === 'teacher') {
                    setTitle("Select Feedback Target");

                    let instId = userData.createdBy || userData.institutionId;
                    let teacherClasses = [];

                    // 1. Fetch Teacher Allotments (Find Institution ID & My Classes)
                    try {
                        // Standard: userId
                        let allotQ = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
                        let allotSnap = await getDocs(allotQ);

                        // Legacy: teacherId
                        if (allotSnap.empty) {
                            allotQ = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                            allotSnap = await getDocs(allotQ);
                        }

                        // Legacy: Name (Very old records which usually lack IDs)
                        if (allotSnap.empty && userData.name) {
                            allotQ = query(collection(db, "teacher_allotments"), where("name", "==", userData.name));
                            allotSnap = await getDocs(allotQ);
                        }

                        // Collect Data
                        allotSnap.forEach(d => {
                            const data = d.data();
                            if (data.createdBy && !instId) instId = data.createdBy;
                            if (data.classAssigned) teacherClasses.push({ cls: data.classAssigned, sec: data.section });
                        });

                    } catch (e) { console.error("Error fetching teacher allotments", e); }

                    // 2. Fetch Students (Strategy A: By Institution) & Add Institution Target
                    if (instId) {
                        try {
                            // Add Institution as Target (Updated to 'institutions' collection)
                            const instDoc = await getDoc(doc(db, "institutions", instId));
                            if (instDoc.exists()) {
                                setInstitutionTarget({ id: instDoc.id, ...instDoc.data(), type: 'Institution', name: instDoc.data().schoolName || instDoc.data().name || 'Institution' });
                            } else {
                                // Fallback to 'users' if old data
                                const instDocOld = await getDoc(doc(db, "users", instId));
                                if (instDocOld.exists()) {
                                    setInstitutionTarget({ id: instDocOld.id, ...instDocOld.data(), type: 'Institution', name: instDocOld.data().name || 'Institution' });
                                }
                            }

                            // Fetch All Students from Institution
                            const q = query(collection(db, "student_allotments"), where("createdBy", "==", instId));
                            const snap = await getDocs(q);
                            list = snap.docs.map(d => ({ id: d.data().userId || d.data().studentId || d.id, ...d.data(), type: 'Student' }));
                        } catch (e) { console.error("Error fetching institution/students", e); }
                    }

                    // Fallback: Use User Profile if Allotments missing (Critical for Legacy Teachers)
                    if (teacherClasses.length === 0 && (userData.assignedClass || userData.class)) {
                        teacherClasses.push({ cls: userData.assignedClass || userData.class, sec: userData.assignedSection || userData.section });
                    }

                    // 3. Fetch Students (Strategy B: By Allotted Class - Always Merge)
                    if (teacherClasses.length > 0) {
                        try {
                            const studentPromises = teacherClasses.map(tc => {
                                const variants = [tc.cls];
                                if (!isNaN(parseFloat(tc.cls))) {
                                    const n = parseInt(tc.cls, 10);
                                    const s = ["th", "st", "nd", "rd"];
                                    const v = n % 100;
                                    const suf = s[(v - 20) % 10] || s[v] || s[0];
                                    variants.push(`${n}${suf}`);
                                    variants.push(`${n}`);
                                    variants.push(n);
                                }
                                const uniqueVars = [...new Set(variants)];
                                const qS = query(collection(db, "student_allotments"), where("classAssigned", "in", uniqueVars));
                                return getDocs(qS);
                            });

                            const snapshots = await Promise.all(studentPromises);
                            snapshots.forEach(snap => {
                                const subList = snap.docs.map(d => ({ id: d.data().userId || d.data().studentId || d.id, ...d.data(), type: 'Student' }));
                                list = [...list, ...subList];
                            });

                            // Deduplicate by ID
                            const uniqueIds = new Set();
                            list = list.filter(item => {
                                if (uniqueIds.has(item.id)) return false;
                                uniqueIds.add(item.id);
                                return true;
                            });
                        } catch (e) { console.error("Error fetching students by class", e); }
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

    // Unified Filter Logic
    const uniqueClasses = [...new Set(targets.filter(t => t.type === 'Student').map(t => t.classAssigned).filter(Boolean))].sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    const uniqueSections = [...new Set(targets.filter(t => t.type === 'Student').map(t => t.section).filter(Boolean))].sort();

    const filteredTargets = targets
        .filter(t => {
            // Text Search
            if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // Class Filter (Only applies to Students usually)
            if (t.type === 'Student' && filterClass !== 'All') {
                const rawCls = (t.classAssigned || '').toString();
                if (rawCls !== filterClass) return false;
            }

            // Section Filter
            if (t.type === 'Student' && filterSection !== 'All') {
                if (t.section !== filterSection) return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (a.type === 'Institution' && b.type !== 'Institution') return -1;
            if (b.type === 'Institution' && a.type !== 'Institution') return 1;
            return a.name.localeCompare(b.name);
        });

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title={title} leftIcon={false} backPath="/student" />

            <div className="container" style={{ maxWidth: '600px', margin: '20px auto' }}>
                <p className="text-center text-muted" style={{ marginBottom: '20px' }}>
                    Who do you want to give feedback to?
                </p>

                {/* Institution Role Toggle */}
                {userData?.role === 'institution' && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#ececec', padding: '5px', borderRadius: '10px' }}>
                        <button
                            onClick={() => { setInstitutionFilter('Teacher'); setFilterClass('All'); setFilterSection('All'); }}
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
                            onClick={() => { setInstitutionFilter('Student'); setFilterClass('All'); setFilterSection('All'); }}
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

                {/* Universal Search & Filters (Visible for Teachers & Institution viewing Students) */}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                        className="input-field"
                        placeholder="🔍 Search Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ margin: 0 }}
                    />

                    {/* Show Class/Section Filters if viewing Students (Teacher or Institution->Student) */}
                    {(userData?.role === 'teacher' || (userData?.role === 'institution' && institutionFilter === 'Student')) && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                                className="input-field"
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <option value="All">All Classes</option>
                                {uniqueClasses.length > 0
                                    ? uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)
                                    : ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>{c}</option>)
                                }
                            </select>
                            <select
                                className="input-field"
                                value={filterSection}
                                onChange={(e) => setFilterSection(e.target.value)}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <option value="All">All Sections</option>
                                {uniqueSections.length > 0
                                    ? uniqueSections.map(s => <option key={s} value={s}>{s}</option>)
                                    : ['A', 'B', 'C', 'D', 'E'].map(s => <option key={s} value={s}>{s}</option>)
                                }
                            </select>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="text-center">Loading List...</div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {/* Institution Card (Only for Teachers/Students) */}
                        {institutionTarget && (
                            <div
                                onClick={() => handleSelect(institutionTarget)}
                                className="card"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#d63031',
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
                                No matching results found.
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
                                        <div
                                            onClick={(e) => { e.stopPropagation(); navigate('/profileview', { state: { target: t } }); }}
                                            style={{
                                                width: '50px', height: '50px',
                                                borderRadius: '50%',
                                                background: '#0984e3', color: 'white',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', zIndex: 10
                                            }} title="View Profile">
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
