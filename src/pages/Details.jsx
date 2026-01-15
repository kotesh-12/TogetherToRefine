import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Details() {
    const navigate = useNavigate();
    const location = useLocation();

    // Check if role was passed from Login/Signup page (PRIORITY)
    const passedRole = location.state?.role;

    const [role, setRole] = useState(passedRole || '');
    const [institutions, setInstitutions] = useState([]);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);

                // If we received a role from Login page, trust it and skip DB check
                if (passedRole) {
                    setRole(passedRole);
                    setLoading(false);
                    return;
                }

                // Try to get role from Firestore if not in local state
                try {
                    // Check 'users' (Student)
                    let userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setRole(userDoc.data().role);
                        setFormData(userDoc.data());
                    } else {
                        // Check 'teachers'
                        userDoc = await getDoc(doc(db, "teachers", user.uid));
                        if (userDoc.exists()) {
                            setRole('teacher');
                            setFormData(userDoc.data());
                        } else {
                            // Check 'institutions'
                            userDoc = await getDoc(doc(db, "institutions", user.uid));
                            if (userDoc.exists()) {
                                setRole('institution');
                                setFormData(userDoc.data());
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching role: ", e);
                }
            } else {
                // Return to login if not authenticated
                navigate('/');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    // Load institutions
    useEffect(() => {
        if (role === 'student' || role === 'teacher') {
            const fetchInstitutions = async () => {
                try {
                    // Fetch from 'institutions' collection
                    const querySnapshot = await getDocs(collection(db, "institutions"));
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
        console.log("Submitting form...", formData);

        if (!userId) {
            alert("User ID missing. Please login again.");
            return;
        }

        try {
            // Cleanup: If we are saving as Teacher or Institution, ensure we don't have a record in 'users' that blocks correct login
            if (role === 'teacher' || role === 'institution') {
                try {
                    await deleteDoc(doc(db, "users", userId));
                    console.log("Cleaned up potential stale user record.");
                } catch (cleanupErr) {
                    console.warn("Cleanup warning:", cleanupErr);
                }
            }

            // Save extra details to Firestore
            const collectionName = role === 'institution' ? 'institutions' : (role === 'teacher' ? 'teachers' : 'users');

            // Ensure we merge with existing data, and set profileCompleted
            // Generate PID if doesn't exist (e.g. Google Sign Up or First Time)
            let finalPid = formData.pid;
            if (!finalPid) {
                const prefix = role === 'student' ? 'ST' : (role === 'teacher' ? 'TE' : 'IN');
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                finalPid = `${prefix}-${randomNum}`;
                console.log("Generated New PID:", finalPid);
            }

            await setDoc(doc(db, collectionName, userId), {
                ...formData,
                pid: finalPid,
                profileCompleted: true,
                updatedAt: new Date()
            }, { merge: true });

            // Logic for Student/Teacher admissions
            if ((role === 'student' || role === 'teacher')) {
                // If Institution is selected, add to their lists
                if (formData.institutionId) {
                    const instRef = doc(db, "institutions", formData.institutionId);
                    const instSnap = await getDoc(instRef);
                    const instName = instSnap.exists() ? (instSnap.data().schoolName || instSnap.data().name) : "Unknown Institution";

                    // Update user's own doc with Institution Name and SET STATUS TO PENDING (not approved)
                    await setDoc(doc(db, collectionName, userId), {
                        institutionName: instName,
                        approved: false // User cannot access dashboard yet
                    }, { merge: true });

                    // Add to Admissions (Waiting List)
                    await addDoc(collection(db, "admissions"), {
                        name: `${formData.firstName} ${formData.secondName}`,
                        role: role,
                        // Calculate Age or Subject
                        [role === 'teacher' ? 'subject' : 'age']: role === 'teacher' ?
                            (formData.subject || 'General') :
                            (formData.dob && !isNaN(new Date(formData.dob).getTime()) ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : 'N/A'),
                        class: formData.class || '',
                        institutionId: formData.institutionId,
                        institutionName: instName,
                        userId: userId,
                        status: 'waiting',
                        joinedAt: new Date()
                    });

                    // Redirect to Pending page
                    navigate('/pending-approval');
                    return;
                } else {
                    // If no institution selected (e.g. independent), approve immediately?
                    // Currently required field, but safe fallback:
                    await setDoc(doc(db, collectionName, userId), { approved: true }, { merge: true });
                }
            } else {
                // Institution role is auto-approved for now (or different flow)
                await setDoc(doc(db, collectionName, userId), { approved: true }, { merge: true });
            }

            console.log("Submission successful, redirecting...");

            // Redirect
            if (role === "student") navigate('/student');
            else if (role === "teacher") navigate('/teacher');
            else if (role === "institution") navigate('/institution');
            else navigate('/');

        } catch (err) {
            console.error("Submission Error:", err);
            alert("Error saving details: " + err.message);
        }
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <header className="details-header">
                {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Profile Setup` : 'Complete Your Profile'}
            </header>

            <div className="card details-card">
                <form onSubmit={handleSubmit}>

                    {/* Role Status and Change Option */}
                    <div className="role-status-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span><strong>Role:</strong> {role ? role.toUpperCase() : 'NOT SELECTED'}</span>
                            {(!role || true) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRole('');
                                        setFormData({}); // Clear form data to prevent mixups
                                    }}
                                    className="change-role-button"
                                    style={{ marginLeft: '10px', fontSize: '12px', padding: '5px 10px' }}
                                >
                                    Change Role ✎
                                </button>
                            )}
                        </div>
                    </div>


                    {/* Fallback Role Selection if not detected */}
                    {!role && (
                        <div className="form-group fallback-role-box">
                            <label className="warning-label">⚠️ Please select your role to continue:</label>
                            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field" required>
                                <option value="">-- Select Role --</option>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="institution">Institution</option>
                            </select>
                        </div>
                    )}

                    {/* Teacher Fields */}
                    {role === 'teacher' && (
                        <div className="form-group">
                            <h3 style={{ borderBottom: '2px solid #0984e3', paddingBottom: '5px', marginBottom: '15px', color: '#0984e3' }}>👨‍🏫 Teacher Details</h3>

                            <label>First Name</label>
                            <input name="firstName" value={formData.firstName || ''} className="input-field" required onChange={handleChange} />

                            <label>Second Name</label>
                            <input name="secondName" value={formData.secondName || ''} className="input-field" required onChange={handleChange} />

                            <label>Subject Specialization</label>
                            <input name="subject" value={formData.subject || ''} className="input-field" placeholder="e.g. Mathematics, Science" required onChange={handleChange} />

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
                            <select name="institutionId" value={formData.institutionId || ''} className="input-field" required onChange={handleChange}>
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
                                {['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <label style={{ color: '#d63031', fontWeight: 'bold', marginTop: '15px' }}>Apply to School/Institution:</label>
                            {institutions.length === 0 && <p style={{ color: 'red', fontSize: '12px' }}>No registered institutions found. You cannot submit without selecting one.</p>}
                            <select name="institutionId" value={formData.institutionId || ''} className="input-field" required onChange={handleChange}>
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

                            <label className="text-muted">Chairman Profile Link</label>
                            <input type="url" name="chairmanLink" value={formData.chairmanLink || ''} className="input-field" onChange={handleChange} />

                            <label className="text-muted">Principal Profile Link</label>
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
                        <button type="submit" className="btn submit-button">Submit Details</button>
                    </div>

                </form>

                {/* Debug Info */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #ddd', paddingTop: '10px', fontSize: '11px', color: '#999' }}>
                    <strong>Debug Info:</strong><br />
                    UID: {userId || '...'}<br />
                    Current Role State: {role || 'None'}<br />
                    Collection Found: {role === 'teacher' ? 'Teachers' : (role === 'institution' ? 'Institutions' : 'Users/None')}
                </div>
            </div>
        </div>
    );
}
