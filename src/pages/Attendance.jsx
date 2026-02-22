import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';

import AIBadge from '../components/AIBadge';
import { useUser } from '../context/UserContext';

export default function Attendance() {
    const { userData } = useUser();
    const navigate = useNavigate();

    // Prevent crash if context is loading
    if (!userData) return <div className="p-4 text-center">Loading...</div>;

    const role = userData.role;
    const instId = role === 'institution' ? userData.uid : userData.institutionId;

    // View State
    const [view, setView] = useState('students');
    const [selectedClass, setSelectedClass] = useState('10');
    const [selectedSection, setSelectedSection] = useState('A');
    const [subject, setSubject] = useState(''); // New: Subject Context
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Student Stats State
    const [mySubjectStats, setMySubjectStats] = useState([]);
    const [myOverallStats, setMyOverallStats] = useState({ present: 0, total: 0, percent: 0 });
    const [myHistory, setMyHistory] = useState([]); // New: History State
    const [teacherClasses, setTeacherClasses] = useState([]); // Restricted classes for Teacher
    const [showSubjects, setShowSubjects] = useState(false); // Toggle state for subject dropdown
    const [debugLogs, setDebugLogs] = useState([]); // Troubleshooting Logs

    // Student specific monthly timetable-based attendance
    const [attendanceMonth, setAttendanceMonth] = useState(() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}`;
    });
    const [studentTimetable, setStudentTimetable] = useState(null);
    const [studentPeriods, setStudentPeriods] = useState([]);


    useEffect(() => {
        if (role === 'teacher' && userData?.uid) {
            const fetchAllowedClasses = async () => {
                try {
                    // Fetch allotments linked to this teacher
                    let classes = [];
                    const clsHelper = (docSnap) => {
                        const data = docSnap.data();
                        return { class: data.classAssigned, section: data.section };
                    };

                    // 1. By userId (New)
                    const q1 = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
                    const snap1 = await getDocs(q1);
                    snap1.forEach(d => classes.push(clsHelper(d)));

                    // 2. By teacherId (Legacy)
                    const q2 = query(collection(db, "teacher_allotments"), where("teacherId", "==", userData.uid));
                    const snap2 = await getDocs(q2);
                    snap2.forEach(d => classes.push(clsHelper(d)));

                    // 3. By Name (Legacy Fallback)
                    if (classes.length === 0 && userData.name) {
                        const q3 = query(collection(db, "teacher_allotments"), where("name", "==", userData.name));
                        const snap3 = await getDocs(q3);
                        snap3.forEach(d => classes.push(clsHelper(d)));
                    }

                    // Filter unique
                    const uniqueMap = new Map();
                    classes.forEach(c => {
                        const key = `${c.class}-${c.section}`;
                        if (!uniqueMap.has(key)) uniqueMap.set(key, c);
                    });
                    const uniqueClasses = Array.from(uniqueMap.values());

                    setTeacherClasses(uniqueClasses);
                    // Auto-select first if available (Overriding default '10' helps show actual data immediately)
                    if (uniqueClasses.length > 0) {
                        // FORCE UPDATE: Even if '10' is selected, if the teacher teaches '9', switch to '9'.
                        // We check if the current 'selectedClass' is actually in the teacher's list?
                        // Actually, simpler is just to default to the first one found.
                        setSelectedClass(uniqueClasses[0].class);
                        setSelectedSection(uniqueClasses[0].section);
                    }
                } catch (e) {
                    console.error("Error fetching teacher classes", e);
                }
            };
            fetchAllowedClasses();
        }
    }, [role, userData]);

    useEffect(() => {
        if (role === 'student' && userData?.uid) {
            const fetchStudentTimetable = async () => {
                try {
                    const uInstId = userData.institutionId || userData.createdBy;
                    const uClass = (userData.class || userData.assignedClass || userData.classAssigned || '').toString().trim();
                    const uSec = (userData.section || 'A').toString().trim();
                    if (!uInstId || !uClass) return;

                    const normClass = uClass.replace(/(\d+)(st|nd|rd|th)/i, '$1');
                    const classVariants = [normClass, uClass, `${normClass}th`];

                    const qT = query(collection(db, "timetables"), where("institutionId", "==", uInstId));
                    const snap = await getDocs(qT);

                    let foundT = null;
                    for (const d of snap.docs) {
                        const dt = d.data();
                        const dtClass = (dt.class || '').toString().trim();
                        const dtClassNorm = dtClass.replace(/(\d+)(st|nd|rd|th)/i, '$1');

                        if (classVariants.includes(dtClass) || normClass === dtClassNorm) {
                            if ((dt.section || '').toLowerCase() === uSec.toLowerCase()) {
                                foundT = dt;
                                break;
                            }
                        }
                    }

                    if (foundT) {
                        setStudentTimetable(foundT.schedule || {});
                        setStudentPeriods(foundT.periods || Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `${i + 1}th Period`, type: 'class' })));
                    } else {
                        setStudentPeriods(Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `${i + 1}th Period`, type: 'class' })));
                    }
                } catch (err) {
                    console.error("Failed to fetch student timetable", err);
                }
            };
            fetchStudentTimetable();
        }
    }, [userData, role]);

    useEffect(() => {
        if (role) {
            if (role === 'institution') setView('teachers');
            else setView('students');

            if (role === 'student' || role === 'teacher') {
                fetchMyStats();
            }
        }
    }, [role, userData]);

    useEffect(() => {
        if (role === 'student') return;
        fetchData();
    }, [selectedClass, selectedSection, selectedDate, view, role, userData, instId]);

    const fetchMyStats = async () => {
        if (!userData?.uid) return;
        try {
            let mergedDocs = [];
            const seenIds = new Set();
            const attendanceQueries = []; // Holds promises for parallel fetching

            const uClass = userData.assignedClass || userData.class;
            const uSection = userData.assignedSection || userData.section;
            setDebugLogs(prev => [`Starting Fetch for ${userData.name} (${uClass}-${uSection})...`]);

            // 1. Fetch by correct User UID
            const q1 = query(collection(db, "attendance"), where("userId", "==", userData.uid));
            const snap1 = await getDocs(q1);
            setDebugLogs(prev => [...prev, `Direct UID Match: Found ${snap1.size} records.`]);

            snap1.forEach(d => {
                if (!seenIds.has(d.id)) {
                    seenIds.add(d.id);
                    mergedDocs.push(d);
                }
            });

            // 2. Teacher Fallback: Fetch by Allotment (Enhanced)
            if (userData.role === 'teacher') {
                try {
                    // A. Linked Allotments (Fast)
                    const tLinkedQ = query(collection(db, "teacher_allotments"), where("userId", "==", userData.uid));
                    const tLinkedSnap = await getDocs(tLinkedQ);
                    setDebugLogs(prev => [...prev, `Teacher Linked Allotments: ${tLinkedSnap.size}`]);

                    const linkedIds = new Set();
                    tLinkedSnap.forEach(d => {
                        linkedIds.add(d.id);
                        if (d.id !== userData.uid) {
                            attendanceQueries.push(getDocs(query(collection(db, "attendance"), where("userId", "==", d.id))));
                        }
                    });

                    // B. Name Match (Robust Client-Side)
                    // Fetch all teacher allotments to ensure we match even if name spelling varies slightly
                    const allTQ = query(collection(db, "teacher_allotments"));
                    const allTSnap = await getDocs(allTQ);

                    const myNameRaw = (userData.name || "").toLowerCase().replace(/\s+/g, '');
                    let nameMatches = 0;

                    allTSnap.forEach(d => {
                        if (linkedIds.has(d.id)) return; // Already handled

                        const data = d.data();
                        const tName = (data.name || "").toLowerCase().replace(/\s+/g, '');

                        // Robust Match: Contains check
                        if (tName && myNameRaw && (tName.includes(myNameRaw) || myNameRaw.includes(tName))) {
                            nameMatches++;
                            if (d.id !== userData.uid) {
                                attendanceQueries.push(getDocs(query(collection(db, "attendance"), where("userId", "==", d.id))));
                            }

                            // Self-Healing
                            if (!data.userId) {
                                console.log(`Linking Teacher Allotment ${d.id} to ${userData.uid}`);
                                updateDoc(doc(db, "teacher_allotments", d.id), { userId: userData.uid });
                            }
                        }
                    });
                    setDebugLogs(prev => [...prev, `Teacher Name Matches: ${nameMatches}`]);

                } catch (err) {
                    console.warn("Teacher fetch failed", err);
                    setDebugLogs(prev => [...prev, `Teacher Fetch Error: ${err.message}`]);
                }
            }


            // 3. Student Fallback: Fetch by Allotment ID
            if (userData.role === 'student') {
                try {
                    // A. Explicit Link Match: Allotments already linked to this User UID
                    // (This catches cases where name might be different but ID is linked)
                    const linkedAllotQ = query(collection(db, "student_allotments"), where("userId", "==", userData.uid));
                    const linkedSnap = await getDocs(linkedAllotQ);
                    setDebugLogs(prev => [...prev, `Linked Allotments (by UID): Found ${linkedSnap.size}.`]);

                    linkedSnap.forEach(d => {
                        // For each linked allotment (e.g. "Pradeep's Allotment"), verify if attendance is stored under the Allotment ID...
                        if (d.id !== userData.uid) {
                            const q2 = query(collection(db, "attendance"), where("userId", "==", d.id));
                            attendanceQueries.push(getDocs(q2));
                        }

                        // ...OR under the User ID itself (data.userId) if it was ever used directly
                        const data = d.data();
                        if (data.userId && data.userId !== d.id) {
                            const q3 = query(collection(db, "attendance"), where("userId", "==", data.userId));
                            attendanceQueries.push(getDocs(q3));
                        }
                    });

                    // B. Legacy Name Match: Allotments matching Name/Class (if not linked)
                    // DATA NORMALIZATION FIX:
                    // 1. Construct Name: If 'name' is missing, combine first/second strings.
                    // 2. Normalize Class: Convert '10th' -> '10', '1st' -> '1', etc to match Allotment format.

                    const rawName = userData.name || `${userData.firstName || ''} ${userData.secondName || ''}`.trim();

                    // Remove non-numeric characters from class (e.g. "10th" -> "10") to match Allotment's simpler format
                    // If it's "Nursery"/"LKG"/"UKG", it stays the same.
                    const normalizedClass = (uClass || '').replace(/(\d+)(st|nd|rd|th)/i, '$1');

                    if (normalizedClass && uSection && rawName) {

                        // Fetch ALL students in this class/section
                        // Robust fetch: Check multiple class formats: "5", "5th", "05", "Class 5"
                        const classVariants = [
                            normalizedClass,
                            uClass,
                            `${normalizedClass}th`,
                            normalizedClass.replace(/^0+/, ''), // Remove leading zeros
                            `Class ${normalizedClass}`
                        ].filter(Boolean); // Remove null/undefined

                        // Remove duplicates
                        const uniqueVariants = [...new Set(classVariants)];

                        // Remove 'section' from Firestore query to avoid Index issues and handle case sensitivity client-side
                        const altQ = query(collection(db, "student_allotments"),
                            where("classAssigned", "in", uniqueVariants)
                        );
                        const altSnap = await getDocs(altQ);

                        setDebugLogs(prev => [...prev, `Scanning ${altSnap.size} allotments in Class Variants: ${uniqueVariants.join(', ')}`]);
                        setDebugLogs(prev => [...prev, `Class Roster: ${altSnap.docs.map(d => d.data().name).join(', ')}`]);

                        const targetName = rawName.toLowerCase().replace(/\s+/g, ''); // normalize spaces
                        // Robust Section Matching: Handle "A", "A ", "a"
                        const targetSec = (uSection || '').trim().toLowerCase();
                        let nameMatches = 0;

                        altSnap.forEach(d => {
                            const data = d.data();

                            // 1. Check Name Match FIRST (most specific)
                            // Allow partial matches if the name is long enough (>3 chars) to avoid false positives on "Al", "Jo" etc.
                            const allotmentName = (data.name || "").toLowerCase().replace(/\s+/g, '');

                            let isNameMatch = false;
                            if (allotmentName === targetName) isNameMatch = true;
                            else if (targetName.length > 3 && allotmentName.includes(targetName)) isNameMatch = true;
                            else if (allotmentName.length > 3 && targetName.includes(allotmentName)) isNameMatch = true;

                            // Fallback: Part Matching
                            if (!isNameMatch) {
                                const ap = (data.name || "").toLowerCase().split(/\s+/).filter(p => p.length > 2);
                                const tp = rawName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
                                if (tp.length > 0 && ap.length > 0) {
                                    const overlap = tp.filter(t => ap.some(a => a.includes(t) || t.includes(a)));
                                    if (overlap.length > 0) isNameMatch = true;
                                }
                            }

                            if (!isNameMatch) return; // Skip if name doesn't match at all

                            // 2. Name Matched! Now check Section
                            const docSec = (data.section || '').trim().toLowerCase();

                            if (docSec !== targetSec) {
                                setDebugLogs(prev => [...prev, `Found Name match "${data.name}" but Section mismatch: Doc="${data.section}" vs User="${uSection}"`]);
                                return;
                            }

                            // 3. Match Found!
                            if (d.id !== userData.uid) {
                                nameMatches++;

                                // SELF-HEALING: Link this allotment to my UID so next time it's instant
                                if (!data.userId) {
                                    console.log(`Self-healing Link: Linking Allotment ${d.id} (${data.name}) to User ${userData.uid}`);
                                    updateDoc(doc(db, "student_allotments", d.id), { userId: userData.uid })
                                        .then(() => setDebugLogs(prev => [...prev, " Self-healed student link successfully."]))
                                        .catch(e => console.warn("Heal failed", e));
                                } else if (data.userId !== userData.uid) {
                                    // If linked to WRONG user (rare but possible during testing), minimal log
                                    console.warn(`Allotment ${d.id} linked to other user ${data.userId}`);
                                }

                                const q3 = query(collection(db, "attendance"), where("userId", "==", d.id)); // Attendance marked against Allotment ID
                                attendanceQueries.push(getDocs(q3));

                                // ALSO check for attendance marked against the USER ID if the teacher just started using the new system
                                if (data.userId) { // If it was already linked
                                    const q4 = query(collection(db, "attendance"), where("userId", "==", data.userId));
                                    attendanceQueries.push(getDocs(q4));
                                }
                            }
                        });
                        setDebugLogs(prev => [...prev, `Name & Section Matches: ${nameMatches}`]);
                    }

                    // Execute all legacy/fallback queries
                    const fallbackResults = await Promise.all(attendanceQueries);
                    fallbackResults.forEach(snap => {
                        snap.forEach(d => {
                            if (!seenIds.has(d.id)) {
                                seenIds.add(d.id);
                                mergedDocs.push(d);
                            }
                        });
                    });
                    setDebugLogs(prev => [...prev, `Total Attendance Docs Merged: ${mergedDocs.length}`]);

                } catch (err) {
                    console.warn("Legacy attendance fetch failed", err);
                    setDebugLogs(prev => [...prev, `Error: ${err.message}`]);
                }
            } // End Student If

            // 4. SHARED EXECUTION (Ensures Teacher Queries Run)
            if (attendanceQueries.length > 0) {
                const finalRes = await Promise.all(attendanceQueries);
                finalRes.forEach(snap => {
                    snap.forEach(d => {
                        if (!seenIds.has(d.id)) {
                            seenIds.add(d.id);
                            mergedDocs.push(d);
                        }
                    });
                });
            }

            const subjectsObj = {};
            let globalTotal = 0;
            let globalPresent = 0;
            const historyList = [];

            mergedDocs.forEach(d => {
                const data = d.data();
                historyList.push({ id: d.id, ...data });

                const subj = data.subject || 'General';

                if (!subjectsObj[subj]) subjectsObj[subj] = { total: 0, present: 0 };

                subjectsObj[subj].total++;
                globalTotal++;

                if (data.status === 'present') {
                    subjectsObj[subj].present++;
                    globalPresent++;
                }
            });

            // Sort history by date descending
            historyList.sort((a, b) => new Date(b.date) - new Date(a.date));
            setMyHistory(historyList); // React key use `h.id`

            // Convert to Array
            const statsArr = Object.keys(subjectsObj).map(key => ({
                subject: key,
                present: subjectsObj[key].present,
                total: subjectsObj[key].total,
                percent: subjectsObj[key].total > 0 ? ((subjectsObj[key].present / subjectsObj[key].total) * 100).toFixed(0) : 0
            }));

            setMySubjectStats(statsArr);
            setMyOverallStats({
                present: globalPresent,
                total: globalTotal,
                percent: globalTotal > 0 ? ((globalPresent / globalTotal) * 100).toFixed(0) : 0
            });

        } catch (e) {
            console.error("Error fetching stats", e);
            setDebugLogs(prev => [...prev, `Critical Error: ${e.message}`]);
        }
    };

    const fetchData = async () => {
        if (view === 'students' && !selectedClass) {
            setList([]);
            return;
        }

        setLoading(true);
        setList([]);
        try {
            const colName = view === 'teachers' ? 'teacher_allotments' : 'student_allotments';

            // Robust check using lowercased role
            const userRole = (role || "").toLowerCase();
            const creatorId = userRole === 'institution' ? userData.uid : userData.institutionId;

            if (!creatorId) {
                console.warn("No creator/institution ID found, aborting fetch.");
                setDebugLogs(prev => [...prev, "Abort: No Creator ID (Inst/Admin ID) found on User Data."]);
                setLoading(false);
                return;
            }

            console.log(`FetchData Start | Role: ${role} | View: ${view} | Creator: ${creatorId} | Class: ${selectedClass} | Sec: ${selectedSection}`);


            const fetchPromises = [];

            if (view === 'students') {
                const classNum = selectedClass;
                const sec = selectedSection;

                // BROAD FETCH STRATEGY:
                // Query all students for this institution, then filter client-side.
                // This bypasses issues with "10" vs "10th" vs "Class 10" mismatch in Firestore indexes or fields.

                // Query A: CreatedBy (Legacy)
                fetchPromises.push(getDocs(query(collection(db, colName), where('createdBy', '==', creatorId))));

                // Query B: InstitutionId (Robust/New)
                fetchPromises.push(getDocs(query(collection(db, colName), where('institutionId', '==', creatorId))));

                // Query C: FALLBACK (Direct Class/Sec Match - Use sparingly, but needed if ID linkage is broken)
                // If we are a teacher, we might not have 'createdBy' set to us, but we have 'class' rights?
                // Actually, for Teachers, we rely on 'institutionId' on the student doc.
                // If that is missing, we try to match simply by Class + Section if we are desperate.
                if (role === 'teacher') {
                    // CAUTION: This might return students from other schools if not careful, but we filter by ID later?
                    // No, let's trust the Teacher's 'institutionId' field. If that fails...
                    // Let's add a query that matches Class + Section broadly, then we filter?
                    // Risk: Data scraping from other schools. 
                    // SAFETY: Only do this if we have a valid Inst ID to check against, OR just rely on Index.

                    // Safer Fallback: Query by 'assignedClass' (legacy user field) or 'classAssigned'
                    // Only fetch if we have a specific class selected
                    if (selectedClass) {
                        // Generate variants: "10", "10th", "Class 10", "Grade 10"
                        const baseVal = selectedClass.replace(/[^0-9]/g, ''); // Extract '10'
                        const variants = [
                            selectedClass,
                            baseVal,
                            `${baseVal}th`,
                            `Class ${baseVal}`,
                            `Grade ${baseVal}`
                        ];
                        // Remove duplicates/empty
                        const uniqueVariants = [...new Set(variants)].filter(Boolean);

                        console.log("Using Fallback Variants:", uniqueVariants);
                        fetchPromises.push(getDocs(query(collection(db, colName), where('classAssigned', 'in', uniqueVariants))));
                    }
                }
            } else {
                // View == Teachers
                // Query A: CreatedBy
                fetchPromises.push(getDocs(query(collection(db, colName), where('createdBy', '==', creatorId))));

                // Query B: InstitutionId
                fetchPromises.push(getDocs(query(collection(db, colName), where('institutionId', '==', creatorId))));
            }

            // ADDED: Swallow errors from individual queries so one failure doesn't kill all
            const snapshots = await Promise.all(fetchPromises.map(p => p.catch(e => {
                console.warn("Sub-query failed", e);
                return { forEach: () => { } }; // Return empty dummy
            })));

            // Merge & Deduplicate
            const uniqueMap = new Map();
            snapshots.forEach(snap => {
                snap.forEach(d => {
                    if (!uniqueMap.has(d.id)) {
                        uniqueMap.set(d.id, { id: d.id, ...d.data() });
                    }
                });
            });

            let rawList = Array.from(uniqueMap.values());

            // CLIENT-SIDE FILTERING (Robust)
            if (view === 'students') {
                const targetSec = (selectedSection || '').trim().toLowerCase();
                const targetClassRaw = (selectedClass || '').toLowerCase().trim();
                const targetClassNorm = targetClassRaw.replace(/(\d+)(st|nd|rd|th)/i, '$1');

                rawList = rawList.filter(item => {
                    if (targetSec && targetSec !== 'all') {
                        if ((item.section || '').trim().toLowerCase() !== targetSec) return false;
                    }
                    const itemClass = (item.classAssigned || '').toLowerCase().trim();
                    const itemClassNorm = itemClass.replace(/(\d+)(st|nd|rd|th)/i, '$1');
                    return (
                        itemClass === targetClassRaw ||
                        itemClassNorm === targetClassNorm ||
                        itemClass === targetClassNorm ||
                        itemClassNorm === targetClassRaw
                    );
                });
            }

            // Deduplicate & Merge
            let fetched = rawList;
            if (view === 'students') {
                const uniqueMap = new Map();
                rawList.forEach(item => {
                    // Deduplicate by userId if available, otherwise by roll number + name combo
                    const stId = item.userId || `${(item.rollNo || item.rollNumber || item.pid || 'NOROLL')}-${(item.studentName || item.name || 'NONAME').toLowerCase().trim()}`;
                    if (!uniqueMap.has(stId)) {
                        uniqueMap.set(stId, {
                            ...item,
                            id: item.id,
                            name: item.studentName || item.name || 'Unknown Student'
                        });
                    }
                });
                fetched = Array.from(uniqueMap.values());
            } else if (view === 'teachers') {
                const uniqueMap = new Map();
                rawList.forEach(item => {
                    const tId = item.userId || item.teacherId || item.id;
                    if (!uniqueMap.has(tId)) {
                        uniqueMap.set(tId, {
                            ...item,
                            id: tId,
                            name: item.teacherName || item.name || 'Unknown Teacher'
                        });
                    }
                });
                fetched = Array.from(uniqueMap.values());
                if (subject) {
                    fetched = fetched.filter(t => (t.subject || '').toLowerCase().includes(subject.toLowerCase()));
                }
            }

            // Fetch Attendance for Date
            let attQuery = query(collection(db, "attendance"), where("date", "==", selectedDate));
            if (view === 'students' && subject) {
                attQuery = query(collection(db, "attendance"), where("date", "==", selectedDate), where("subject", "==", subject));
            }

            const attendanceSnap = await getDocs(attQuery);
            const attendanceMap = {};
            attendanceSnap.docs.forEach(d => {
                attendanceMap[d.data().userId] = d.data().status;
            });

            // Calculate Stats for Percentages
            const stats = await Promise.all(fetched.map(async (p) => {
                const targetId = p.userId || p.id;
                let qStats;
                if (view === 'students' && subject) {
                    qStats = query(collection(db, "attendance"), where("userId", "==", targetId), where("subject", "==", subject));
                } else {
                    qStats = query(collection(db, "attendance"), where("userId", "==", targetId));
                }

                const allAtt = await getDocs(qStats);
                let total = 0, present = 0;
                allAtt.forEach(doc => { total++; if (doc.data().status === 'present') present++; });

                return {
                    id: p.id,
                    targetId, // actual UID used for marking
                    percent: total > 0 ? ((present / total) * 100).toFixed(0) : 0,
                    present,
                    total
                };
            }));

            const statsMap = {};
            stats.forEach(s => statsMap[s.id] = s);

            const merged = fetched.map(p => {
                const s = statsMap[p.id];
                return {
                    ...p,
                    status: attendanceMap[s.targetId] || 'pending',
                    percentage: s.percent,
                    statsData: s
                };
            });

            // Sort Alphabetically
            merged.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setList(merged);

            // Sort Alphabetically by Name
            merged.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            setList(merged);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleSuspend = async (studentId, currentSuspension) => {
        const daysStr = prompt("Enter suspension duration in days (0 to lift):", "3");
        if (daysStr === null) return;
        const days = parseInt(daysStr, 10);
        if (isNaN(days)) return alert("Invalid number");

        const until = new Date();
        until.setDate(until.getDate() + days); // Add days

        try {
            // Update Student Allotment
            await updateDoc(doc(db, "student_allotments", studentId), {
                suspendedUntil: days > 0 ? until : null
            });
            // Update local state
            setList(prev => prev.map(item => item.id === studentId ? {
                ...item,
                suspendedUntil: days > 0 ? { seconds: until.getTime() / 1000 } : null
            } : item));
            alert(days > 0 ? `Student suspended for ${days} days.` : "Suspension lifted.");
        } catch (e) {
            console.error("Suspension failed", e);
            alert("Error updating suspension.");
        }
    };

    const markAttendance = async (id, status) => {
        // Validation Removed: Subject is now optional (defaults to General)

        const person = list.find(l => l.id === id);
        if (!person) return;

        // 1. Suspension Check (Teachers)
        if (view === 'students' && role === 'teacher') {
            if (person.suspendedUntil) {
                const suspendDate = new Date(person.suspendedUntil.seconds * 1000);
                if (suspendDate > new Date()) {
                    alert(`🚫 Cannot mark attendance. Student is suspended until ${suspendDate.toLocaleDateString()}`);
                    return;
                }
            }
        }


        // 3. "Only 1 Time" Rule (Duplicate Check)
        if (person.status !== 'pending') {
            alert("⚠️ Attendance already marked for this subject today! updates are not allowed.");
            return;
        }

        // CRITICAL FIX: Use the linked User UID if available
        const targetId = person.userId || id;

        try {
            const finalSubject = view === 'teachers' ? 'General' : subject;
            const docId = `${selectedDate}_${targetId}_${finalSubject}`;

            await setDoc(doc(db, "attendance", docId), {
                userId: targetId,
                date: selectedDate,
                subject: finalSubject,
                status: status,
                role: view === 'teachers' ? 'teacher' : 'student',
                updater: userData.uid,
                updaterName: userData.name || "Unknown Staff", // Store name for student view
                timestamp: new Date()
            });
            setList(prev => prev.map(item => item.id === id ? { ...item, status } : item));
        } catch (e) {
            console.error("Error marking attendance:", e);
            alert("Error marking attendance");
        }
    };

    // Helper to check suspension status for UI
    const isSuspended = (person) => {
        if (!person.suspendedUntil) return false;
        // Compare dates
        const now = new Date();
        const susp = new Date(person.suspendedUntil.seconds * 1000);
        return susp > now;
    };


    const backPath = role === 'student' ? '/student' : (role === 'teacher' ? '/teacher' : (role === 'institution' ? '/institution' : '/'));

    // --- STUDENT VIEW ---
    if (role === 'student') {
        if (!userData) return <div className="text-center p-4">Loading Data...</div>;

        return (
            <div className="page-wrapper" style={{ minHeight: '100vh', background: '#f5f7fa' }}>
                <AIBadge />

                <div className="container" style={{ maxWidth: '800px', margin: '20px auto', paddingBottom: '50px' }}>

                    {/* Overall Score Card */}
                    <div className="card text-center" style={{ padding: '30px', marginBottom: '20px', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white', borderRadius: '15px' }}>
                        <h2 style={{ margin: 0, color: 'white' }}>Overall Attendance</h2>
                        <div style={{ fontSize: '3.5rem', fontWeight: 'bold', margin: '10px 0' }}>
                            {myOverallStats?.percent || 0}%
                        </div>
                        <p style={{ opacity: 0.9 }}>
                            {myOverallStats?.present || 0} / {myOverallStats?.total || 0} Classes Attended
                        </p>
                    </div>

                    {/* Subject-Wise Breakdown */}
                    <h3 style={{ marginLeft: '10px', color: '#2d3436' }}>Subject-Wise Breakdown</h3>
                    <div className="responsive-grid" style={{ marginTop: '10px' }}>
                        {mySubjectStats && mySubjectStats.length > 0 ? mySubjectStats.map((stat, idx) => (
                            <div key={idx} className="card" style={{ padding: '20px', textAlign: 'center', borderRadius: '12px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px', color: '#2d3436' }}>
                                    {stat?.subject || 'Subject'}
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: parseInt(stat.percent) >= 75 ? '#00b894' : '#d63031' }}>
                                    {stat?.percent || 0}%
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#636e72', marginTop: '5px' }}>
                                    {stat?.present || 0} / {stat?.total || 0} Classes
                                </div>
                            </div>
                        )) : (
                            <p className="text-muted" style={{ padding: '20px', width: '100%' }}>No subject records found yet.</p>
                        )}
                    </div>

                    {/* Monthly Timetable Attendance View */}
                    <div className="card" style={{ marginTop: '30px', overflowX: 'auto', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, color: '#2d3436' }}>📅 Monthly Period Tracker</h3>
                            <input
                                type="month"
                                className="input-field"
                                style={{ width: 'auto', margin: 0, padding: '5px 10px' }}
                                value={attendanceMonth}
                                onChange={(e) => setAttendanceMonth(e.target.value)}
                            />
                        </div>

                        {studentPeriods && studentPeriods.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: '#f5f7fa', borderBottom: '2px solid #dfe6e9' }}>
                                        <th style={{ padding: '12px 10px', color: '#636e72', fontWeight: 'bold' }}>S.No</th>
                                        <th style={{ padding: '12px 10px', color: '#636e72', fontWeight: 'bold' }}>Date</th>
                                        {studentPeriods.filter(p => p.type !== 'break').map(p => (
                                            <th key={p.id} style={{ padding: '12px 10px', color: '#636e72', fontWeight: 'bold' }}>{p.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const [y, m] = attendanceMonth.split('-');
                                        const year = parseInt(y, 10);
                                        const month = parseInt(m, 10);
                                        const daysInMonth = new Date(year, month, 0).getDate();

                                        const histMap = {};
                                        myHistory.forEach(h => {
                                            if (h.date) {
                                                const parts = h.date.split('-');
                                                if (parts.length === 3) {
                                                    const dKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                                    if (!histMap[dKey]) histMap[dKey] = {};
                                                    const s = (h.subject || 'General').trim().toLowerCase();
                                                    const strStatus = typeof h.status === 'string' ? h.status.toLowerCase().trim() : h.status;
                                                    histMap[dKey][s] = strStatus;

                                                    // Mark as daily general attendance to act as fallback for all periods
                                                    if (s === 'general' || (h.subject || '').trim() === '') {
                                                        histMap[dKey]['_daily_'] = strStatus;
                                                    }
                                                }
                                            }
                                        });

                                        const rows = [];
                                        const classPeriods = studentPeriods.filter(p => p.type !== 'break');
                                        const today = new Date();

                                        for (let day = 1; day <= daysInMonth; day++) {
                                            const dateObj = new Date(year, month - 1, day);
                                            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
                                            const daySchedule = studentTimetable ? studentTimetable[dayOfWeek] : null;

                                            const isSunday = dateObj.getDay() === 0;
                                            const isFuture = dateObj > today;

                                            rows.push(
                                                <tr key={day} style={{ borderBottom: '1px solid #f1f2f6', background: isSunday ? '#fff3cd' : 'transparent' }}>
                                                    <td style={{ padding: '12px 10px', color: '#636e72' }}>{day}</td>
                                                    <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#2d3436' }}>{dateStr.slice(5)}</td>
                                                    {classPeriods.map(p => {
                                                        const subj = daySchedule ? daySchedule[p.id]?.subject : null;
                                                        let displayStatus = <span style={{ color: '#b2bec3' }}>-</span>;

                                                        const targetedSubject = (subj || 'General').trim().toLowerCase();
                                                        let status = null;

                                                        if (histMap[dateStr]) {
                                                            if (histMap[dateStr][targetedSubject]) {
                                                                status = histMap[dateStr][targetedSubject];
                                                            } else if (histMap[dateStr]['_daily_']) {
                                                                status = histMap[dateStr]['_daily_'];
                                                            } else {
                                                                // Fallback: If only 1 specific subject was taken, carry it over if general is missing
                                                                const availableStatuses = Object.values(histMap[dateStr]).filter(v => typeof v === 'string' && (v === 'present' || v === 'absent' || v === 'leave'));
                                                                if (availableStatuses.length > 0) {
                                                                    status = availableStatuses[0];
                                                                }
                                                            }
                                                        }

                                                        // Override output hierarchically
                                                        if (status === 'present') {
                                                            displayStatus = <span style={{ color: '#00b894', fontWeight: 'bold', fontSize: '16px' }}>P</span>;
                                                        } else if (status === 'absent') {
                                                            displayStatus = <span style={{ color: '#d63031', fontWeight: 'bold', fontSize: '16px' }}>A</span>;
                                                        } else if (status === 'leave') {
                                                            displayStatus = <span style={{ color: '#e1b12c', fontWeight: 'bold', fontSize: '16px' }}>L</span>;
                                                        } else if (isSunday) {
                                                            displayStatus = <span style={{ color: '#d63031', fontSize: '10px', fontWeight: 'bold' }}>HOLIDAY</span>;
                                                        } else if (isFuture) {
                                                            displayStatus = <span style={{ color: '#dfe6e9' }}>-</span>;
                                                        } else if (subj) {
                                                            displayStatus = <span style={{ color: '#636e72', fontSize: '11px', textTransform: 'uppercase', opacity: 0.7 }}>{subj.length > 5 ? subj.substring(0, 5) + '..' : subj}</span>;
                                                        }

                                                        return <td key={p.id} style={{ padding: '12px 10px' }}>{displayStatus}</td>;
                                                    })}
                                                </tr>
                                            );
                                        }
                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#636e72' }}>
                                No timetable mapped.
                            </div>
                        )}
                    </div>


                </div>
            </div>
        );
    }

    // --- TEACHER & INSTITUTION VIEW ---
    return (
        <div className="page-wrapper">
            <AIBadge />


            <div className="container" style={{ maxWidth: '900px', margin: '20px auto' }}>

                {/* Teacher's Own Stats */}
                {role === 'teacher' && (
                    <div className="card" style={{ background: 'linear-gradient(to right, #74b9ff, #a29bfe)', color: 'white', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'white' }}>My Attendance</h3>
                                <p style={{ margin: 0, opacity: 0.9 }}>Overall</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{myOverallStats.percent}%</div>
                                <div style={{ fontSize: '0.9rem' }}>{myOverallStats.present}/{myOverallStats.total} Days</div>
                            </div>
                        </div>

                        {/* Recent History Toggle/View */}
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '5px' }}>Recent History</h4>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {myHistory.length > 0 ? myHistory.map((h, index) => (
                                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '4px' }}>
                                        <span>{index + 1}. {h.date}</span>
                                        <span style={{ fontWeight: 'bold', color: h.status === 'present' ? '#55efc4' : '#fab1a0' }}>
                                            {h.status.toUpperCase()}
                                        </span>
                                    </div>
                                )) : <div style={{ fontSize: '12px' }}>No records yet.</div>}
                            </div>
                        </div>
                    </div>
                )}



                <div className="card">
                    <h3 className="text-center" style={{ marginBottom: '20px' }}>Manage Attendance</h3>

                    {/* Controls Row */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px', alignItems: 'center' }}>

                        <input type="date" className="input-field" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 'auto', margin: 0 }} />

                        {view === 'students' && (
                            <>
                                <select
                                    className="input-field"
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    style={{ width: 'auto', margin: 0, minWidth: '80px' }}
                                >
                                    <option value="">Class</option>
                                    {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <select
                                    className="input-field"
                                    value={selectedSection}
                                    onChange={(e) => setSelectedSection(e.target.value)}
                                    style={{ width: 'auto', margin: 0, minWidth: '70px' }}
                                >
                                    <option value="">Sec</option>
                                    {['A', 'B', 'C', 'D'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        {/* Custom Subject Dropdown */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input-field"
                                    placeholder={view === 'teachers' ? "Filter by Subject" : "Subject (Optional)"}
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    onClick={() => setShowSubjects(!showSubjects)}
                                    style={{ width: '180px', margin: 0, paddingRight: '30px' }}
                                />
                                <span
                                    onClick={() => setShowSubjects(!showSubjects)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#888', fontSize: '10px' }}
                                >
                                    {showSubjects ? '▲' : '▼'}
                                </span>
                            </div>

                            {showSubjects && (
                                <div style={{
                                    position: 'absolute', top: '105%', left: 0, width: '100%',
                                    background: 'white', border: '1px solid #ddd', borderRadius: '8px',
                                    maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                                }}>
                                    {['Telugu', 'Hindi', 'English', 'Maths', 'Science', 'Social Studies', 'Physical Science', 'Natural Science', 'Environmental Science (EVS)', 'Sanskrit']
                                        .filter(s => s.toLowerCase().includes(subject.toLowerCase()))
                                        .map(s => (
                                            <div
                                                key={s}
                                                onClick={() => { setSubject(s); setShowSubjects(false); }}
                                                style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f1f1', fontSize: '13px', color: '#2d3436' }}
                                                onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                                                onMouseLeave={(e) => e.target.style.background = 'white'}
                                            >
                                                {s}
                                            </div>
                                        ))}
                                    {/* Option to clear */}
                                    <div
                                        onClick={() => { setSubject(''); setShowSubjects(false); }}
                                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', color: '#d63031', fontStyle: 'italic' }}
                                        onMouseEnter={(e) => e.target.style.background = '#fff5f5'}
                                        onMouseLeave={(e) => e.target.style.background = 'white'}
                                    >
                                        Clear Selection
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '5px' }}>
                            <button className={`btn`} style={{ padding: '10px', background: view === 'students' ? '#0984e3' : '#b2bec3' }} onClick={() => setView('students')}>Students</button>
                            <button className={`btn`} style={{ padding: '10px', background: view === 'teachers' ? '#e17055' : '#b2bec3' }} onClick={() => setView('teachers')}>Teachers</button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="list-container">
                        {loading && <p className="text-center">Loading...</p>}
                        {!loading && list.length === 0 && (
                            <div className="text-center text-muted">
                                {view === 'students' && !selectedClass ? "Select a Class." : "No records found."}
                            </div>
                        )}

                        {view === 'teachers' ? (
                            <div className="attendance-list-wrapper">
                                {/* Desktop Table View */}
                                <div className="hide-mobile" style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dfe6e9', color: '#636e72', fontSize: '13px', textTransform: 'uppercase' }}>
                                                <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>S.No</th>
                                                <th style={{ padding: '15px', textAlign: 'left' }}>Teacher Name</th>
                                                <th style={{ padding: '15px', textAlign: 'left' }}>Subject</th>
                                                <th style={{ padding: '15px', textAlign: 'center' }}>Attendance</th>
                                                <th style={{ padding: '15px', textAlign: 'center' }}>Total Days</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map((item, index) => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f2f6', background: item.status === 'present' ? '#e6ffec' : (item.status === 'absent' ? '#fff0f0' : 'white') }}>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#b2bec3' }}>{index + 1}</td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#2d3436' }}>{item.name}</td>
                                                    <td style={{ padding: '12px', color: '#636e72' }}>{item.subject || '-'}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => markAttendance(item.id, 'present')}
                                                                style={{
                                                                    width: '35px', height: '35px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                                                    background: item.status === 'present' ? '#00b894' : '#ecf0f1', color: item.status === 'present' ? 'white' : '#b2bec3'
                                                                }}>P</button>
                                                            <button
                                                                onClick={() => markAttendance(item.id, 'absent')}
                                                                style={{
                                                                    width: '35px', height: '35px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                                                    background: item.status === 'absent' ? '#d63031' : '#ecf0f1', color: item.status === 'absent' ? 'white' : '#b2bec3'
                                                                }}>A</button>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', color: '#6c5ce7', fontWeight: '800' }}>
                                                        {new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + 1, 0).getDate()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View - centered and fits screen */}
                                <div className="show-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {list.map((item, index) => (
                                        <div key={item.id} style={{
                                            background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '16px',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            boxShadow: 'var(--shadow-sm)'
                                        }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                                                    {item.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{item.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.subject || 'All Subjects'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => markAttendance(item.id, 'present')}
                                                    style={{
                                                        padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: '800',
                                                        background: item.status === 'present' ? '#00b894' : '#ecf0f1', color: item.status === 'present' ? 'white' : 'var(--text-main)'
                                                    }}>P</button>
                                                <button
                                                    onClick={() => markAttendance(item.id, 'absent')}
                                                    style={{
                                                        padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: '800',
                                                        background: item.status === 'absent' ? '#d63031' : '#ecf0f1', color: item.status === 'absent' ? 'white' : 'var(--text-main)'
                                                    }}>A</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            list.map((item, index) => {
                                const suspended = isSuspended(item);
                                return (
                                    <div key={item.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', borderBottom: '1px solid #eee',
                                        background: suspended ? '#f3a683' : (item.status === 'present' ? '#e6ffec' : (item.status === 'absent' ? '#ffe6e6' : 'white')),
                                        opacity: suspended && role === 'teacher' ? 0.6 : 1
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            {/* Number Count */}
                                            <div style={{ fontWeight: 'bold', color: '#636e72', fontSize: '14px', width: '25px' }}>
                                                {index + 1}.
                                            </div>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dfe6e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {item.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {item.name}
                                                    {suspended && <span style={{ fontSize: '10px', background: '#d63031', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>SUSPENDED</span>}
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#636e72' }}>{item.classAssigned} {item.subject ? `• ${item.subject}` : ''}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

                                            {/* Actual Stats Display (Visible to Everyone) */}
                                            <div style={{ textAlign: 'center', marginRight: '15px', minWidth: '50px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: item.percentage < 75 ? '#d63031' : '#00b894' }}>
                                                    {item.percentage}%
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#636e72', fontWeight: '500' }}>
                                                    {item.statsData?.present || 0} / {item.statsData?.total || 0} classes
                                                </div>
                                            </div>

                                            {/* Institution Suspends Students + Mark Attendance */}
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                {role === 'institution' && view === 'students' && (
                                                    <button
                                                        onClick={() => handleSuspend(item.id, item.suspendedUntil)}
                                                        style={{ border: 'none', background: '#d63031', color: 'white', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', height: '30px', marginRight: '5px' }}
                                                        title="Suspend Student"
                                                    >
                                                        {suspended ? 'Lift' : '⛔'}
                                                    </button>
                                                )}

                                                <>
                                                    <button
                                                        disabled={suspended}
                                                        onClick={() => markAttendance(item.id, 'present')}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '6px', border: 'none',
                                                            cursor: suspended ? 'not-allowed' : 'pointer',
                                                            background: item.status === 'present' ? '#00b894' : '#ecf0f1', color: item.status === 'present' ? 'white' : '#2d3436'
                                                        }}>
                                                        P
                                                    </button>
                                                    <button
                                                        disabled={suspended}
                                                        onClick={() => markAttendance(item.id, 'absent')}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '6px', border: 'none',
                                                            cursor: suspended ? 'not-allowed' : 'pointer',
                                                            background: item.status === 'absent' ? '#d63031' : '#ecf0f1', color: item.status === 'absent' ? 'white' : '#2d3436'
                                                        }}>
                                                        A
                                                    </button>
                                                </>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {list.length > 0 && (
                        <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '40px' }}>
                            <button
                                className="btn"
                                disabled={list.some(item => item.status === 'pending')}
                                style={{
                                    backgroundColor: list.some(item => item.status === 'pending') ? '#b2bec3' : '#00b894',
                                    padding: '12px 40px',
                                    fontSize: '1.2rem',
                                    boxShadow: list.some(item => item.status === 'pending') ? 'none' : '0 4px 10px rgba(0,184,148,0.4)',
                                    cursor: list.some(item => item.status === 'pending') ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => {
                                    alert("Attendance Submitted Successfully! ✅");
                                    navigate(-1);
                                }}
                            >
                                Submit Attendance
                            </button>
                        </div>
                    )}



                </div>
            </div>
        </div>
    );
}
