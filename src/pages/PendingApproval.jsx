import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function PendingApproval() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const checkStatus = async () => {
        setLoading(true);
        setStatusMsg('Checking logic...');
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            navigate('/');
            return;
        }

        try {
            console.log("Checking status for:", user.uid);

            // 1. Check User Profile directly first
            let role = 'student';
            let userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, "teachers", user.uid));
                role = 'teacher';
            }

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.approved === true) {
                    console.log("User is already approved! Redirecting...");
                    setStatusMsg('Approved! Redirecting...');
                    setTimeout(() => navigate(role === 'teacher' ? '/teacher' : '/student'), 1000);
                    return;
                }
            }

            // 2. SELF-REPAIR: Check 'admissions' collection
            // Did the institution approve them in 'admissions' but the 'user' doc update failed?
            const q = query(collection(db, "admissions"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);

            let isAllotted = false;
            let admissionData = null;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.status === 'allotted') {
                    isAllotted = true;
                    admissionData = data;
                }
            });

            if (isAllotted && admissionData) {
                console.log("Found ALLOTTED Admission record! Repairing user profile...");
                setStatusMsg('Admission found! Finalizing setup...');

                // FORCE UPDATE user profile
                const collectionName = role === 'teacher' ? 'teachers' : 'users';
                await setDoc(doc(db, collectionName, user.uid), {
                    approved: true,
                    assignedClass: admissionData.assignedClass || '',
                    assignedSection: admissionData.assignedSection || '',
                    // Ensure class/section are set for students
                    class: admissionData.assignedClass || '',
                    section: admissionData.assignedSection || ''
                }, { merge: true });

                alert("✅ Approval Confirmed! You are now being redirected.");
                window.location.reload(); // Reload to refresh context
            } else {
                console.log("Still waiting. Admission status:", isAllotted ? "Allotted" : "Pending/Waiting");
                setStatusMsg('Still waiting for institution approval.');
            }

        } catch (e) {
            console.error("Error checking status:", e);
            setStatusMsg('Error checking status. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        const auth = getAuth();
        auth.signOut().then(() => {
            navigate('/');
        });
    };

    return (
        <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
            <div className="card" style={{ maxWidth: '500px', margin: '0 auto', padding: '40px' }}>
                <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
                <h2 style={{ color: '#0984e3' }}>Application Pending</h2>
                <p style={{ fontSize: '16px', color: '#555', lineHeight: '1.6' }}>
                    Your admission request has been sent to the institution.
                    <br /><br />
                    Please wait for the administrator to approve your request and allot you a class.
                </p>

                {statusMsg && <p style={{ color: '#d63031', fontWeight: 'bold' }}>{statusMsg}</p>}

                <div style={{ marginTop: '30px' }}>
                    <button className="btn" onClick={checkStatus} disabled={loading}>
                        {loading ? 'Checking...' : 'Check Status ⟳'}
                    </button>
                </div>

                {/* Debug Info */}
                <div style={{ marginTop: '20px', fontSize: '12px', color: '#aaa' }}>
                    UID: {getAuth().currentUser?.uid || 'Not Logged In'}
                </div>
                <div style={{ marginTop: '15px' }}>
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', textDecoration: 'underline' }}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
