import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Report({ type }) { // type: 'sexual_harassment' or 'misbehavior'
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        incidentDate: '',
        location: '',
        victimName: '',
        accusedName: '',
        description: '',
        evidence: '',
        age: '',
        gender: ''
    });

    useEffect(() => {
        // Since we are moving to React, we generally fetch user details from Context or Firestore
        // For now, we simulate legacy behavior of reading local storage if available, or defaulting
        // In a real app, use auth context.
        setFormData(prev => ({
            ...prev,
            // Mock data or read from a user profile state if we had it globally
            age: '',
            gender: ''
        }));
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.description.length < 50) return alert("Please provide more details in description.");

        try {
            // Save to secure collection
            await addDoc(collection(db, "emergency_reports"), {
                ...formData,
                type: type || 'misbehavior',
                createdAt: serverTimestamp(),
                status: 'pending_review'
            });
            alert("Report Submitted securely. Authorities will be notified.");
            navigate('/student'); // Redirect to safety
        } catch (err) {
            console.error(err);
            alert("Error submitting report.");
        }
    };

    const handleWhatsApp = () => {
        if (!formData.location) {
            alert("Please enter a location first.");
            return;
        }
        const text = `🚨 Emergency Report (${type})\n\nLoc: ${formData.location}\nAccused: ${formData.accusedName || 'Unknown'}\nDesc: ${formData.description || 'Emergency'}`;
        window.open(`https://wa.me/919959007119?text=${encodeURIComponent(text)}`, '_blank');
    }

    const [localContacts, setLocalContacts] = useState(null);

    useEffect(() => {
        const fetchEmergencyDetails = async () => {
            const { getAuth } = await import('firebase/auth');
            const { getDoc, doc } = await import('firebase/firestore');
            const auth = getAuth();
            const user = auth.currentUser;

            if (user) {
                try {
                    // 1. Get User to find Institution ID
                    const userSnap = await getDoc(doc(db, "users", user.uid));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const instId = userData.institutionId;

                        if (instId) {
                            // 2. Get Institution for Police Details
                            const instSnap = await getDoc(doc(db, "institutions", instId));
                            if (instSnap.exists()) {
                                setLocalContacts(instSnap.data());
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching emergency contacts", e);
                }
            }
        };
        fetchEmergencyDetails();
    }, []);

    const isEmergency = type === 'sexual_harassment';

    return (
        <div style={{ padding: '20px', background: isEmergency ? '#fff5f5' : '#fff', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>⬅ Back</button>
            </div>

            {/* Dynamic Emergency Banner */}
            {isEmergency && (
                <div style={{ background: 'linear-gradient(to right, #c0392b, #e74c3c)', color: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', animation: 'pulse 2s infinite' }}>
                    <div className="scrolling-text">
                        🚨 {localContacts ? `Nearest Police: ${localContacts.localPoliceName} (${localContacts.localPolicePhone})` : "Emergency Contacts: National Police 112"} | Women Helpline 1091. Report Responsibly.
                    </div>
                </div>
            )}

            <div className="container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ color: isEmergency ? '#c0392b' : '#2c3e50', textAlign: 'center' }}>
                    {isEmergency ? 'Report Sexual Harassment / Abuse' : 'Report Misbehavior / Bullying'}
                </h2>
                <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '14px', marginBottom: '20px' }}>
                    {isEmergency
                        ? "This is a secure, serious reporting channel. Your safety is our priority."
                        : "Report bullying, ragging, or any inappropriate behavior safely."}
                </p>

                <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    <label>Victim Name (Optional - Can remain anonymous)</label>
                    <input name="victimName" value={formData.victimName} onChange={handleChange} className="input-field" placeholder="Leave empty for Anonymous" />

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Age</label>
                            <input name="age" type="number" value={formData.age} onChange={handleChange} className="input-field" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                                <option value="">Select</option>
                                <option>Female</option>
                                <option>Male</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    <label style={{ color: '#d63031', fontWeight: 'bold' }}>Name of Accused Person(s) *</label>
                    <input name="accusedName" value={formData.accusedName} onChange={handleChange} className="input-field" required placeholder="Who is responsible?" />

                    <label>Date & Time of Incident</label>
                    <input name="incidentDate" type="datetime-local" value={formData.incidentDate} onChange={handleChange} className="input-field" required />

                    <label>Location of Incident</label>
                    <input name="location" value={formData.location} onChange={handleChange} className="input-field" required placeholder="Where did it happen? (e.g. Corridor, Bus)" />

                    <label>Detailed Description *</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="input-field"
                        style={{ height: '100px', resize: 'vertical' }}
                        required
                        placeholder="Please describe exactly what happened. Be as specific as possible."
                    ></textarea>

                    <label>Evidence Link (Optional)</label>
                    <input name="evidence" value={formData.evidence} onChange={handleChange} className="input-field" placeholder="Google Drive / Cloud Link to photo/video" />

                    <button type="submit" className="btn" style={{ backgroundColor: isEmergency ? '#e74c3c' : '#0984e3', marginTop: '10px' }}>
                        Submit Secure Report 🔒
                    </button>

                    {isEmergency && (
                        <button type="button" onClick={handleWhatsApp} className="btn" style={{ backgroundColor: '#25D366', marginTop: '5px' }}>
                            Share Location on WhatsApp SOS 💬
                        </button>
                    )}

                </form>

                <div style={{ marginTop: '20px', fontSize: '12px', color: '#95a5a6', textAlign: 'center' }}>
                    <p>🔒 This report is encrypted and sent directly to the Institution's Grievance Cell.</p>
                    <p>False reporting is a punishable offense.</p>
                </div>
            </div>
            <style>{`
                .scrolling-text {
                    white-space: nowrap;
                    overflow: hidden;
                    display: inline-block;
                    animation: scroll 15s linear infinite;
                    font-weight: bold;
                }
                @keyframes scroll {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
                }
            `}</style>
        </div>
    );
}
