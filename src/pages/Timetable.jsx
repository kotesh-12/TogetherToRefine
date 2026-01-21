import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';

const defaultPeriodConfig = [
    { id: 'p1', name: '1', type: 'class' },
    { id: 'p2', name: '2', type: 'class' },
    { id: 'p3', name: '3', type: 'class' },
    { id: 'break1', name: 'Lunch', type: 'break' },
    { id: 'p4', name: '4', type: 'class' },
    { id: 'p5', name: '5', type: 'class' },
    { id: 'p6', name: '6', type: 'class' },
    { id: 'p7', name: '7', type: 'class' },
    { id: 'p8', name: '8', type: 'class' }
];

export default function Timetable() {
    const { userData } = useUser();
    const [loading, setLoading] = useState(false);

    // Selection State
    const [selectedClass, setSelectedClass] = useState(userData?.class || userData?.assignedClass || '10');
    const [selectedSection, setSelectedSection] = useState(userData?.section || userData?.assignedSection || 'A');

    // Data State
    const [timetable, setTimetable] = useState({});
    const [periodConfig, setPeriodConfig] = useState(defaultPeriodConfig);

    const [allottedTeachers, setAllottedTeachers] = useState([]);

    // Modes
    const [isEditing, setIsEditing] = useState(false);
    const [structureMode, setStructureMode] = useState(false);
    const [viewMode, setViewMode] = useState('class'); // 'class' or 'personal' (for teachers)
    const [mySchedule, setMySchedule] = useState({});
    const [allotmentCount, setAllotmentCount] = useState(0); // Restore
    const [overviewData, setOverviewData] = useState([]);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // Restore

    useEffect(() => {
        if (userData?.role === 'student') {
            if (userData.class) setSelectedClass(userData.class);
            if (userData.section) setSelectedSection(userData.section);
            fetchTimetable();
        } else if (userData?.role === 'teacher') {
            if (viewMode === 'personal') {
                setPeriodConfig(defaultPeriodConfig);
                fetchMyTimetable();
            } else {
                fetchTimetable();
                fetchAllotments();
            }
        } else {
            // Institution
            if (viewMode === 'overview') {
                fetchAllTimetables();
            } else {
                fetchTimetable();
                fetchAllotments();
            }
        }
    }, [selectedClass, selectedSection, userData, viewMode]);

    const fetchAllTimetables = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "timetables"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Sort: Nursery->LKG..->1->10
            const classOrder = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
            list.sort((a, b) => {
                const idxA = classOrder.indexOf(a.class || '');
                const idxB = classOrder.indexOf(b.class || '');
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                return (a.class || '').localeCompare(b.class || '');
            });

            setOverviewData(list);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMyTimetable = async () => {
        setLoading(true);

        try {
            // 1. Robust Allotment Fetching
            let allotments = [];

            // Query 1: userId (Standard)
            let q = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
            let snap = await getDocs(q);
            const r1 = snap.docs.map(d => d.data());

            allotments = [...allotments, ...r1];

            // Query 2: teacherId (Fallback)
            if (allotments.length === 0) {
                q = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                snap = await getDocs(q);
                const r2 = snap.docs.map(d => d.data());

                allotments = [...allotments, ...r2];
            }

            // Query 3: Name (Legacy Fallback)
            if (allotments.length === 0 && userData.name) {
                q = query(collection(db, "teacher_allotments"), where("name", "==", userData.name));
                snap = await getDocs(q);
                const r3 = snap.docs.map(d => d.data());

                allotments = [...allotments, ...r3];

                // Query 4: Case Variants
                if (r3.length === 0) {
                    const variants = [
                        userData.name.charAt(0).toUpperCase() + userData.name.slice(1), // Title
                        userData.name.toUpperCase(), // ALL CAPS
                        userData.name.toLowerCase() // all lower
                    ].filter(n => n !== userData.name);

                    for (const vName of variants) {
                        q = query(collection(db, "teacher_allotments"), where("name", "==", vName));
                        snap = await getDocs(q);
                        const rV = snap.docs.map(d => d.data());
                        if (rV.length > 0) {

                            allotments = [...allotments, ...rV];
                            break;
                        }
                    }
                }
            }

            // Query 5: Tokenized "Loose" Match (Last Resort for "v" vs "v v")
            if (allotments.length === 0 && userData.name) {

                const allSnap = await getDocs(collection(db, "teacher_allotments"));
                const allData = allSnap.docs.map(d => d.data());

                const uName = userData.name.toLowerCase().trim();

                const matches = allData.filter(a => {
                    if (!a.name) return false;
                    const tokens = a.name.toLowerCase().split(/[\s.]+/).filter(Boolean);
                    return tokens.includes(uName);
                });


                allotments = [...allotments, ...matches];
            }

            // remove duplicates if any
            // allotments = [...new Set(allotments)]; 

            setAllotmentCount(allotments.length);
            if (allotments.length === 0) {

                setMySchedule({});
                setLoading(false);
                return;
            }

            // 2. Fetch Timetables (Robust Key Generation)
            const classSubjectMap = {}; // Key: "10_A" -> [subjects]
            const docIdsToFetch = new Set();

            // Fallback Subject from Profile (if allotment is missing subject)
            const profileSubject = userData.subject ? String(userData.subject).toLowerCase() : null;

            allotments.forEach(a => {
                if (!a.classAssigned || !a.section) return;

                const rawCls = String(a.classAssigned).trim();
                const clsBase = rawCls.replace(/\D/g, '') || rawCls; // Fallback to raw if no digits (e.g. Nursery)
                const sec = String(a.section).trim().toUpperCase(); // Normalize section (A, B...)

                const keys = new Set();
                keys.add(`${rawCls}_${sec}`);
                keys.add(`${clsBase}_${sec}`);

                // Use Allotment Subject OR Profile Subject
                const subjRaw = a.subject || profileSubject;
                const mySubjects = subjRaw ? [String(subjRaw).toLowerCase()] : [];

                keys.forEach(key => {
                    docIdsToFetch.add(key);
                    if (!classSubjectMap[key]) classSubjectMap[key] = [];
                    classSubjectMap[key].push(...mySubjects);
                });
            });

            const docIds = Array.from(docIdsToFetch);
            setDebugLog(prev => [...prev, `Found Allotments: ${allotments.length}`, `Scanning Docs: ${docIds.join(', ')}`]);

            if (docIds.length === 0) { setMySchedule({}); setLoading(false); return; }

            const promises = docIds.map(id => getDoc(doc(db, "timetables", id)));
            const docs = await Promise.all(promises);

            const aggSchedule = {};

            docs.forEach((d, i) => {
                if (!d.exists()) {
                    setDebugLog(prev => [...prev, `Doc ${docIds[i]} does not exist.`]);
                    return;
                }
                const data = d.data();
                const clsSecKey = d.id;
                const [cls, sec] = clsSecKey.split('_');
                const schedule = data.schedule || {};
                const tbPeriods = data.periods || defaultPeriodConfig;

                const mySubjectsHere = classSubjectMap[clsSecKey] || [];

                Object.keys(schedule).forEach(day => {
                    if (!aggSchedule[day]) aggSchedule[day] = {};

                    Object.keys(schedule[day]).forEach(pId => {
                        const cell = schedule[day][pId];
                        const cellObj = typeof cell === 'object' ? cell : { subject: cell, span: 1 };
                        const cellText = String(cellObj.subject || '').trim().toLowerCase();

                        if (!cellText) return;

                        // CHECK MATCH
                        const nameMatch = userData.name && cellText.includes(userData.name.toLowerCase());

                        const subjectMatch = mySubjectsHere.some(sub => {
                            if (!sub) return false;
                            return cellText.includes(sub) || sub.includes(cellText);
                        });

                        if (nameMatch || subjectMatch) {
                            // Mapping Logic
                            const periodIndex = tbPeriods.findIndex(p => p.id === pId);
                            const periodDef = tbPeriods[periodIndex];

                            let targetP;
                            const pName = periodDef ? periodDef.name : null;

                            // Strategy 1: Name Match
                            if (pName) targetP = defaultPeriodConfig.find(gp => gp.name === pName);

                            // Strategy 2: ID Match
                            if (!targetP) targetP = defaultPeriodConfig.find(gp => gp.id.toLowerCase() === pId.toLowerCase());

                            // Strategy 3: Index Match (Positional Fallback)
                            if (!targetP && periodIndex !== -1 && periodIndex < defaultPeriodConfig.length) {
                                targetP = defaultPeriodConfig[periodIndex];
                            }

                            if (targetP) {
                                const existing = aggSchedule[day][targetP.id];
                                const newContent = `${cls}-${sec} (${cellObj.subject})`;

                                aggSchedule[day][targetP.id] = {
                                    subject: existing ? `${existing.subject}\n${newContent}` : newContent,
                                    span: Math.max(existing?.span || 1, cellObj.span || 1)
                                };
                            }
                        }
                    });
                });
            });
            setMySchedule(aggSchedule);

        } catch (e) {
            console.error("Error fetching my timetable", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllotments = async () => {
        if (!selectedClass) return;
        try {
            const q = query(
                collection(db, "teacher_allotments"),
                where("classAssigned", "==", selectedClass),
                where("section", "==", selectedSection)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data();
                return `${data.subject} (${data.teacherName || data.name})`;
            });
            setAllottedTeachers(list);
        } catch (e) {
            console.error("Error fetching allotted teachers", e);
        }
    };

    const fetchTimetable = async () => {
        setLoading(true);
        try {
            // Normalize class: "10th" -> "10", "1st" -> "1"
            const rawCls = selectedClass || '';
            const normalizedCls = rawCls.replace(/(\d+)(st|nd|rd|th)/i, '$1');

            // Try standard ID first (e.g. "10_A")
            let docId = `${normalizedCls}_${selectedSection}`;
            let docRef = doc(db, "timetables", docId);
            let docSnap = await getDoc(docRef);

            // Fallback: If not found, try raw class (e.g. "10th_A" in case it was saved that way)
            if (!docSnap.exists() && normalizedCls !== rawCls) {
                docId = `${rawCls}_${selectedSection}`; // e.g. "10th_A"
                docRef = doc(db, "timetables", docId);
                docSnap = await getDoc(docRef);
            }

            if (docSnap.exists()) {
                const data = docSnap.data();
                setTimetable(data.schedule || {});
                if (data.periods) setPeriodConfig(data.periods);
                else setPeriodConfig(defaultPeriodConfig);
            } else {
                setTimetable({});
                setPeriodConfig(defaultPeriodConfig);
            }
        } catch (e) {
            console.error("Error fetching timetable:", e);
        } finally {
            setLoading(false);
        }
    };

    // --- Content Handlers ---

    const handleCellChange = (day, periodId, field, value) => {
        setTimetable(prev => ({
            ...prev,
            [day]: {
                ...(prev?.[day] || {}),
                [periodId]: {
                    ...(prev?.[day]?.[periodId] || {}),
                    [field]: value
                }
            }
        }));
    };

    // --- Structure Handlers ---

    const addPeriod = () => {
        const newId = `p${Date.now()}`;
        setPeriodConfig([...periodConfig, { id: newId, name: 'New', type: 'class' }]);
    };

    const removePeriod = (index) => {
        const newConfig = [...periodConfig];
        newConfig.splice(index, 1);
        setPeriodConfig(newConfig);
    };

    const updatePeriod = (index, field, value) => {
        const newConfig = [...periodConfig];
        newConfig[index][field] = value;
        setPeriodConfig(newConfig);
    };

    const movePeriod = (index, direction) => {
        if (direction === -1 && index === 0) return;
        if (direction === 1 && index === periodConfig.length - 1) return;

        const newConfig = [...periodConfig];
        const item = newConfig[index];
        newConfig.splice(index, 1);
        newConfig.splice(index + direction, 0, item);
        setPeriodConfig(newConfig);
    };

    const saveTimetable = async () => {
        if (userData?.role !== 'institution') return;
        setLoading(true);
        try {
            const docId = `${selectedClass}_${selectedSection}`;
            await setDoc(doc(db, "timetables", docId), {
                class: selectedClass,
                section: selectedSection,
                schedule: timetable,
                periods: periodConfig,
                updatedBy: userData.uid,
                updatedAt: new Date()
            });
            alert("Timetable & Structure Saved! ✅");
            setIsEditing(false);
            setStructureMode(false);
        } catch (e) {
            console.error("Error saving:", e);
            alert("Failed to save.");
        } finally {
            setLoading(false);
        }
    };

    const isInstitution = userData?.role === 'institution';

    const updateSubject = async () => {
        const newSub = prompt("Enter your main Subject (e.g. Maths, Science):");
        if (!newSub) return;
        try {
            await setDoc(doc(db, "teachers", userData.uid), { subject: newSub }, { merge: true });
            alert("Subject Updated! Period matching will retry on reload.");
            window.location.reload();
        } catch (e) {
            console.error("Error updating subject:", e);
            alert("Failed to update subject.");
        }
    };


    const finalTimetable = viewMode === 'personal' ? mySchedule : timetable;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', paddingBottom: '50px' }}>
            <AIBadge />
            <AnnouncementBar title="Weekly Timetable" leftIcon="back" />

            <div className="container" style={{ maxWidth: '1400px', margin: '20px auto', padding: '0 10px' }}>

                {/* Controls */}
                <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#2d3436' }}>📅 Schedule</h3>

                        {(userData?.role === 'teacher') && (
                            <div style={{ display: 'flex', background: '#dfe6e9', borderRadius: '20px', padding: '3px', marginLeft: '15px' }}>
                                <button
                                    onClick={() => setViewMode('class')}
                                    style={{
                                        border: 'none', background: viewMode === 'class' ? '#0984e3' : 'transparent',
                                        color: viewMode === 'class' ? 'white' : '#636e72', borderRadius: '18px',
                                        padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    Class
                                </button>
                                <button
                                    onClick={() => { setViewMode('personal'); setIsEditing(false); setStructureMode(false); }}
                                    style={{
                                        border: 'none', background: viewMode === 'personal' ? '#0984e3' : 'transparent',
                                        color: viewMode === 'personal' ? 'white' : '#636e72', borderRadius: '18px',
                                        padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    My View
                                </button>
                            </div>
                        )}

                        {isInstitution && (
                            <div style={{ display: 'flex', background: '#dfe6e9', borderRadius: '20px', padding: '3px', marginLeft: '15px' }}>
                                <button
                                    onClick={() => setViewMode('class')}
                                    style={{
                                        border: 'none', background: viewMode !== 'overview' ? '#0984e3' : 'transparent',
                                        color: viewMode !== 'overview' ? 'white' : '#636e72', borderRadius: '18px',
                                        padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    Single Class
                                </button>
                                <button
                                    onClick={() => setViewMode('overview')}
                                    style={{
                                        border: 'none', background: viewMode === 'overview' ? '#0984e3' : 'transparent',
                                        color: viewMode === 'overview' ? 'white' : '#636e72', borderRadius: '18px',
                                        padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    See All Classes
                                </button>
                            </div>
                        )}

                        {(viewMode !== 'overview') && (isInstitution || (userData?.role === 'teacher' && viewMode === 'class')) && (
                            <>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="input-field"
                                    style={{ width: 'auto', margin: 0, padding: '8px' }}
                                    disabled={loading}
                                >
                                    {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select
                                    value={selectedSection}
                                    onChange={(e) => setSelectedSection(e.target.value)}
                                    className="input-field"
                                    style={{ width: 'auto', margin: 0, padding: '8px' }}
                                    disabled={loading}
                                >
                                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </>
                        )}
                        {userData?.role === 'student' && (
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0984e3' }}>
                                {selectedClass} - {selectedSection}
                            </span>
                        )}
                    </div>

                    {isInstitution && viewMode !== 'overview' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="btn"
                                onClick={() => { setStructureMode(!structureMode); setIsEditing(true); }}
                                style={{ background: structureMode ? '#e17055' : '#636e72', fontSize: '14px' }}
                            >
                                {structureMode ? 'Done Configuring' : '⚙️ Configure Periods'}
                            </button>

                            <button
                                className="btn"
                                onClick={isEditing ? saveTimetable : () => setIsEditing(true)}
                                style={{ background: isEditing ? '#00b894' : '#0984e3', minWidth: '120px' }}
                                disabled={loading}
                            >
                                {loading ? '⏳ Saving...' : (isEditing ? '💾 Save Changes' : '✏️ Edit Content')}
                            </button>
                        </div>
                    )}
                </div>

                {/* OVERVIEW MODE (ALL CLASSES) */}
                {viewMode === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                        {overviewData.length === 0 && !loading && <p className="text-center">No timetables found.</p>}

                        {overviewData.map((data) => {
                            const periods = data.periods || defaultPeriodConfig;
                            const schedule = data.schedule || {};
                            return (
                                <div key={data.id} className="card">
                                    <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', color: '#0984e3' }}>
                                        Class {data.class} - {data.section}
                                    </h3>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: '800px' }}>
                                            <thead>
                                                <tr style={{ background: '#6c5ce7', color: 'white' }}>
                                                    <th style={{ padding: '10px', width: '80px' }}>Day</th>
                                                    {periods.map(p => (
                                                        <th key={p.id} style={{ padding: '8px', background: p.type === 'break' ? '#fdcb6e' : 'transparent', minWidth: '100px', fontSize: '13px' }}>
                                                            {p.type === 'break' ? '🍽️' : ''} {p.name}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {days.map(day => (
                                                    <tr key={day}>
                                                        <td style={{ padding: '10px', fontWeight: 'bold', background: '#f5f6fa', fontSize: '13px' }}>{day}</td>
                                                        {periods.map((p, index) => {
                                                            // Simple Read-Only Render Logic for Overview
                                                            const cellData = schedule?.[day]?.[p.id] || {};

                                                            let skip = false;
                                                            // Naive merge check: skip if previous cells cover this
                                                            // To allow simplified overview, maybe skip complex merge logic?
                                                            // Or implement basic span skipping:
                                                            for (let k = 1; k <= index; k++) {
                                                                const prevP = periods[index - k];
                                                                const prevData = schedule?.[day]?.[prevP.id] || {};
                                                                const prevSpan = parseInt(prevData.span || 1);
                                                                if (prevSpan > k) { skip = true; break; }
                                                            }

                                                            if (skip) return null;
                                                            const span = parseInt(cellData.span || 1);
                                                            const val = typeof cellData === 'object' ? (cellData.subject || '') : cellData;

                                                            if (p.type === 'break') {
                                                                return <td key={p.id} style={{ background: '#ffeaa7' }}></td>;
                                                            }

                                                            return (
                                                                <td key={p.id} colSpan={span} style={{ border: '1px solid #eee', padding: '10px', fontSize: '13px', textAlign: 'center' }}>
                                                                    {val || '-'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}


                {/* STANDARD SINGLE VIEW Mode */}
                {viewMode !== 'overview' && (
                    <>
                        <div style={{ overflowX: 'auto', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: '1000px' }}>
                                <thead>
                                    <tr style={{ background: '#6c5ce7', color: 'white' }}>
                                        <th style={{ padding: '15px', border: '1px solid rgba(255,255,255,0.2)', width: '100px' }}>Day</th>
                                        {periodConfig.map((p, index) => (
                                            <th key={p.id} style={{ padding: '10px', border: '1px solid rgba(255,255,255,0.2)', background: p.type === 'break' ? '#fdcb6e' : 'transparent', minWidth: '120px' }}>
                                                {structureMode ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <input
                                                            value={p.name}
                                                            onChange={(e) => updatePeriod(index, 'name', e.target.value)}
                                                            style={{ width: '100%', color: 'black', padding: '5px' }}
                                                            placeholder="Name/Time"
                                                        />
                                                        <select
                                                            value={p.type}
                                                            onChange={(e) => updatePeriod(index, 'type', e.target.value)}
                                                            style={{ color: 'black', padding: '2px' }}
                                                        >
                                                            <option value="class">Class</option>
                                                            <option value="break">Break</option>
                                                        </select>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <button onClick={() => movePeriod(index, -1)} style={{ cursor: 'pointer', padding: '2px' }}>⬅️</button>
                                                            <button onClick={() => removePeriod(index)} style={{ cursor: 'pointer', color: 'red', fontWeight: 'bold' }}>❌</button>
                                                            <button onClick={() => movePeriod(index, 1)} style={{ cursor: 'pointer', padding: '2px' }}>➡️</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {p.type === 'break' ? '🍽️' : ''} {p.name}
                                                    </div>
                                                )}
                                            </th>
                                        ))}
                                        {structureMode && (
                                            <th style={{ padding: '10px', background: 'rgba(0,0,0,0.1)' }}>
                                                <button onClick={addPeriod} style={{ width: '100%', height: '100%', fontSize: '20px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'white' }}>➕ Add</button>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map(day => (
                                        <tr key={day}>
                                            <td style={{ padding: '15px', fontWeight: 'bold', background: '#f0f3f7', borderBottom: '1px solid #dfe6e9' }}>{day}</td>

                                            {periodConfig.map((p, index) => {
                                                // Merge Handling
                                                const cellData = finalTimetable?.[day]?.[p.id] || {};

                                                let skip = false;
                                                for (let k = 1; k <= index; k++) {
                                                    const prevP = periodConfig[index - k];
                                                    const prevData = finalTimetable?.[day]?.[prevP.id] || {};
                                                    const prevSpan = parseInt(prevData.span || 1);
                                                    if (prevSpan > k) {
                                                        skip = true;
                                                        break;
                                                    }
                                                }

                                                if (skip) return null;

                                                const span = parseInt(cellData.span || 1);
                                                // Handle Object (Non-Legacy) or String (Legacy)
                                                const val = typeof cellData === 'object' ? (cellData.subject || '') : cellData;

                                                if (p.type === 'break') {
                                                    return (
                                                        <td key={p.id} style={{ background: '#ffeaa7', textAlign: 'center', fontWeight: 'bold', border: '1px solid #dfe6e9', color: '#b7791f' }}>
                                                            {p.name}
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={p.id} colSpan={span} style={{ border: '1px solid #dfe6e9', padding: '0', minWidth: '100px' }}>
                                                        {isEditing && !structureMode ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80px' }}>
                                                                <input
                                                                    list="allotted-teachers"
                                                                    value={val}
                                                                    onChange={(e) => handleCellChange(day, p.id, 'subject', e.target.value)}
                                                                    placeholder="Subject"
                                                                    style={{
                                                                        width: '100%', flex: 1, border: 'none', padding: '10px',
                                                                        fontSize: '14px', outline: 'none', background: 'transparent'
                                                                    }}
                                                                />
                                                                {/* Merge Control */}
                                                                <div style={{ background: '#f1f2f6', padding: '2px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#636e72' }}>
                                                                    <span>Span:</span>
                                                                    <input
                                                                        type="number"
                                                                        min="1" max="8"
                                                                        value={span}
                                                                        onChange={(e) => handleCellChange(day, p.id, 'span', e.target.value)}
                                                                        style={{ width: '35px', border: '1px solid #ccc', borderRadius: '3px', padding: '2px' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ padding: '15px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: val ? '#2d3436' : '#b2bec3', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                                                                {val || '-'}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!isEditing && finalTimetable && Object.keys(finalTimetable).length === 0 && (
                            <div style={{ textAlign: 'center', marginTop: '50px', color: '#636e72', background: '#fff3cd', padding: '20px', borderRadius: '10px', border: '1px solid #ffeeba' }}>
                                {viewMode === 'personal' ? (
                                    <>
                                        <h3 style={{ color: '#856404' }}>No Periods Matched 🤷‍♂️</h3>
                                        <p>We found <b>{allotmentCount}</b> classes allotted to you.</p>
                                        <p>However, we couldn't match any specific periods.</p>
                                        <div style={{ textAlign: 'left', margin: '15px auto', maxWidth: '400px', fontSize: '13px', background: 'white', padding: '15px', borderRadius: '8px' }}>
                                            <b>How to Fix:</b>
                                            <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                                                <li>
                                                    Update Profile Subject:
                                                    {!userData.subject ? (
                                                        <button onClick={updateSubject} style={{ marginLeft: '10px', cursor: 'pointer', border: '1px solid #0984e3', color: '#0984e3', background: 'white', borderRadius: '4px', padding: '2px 8px' }}>
                                                            Set Subject Now
                                                        </button>
                                                    ) : (
                                                        <span> (Current: <b>{userData.subject}</b>)</span>
                                                    )}
                                                </li>
                                                <li>Or ensure the Timetable cells contain your <b>Name</b> (e.g. "Maths ({userData.name})").</li>
                                            </ul>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3>No Timetable Found 📭</h3>
                                        <p>Ask your institution to upload the schedule.</p>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
                {/* Datalist for Auto-Suggest */}
                <datalist id="allotted-teachers">
                    {allottedTeachers.map((t, i) => <option key={i} value={t} />)}
                </datalist>



            </div>
        </div>
    );
}
