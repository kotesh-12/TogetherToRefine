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
    const [conflicts, setConflicts] = useState({}); // Stores conflict msgs: "Monday_p1" -> "Busy in 10-A"

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

    // Helper ID
    const instId = userData?.role === 'institution' ? userData.uid : userData.institutionId;

    const fetchAllTimetables = async () => {
        setLoading(true);
        try {
            // Filter by Institution ID
            const q = query(collection(db, "timetables"), where("institutionId", "==", instId));
            const snap = await getDocs(q);
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

            // ... (Rest of fetchMyTimetable logic remains mostly same, but we need to ensure getDoc later checks institution)
            // Actually, getDoc(doc(db, "timetables", id)) is direct ID access.
            // IDs are currently "10_A". This is NOT unique across institutions! CLASH RISK.
            // FIX: ID should be "INST_ID_10_A". 
            // RETROFIT: We must check if the doc belongs to my institution.

            // For now, let's keep logic but filter the DOC results.

            if (allotments.length === 0) {
                // Try legacy name match logic or return...
            }

            // ... [Rest of allotment fetching logic] ...

            setAllotmentCount(allotments.length);
            if (allotments.length === 0) {
                setMySchedule({});
                setLoading(false);
                return;
            }

            // 2. Fetch Timetables from Targets
            const scheduleMap = {};
            days.forEach(d => scheduleMap[d] = {});

            // Group allotments by class/section
            const targets = [];
            allotments.forEach(a => {
                if (a.classAssigned && a.section) {
                    const raw = String(a.classAssigned);
                    const cls = raw.replace(/(\d+)(st|nd|rd|th)/i, '$1');
                    const sec = String(a.section).trim();
                    targets.push({ cls, sec, raw, subject: a.subject });
                }
            });
            const uniqueTargets = [...new Set(targets.map(t => `${t.cls}_${t.sec}`))];

            // Query Logic
            const promises = uniqueTargets.map(async (key) => {
                const [cls, sec] = key.split('_');
                // Query by InstID + Section strictly first
                const qT = query(collection(db, "timetables"), where("institutionId", "==", instId), where("section", "==", sec));
                const snapT = await getDocs(qT);

                // Client-side filter for Class (handling 10 vs 10th)
                const doc = snapT.docs.find(d => {
                    const dCls = String(d.data().class).replace(/(\d+)(st|nd|rd|th)/i, '$1');
                    return dCls === cls;
                });
                return doc;
            });

            const results = await Promise.all(promises);

            let configSet = false;

            // 3. Merge Logic
            results.forEach(docSnap => {
                if (!docSnap || !docSnap.exists()) return;
                const data = docSnap.data();

                // Set the Period Interval Config from the first valid timetable found
                // This ensures the columns match the data keys (p1 vs period_1 etc)
                if (!configSet && data.periods) {
                    setPeriodConfig(data.periods);
                    configSet = true;
                }

                const tSchedule = data.schedule || {};
                const tClass = data.class;
                const tSection = data.section;

                days.forEach(day => {
                    if (!tSchedule[day]) return;
                    Object.keys(tSchedule[day]).forEach(pId => {
                        const cell = tSchedule[day][pId];
                        const val = typeof cell === 'object' ? (cell.subject || '') : cell;

                        // MATCH LOGIC: Check Subject OR Name
                        const mySubject = (userData.subject || '').toLowerCase().trim();
                        const myName = (userData.name || '').toLowerCase().trim();
                        const cellText = String(val).toLowerCase();

                        // Match Conditions
                        const subjectMatch = mySubject && cellText.includes(mySubject);
                        const nameMatch = myName && cellText.includes(myName);

                        if (subjectMatch || nameMatch) {
                            // Found a slot!
                            scheduleMap[day][pId] = {
                                subject: `${val} (${tClass}-${tSection})`,
                                span: cell.span || 1
                            };
                        }
                    });
                });
            });

            setMySchedule(scheduleMap);
        } catch (e) {
            console.error(e);
            setMySchedule({});
        }
        setLoading(false);
    };

    const fetchTimetable = async () => {
        setLoading(true);
        try {
            // Normalize class: "10th" -> "10", "1st" -> "1"
            const rawCls = selectedClass || '';
            const normalizedCls = rawCls.replace(/(\d+)(st|nd|rd|th)/i, '$1');

            const q1 = query(
                collection(db, "timetables"),
                where("institutionId", "==", instId),
                where("class", "in", [rawCls, normalizedCls]),
                where("section", "==", selectedSection)
            );

            // Legacy Query
            const q2 = query(
                collection(db, "timetables"),
                where("createdBy", "==", instId), // Legacy check
                where("class", "in", [rawCls, normalizedCls]),
                where("section", "==", selectedSection)
            );

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            // Prioritize Q1, fall back to Q2
            let data = null;
            if (!snap1.empty) data = snap1.docs[0].data();
            else if (!snap2.empty) data = snap2.docs[0].data();

            if (data) {
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

    // ... (rest) ...

    const saveTimetable = async () => {
        if (userData?.role !== 'institution') return;
        setLoading(true);
        try {
            // Use a composite ID that includes ID to prevent collisions?
            // Existing data uses "10_A". If we change this, we break old data links.
            // BUT we must fix it. 
            // Proposal: User "INST_ID_10_A" as Doc ID.

            const docId = `${userData.uid}_${selectedClass}_${selectedSection}`;

            await setDoc(doc(db, "timetables", docId), {
                class: selectedClass,
                section: selectedSection,
                schedule: timetable,
                periods: periodConfig,
                updatedBy: userData.uid,
                institutionId: userData.uid, // CRITICAL
                updatedAt: new Date()
            });

            // Clean up old insecure doc if exists? (Optional)

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


    // Zoom State
    const [zoom, setZoom] = useState(1);
    const tableContainerRef = React.useRef(null);

    // Auto-Fit on Load (Mobile)
    useEffect(() => {
        const handleResize = () => {
            // Only auto-scale if we haven't manually zoomed? 
            // Or just set initial zoom.
            const w = window.innerWidth;
            if (w < 800) {
                // Fit 900px table into 'w'
                const scale = (w - 40) / 900;
                setZoom(scale);
            } else {
                setZoom(1);
            }
        };

        handleResize();
        // window.addEventListener('resize', handleResize); // Optional: dynamic resize
        // return () => window.removeEventListener('resize', handleResize);
    }, []);


    const finalTimetable = viewMode === 'personal' ? mySchedule : timetable;

    return (
        <div style={{ minHeight: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', paddingBottom: '120px' }}>
            <AIBadge />


            <div className="container" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '20px 10px' }}>

                {/* Controls */}
                <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>

                    {/* ...Existing Controls... */}
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
                                    One
                                </button>
                                <button
                                    onClick={() => setViewMode('overview')}
                                    style={{
                                        border: 'none', background: viewMode === 'overview' ? '#0984e3' : 'transparent',
                                        color: viewMode === 'overview' ? 'white' : '#636e72', borderRadius: '18px',
                                        padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    All
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
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0984e3', whiteSpace: 'nowrap' }}>
                                {selectedClass} - {selectedSection}
                            </span>
                        )}
                    </div>
                </div>

                {/* ZOOM CONTROLS (Floating or Inline) */}
                {viewMode !== 'overview' && (
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'white', padding: '5px 15px', borderRadius: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                            <span style={{ fontSize: '12px', color: '#666' }}>🔎 View:</span>
                            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} style={{ cursor: 'pointer', border: 'none', background: '#f1f2f6', borderRadius: '50%', width: '25px', height: '25px' }}>-</button>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '40px' }}>{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={{ cursor: 'pointer', border: 'none', background: '#f1f2f6', borderRadius: '50%', width: '25px', height: '25px' }}>+</button>
                            <button
                                onClick={() => {
                                    const w = window.innerWidth;
                                    setZoom(w < 800 ? (w - 40) / 900 : 1);
                                }}
                                style={{ marginLeft: '10px', fontSize: '12px', cursor: 'pointer', border: '1px solid #ddd', background: 'white', borderRadius: '12px', padding: '2px 8px' }}
                            >
                                Fit Screen
                            </button>
                        </div>
                    </div>
                )}


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
                                                            const cellData = schedule?.[day]?.[p.id] || {};
                                                            let skip = false;
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
                        <div
                            ref={tableContainerRef}
                            style={{
                                width: '100%',
                                overflow: 'hidden', // Hide scroll since we scale
                                borderRadius: '16px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                transition: 'height 0.3s'
                            }}
                        >
                            <div style={{
                                width: '900px', // Fixed base width for calculation
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                    <thead>
                                        <tr style={{ background: '#6c5ce7', color: 'white' }}>
                                            <th style={{ padding: '15px', border: '1px solid rgba(255,255,255,0.2)', width: '100px' }}>Day</th>
                                            {periodConfig.map((p, index) => (
                                                <th key={p.id} style={{ padding: '10px', border: '1px solid rgba(255,255,255,0.2)', background: p.type === 'break' ? '#fdcb6e' : 'transparent', minWidth: '100px' }}>
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
                                                                    {conflicts && conflicts[`${day}_${p.id}`] && (
                                                                        <div style={{ color: '#d63031', fontSize: '10px', fontWeight: 'bold', margin: '2px 5px', background: '#ffeaa7', padding: '3px', borderRadius: '4px', border: '1px solid #fab1a0' }}>
                                                                            ⚠ {conflicts[`${day}_${p.id}`]}
                                                                        </div>
                                                                    )}
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
