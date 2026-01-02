import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Details() {
    const navigate = useNavigate();
    const [role, setRole] = useState('');
    const [institutions, setInstitutions] = useState([]);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                // Try to get role from Firestore if not in local state
                try {
                    let userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setRole(userDoc.data().role);
                    } else {
                        userDoc = await getDoc(doc(db, "institutions", user.uid));
                        if (userDoc.exists()) {
                            setRole('institution'); // or userDoc.data().role
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
            // Save extra details to Firestore
            const collectionName = role === 'institution' ? 'institutions' : 'users';

            // Ensure we merge with existing data, and set profileCompleted
            await setDoc(doc(db, collectionName, userId), {
                ...formData,
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

                    // Update user's own doc with Institution Name for display (as per previous Profile request)
                    await setDoc(doc(db, collectionName, userId), { institutionName: instName }, { merge: true });

                    // Add to Admissions (Waiting List)
                    await addDoc(collection(db, "admissions"), {
                        name: `${formData.firstName} ${formData.secondName}`,
                        role: role,
                        // Calculate Age or Subject
                        [role === 'teacher' ? 'subject' : 'age']: role === 'teacher' ?
                            (formData.subject || 'General') :
                            (formData.dob ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : 'N/A'),
                        class: formData.class || '',
                        institutionId: formData.institutionId,
                        institutionName: instName,
                        userId: userId,
                        status: 'waiting',
                        joinedAt: new Date()
                    });

                    // Add to Linked Users (optional, maybe redundant with Admissions but keeping for legacy compatibility)
                    await setDoc(doc(db, "institutions", formData.institutionId, "linkedUsers", userId), {
                        ...formData,
                        userId, role, status: 'pending'
                    });
                }
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
            <header style={{
                backgroundColor: '#1e90ff', color: 'white', padding: '15px',
                textAlign: 'center', fontSize: '24px', fontWeight: 'bold', borderRadius: '10px 10px 0 0'
            }}>
                Details
            </header>

            <div className="card" style={{ marginTop: '0', borderRadius: '0 0 10px 10px' }}>
                <form onSubmit={handleSubmit}>

                    {/* Fallback Role Selection if not detected */}
                    {!role && (
                        <div className="form-group" style={{ marginBottom: '20px', padding: '10px', background: '#ffeaa7', borderRadius: '5px' }}>
                            <label style={{ fontWeight: 'bold' }}>⚠️ Role not detected. Please select your role:</label>
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
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select name="expYears" value={formData.expYears || '0 Years'} className="input-field" onChange={handleChange}>
                                    <option>0 Years</option><option>1 Year</option><option>2 Years</option><option>3 Years</option><option>4 Years</option><option>5+ Years</option>
                                </select>
                                <select name="expMonths" value={formData.expMonths || '0 Months'} className="input-field" onChange={handleChange}>
                                    <option>0 Months</option><option>6 Months</option><option>11 Months</option>
                                </select>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
                                <input type="checkbox" name="noExp" checked={formData.noExp || false} onChange={handleChange} /> No Experience
                            </label>

                            <label>Select Your Institution:</label>
                            <select name="institutionId" value={formData.institutionId || ''} className="input-field" required onChange={handleChange}>
                                <option value="" disabled>Select an institution</option>
                                {institutions.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.schoolName || inst.name || "Unnamed"}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Student Fields */}
                    {role === 'student' && (
                        <div className="form-group">
                            <label>First Name</label>
                            <input name="firstName" value={formData.firstName || ''} className="input-field" required onChange={handleChange} />

                            <label>Second Name</label>
                            <input name="secondName" value={formData.secondName || ''} className="input-field" required onChange={handleChange} />

                            <label>Class</label>
                            <select name="class" value={formData.class || 'Nursery'} className="input-field" onChange={handleChange}>
                                <option>Nursery</option>
                                {['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <label>Select Your Institution:</label>
                            <select name="institutionId" value={formData.institutionId || ''} className="input-field" required onChange={handleChange}>
                                <option value="" disabled>Select an institution</option>
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

                            <h4 style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>📞 Institution Contact Details</h4>
                            <p className="text-muted" style={{ fontSize: '12px' }}>This will be visible to students for admissions/inquiries.</p>

                            <label>Official Phone Number</label>
                            <input name="phoneNumber" type="tel" value={formData.phoneNumber || ''} className="input-field" placeholder="+91 9876543210" required onChange={handleChange} />

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '5px 0' }}>
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

                            <h4 style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>🚑 Emergency & Safety Contacts</h4>
                            <p className="text-muted" style={{ fontSize: '12px' }}>These numbers will be shown to your students in the Report Harassment page.</p>

                            <label>Local Police Station Name</label>
                            <input name="localPoliceName" value={formData.localPoliceName || ''} className="input-field" placeholder="e.g. Banjara Hills PS" required onChange={handleChange} />

                            <label>Local Police Phone Number</label>
                            <input name="localPolicePhone" value={formData.localPolicePhone || ''} className="input-field" placeholder="e.g. 040-23456789" required onChange={handleChange} />
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                        <button type="submit" className="btn" style={{ flex: 1, backgroundColor: '#2ecc71', color: 'white' }}>Submit Details</button>
                    </div>

                </form>
            </div>
        </div>
    );
}
