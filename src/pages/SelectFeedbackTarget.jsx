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

    const normalizeClassValue = (c) => {
        if (!c) return [];
        const s = String(c).trim().toLowerCase();
        const num = parseInt(s);
        if (isNaN(num)) return [s];

        // Generate variants: "10", "10th"
        const suffixes = ["th", "st", "nd", "rd"];
        const mod100 = num % 100;
        const mod10 = num % 10;
        let suffix = suffixes[0];
        if (mod100 >= 11 && mod100 <= 13) {
            suffix = "th";
        } else {
            suffix = suffixes[mod10] || suffixes[0];
        }

        return [num.toString(), `${num}${suffix}`];
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!userData) return;

            const role = userData.role;
            let list = [];

            try {
                if (role === 'student') {
                    setTitle("Give Feedback");

                    // 1. Institution Target
                    const instId = userData.institutionId;
                    if (instId) {
                        try {
                            const instDoc = await getDoc(doc(db, "institutions", instId));
                            if (instDoc.exists()) {
                                setInstitutionTarget({
                                    id: instDoc.id,
                                    ...instDoc.data(),
                                    type: 'Institution',
                                    name: instDoc.data().institutionName || instDoc.data().schoolName || 'Your School'
                                });
                            }
                        } catch (e) { console.error("Inst fetch error", e); }
                    }

                    // 2. Teacher Targets (Based on Class/Section)
                    const userClass = userData.class || userData.assignedClass;
                    const userSection = userData.section || userData.assignedSection;

                    if (userClass && instId) {
                        const classVariants = normalizeClassValue(userClass);
                        const q = query(
                            collection(db, "teacher_allotments"),
                            where("createdBy", "==", instId),
                            where("classAssigned", "in", classVariants)
                        );
                        const snap = await getDocs(q);
                        const teachers = [];
                        snap.forEach(d => {
                            const data = d.data();
                            // Filter by section if allotment is section-specific
                            if (!data.section || data.section === 'All' || data.section === userSection) {
                                teachers.push({
                                    id: data.userId || data.teacherId || d.id,
                                    userId: data.userId || data.teacherId, // Added
                                    teacherId: data.teacherId, // Added
                                    name: data.name || data.teacherName || 'Teacher',
                                    subject: data.subject || 'General',
                                    type: 'Teacher'
                                });
                            }
                        });

                        // Deduplicate teachers
                        const seenT = new Set();
                        list = teachers.filter(t => {
                            if (seenT.has(t.id)) return false;
                            seenT.add(t.id);
                            return true;
                        });
                    }
                }
                else if (role === 'teacher') {
                    setTitle("Select Student or Inst");
                    const instId = userData.institutionId || userData.createdBy;

                    // 1. Institution Target
                    if (instId) {
                        const instDoc = await getDoc(doc(db, "institutions", instId));
                        if (instDoc.exists()) {
                            setInstitutionTarget({
                                id: instDoc.id,
                                ...instDoc.data(),
                                type: 'Institution',
                                name: instDoc.data().institutionName || instDoc.data().schoolName || 'Institution'
                            });
                        }
                    }

                    // 2. Student Targets (By Allotment)
                    const myUid = userData.uid;
                    const allotQ = query(collection(db, "teacher_allotments"), where("userId", "==", myUid));
                    const allotSnap = await getDocs(allotQ);

                    const myClasses = [];
                    allotSnap.forEach(d => myClasses.push(d.data()));

                    if (myClasses.length > 0) {
                        const studentPromises = myClasses.map(allot => {
                            const variants = normalizeClassValue(allot.classAssigned);
                            let sq = query(collection(db, "student_allotments"),
                                where("createdBy", "==", instId),
                                where("classAssigned", "in", variants)
                            );
                            return getDocs(sq);
                        });

                        const snaps = await Promise.all(studentPromises);
                        const students = [];
                        snaps.forEach((sSnap, idx) => {
                            const allot = myClasses[idx];
                            sSnap.forEach(sd => {
                                const sData = sd.data();
                                if (!allot.section || allot.section === 'All' || sData.section === allot.section) {
                                    students.push({
                                        id: sData.userId || sData.studentId || sd.id,
                                        userId: sData.userId || sData.studentId, // Added
                                        studentId: sData.studentId, // Added
                                        name: sData.name || sData.studentName || 'Student',
                                        classAssigned: sData.classAssigned,
                                        section: sData.section,
                                        type: 'Student'
                                    });
                                }
                            });
                        });

                        // Deduplicate
                        const seenS = new Set();
                        list = students.filter(s => {
                            if (seenS.has(s.id)) return false;
                            seenS.add(s.id);
                            return true;
                        });
                    }
                }
                else if (role === 'institution') {
                    setTitle("Feedback Management");
                    const colName = institutionFilter === 'Teacher' ? 'teacher_allotments' : 'student_allotments';
                    const q = query(collection(db, colName), where('createdBy', '==', userData.uid));
                    const snap = await getDocs(q);

                    const uniqueMap = new Map();
                    snap.forEach(d => {
                        const data = d.data();
                        const id = data.userId || data.studentId || data.teacherId || d.id;
                        if (!uniqueMap.has(id)) {
                            uniqueMap.set(id, {
                                id,
                                userId: data.userId || data.studentId || data.teacherId, // Added
                                studentId: data.studentId, // Added
                                teacherId: data.teacherId, // Added
                                name: data.name || data.studentName || data.teacherName || 'Unknown',
                                type: institutionFilter,
                                subject: data.subject || '',
                                classAssigned: data.classAssigned || '',
                                section: data.section || ''
                            });
                        }
                    });
                    list = Array.from(uniqueMap.values());
                }

                setTargets(list);
            } catch (e) {
                console.error("Error in SelectFeedbackTarget:", e);
                setTargets([]);
            } finally {
                setLoading(false);
            }
        };

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
                                            onClick={(e) => { e.stopPropagation(); navigate('/profile-view', { state: { target: t } }); }}
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
