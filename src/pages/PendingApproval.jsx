import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';

export default function PendingApproval() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const { user, loading: userLoading, userData } = useUser();

    // hasMounted: skip the first render so stale sessionStorage cache
    // doesn't fire a redirect before the live Firestore snapshot arrives.
    const hasMounted = useRef(false);

    // Auto-redirect ONLY after the first render (when data actually CHANGES via snapshot)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;
            return;
        }
        if (userData?.approved === true) {
            const role = (userData.role || '').toLowerCase().trim();
            console.log(`[PendingApproval] Approved as '${role}'. Redirecting...`);
            let path = '/student';
            if (role === 'teacher') path = '/teacher';
            else if (role === 'institution') path = '/institution';
            else if (role === 'admin') path = '/admin';
            else if (role === 'parent') path = '/parent';
            navigate(path, { replace: true });
        }
    }, [userData, navigate]);

    // NOTE: checkStatus is now triggered ONLY by the button click.
    // Removed the auto-run on mount — it was racing with UserContext's onSnapshot,
    // causing flickering between onboarding and pending-approval.
    const checkStatus = async () => {
        if (!user) {
            if (!userLoading) navigate('/');
            return;
        }

        setLoading(true);
        setStatusMsg('Checking status...');

        try {
            // 1. Read the user doc directly from Firestore
            let role = 'student';
            let userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'teachers', user.uid));
                if (userDoc.exists()) role = 'teacher';
            }
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'institutions', user.uid));
                if (userDoc.exists()) role = 'institution';
            }

            if (userDoc.exists() && userDoc.data().approved === true) {
                setStatusMsg('Approved! The page will redirect shortly...');
                // The live snapshot in UserContext will detect this and fire the redirect.
                return;
            }

            // 2. SELF-REPAIR: Check if allotment was done but user doc wasn't updated
            const q = query(collection(db, 'admissions'), where('userId', '==', user.uid));
            const snap = await getDocs(q);

            let isAllotted = false;
            let admissionData = null;
            snap.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.status === 'allotted' || data.status === 'approved') {
                    isAllotted = true;
                    admissionData = data;
                }
            });

            if (isAllotted && admissionData) {
                setStatusMsg('Admission found! Finalizing...');
                const colName = role === 'teacher' ? 'teachers' : 'users';
                await setDoc(doc(db, colName, user.uid), {
                    approved: true,
                    assignedClass: admissionData.assignedClass || '',
                    assignedSection: admissionData.assignedSection || '',
                    class: admissionData.assignedClass || '',
                    section: admissionData.assignedSection || ''
                }, { merge: true });
                alert('✅ Approval Confirmed! Redirecting...');
                window.location.reload();
            } else {
                setStatusMsg('Still waiting for institution approval.');
            }
        } catch (e) {
            console.error('Error checking status:', e);
            setStatusMsg('Error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        getAuth().signOut().then(() => navigate('/'));
    };

    return (
        <div className="container" style={{ textAlign: 'center', marginTop: '100px', paddingBottom: '50px' }}>
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
                <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
                <h2 style={{ color: '#0984e3' }}>Application Pending</h2>
                <p style={{ fontSize: '16px', color: '#555', lineHeight: '1.6' }}>
                    Your admission request has been sent to the institution.
                    <br /><br />
                    Please wait for the administrator to approve your request and allot you a class.
                </p>

                {statusMsg && <p style={{ color: '#d63031', fontWeight: 'bold' }}>{statusMsg}</p>}

                <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                    <button className="btn" onClick={checkStatus} disabled={loading} style={{ width: '200px' }}>
                        {loading ? 'Checking...' : 'Check Status ⟳'}
                    </button>
                    <button className="btn" onClick={() => navigate('/details')} style={{ backgroundColor: '#6c5ce7', width: '200px' }}>
                        ✏️ Edit Details
                    </button>
                </div>

                <div style={{ marginTop: '30px', fontSize: '12px', color: '#aaa' }}>
                    UID: {getAuth().currentUser?.uid || 'Not Logged In'}
                </div>
                <div style={{ marginTop: '15px' }}>
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
