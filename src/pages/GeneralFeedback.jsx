import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';

export default function GeneralFeedback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();

    // Tabs: 'write' or 'read'
    const [activeTab, setActiveTab] = useState(location.state?.target ? 'write' : 'read');
    const [targetPerson, setTargetPerson] = useState(location.state?.target || null);

    // Cooldown State
    const [cooldown, setCooldown] = useState({ active: false, daysLeft: 0, date: null });

    // Write Form State
    const [ratings, setRatings] = useState({
        behavior: { dropdown: '', stars: 0 },
        communication: { dropdown: '', stars: 0 },
        bodyLanguage: { dropdown: '', stars: 0 },
        hardworking: { dropdown: '', stars: 0 }
    });
    const [comment, setComment] = useState('');
    const [revealName, setRevealName] = useState(false);
    const [loading, setLoading] = useState(false);

    // Read List State
    const [receivedFeedback, setReceivedFeedback] = useState([]);

    // Check Cooldown Logic
    useEffect(() => {
        const checkCycle = async () => {
            if (activeTab !== 'write' || !userData || !targetPerson) return;

            // 1. Student -> Teacher (Existing Rule: 28 Days)
            if (userData.role === 'student' && targetPerson.type === 'Teacher') {
                await runCooldownCheck(28);
            }
            // 2. Teacher -> Student (New Rule: 28 Days Block, 75 Days Due Warning)
            else if (userData.role === 'teacher' && targetPerson.type === 'Student') {
                // ... existing logic ...
                // Normalize class comparison (Same as before)
                const myClass = (userData.assignedClass || '').toString();
                const mySec = (userData.assignedSection || '').toString();
                const tClass = (targetPerson.classAssigned || '').toString();
                const tSec = (targetPerson.section || '').toString();

                if (myClass === tClass && mySec === tSec) {
                    await runCooldownCheck(28, 75);
                } else {
                    setCooldown({ active: false, daysLeft: 0, date: null });
                }
            }
            // 3. Institution -> Any (28 Days Rule)
            else if (userData.role === 'institution') {
                await runCooldownCheck(28);
            }
        };

        const runCooldownCheck = async (minDays, maxDaysWarning = 0) => {
            try {
                const q = query(
                    collection(db, "general_feedback"),
                    where("authorId", "==", userData.uid),
                    where("targetId", "==", targetPerson.id || targetPerson.uid)
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const docs = snap.docs.map(d => d.data());
                    docs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
                    const lastFeedback = docs[0];
                    const lastDate = lastFeedback.timestamp.toDate();
                    const now = new Date();
                    const diffDays = Math.floor(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));

                    if (diffDays < minDays) {
                        const nextAllowed = new Date(lastDate);
                        nextAllowed.setDate(lastDate.getDate() + minDays);
                        const dateStr = nextAllowed.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                        setCooldown({ active: true, daysLeft: minDays - diffDays, date: lastDate.toLocaleDateString(), nextDate: dateStr, type: 'block' });
                    } else if (maxDaysWarning > 0 && diffDays > maxDaysWarning) {
                        setCooldown({ active: false, daysLeft: diffDays, date: lastDate.toLocaleDateString(), type: 'warning', max: maxDaysWarning });
                    } else {
                        setCooldown({ active: false, daysLeft: 0, date: null });
                    }
                } else {
                    // Never given feedback
                    if (maxDaysWarning > 0) {
                        // technically overdue if new student? No, treating as fresh.
                        setCooldown({ active: false, daysLeft: 0, date: null, type: 'new' });
                    }
                }
            } catch (e) { console.error(e); }
        };

        checkCycle();
    }, [activeTab, userData, targetPerson]);

    // Fetch Received Feedback (Emergency Fuzzy Search)
    useEffect(() => {
        if (activeTab === 'read' && userData?.uid) {
            const fetchFeedback = async () => {
                setLoading(true);
                try {
                    // 1. Calculate My Aliases/IDs
                    const myIds = new Set([userData.uid]);

                    // Fetch linked allotments to get IDs/Names
                    if (userData.role === 'teacher' || userData.role === 'student') {
                        try {
                            const col = userData.role === 'teacher' ? 'teacher_allotments' : 'student_allotments';
                            // Linked
                            const fieldId = userData.role === 'teacher' ? 'teacherId' : 'studentId';
                            const qAllot = query(collection(db, col), where(fieldId, "==", userData.uid));
                            const allotSnap = await getDocs(qAllot);
                            allotSnap.forEach(d => myIds.add(d.id));

                            // Try to find Name-based allotments too
                            if (userData.name) {
                                const fieldName = userData.role === 'teacher' ? 'teacherName' : 'studentName';
                                const qAllotName = query(collection(db, col), where(fieldName, "==", userData.name));
                                const allotSnapName = await getDocs(qAllotName);
                                allotSnapName.forEach(d => myIds.add(d.id));
                            }
                        } catch (e) { console.error("Failed to fetch allotment aliases:", e); }
                    }

                    // 2. EMERGENCY FETCH: Get last 100 feedbacks globally and filter client-side
                    // This bypasses specific query limitations to find "Near Matches"
                    const qGlobal = query(collection(db, "general_feedback"), orderBy("timestamp", "desc"), limit(100));
                    const snapGlobal = await getDocs(qGlobal);

                    const filtered = snapGlobal.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => {
                        // Strict ID Check
                        if (myIds.has(item.targetId)) return true;

                        // Name Check (Loose)
                        if (item.targetName && userData.name) {
                            const tName = item.targetName.toLowerCase().trim();
                            const uName = userData.name.toLowerCase().trim();
                            // Exact
                            if (tName === uName) return true;
                            // Partial
                            if (tName.includes(uName) || uName.includes(tName)) return true;
                            // Token Match
                            const tTokens = tName.split(' ');
                            if (tTokens.some(t => uName.includes(t) && t.length > 3)) return true;
                        }
                        return false;
                    });

                    setReceivedFeedback(filtered);
                } catch (e) {
                    console.error("Error fetching feedback:", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchFeedback();
        }
    }, [activeTab, userData]);

    const handleDropdown = (category, val) => {
        setRatings(prev => ({ ...prev, [category]: { ...prev[category], dropdown: val } }));
    };

    const handleStars = (category, val) => {
        setRatings(prev => ({ ...prev, [category]: { ...prev[category], stars: val } }));
    };

    const handleSubmit = async () => {
        if (!targetPerson) return alert("No target selected.");

        // Validation
        const r = ratings;
        if (!r.behavior.dropdown || !r.behavior.stars ||
            !r.communication.dropdown || !r.communication.stars ||
            !r.bodyLanguage.dropdown || !r.bodyLanguage.stars ||
            !r.hardworking.dropdown || !r.hardworking.stars) {
            return alert("Please fill all ratings (Stars & Options).");
        }

        // Fix Empty/Spam comments
        const cleanComment = comment.trim();
        if (cleanComment.length > 0 && cleanComment.length < 5) {
            return alert("Please provide a more detailed comment (min 5 chars) or leave it empty.");
        }
        // If they left it strictly empty, maybe that is allowed? 
        // The AI report said "Logging Noise.. content 'No text'". 
        // If the backend logs "No text" when empty, that's fine, but user submissions with just "  " should be blocked.
        if (cleanComment.length === 0 && comment.length > 0) {
            return alert("Comment cannot be just spaces.");
        }

        setLoading(true);
        try {
            // Generate UPID for Student (or use existing behavior for others)
            let finalPid = userData.pid || 'Anonymous';
            let isAnonymousSubmission = false;

            // Logic: Higher Authorities ALWAYS reveal name. Students can choose.
            // Requirement: "submit by a upid... linked to student id... list of previous upids"
            // This implies we generate a NEW UPID for this submission if it is anonymous/student.

            if (userData.role === 'student' && !revealName) {
                // Generate a Random 4-char hex string
                const randomPart = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
                finalPid = `UPID-${randomPart}`;
                isAnonymousSubmission = true;
            } else if (revealName) {
                finalPid = null; // Will show Name
            }

            // 1. Submit Feedback
            await addDoc(collection(db, "general_feedback"), {
                authorId: userData.uid,
                authorPid: finalPid, // Now uses the generated UPID
                authorName: userData.name,
                authorRole: userData.role,
                targetId: targetPerson.id || targetPerson.uid,
                targetName: targetPerson.name,
                targetRole: targetPerson.type || 'User',
                behavior: r.behavior,
                communication: r.communication,
                bodyLanguage: r.bodyLanguage,
                hardworking: r.hardworking,
                comment,
                timestamp: serverTimestamp()
            });

            // 2. If it was a Generated UPID, save to Student History
            if (isAnonymousSubmission && userData.role === 'student') {
                try {
                    const userRef = doc(db, "users", userData.uid);
                    await updateDoc(userRef, {
                        upidHistory: arrayUnion({
                            upid: finalPid,
                            target: targetPerson.name,
                            date: new Date() // Client timestamp for history display
                        })
                    });
                } catch (histErr) {
                    console.error("Failed to update UPID history", histErr);
                }
            }

            alert("Feedback Submitted Successfully!" + (isAnonymousSubmission ? `\nYour Private ID: ${finalPid}` : ""));
            navigate(-1);
        } catch (e) {
            console.error(e);
            alert("Error submitting feedback.");
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { key: 'behavior', label: 'Behavior', icon: '🤝' },
        { key: 'communication', label: 'Communication', icon: '🗣️' },
        { key: 'bodyLanguage', label: 'Body Language', icon: '🕺' },
        { key: 'hardworking', label: 'Hard Working', icon: '🚀' }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
            padding: '40px 20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                <button
                    onClick={() => navigate(-1)}
                    className="btn-back-marker"
                >
                    Back
                </button>
            </div>

            <div style={{
                maxWidth: '650px',
                margin: '0 auto',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative background blob */}
                <div style={{
                    position: 'absolute', top: '-50px', right: '-50px',
                    width: '150px', height: '150px', background: '#4facfe',
                    borderRadius: '50%', filter: 'blur(60px)', opacity: '0.4'
                }}></div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: '#f0f2f5', padding: '5px', borderRadius: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveTab('read')}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                            background: activeTab === 'read' ? 'white' : 'transparent',
                            boxShadow: activeTab === 'read' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'read' ? '#0984e3' : '#636e72',
                            minWidth: '150px'
                        }}
                    >
                        📩 Received Feedback
                    </button>
                    <button
                        onClick={() => setActiveTab('write')}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                            background: activeTab === 'write' ? 'white' : 'transparent',
                            boxShadow: activeTab === 'write' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'write' ? '#0984e3' : '#636e72',
                            minWidth: '150px'
                        }}
                    >
                        📝 Give Feedback
                    </button>
                    <button
                        onClick={() => navigate('/report-misbehavior', { state: { target: targetPerson } })}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                            background: '#1ef031',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            fontWeight: 'bold', cursor: 'pointer', color: 'white',
                            minWidth: '150px'
                        }}
                    >
                        ⚠️ Misbehavior
                    </button>
                    <button
                        onClick={() => navigate('/report-harassment', { state: { target: targetPerson } })}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                            background: '#d63031',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            fontWeight: 'bold', cursor: 'pointer', color: 'white',
                            minWidth: '150px'
                        }}
                    >
                        🚨 Sexual Harassment
                    </button>
                </div>

                {activeTab === 'write' ? (
                    targetPerson ? (
                        <>
                            <div className="text-center" style={{ marginBottom: '40px', position: 'relative' }}>
                                <div style={{ fontSize: '60px', marginBottom: '10px' }}>🌟</div>
                                <h2 style={{
                                    background: targetPerson.type === 'Institution' ? 'none' : 'linear-gradient(to right, #00f2fe, #4facfe)',
                                    color: targetPerson.type === 'Institution' ? '#d63031' : 'inherit',
                                    WebkitBackgroundClip: targetPerson.type === 'Institution' ? 'unset' : 'text',
                                    WebkitTextFillColor: targetPerson.type === 'Institution' ? 'unset' : 'transparent',
                                    margin: '0', fontSize: '28px', fontWeight: '800'
                                }}>
                                    Feedback for {targetPerson.name}
                                </h2>
                                <p style={{ color: '#888', marginTop: '5px' }}>Help us improve by rating honestly</p>
                            </div>

                            {/* Cooldown / Status Block */}
                            {cooldown.active && cooldown.type === 'block' ? (
                                <div className="card text-center" style={{ padding: '40px', background: '#fff0f0', border: '1px solid #fab1a0' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
                                    <h3 style={{ color: '#d63031' }}>Feedback Cycle Active</h3>
                                    <p style={{ color: '#636e72', marginBottom: '20px' }}>
                                        You can submit your next feedback on:<br />
                                        <strong style={{ fontSize: '1.2rem', color: '#2d3436' }}>{cooldown.nextDate}</strong>
                                    </p>
                                    <button className="btn" onClick={() => navigate(-1)}>Go Back</button>
                                </div>
                            ) : (
                                <>
                                    {cooldown.type === 'warning' && (
                                        <div style={{ background: '#ffeaa7', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #fdcb6e', color: '#d63031', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '24px' }}>⚠️</span>
                                            <div>
                                                <strong>Feedback Overdue!</strong>
                                                <div style={{ fontSize: '13px' }}>It has been {cooldown.daysLeft} days since your last feedback. Policy requires feedback every 75 days.</div>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gap: '25px' }}>
                                        {categories.map(cat => (
                                            <div key={cat.key} style={{
                                                background: '#f8f9fa', padding: '20px', borderRadius: '16px',
                                                border: '1px solid #cbd5e0', transition: 'transform 0.2s',
                                                display: 'flex', flexDirection: 'column', gap: '15px',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <div style={{
                                                        fontSize: '30px', background: 'white', width: '60px', height: '60px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0'
                                                    }}>
                                                        {cat.icon}
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '18px', fontWeight: '700', color: '#2d3748' }}>{cat.label}</label>
                                                        <div style={{ fontSize: '12px', color: '#718096' }}>Rate their {cat.label.toLowerCase()}</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                    <select
                                                        style={{
                                                            padding: '10px 15px', borderRadius: '12px', border: '1px solid #a0aec0',
                                                            background: 'white', color: '#2d3748', fontWeight: '500', outline: 'none',
                                                            minWidth: '140px', cursor: 'pointer'
                                                        }}
                                                        value={ratings[cat.key].dropdown}
                                                        onChange={(e) => handleDropdown(cat.key, e.target.value)}
                                                    >
                                                        <option value="" disabled>Select Rating...</option>
                                                        <option>Excellent</option><option>Good</option><option>Average</option><option>Poor</option>
                                                    </select>

                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <span
                                                                key={s}
                                                                style={{
                                                                    fontSize: '28px', cursor: 'pointer',
                                                                    color: s <= ratings[cat.key].stars ? '#fbbf24' : '#e2e8f0',
                                                                    transition: 'all 0.2s', transform: s <= ratings[cat.key].stars ? 'scale(1.1)' : 'scale(1)'
                                                                }}
                                                                onClick={() => handleStars(cat.key, s)}
                                                            >★</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginTop: '30px' }}>
                                        <label style={{ fontWeight: '700', color: '#2d3748', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>📝</span> Additional Comments
                                        </label>
                                        <textarea
                                            className="input-field"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="Share any specific details or suggestions..."
                                            style={{
                                                height: '100px', resize: 'vertical', borderRadius: '16px',
                                                border: '2px solid #edf2f7', padding: '15px', background: '#f8f9fa'
                                            }}
                                        />
                                    </div>

                                    {/* Reveal Name Option */}
                                    {(userData.role === 'institution' || (userData.role === 'teacher' && targetPerson.type === 'Student')) ? (
                                        <div style={{ marginTop: '15px', color: '#636e72', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span>🔒</span>
                                            Feedback will be sent as <strong>{userData.name}</strong> (Official)
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="checkbox"
                                                id="revealName"
                                                checked={revealName}
                                                onChange={(e) => setRevealName(e.target.checked)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                            <label htmlFor="revealName" style={{ cursor: 'pointer', fontSize: '14px', color: '#2d3436' }}>
                                                Show my Name (Uncheck for Anonymous ID)
                                            </label>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        style={{
                                            width: '100%', padding: '18px', marginTop: '20px',
                                            background: 'linear-gradient(to right, #00c6fb, #005bea)',
                                            color: 'white', border: 'none', borderRadius: '16px',
                                            fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                                            boxShadow: '0 10px 20px rgba(0, 91, 234, 0.3)',
                                            transition: 'transform 0.2s, box-shadow 0.2s'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 91, 234, 0.4)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 91, 234, 0.3)'; }}
                                    >
                                        {loading ? '🚀 Sending Feedback...' : '🚀 Submit Feedback'}
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <p style={{ color: '#666', marginBottom: '20px' }}>Select a person to give feedback to.</p>
                            <button
                                className="btn"
                                onClick={() => navigate('/select-feedback-target')}
                                style={{ background: '#0984e3', color: 'white' }}
                            >
                                🔍 Find Person
                            </button>
                        </div>
                    )
                ) : (
                    // READ MODE
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {receivedFeedback.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                                No feedback received yet. 📭
                            </div>
                        ) : (
                            receivedFeedback.map(f => (
                                <div key={f.id} style={{
                                    background: 'white', padding: '20px', borderRadius: '16px',
                                    border: '1px solid #e1e8ed', boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#2d3436' }}>
                                            From: {f.authorPid || f.authorName} ({f.authorRole})
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#b2bec3' }}>
                                            {f.timestamp?.toDate().toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {Object.keys(f).filter(k => ['behavior', 'communication', 'bodyLanguage', 'hardworking'].includes(k)).map(k => (
                                            <div key={k} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                                                <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {f[k].stars}★ ({f[k].dropdown})
                                            </div>
                                        ))}
                                    </div>
                                    {f.comment && (
                                        <div style={{ marginTop: '15px', background: '#ffeaa7', padding: '10px', borderRadius: '8px', fontSize: '14px', color: '#d63031' }}>
                                            💬 "{f.comment}"
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
