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
        const text = `🚨 Emergency Report (${type})\n\nLoc: ${formData.location}\nAccused: ${formData.accusedName}\nDesc: ${formData.description}`;
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
            <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border: 'none', background: 'none', fontSize: '20px' }}>⬅ Back</button>

            {/* Dynamic Emergency Banner */}
            {isEmergency && (
                <div style={{ background: 'linear-gradient(to right, #c0392b, #e74c3c)', color: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', animation: 'pulse 2s infinite' }}>
                    <div className="scrolling-text">
                        🚨 {localContacts ? `Nearest Police: ${localContacts.localPoliceName} (${localContacts.localPolicePhone})` : "Emergency Contacts: National Police 112"} | Women Helpline 1091. Report Responsibly.
                    </div>
                </div>
            )}

            {/* Consolidated Styles */}
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
