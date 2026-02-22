import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs, addDoc } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';
import TimetableAIModal from './TimetableAIModal';

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

    // AI Generator Configuration Modal State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiConfig, setAiConfig] = useState({
        subjects: [],
        teacherAssignments: {}, // { subject: teacherId }
        periodsPerDay: 7,
        lunchBreakAfterPeriod: 3
    });
    const [availableTeachers, setAvailableTeachers] = useState([]);


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

    // Helper ID - MUST be declared before useEffect that uses it
    const instId = userData?.role === 'institution' ? userData.uid : userData?.institutionId;

    // Fetch available teachers for AI modal
    useEffect(() => {
        if (userData?.role === 'institution' && instId) {
            fetchAvailableTeachers();
        }
    }, [userData, instId]);

    if (!userData) return <div className="p-4 text-center">Loading User Data...</div>;

    const fetchAllTimetables = async () => {
        if (!instId) return; // Guard against crash
        setLoading(true);
        try {
            // Query 1: New Schema (institutionId)
            const q1 = query(collection(db, "timetables"), where("institutionId", "==", instId));

            // Query 2: Legacy Schema (createdBy)
            const q2 = query(collection(db, "timetables"), where("createdBy", "==", instId));

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            // Merge & Dedupe
            const map = new Map();
            snap1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
            snap2.docs.forEach(d => {
                if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() });
            });

            const list = Array.from(map.values());

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

            // FIX: ID should be "INST_ID_10_A". 
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
                        const cellText = String(val).toLowerCase().trim();

                        const subjectFound = mySubject && cellText.includes(mySubject);
                        const nameFound = myName && cellText.includes(myName);
                        // Check for any grouping symbols that imply a specific person is assigned
                        const hasParentheses = /[(){}[\]]/.test(cellText);

                        // Strict Filter Logic
                        let isMySlot = false;
                        if (nameFound) {
                            isMySlot = true; // Name matched explicitly -> Definitely Me
                        } else if (subjectFound) {
                            // Subject matched, but Name did not match. 
                            // If there are parentheses '(', it likely implies another teacher's name is there (e.g., "Maths (Alice)")
                            // Since nameFound is false, that name is NOT me. So ignore it.
                            if (hasParentheses) {
                                isMySlot = false;
                            } else {
                                isMySlot = true; // "Maths" or "Maths II" -> Likely Me
                            }
                        }

                        if (isMySlot) {
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
        if (!instId) return;
        setLoading(true);
        try {
            // Normalize class: "10th" -> "10", "1st" -> "1"
            const rawCls = selectedClass || '';
            const normalizedCls = rawCls.replace(/(\d+)(st|nd|rd|th)/i, '$1');

            // Normalize: Trim inputs
            const safeSec = (selectedSection || '').trim();

            const q1 = query(
                collection(db, "timetables"),
                where("institutionId", "==", instId),
                where("class", "in", [rawCls, normalizedCls]),
                where("section", "==", safeSec)
            );

            // Legacy Query
            const q2 = query(
                collection(db, "timetables"),
                where("createdBy", "==", instId),
                where("class", "in", [rawCls, normalizedCls]),
                where("section", "==", safeSec)
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

            const cleanClass = (selectedClass || '').trim();
            const cleanSection = (selectedSection || '').trim();
            const docId = `${userData.uid}_${cleanClass}_${cleanSection}`;

            await setDoc(doc(db, "timetables", docId), {
                class: cleanClass,
                section: cleanSection,
                schedule: JSON.parse(JSON.stringify(timetable)),
                periods: JSON.parse(JSON.stringify(periodConfig)),
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

    // --- State Handler Functions (Fixing Reference Errors) ---

    // 1. Fetch Teacher Allotments (for Suggestions)
    const fetchAllotments = async () => {
        if (!instId) return;
        try {
            // New Schema
            const q1 = query(collection(db, "teacher_allotments"), where("institutionId", "==", instId));
            const snap1 = await getDocs(q1);

            // Legacy
            const q2 = query(collection(db, "teacher_allotments"), where("createdBy", "==", instId));
            const snap2 = await getDocs(q2);

            // Merge
            const unique = new Set();
            const process = (docs) => {
                docs.forEach(d => {
                    const data = d.data();
                    const label = `${data.subject || 'General'} (${data.name || data.teacherName})`;
                    unique.add(label);
                    // Also just Name?
                    if (data.name) unique.add(data.name);
                });
            };
            process(snap1.docs);
            process(snap2.docs);

            setAllottedTeachers(Array.from(unique));
        } catch (e) { console.error(e); }
    };

    // 2. Period Config Handlers
    const updatePeriod = (index, field, value) => {
        const newConfig = [...periodConfig];
        newConfig[index] = { ...newConfig[index], [field]: value };
        setPeriodConfig(newConfig);
    };

    const movePeriod = (index, direction) => {
        if (index + direction < 0 || index + direction >= periodConfig.length) return;
        const newConfig = [...periodConfig];
        const temp = newConfig[index];
        newConfig[index] = newConfig[index + direction];
        newConfig[index + direction] = temp;
        setPeriodConfig(newConfig);
    };

    const removePeriod = (index) => {
        if (!window.confirm("Delete this period column? Data will be lost.")) return;
        const newConfig = periodConfig.filter((_, i) => i !== index);
        setPeriodConfig(newConfig);
    };

    const addPeriod = () => {
        const newId = `p_custom_${Date.now()}`;
        setPeriodConfig([...periodConfig, { id: newId, name: 'New Period', type: 'class' }]);
    };

    // 3. Timetable Cell Handler
    const handleCellChange = (day, pId, field, value) => {
        setTimetable(prev => {
            const daySchedule = prev[day] || {};
            const cell = daySchedule[pId] || {};

            // If field is 'subject' (the text value) or 'span'
            // We store objects now: { subject: "Maths", span: 1 }
            // Legacy might be string. We convert to object.

            const newCell = typeof cell === 'object' ? { ...cell } : { subject: cell, span: 1 };

            if (field === 'subject') newCell.subject = value;
            else if (field === 'span') newCell.span = value;

            return {
                ...prev,
                [day]: {
                    ...daySchedule,
                    [pId]: newCell
                }
            };
        });
    };

    // Fetch Available Teachers for AI Modal
    const fetchAvailableTeachers = async () => {
        if (!instId) return;
        try {
            const q1 = query(collection(db, "teacher_allotments"), where("institutionId", "==", instId));
            const q2 = query(collection(db, "teacher_allotments"), where("createdBy", "==", instId));

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            const teacherMap = new Map();
            const process = (docs) => {
                docs.forEach(d => {
                    const data = d.data();
                    const teacherId = data.teacherId || data.userId;
                    if (teacherId && !teacherMap.has(teacherId)) {
                        teacherMap.set(teacherId, {
                            id: teacherId,
                            name: data.teacherName || data.name || 'Unknown',
                            subject: data.subject || 'General'
                        });
                    }
                });
            };

            process(snap1.docs);
            process(snap2.docs);

            setAvailableTeachers(Array.from(teacherMap.values()));
        } catch (e) {
            console.error('Error fetching teachers:', e);
        }
    };

    // Create Subject-Specific Groups
    const createSubjectGroups = async (timetableData) => {
        if (!instId) return;

        try {
            // Extract unique subject-teacher pairs from timetable
            const subjectTeacherPairs = new Map(); // { subject: teacherId }

            Object.values(timetableData).forEach(daySchedule => {
                Object.values(daySchedule).forEach(cell => {
                    if (cell.subject && !cell.subject.includes('Break') && !cell.subject.includes('Conflict')) {
                        // Extract subject and teacher name
                        const match = cell.subject.match(/^(.+?)\s*\(([^)]+)\)$/);
                        if (match) {
                            const subject = match[1].trim();
                            const teacherName = match[2].trim();

                            // Find teacher ID
                            const teacher = availableTeachers.find(t => t.name === teacherName);
                            if (teacher && !subjectTeacherPairs.has(subject)) {
                                subjectTeacherPairs.set(subject, teacher.id);
                            }
                        }
                    }
                });
            });

            // Fetch all students from this class
            const studentsRef = collection(db, 'users');
            const studentsQuery = query(
                studentsRef,
                where('role', '==', 'student'),
                where('institutionId', '==', instId),
                where('class', '==', selectedClass),
                where('section', '==', selectedSection)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const studentIds = studentsSnapshot.docs.map(doc => doc.id);

            // Create or update a group for each subject
            for (const [subject, teacherId] of subjectTeacherPairs) {
                const groupName = `${subject} (${selectedClass}-${selectedSection})`;

                // Check if group already exists
                const groupsRef = collection(db, 'groups');
                const existingGroupQuery = query(
                    groupsRef,
                    where('name', '==', groupName),
                    where('institutionId', '==', instId)
                );
                const existingSnapshot = await getDocs(existingGroupQuery);

                if (existingSnapshot.empty) {
                    // Create new group
                    const groupMembers = [
                        instId,           // Institution
                        teacherId,        // Subject teacher
                        ...studentIds     // All students from this class
                    ].filter(Boolean);  // Remove any undefined values

                    const newGroup = {
                        name: groupName,
                        description: `${subject} class group for ${selectedClass}-${selectedSection}`,
                        institutionId: instId,
                        createdBy: instId,
                        members: groupMembers,
                        class: selectedClass,
                        section: selectedSection,
                        subject: subject,
                        teacherId: teacherId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        type: 'subject-class' // Mark as auto-created subject group
                    };

                    await addDoc(groupsRef, newGroup);
                    console.log(`Created group: ${groupName}`);
                } else {
                    // Update existing group with new teacher
                    const existingGroup = existingSnapshot.docs[0];
                    const existingData = existingGroup.data();
                    const oldTeacherId = existingData.teacherId;

                    // Start with fresh members list
                    let updatedMembers = existingData.members || [];

                    // IMPORTANT: Remove ALL teachers first (to clean up any old groups with multiple teachers)
                    // We'll identify teachers by checking if they're NOT students and NOT the institution
                    const cleanedMembers = updatedMembers.filter(memberId => {
                        // Keep institution
                        if (memberId === instId) return true;
                        // Keep students
                        if (studentIds.includes(memberId)) return true;
                        // Remove all others (teachers)
                        return false;
                    });

                    // Now add ONLY the correct subject teacher
                    updatedMembers = [
                        instId,           // Institution
                        teacherId,        // ONLY this subject's teacher
                        ...studentIds     // All students
                    ].filter(Boolean);

                    // Update the group
                    const groupDocRef = doc(db, 'groups', existingGroup.id);
                    await setDoc(groupDocRef, {
                        ...existingData,
                        members: updatedMembers,
                        teacherId: teacherId,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });

                    console.log(`Updated group: ${groupName} (cleaned up, only ${teacherId} teacher)`);
                }
            }
        } catch (e) {
            console.error('Error creating subject groups:', e);
            // Don't fail the timetable generation if group creation fails
        }
    };


    // 4. AI Timetable Generator (Enhanced with Cross-Class Conflict Detection)
    const generateAITimetable = async () => {
        // Validate configuration
        if (aiConfig.subjects.length === 0) {
            alert('Please select at least one subject!');
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Fetch ALL existing timetables to check teacher availability
            const allExistingTimetables = {};

            if (instId) {
                const timetablesRef = collection(db, 'timetables');
                const q = query(timetablesRef, where('institutionId', '==', instId));
                const snapshot = await getDocs(q);

                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Store timetables by class-section key
                    const key = `${data.class}-${data.section}`;
                    allExistingTimetables[key] = data.schedule || {};
                });
            }

            // STEP 2: Build teacher schedule from ALL existing timetables
            const teacherSchedule = {}; // { teacherId: { day: [periodIds] } }

            // Initialize teacher schedule for all assigned teachers
            Object.values(aiConfig.teacherAssignments).forEach(teacherId => {
                if (teacherId) {
                    teacherSchedule[teacherId] = {};
                    days.forEach(day => {
                        teacherSchedule[teacherId][day] = [];
                    });
                }
            });

            // STEP 3: Populate teacher schedule from existing timetables
            Object.entries(allExistingTimetables).forEach(([classKey, schedule]) => {
                // Skip the current class we're generating for
                const currentKey = `${selectedClass}-${selectedSection}`;
                if (classKey === currentKey) return;

                // Parse each day and period
                Object.entries(schedule).forEach(([day, periods]) => {
                    Object.entries(periods).forEach(([periodId, cell]) => {
                        if (cell && cell.subject) {
                            // Extract teacher ID or name from the cell
                            // Format: "Subject (TeacherName)" or just "Subject"
                            const match = cell.subject.match(/\(([^)]+)\)/);
                            if (match) {
                                const teacherNameInCell = match[1];

                                // Find matching teacher ID
                                Object.entries(aiConfig.teacherAssignments).forEach(([subject, teacherId]) => {
                                    if (teacherId) {
                                        const teacher = availableTeachers.find(t => t.id === teacherId);
                                        if (teacher && teacher.name === teacherNameInCell) {
                                            // Mark this teacher as busy at this time
                                            if (teacherSchedule[teacherId] && teacherSchedule[teacherId][day]) {
                                                if (!teacherSchedule[teacherId][day].includes(periodId)) {
                                                    teacherSchedule[teacherId][day].push(periodId);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                });
            });

            // STEP 4: Create new period configuration based on user input
            const newPeriodConfig = [];
            for (let i = 0; i < aiConfig.periodsPerDay; i++) {
                if (i === aiConfig.lunchBreakAfterPeriod) {
                    newPeriodConfig.push({ id: `break_lunch`, name: 'Lunch Break', type: 'break' });
                }
                newPeriodConfig.push({ id: `p${i + 1}`, name: `Period ${i + 1}`, type: 'class' });
            }
            setPeriodConfig(newPeriodConfig);

            // STEP 5: Intelligent Scheduling with Constraint Satisfaction
            const newTimetable = {};

            // Calculate how many periods each subject needs across the week
            const totalClassPeriods = newPeriodConfig.filter(p => p.type === 'class').length * days.length;
            const periodsPerSubject = Math.floor(totalClassPeriods / aiConfig.subjects.length);

            // Track subject usage to ensure even distribution
            const subjectUsageCount = {};
            aiConfig.subjects.forEach(subject => {
                subjectUsageCount[subject] = 0;
            });

            days.forEach(day => {
                newTimetable[day] = {};

                newPeriodConfig.forEach((period, periodIdx) => {
                    // Skip break periods
                    if (period.type === 'break') {
                        newTimetable[day][period.id] = { subject: period.name, span: 1 };
                        return;
                    }

                    // SMART ALGORITHM: Find best subject-teacher combination for this slot
                    let bestMatch = null;
                    let attemptedSubjects = [];

                    // Sort subjects by usage (least used first) for even distribution
                    const sortedSubjects = [...aiConfig.subjects].sort((a, b) =>
                        subjectUsageCount[a] - subjectUsageCount[b]
                    );

                    for (const subject of sortedSubjects) {
                        // Skip if we've tried this subject already
                        if (attemptedSubjects.includes(subject)) continue;
                        attemptedSubjects.push(subject);

                        // Check if this subject was used in previous period (avoid consecutive)
                        const prevPeriods = newPeriodConfig.slice(0, periodIdx).filter(p => p.type !== 'break');
                        let isConsecutive = false;

                        if (prevPeriods.length > 0) {
                            const lastPeriod = prevPeriods[prevPeriods.length - 1];
                            const prevSubject = newTimetable[day][lastPeriod.id]?.subject;
                            if (prevSubject && prevSubject.includes(subject)) {
                                isConsecutive = true;
                            }
                        }

                        // Skip if consecutive (unless no other option)
                        if (isConsecutive && attemptedSubjects.length < aiConfig.subjects.length) {
                            continue;
                        }

                        // Check if assigned teacher is available
                        const teacherId = aiConfig.teacherAssignments[subject];
                        if (teacherId) {
                            const teacher = availableTeachers.find(t => t.id === teacherId);
                            if (teacher) {
                                const isTeacherBusy = teacherSchedule[teacherId][day].includes(period.id);

                                if (!isTeacherBusy) {
                                    // PERFECT MATCH: Subject needed + Teacher available
                                    bestMatch = {
                                        subject: subject,
                                        teacher: teacher,
                                        teacherId: teacherId
                                    };
                                    break; // Found optimal match, stop searching
                                }
                            }
                        } else {
                            // No teacher assigned, but subject can still be scheduled
                            if (!bestMatch) {
                                bestMatch = {
                                    subject: subject,
                                    teacher: null,
                                    teacherId: null
                                };
                            }
                        }
                    }

                    // Assign the best match found
                    if (bestMatch) {
                        let cellValue;
                        if (bestMatch.teacher) {
                            cellValue = `${bestMatch.subject} (${bestMatch.teacher.name})`;
                            // Mark teacher as busy
                            teacherSchedule[bestMatch.teacherId][day].push(period.id);
                        } else {
                            cellValue = bestMatch.subject;
                        }

                        newTimetable[day][period.id] = { subject: cellValue, span: 1 };
                        subjectUsageCount[bestMatch.subject]++;
                    } else {
                        // Fallback: No perfect match found (rare case)
                        const fallbackSubject = sortedSubjects[0];
                        newTimetable[day][period.id] = { subject: fallbackSubject, span: 1 };
                        subjectUsageCount[fallbackSubject]++;
                    }
                });
            });

            // Count conflicts for user feedback
            let conflictCount = 0;
            Object.values(newTimetable).forEach(daySchedule => {
                Object.values(daySchedule).forEach(cell => {
                    if (cell.subject && cell.subject.includes('⚠️ Conflict')) {
                        conflictCount++;
                    }
                });
            });

            setTimetable(newTimetable);
            setIsEditing(true);
            setShowAIModal(false);

            // STEP 6: Auto-create subject-specific groups
            await createSubjectGroups(newTimetable);

            // Inform user about conflicts
            if (conflictCount > 0) {
                alert(`✅ Timetable generated!\n\n⚠️ Warning: ${conflictCount} period(s) have teacher conflicts (teacher is busy in another class at that time).\n\nPlease review and manually assign available teachers for conflicting periods.`);
            } else {
                alert('✅ AI Timetable generated successfully! No conflicts detected.\n\n📚 Subject-specific groups have been created automatically for communication.');
            }
        } catch (e) {
            console.error('Error generating timetable:', e);
            alert('Failed to generate timetable. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    const finalTimetable = viewMode === 'personal' ? mySchedule : timetable;

    return (
        <div style={{ minHeight: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', paddingBottom: '120px' }}>
            <AIBadge />


            <div className="container" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '20px 10px' }}>

                {/* Controls */}
                <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>

                    {/* DEBUG PANEL FOR INSTITUTION */}
                    {userData?.role === 'institution' && (
                        <div style={{ width: '100%', padding: '10px', background: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', fontSize: '11px', marginBottom: '10px' }}>
                            <strong>🔧 Diagnostic Info (Visible only to you):</strong><br />
                            <strong>My Inst ID:</strong> {instId} <br />
                            <strong>Records Found:</strong> {overviewData.length} (Overview) / {Object.keys(timetable).length > 0 ? 'Found' : '0'} (Single)<br />
                            <strong>View Mode:</strong> {viewMode} | <strong>Selected Class:</strong> {selectedClass}
                        </div>
                    )}

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

                    {/* Institution Controls */}
                    {isInstitution && viewMode !== 'overview' && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {!isEditing ? (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        style={{
                                            background: '#0984e3', color: 'white', border: 'none', padding: '10px 20px',
                                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                                            boxShadow: '0 4px 6px rgba(9, 132, 227, 0.2)'
                                        }}
                                    >
                                        ✏️ Edit Schedule
                                    </button>
                                    <button
                                        onClick={() => setShowAIModal(true)}
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white', border: 'none', padding: '10px 20px',
                                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                                            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.4)'
                                        }}
                                    >
                                        🤖 AI Generate
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setStructureMode(!structureMode)}
                                        style={{
                                            background: structureMode ? '#e17055' : '#6c5ce7', color: 'white', border: 'none',
                                            padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        {structureMode ? 'Done Structure' : '⚙️ Structure'}
                                    </button>
                                    <button
                                        onClick={saveTimetable}
                                        style={{
                                            background: '#00b894', color: 'white', border: 'none', padding: '8px 20px',
                                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                                            boxShadow: '0 4px 6px rgba(0, 184, 148, 0.2)'
                                        }}
                                    >
                                        💾 Save
                                    </button>
                                    <button
                                        onClick={() => { setIsEditing(false); setStructureMode(false); }}
                                        style={{
                                            background: '#d63031', color: 'white', border: 'none', padding: '8px 15px',
                                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    )}
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
                            if (!data) return null;
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

                {/* AI Configuration Modal */}
                <TimetableAIModal
                    show={showAIModal}
                    onClose={() => setShowAIModal(false)}
                    aiConfig={aiConfig}
                    setAiConfig={setAiConfig}
                    availableTeachers={availableTeachers}
                    onGenerate={generateAITimetable}
                />


            </div>
        </div>
    );
}
