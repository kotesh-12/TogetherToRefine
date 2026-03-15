import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useUser } from '../context/UserContext';

export default function Details() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setUserData } = useUser();

    // Check if role was passed from Login/Signup page (PRIORITY)
    const passedRole = location.state?.role;

    const [role, setRole] = useState(passedRole || '');
    const [institutions, setInstitutions] = useState([]);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRoleLocked, setIsRoleLocked] = useState(false);

    // Form states
    const [formData, setFormData] = useState({});
    const [initialData, setInitialData] = useState({}); // To detecting changes

    const handleBack = async () => {
        // If it's a new user setting up for the first time, Back means Logout/Cancel to avoid redirect loops
        if (!initialData || Object.keys(initialData).length === 0) {
            await signOut(auth);
            navigate('/');
        } else {
            // If editing existing profile, just go back
            navigate(-1);
        }
    };

    // DATA PROPAGATION HELPER (DML-like Cascading Update)
    const propagateUserUpdates = async (uid, userRole, newName, newSubject = null) => {
        console.log(`🔄 Propagating updates for ${userRole}: ${newName} ${newSubject ? `(Subject: ${newSubject})` : ''}`);
        const promises = [];

        try {
            // 1. Update Admissions (Student/Teacher)
            if (userRole === 'student' || userRole === 'teacher') {
                const q = query(collection(db, "admissions"), where("userId", "==", uid));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const updates = { name: newName };
                    if (userRole === 'teacher' && newSubject) updates.subject = newSubject;
                    promises.push(updateDoc(d.ref, updates));
                });
            }

            // 2. Update Student Allotments (Student only)
            if (userRole === 'student') {
                const q = query(collection(db, "student_allotments"), where("userId", "==", uid));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    promises.push(updateDoc(d.ref, { name: newName, studentName: newName }));
                });
            }

            // 3. Update Teacher Allotments & Groups (Teacher only)
            if (userRole === 'teacher') {
                // Update Allotments
                const q = query(collection(db, "teacher_allotments"), where("userId", "==", uid));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const updates = { name: newName, teacherName: newName };
                    if (newSubject) updates.subject = newSubject;
                    promises.push(updateDoc(d.ref, updates));
                });

                // Update 'groups' metadata where this teacher is the owner/teacher
                // Note: Groups usually link by teacherId
                const qGroup = query(collection(db, "groups"), where("teacherId", "==", uid));
                const snapGroup = await getDocs(qGroup);
                snapGroup.forEach(d => {
                    const updates = { teacherName: newName };
                    if (newSubject) updates.subject = newSubject;
                    promises.push(updateDoc(d.ref, updates));
                });
            }

            // 4. Institution Name Propagation
            if (userRole === 'institution') {
                // Update Students/Teachers linked to this Institution
                const q = query(collection(db, "users"), where("institutionId", "==", uid));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    promises.push(updateDoc(d.ref, { institutionName: newName }));
                });
                const q2 = query(collection(db, "teachers"), where("institutionId", "==", uid));
                const snap2 = await getDocs(q2);
                snap2.forEach(d => {
                    promises.push(updateDoc(d.ref, { institutionName: newName }));
                });

                // Update Admissions linked to this Inst
                const q3 = query(collection(db, "admissions"), where("institutionId", "==", uid));
                const snap3 = await getDocs(q3);
                snap3.forEach(d => {
                    promises.push(updateDoc(d.ref, { institutionName: newName }));
                });
            }

            if (promises.length > 0) {
                await Promise.all(promises);
                console.log(`✅ Updated ${promises.length} related documents.`);
            }
        } catch (e) {
            console.error("Propagation Error:", e);
        }
    };

    useEffect(() => {
        if (userLoading) return;

        if (user) {
            setUserId(user.uid);
            // Profile fetching logic
            const loadProfile = async () => {
                try {
                    if (passedRole) {
                        setRole(passedRole);
                        setIsRoleLocked(true);

                        const colName = passedRole === 'institution' ? 'institutions' : (passedRole === 'teacher' ? 'teachers' : 'users');
                        const userDoc = await getDoc(doc(db, colName, user.uid));
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            setFormData(data);
                            setInitialData(data);
                            // Also update local UserContext if needed
                            setUserData(data);
                        }
                    } else {
                        // Try to find profile in ANY collection
                        let userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            setRole('student');
                            setFormData(data);
                            setInitialData(data);
                            setIsRoleLocked(true);
                            setUserData(data);
                        } else {
                            userDoc = await getDoc(doc(db, "teachers", user.uid));
                            if (userDoc.exists()) {
                                const data = userDoc.data();
                                setRole('teacher');
                                setFormData(data);
                                setInitialData(data);
                                setIsRoleLocked(true);
                                setUserData(data);
                            } else {
                                userDoc = await getDoc(doc(db, "institutions", user.uid));
                                if (userDoc.exists()) {
                                    const data = userDoc.data();
                                    setRole('institution');
                                    setFormData(data);
                                    setInitialData(data);
                                    setIsRoleLocked(true);
                                    setUserData(data);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching profile:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadProfile();
        } else {
            // Only navigate home if we are SURE there is no user
            if (!userLoading) navigate('/');
        }
    }, [user, userLoading, passedRole, navigate]);

    // Load institutions
    useEffect(() => {
        if (role === 'student' || role === 'teacher') {
            const fetchInstitutions = async () => {
                try {
                    // Fetch only APPROVED institutions
                    const q = query(collection(db, "institutions"), where("approved", "==", true));
                    const querySnapshot = await getDocs(q);
                    const list = [];
                    querySnapshot.forEach((doc) => {
                        list.push({ id: doc.id, ...doc.data() });
                    });

                    console.log("Institutions loaded:", list);
                    setInstitutions(list);
                } catch (error) {
                    console.error("Failed to load institutions", error);
                }
            };
            fetchInstitutions();
        }
    }, [role]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; // Prevent double submission
        setLoading(true);
        console.log("Submitting form...", formData);

        if (!userId) {
            alert("User ID missing. Please login again.");
            return;
        }

        // STRICT VALIDATION
        if (!role) {
            alert("Please select a role.");
            return;
        }

        // REQUIRED FIELDS CHECK
        if ((role === 'student' || role === 'teacher') && !formData.institutionId) {
            alert("⚠️ Please select a School/Institution.");
            return;
        }

        if (role === 'student') {
            if (!formData.firstName || !formData.class || !formData.dob) return alert("Please fill Name, Class, DOB.");
        } else if (role === 'teacher') {
            if (!formData.firstName || !formData.subject) return alert("Please fill Name, Subject.");
        } else if (role === 'institution') {
            if (!formData.schoolName || !formData.phoneNumber) return alert("Please fill School Name, Phone.");
        }

        // --- UX LOGIC: DETECT MAJOR CHANGES ---
        // Major changes require Re-Approval (Status: Pending)
        // Minor changes (Name, Phone, etc) are instant updates.

        let isMajorUpdate = false;

        // 1. New User (No initial data) -> Always Major
        if (!initialData || Object.keys(initialData).length === 0) {
            isMajorUpdate = true;
        } else {
            // 2. Existing User -> Check specific fields
            // If Not Approved, allow changes freely (correction mode)
            // If Approved, changing Institution is Major. Class changes safely update.
            const isApproved = initialData.approved === true;

            if (role === 'student' || role === 'teacher') {
                if (isApproved) {
                    if (String(formData.institutionId) !== String(initialData.institutionId)) {
                        isMajorUpdate = true;
                    }
                } else {
                    isMajorUpdate = true;
                }
            }

            // Note: If ROLE changed, it's major, but role is usually locked or handled by separate flow.
            if (role !== initialData.role && initialData.role) isMajorUpdate = true;
        }

        // Allow Institution Admins to update freely? Yes, usually self-managed.
        // BUT for initial setup, we force check.
        if (role === 'institution' && (!initialData || !initialData.approved)) isMajorUpdate = true;

        try {
            // Cleanup stale collections if role changed (rare)
            if ((role === 'teacher' || role === 'institution') && initialData && initialData.role !== role) {
                try { await deleteDoc(doc(db, "users", userId)); } catch (e) { console.error("Failed to cleanup old user doc:", e); }
            }

            const collectionName = role === 'institution' ? 'institutions' : (role === 'teacher' ? 'teachers' : 'users');

            // Format Name
            const newDisplayName = role === 'institution' ? formData.schoolName : `${formData.firstName} ${formData.secondName}`;

            // Generate PID if new
            let finalPid = formData.pid;
            if (!finalPid) {
                const prefix = role === 'student' ? 'ST' : (role === 'teacher' ? 'TE' : 'IN');
                finalPid = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
            }

            // --- CASE 1: SAFE UPDATE (Minor Changes) ---
            if (!isMajorUpdate) {
                console.log("✅ Safe Update Detected. Updating profile without resetting approval.");
                await setDoc(doc(db, collectionName, userId), {
                    ...formData,
                    role: role, // Ensure role is saved
                    name: newDisplayName,
                    pid: finalPid,
                    profileCompleted: true,
                    updatedAt: new Date()
                    // DO NOT TOUCH 'approved' or 'institutionName' (unless inst changed which is major)
                }, { merge: true });

                // Propagate Name Changes
                await propagateUserUpdates(userId, role, newDisplayName, formData.subject);

                // Optimistic UI
                setUserData(prev => ({ ...prev, ...formData, name: newDisplayName }));

                alert("Profile Updated Successfully! ✅");

                // Explicitly navigate to dashboard based on role to avoid redirect loops
                const dashboardPath = role === 'student' ? '/student' : (role === 'teacher' ? '/teacher' : (role === 'institution' ? '/institution' : '/'));
                navigate(dashboardPath, { replace: true });
                return;
            }

            // --- CASE 2: MAJOR UPDATE (Approval Required) ---
            console.log("⚠️ Major Update Detected.");

            if (role === 'student' || role === 'teacher') {
                const instRef = doc(db, "institutions", formData.institutionId);
                const instSnap = await getDoc(instRef);
                const instName = instSnap.exists() ? (instSnap.data().schoolName || instSnap.data().name) : "Unknown Institution";

                // ── SMART ADMISSION BYPASS ────────────────────────────────────────────
                // If the account was created by the institution (isInstitutionCreated),
                // the institution already allotted them. Skip pending-approval entirely.
                // Flow: Login → Details → Onboarding → Dashboard ✅
                const isSmartAdmission = initialData?.isInstitutionCreated === true || formData?.isInstitutionCreated === true;

                if (isSmartAdmission) {
                    console.log("✅ Smart Admission: bypassing pending-approval, going straight to dashboard");
                    // ATOMIC write: approved + profileCompleted + onboardingCompleted all in one
                    // This prevents ProtectedRoute from blocking with stale context
                    await setDoc(doc(db, collectionName, userId), {
                        ...formData,
                        role: role,
                        name: newDisplayName,
                        pid: finalPid,
                        profileCompleted: true,
                        onboardingCompleted: true, // Skip onboarding for Smart Admission
                        institutionName: instName,
                        approved: true, // Institution created = already approved
                        updatedAt: new Date()
                    }, { merge: true });

                    // Update the pre-existing admission record to 'allotted'
                    try {
                        const qAdm = query(
                            collection(db, "admissions"),
                            where("userId", "==", userId),
                            where("status", "==", "waiting")
                        );
                        const admSnap = await getDocs(qAdm);
                        const updatePromises = [];
                        admSnap.forEach((admDoc) => {
                            updatePromises.push(updateDoc(admDoc.ref, { status: 'allotted', allottedAt: new Date() }));
                        });
                        await Promise.all(updatePromises);
                    } catch (e) { /* non-critical */ }

                    // Update sessionStorage cache
                    try {
                        const existingCache = sessionStorage.getItem('user_profile_cache');
                        if (existingCache) {
                            const parsed = JSON.parse(existingCache);
                            sessionStorage.setItem('user_profile_cache', JSON.stringify({
                                ...parsed,
                                approved: true,
                                profileCompleted: true,
                                onboardingCompleted: true
                            }));
                        }
                    } catch (e) { /* ignore */ }

                    // Update context AND navigate to dashboard directly
                    setUserData(prev => ({
                        ...prev,
                        approved: true,
                        profileCompleted: true,
                        onboardingCompleted: true
                    }));

                    // Go straight to dashboard — no intermediate pages
                    const dashboardPath = role === 'student' ? '/student'
                        : role === 'teacher' ? '/teacher'
                            : '/student';
                    navigate(dashboardPath, { replace: true });
                    return;
                }
                // ─────────────────────────────────────────────────────────────────────

                // NORMAL flow: self-created student/teacher needs institution approval
                // 1. ATOMIC Write: profileCompleted + approved:false in ONE call
                await setDoc(doc(db, collectionName, userId), {
                    ...formData,
                    role: role,
                    name: newDisplayName,
                    pid: finalPid,
                    profileCompleted: true,
                    institutionName: instName,
                    approved: false,
                    updatedAt: new Date()
                }, { merge: true });

                // 2. Create Admission Record (no duplicate)
                try {
                    const qAdmissions = query(
                        collection(db, "admissions"),
                        where("userId", "==", userId),
                        where("status", "==", "waiting")
                    );
                    const snapAdmissions = await getDocs(qAdmissions);

                    if (!snapAdmissions.empty) {
                        console.log("Admission request already exists, skipping creation");
                    } else {
                        await addDoc(collection(db, "admissions"), {
                            name: newDisplayName,
                            role: role,
                            [role === 'teacher' ? 'subject' : 'age']: role === 'teacher' ? (formData.subject || 'General') : (formData.dob ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : 'N/A'),
                            dob: formData.dob || null,
                            class: formData.class || '',
                            institutionId: formData.institutionId,
                            institutionName: instName,
                            userId: userId,
                            status: 'waiting',
                            joinedAt: new Date()
                        });
                    }
                } catch (admissionErr) {
                    console.error("Failed to manage admissions:", admissionErr);
                }

                // 3. Update cache with approved:false and redirect
                try {
                    const existingCache = sessionStorage.getItem('user_profile_cache');
                    if (existingCache) {
                        const parsed = JSON.parse(existingCache);
                        sessionStorage.setItem('user_profile_cache', JSON.stringify({ ...parsed, approved: false, profileCompleted: true }));
                    }
                } catch (e) { /* ignore cache errors */ }
                setUserData(prev => ({ ...prev, approved: false, profileCompleted: true }));
                navigate('/pending-approval', { replace: true });
                return;
            } else if (role === 'institution') {
                // Institution first-time setup
                await setDoc(doc(db, "institutions", userId), {
                    ...formData,
                    role: role,
                    name: newDisplayName,
                    pid: finalPid,
                    profileCompleted: true,
                    approved: false,
                    updatedAt: new Date()
                }, { merge: true });

                try {
                    const existingCache = sessionStorage.getItem('user_profile_cache');
                    if (existingCache) {
                        const parsed = JSON.parse(existingCache);
                        sessionStorage.setItem('user_profile_cache', JSON.stringify({ ...parsed, approved: false, profileCompleted: true }));
                    }
                } catch (e) { /* ignore cache errors */ }
                setUserData(prev => ({ ...prev, approved: false, profileCompleted: true }));
                navigate('/pending-approval', { replace: true });
                return;
            }

        } catch (err) {
            console.error("Submission Error:", err);
            alert("Error saving: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: '50px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p>Loading Profile...</p>
                <button
                    onClick={() => {
                        import('../firebase').then(({ auth }) => {
                            auth.signOut();
                            sessionStorage.clear();
                            window.location.href = '/';
                        });
                    }}
                    style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}
                >
                    Stuck? Click to Reset
                </button>
            </div>
        );
    }

    return (
        <div className="container">
            <button
                onClick={handleBack}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#6c5ce7',
                    fontWeight: 'bold',
                    marginBottom: '10px'
                }}
            >
                ← Back
            </button>
            <header className="details-header">
                {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Profile Setup` : 'Complete Your Profile'}
            </header>

            <div className="card details-card">
                <form onSubmit={handleSubmit}>

                    {/* 1. ROLE SELECTION (Show ONLY if role is not set) */}
                    {!role && (
                        <div className="form-group fallback-role-box" style={{ background: '#fff3cd', padding: '20px', borderRadius: '10px', border: '1px solid #ffeeba' }}>
                            <h3 style={{ marginTop: 0, color: '#856404' }}>Welcome! Please select your path:</h3>
                            <p style={{ fontSize: '14px', color: '#856404' }}>To customize your profile, we need to know who you are.</p>

                            <label className="warning-label" style={{ display: 'block', marginBottom: '10px' }}>I am a:</label>
                            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field" style={{ fontSize: '16px', padding: '10px' }} required>
                                <option value="">-- Choose Your Role --</option>
                                <option value="student">👨‍🎓 Student</option>
                                <option value="teacher">👩‍🏫 Teacher</option>
                                <option value="institution">🏫 Institution / School</option>
                            </select>
                        </div>
                    )}

                    {/* 2. FORM FIELDS (Show ONLY if role is set) */}
                    {role && (
                        <div className="role-specific-form fade-in">
                            <div className="role-status-box" style={{ marginBottom: '20px', padding: '10px', background: '#e2e6ea', borderRadius: '5px' }}>
                                <strong>Selected Role:</strong> {role.toUpperCase()}
                                <span onClick={() => { if (!passedRole && !initialData.isInstitutionCreated) setRole(''); }} style={{ float: 'right', cursor: 'pointer', color: 'blue', fontSize: '12px', textDecoration: 'underline' }}>
                                    {(!passedRole && !initialData.isInstitutionCreated) && "(Change)"}
                                </span>
                            </div>

                            {/* Teacher Fields */}
                            {role === 'teacher' && (
                                <div className="form-group">
                                    <h3 style={{ borderBottom: '2px solid #0984e3', paddingBottom: '5px', marginBottom: '15px', color: '#0984e3' }}>👨‍🏫 Teacher Details</h3>

                                    <label>First Name</label>
                                    <input name="firstName" value={formData.firstName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Second Name</label>
                                    <input name="secondName" value={formData.secondName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Subject Specialization</label>
                                    <input
                                        name="subject"
                                        value={formData.subject || ''}
                                        className="input-field"
                                        placeholder="e.g. Mathematics, Science"
                                        required
                                        onChange={handleChange}
                                    // Subject is now editable by Teacher
                                    />
                                    {/* <p style={{ fontSize: '11px', color: '#d63031', marginTop: '-5px' }}>* Subject is assigned by Institution</p> */}

                                    <label>Gender</label>
                                    <select name="gender" value={formData.gender || ''} className="input-field" onChange={handleChange}>
                                        <option value="" disabled>Select Gender</option>
                                        <option>Male</option><option>Female</option><option>Other</option>
                                    </select>

                                    <label>Age (Date of Birth)</label>
                                    <input type="date" name="dob" value={formData.dob || ''} className="input-field" required onChange={handleChange} />

                                    <label className="text-muted">Experience</label>
                                    <div className="experience-container">
                                        <select name="expYears" value={formData.expYears || '0 Years'} className="input-field" onChange={handleChange}>
                                            <option>0 Years</option><option>1 Year</option><option>2 Years</option><option>3 Years</option><option>4 Years</option><option>5+ Years</option>
                                        </select>
                                        <select name="expMonths" value={formData.expMonths || '0 Months'} className="input-field" onChange={handleChange}>
                                            <option>0 Months</option><option>6 Months</option><option>11 Months</option>
                                        </select>
                                    </div>

                                    <label className="checkbox-label">
                                        <input type="checkbox" name="noExp" checked={formData.noExp || false} onChange={handleChange} /> No Experience
                                    </label>

                                    <label style={{ color: '#d63031', fontWeight: 'bold', marginTop: '15px' }}>Apply to School/Institution:</label>
                                    {institutions.length === 0 && <p style={{ color: 'red', fontSize: '12px' }}>No registered institutions found. You cannot submit without selecting one.</p>}
                                    <p style={{ fontSize: '12px', color: '#666', marginTop: '-5px', marginBottom: '10px' }}>Select the school you want to join. They will receive your application.</p>
                                    <select
                                        name="institutionId"
                                        value={formData.institutionId || ''}
                                        className="input-field"
                                        required
                                        onChange={handleChange}
                                        disabled={!!initialData.institutionId && initialData.approved === true} // Allow edit if NOT approved
                                    >
                                        <option value="" disabled>Select a School to Apply</option>
                                        {institutions.map(inst => (
                                            <option key={inst.id} value={inst.id}>{inst.schoolName || inst.name || "Unnamed"}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Student Fields */}
                            {role === 'student' && (
                                <div className="form-group">
                                    <h3 style={{ borderBottom: '2px solid #00b894', paddingBottom: '5px', marginBottom: '15px', color: '#00b894' }}>🎓 Student Details</h3>

                                    <label>First Name</label>
                                    <input name="firstName" value={formData.firstName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Second Name</label>
                                    <input name="secondName" value={formData.secondName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Class</label>
                                    <select name="class" value={formData.class || 'Nursery'} className="input-field" onChange={handleChange}>
                                        <option>Nursery</option>
                                        {['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>

                                    <label style={{ color: '#d63031', fontWeight: 'bold', marginTop: '15px' }}>Apply to School/Institution:</label>
                                    {institutions.length === 0 && <p style={{ color: 'red', fontSize: '12px' }}>No registered institutions found. You cannot submit without selecting one.</p>}
                                    <select
                                        name="institutionId"
                                        value={formData.institutionId || ''}
                                        className="input-field"
                                        required
                                        onChange={handleChange}
                                        disabled={!!initialData.institutionId && (initialData.approved === true || !!initialData.isInstitutionCreated)} // Allow edit if NOT approved and not inst-created
                                    >
                                        <option value="" disabled>Select a School to Apply</option>
                                        {institutions.map(inst => (
                                            <option key={inst.id} value={inst.id}>{inst.schoolName || inst.name || "Unnamed"}</option>
                                        ))}
                                    </select>

                                    <label>Gender</label>
                                    <select name="gender" value={formData.gender || ''} className="input-field" onChange={handleChange}>
                                        <option value="" disabled>Select Gender</option>
                                        <option>Male</option><option>Female</option><option>Other</option>
                                    </select>

                                    <label>Age (Date of Birth)</label>
                                    <input type="date" name="dob" value={formData.dob || ''} className="input-field" required onChange={handleChange} />

                                    <label className="text-muted">Father Name</label>
                                    <input name="fatherName" value={formData.fatherName || ''} className="input-field" onChange={handleChange} />

                                    <label className="text-muted">Mother Name</label>
                                    <input name="motherName" value={formData.motherName || ''} className="input-field" onChange={handleChange} />

                                    <label className="help-text">Parent/Guardian Phone Number (For Parent Login)</label>
                                    <input
                                        name="parentPhone"
                                        type="tel"
                                        value={formData.parentPhone || ''}
                                        className="input-field"
                                        placeholder="Use this number for Parent Login"
                                        onChange={handleChange}
                                    />

                                    <label className="text-muted">Prizes</label>
                                    <textarea name="prizes" value={formData.prizes || ''} className="input-field" placeholder="Mention prizes received, if any" onChange={handleChange}></textarea>
                                </div>
                            )}

                            {/* Institution Fields */}
                            {role === 'institution' && (
                                <div className="form-group">
                                    <h3 style={{ borderBottom: '2px solid #6c5ce7', paddingBottom: '5px', marginBottom: '15px', color: '#6c5ce7' }}>🏫 Institution Registration</h3>

                                    <label>Chairman Name</label>
                                    <input name="chairmanName" value={formData.chairmanName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Principal Name</label>
                                    <input name="principalName" value={formData.principalName || ''} className="input-field" required onChange={handleChange} />

                                    <label>School Name</label>
                                    <input name="schoolName" value={formData.schoolName || ''} className="input-field" required onChange={handleChange} />

                                    <label>Establishment Year</label>
                                    <input type="date" name="estYear" value={formData.estYear || ''} className="input-field" required onChange={handleChange} />

                                    <label className="text-muted">Chairman Profile Link <span style={{ fontSize: '12px', color: '#888' }}>(Optional)</span></label>
                                    <input type="url" name="chairmanLink" value={formData.chairmanLink || ''} className="input-field" onChange={handleChange} />

                                    <label className="text-muted">Principal Profile Link <span style={{ fontSize: '12px', color: '#888' }}>(Optional)</span></label>
                                    <input type="url" name="principalLink" value={formData.principalLink || ''} className="input-field" onChange={handleChange} />

                                    <h4 className="section-header">📞 Institution Contact Details</h4>
                                    <p className="text-muted help-text">This will be visible to students for admissions/inquiries.</p>

                                    <label>Official Phone Number</label>
                                    <input name="phoneNumber" type="tel" value={formData.phoneNumber || ''} className="input-field" placeholder="+91 9876543210" required onChange={handleChange} />

                                    <label className="checkbox-label-sm">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFormData(prev => ({ ...prev, whatsappNumber: prev.phoneNumber }));
                                                }
                                            }}
                                        />
                                        WhatsApp number is same as Phone Number
                                    </label>

                                    <label>WhatsApp Number</label>
                                    <input name="whatsappNumber" type="tel" value={formData.whatsappNumber || ''} className="input-field" placeholder="+91 9876543210" required onChange={handleChange} />

                                    <h4 className="section-header">🚑 Emergency & Safety Contacts</h4>
                                    <p className="text-muted help-text">These numbers will be shown to your students in the Report Harassment page.</p>

                                    <label>Local Police Station Name</label>
                                    <input name="localPoliceName" value={formData.localPoliceName || ''} className="input-field" placeholder="e.g. Banjara Hills PS" required onChange={handleChange} />

                                    <label>Local Police Phone Number</label>
                                    <input name="localPolicePhone" value={formData.localPolicePhone || ''} className="input-field" placeholder="e.g. 040-23456789" required onChange={handleChange} />
                                </div>
                            )}
                            <div className="submit-container">
                                <button type="submit" className="btn submit-button" disabled={loading}>
                                    {loading ? 'Processing...' : 'Submit Details'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>

                {/* Debug Info Removed for Security */}
            </div>
        </div>
    );
}
