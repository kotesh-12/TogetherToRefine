import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Login() {
    // -------------------------------------------------------------------------
    // 1. ALL HOOK DECLARATIONS (Must be at top, unconditional)
    // -------------------------------------------------------------------------
    const [configError, setConfigError] = useState(window.FIREBASE_CONFIG_ERROR || null);
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState('student');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');

    const navigate = useNavigate();
    const { user, userData, loading: userLoading } = useUser();

    // Helper functions (safe to be here)
    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    const checkUserExists = async (uid) => {
        try {
            const safeGet = async (col, id) => {
                try {
                    const s = await getDoc(doc(db, col, id));
                    return s.exists() ? s : null;
                } catch (e) {
                    return null;
                }
            };

            const instSnap = await safeGet("institutions", uid);
            if (instSnap) {
                const data = instSnap.data();
                return { role: (data.role || 'institution').toLowerCase(), isNew: false, approved: true };
            }

            const teachSnap = await safeGet("teachers", uid);
            if (teachSnap) {
                const data = teachSnap.data();
                return { role: (data.role || 'teacher').toLowerCase(), isNew: !data.profileCompleted, approved: data.approved };
            }

            const userSnap = await safeGet("users", uid);
            if (userSnap) {
                const data = userSnap.data();
                const normalizedRole = (data.role || 'student').toLowerCase();
                return { role: normalizedRole, isNew: !data.profileCompleted, approved: data.approved };
            }

            return { role: null, isNew: true };
        } catch (e) {
            console.error("Error checking user existence:", e);
            throw e;
        }
    };

    const redirectToRolePage = (role) => {
        const r = (role || '').toLowerCase();
        switch (r) {
            case 'student': navigate('/student'); break;
            case 'teacher': navigate('/teacher'); break;
            case 'institution': navigate('/institution'); break;
            case 'admin': navigate('/admin'); break;
            default: navigate('/admission');
        }
    };

    // -------------------------------------------------------------------------
    // 2. USE EFFECTS (Unconditional)
    // -------------------------------------------------------------------------

    // Effect 1: Redirect logic for logged-in users
    useEffect(() => {
        if (userLoading) return; // Wait for initial load

        if (user) {
            if (userData && userData.role) {
                const isStudentIncomplete = userData.role === 'student' && (!userData.class || !userData.institutionId);
                const isTeacherIncomplete = userData.role === 'teacher' && (!userData.subject || !userData.institutionId);
                const isInstitutionIncomplete = userData.role === 'institution' && (!userData.schoolName);

                if (!userData.profileCompleted || isStudentIncomplete || isTeacherIncomplete || isInstitutionIncomplete) {
                    navigate('/details');
                    return;
                }

                if (userData.approved === false) {
                    navigate('/pending-approval', { replace: true });
                } else {
                    switch (userData.role) {
                        case 'student': navigate('/student', { replace: true }); break;
                        case 'teacher': navigate('/teacher', { replace: true }); break;
                        case 'institution': navigate('/institution', { replace: true }); break;
                        case 'admin': navigate('/admin', { replace: true }); break;
                        default: navigate('/admission', { replace: true });
                    }
                }
            } else {
                if (!userData) {
                    navigate('/details');
                }
            }
        }
    }, [user, userData, userLoading, navigate]);

    // Effect 2: Config Error Check
    useEffect(() => {
        if (window.FIREBASE_CONFIG_ERROR) {
            setConfigError(window.FIREBASE_CONFIG_ERROR);
        }
    }, []);

    // Effect 3: Redirect Result Handler
    useEffect(() => {
        let isMounted = true;
        const checkRedirect = async () => {
            if (!auth) return;
            try {
                const result = await getRedirectResult(auth);
                if (result && isMounted) {
                    setLoading(true);
                    const user = result.user;
                    const { role, isNew, approved } = await checkUserExists(user.uid);

                    if (isMounted) {
                        if (role && !isNew) {
                            if (approved === false) navigate('/pending-approval');
                            else redirectToRolePage(role);
                        } else {
                            navigate('/details');
                        }
                    }
                }
            } catch (err) {
                console.error("Redirect Login Failed:", err);
                if (isMounted) {
                    let msg = err.message;
                    if (err.code === 'auth/unauthorized-domain') {
                        msg = `DOMAIN ERROR: ${window.location.hostname} is not whitelisted in Firebase Console.`;
                        alert(msg);
                    }
                    setError(msg);
                    setLoading(false);
                }
            }
        };
        checkRedirect();
        return () => { isMounted = false; };
    }, [navigate]);

    // -------------------------------------------------------------------------
    // 3. HANDLERS
    // -------------------------------------------------------------------------
    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
            if (!email || !password || !role) {
                setError('All fields are required!');
                return;
            }
        } else {
            if (!email || !password || !role || !name) {
                setError('Please fill in all required fields.');
                return;
            }
            if (role !== 'institution' && role !== 'admin' && !gender) {
                setError('Gender is required.');
                return;
            }
        }

        if (!isLogin) {
            if (password.length < 8) {
                setError('Password must be at least 8 characters long.');
                return;
            }
            if (!/[A-Z]/.test(password)) {
                setError('Password must contain at least one uppercase letter.');
                return;
            }
            if (!/[0-9]/.test(password)) {
                setError('Password must contain at least one number.');
                return;
            }
        }

        setLoading(true);

        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;
                const { role: dbRole, isNew, approved } = await checkUserExists(uid);

                if (dbRole) {
                    if (isNew) {
                        navigate('/details');
                        return;
                    } else {
                        if (approved === false) navigate('/pending-approval');
                        else redirectToRolePage(dbRole);
                    }
                } else {
                    navigate('/details');
                }
            } else {
                let uid;
                if (auth.currentUser) {
                    uid = auth.currentUser.uid;
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    uid = userCredential.user.uid;
                }

                // Temporary logic: Navigate to Details to complete profile
                navigate('/details', { state: { role } });
                return;
            }
        } catch (err) {
            console.error(err);
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const { role: dbRole, isNew, approved } = await checkUserExists(user.uid);

            if (dbRole && !isNew) {
                if (approved === false) navigate('/pending-approval');
                else redirectToRolePage(dbRole);
            } else {
                navigate('/details', { state: { role: role } });
                return;
            }
        } catch (err) {
            console.error("Popup Error:", err);
            if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/popup-closed-by-user'].includes(err.code)) {
                console.log("Popup blocked/closed. Trying Redirect...");
                try {
                    await signInWithRedirect(auth, provider);
                } catch (redirErr) {
                    setError("Redirect Failed: " + redirErr.message);
                    setLoading(false);
                }
            } else if (err.code === 'auth/unauthorized-domain') {
                const msg = `SETUP ERROR: Domain '${window.location.hostname}' is not authorized in Firebase.`;
                setError(msg);
                alert(msg);
                setLoading(false);
            } else {
                setError("Login Error: " + err.message);
                setLoading(false);
            }
        }
    };

    // -------------------------------------------------------------------------
    // 4. CONDITIONAL RENDERS (Must be at the very end)
    // -------------------------------------------------------------------------

    if (configError) {
        return (
            <div className="login-container">
                <div className="card login-card" style={{ textAlign: 'center', borderTop: '5px solid red' }}>
                    <h2 style={{ color: '#d63031' }}>⚠️ Configuration Error</h2>
                    <p>The application could not start because some environment variables are missing.</p>
                    <div style={{ background: '#ffeaa7', padding: '10px', borderRadius: '5px', margin: '20px 0', textAlign: 'left', fontSize: '12px', overflow: 'auto' }}>
                        <strong>Missing Keys / Error:</strong>
                        <pre>{JSON.stringify(configError, null, 2)}</pre>
                    </div>
                </div>
            </div>
        );
    }

    if (userLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p>Verifying Session...</p>
            </div>
        );
    }

    if (!auth) return <div className="login-container"><div className="card">Error: Firebase Auth not initialized.</div></div>;

    return (
        <div className="login-container">
            <div className="card login-card" style={{ textAlign: 'center' }}>
                <img src="/logo2.png" alt="TTR Logo" style={{ width: '80px', height: 'auto', marginBottom: '10px' }} />
                <h2 className="login-title">{isLogin ? 'Login' : 'Sign Up'}</h2>
                {error && <div className="error-text">{error}</div>}

                <form onSubmit={handleAuth}>
                    <select
                        className="input-field"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                    >
                        <option value="" disabled>Select Role</option>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="institution">Institution</option>
                    </select>

                    {!isLogin && (
                        <>
                            <input
                                type="text"
                                className="input-field"
                                placeholder={role === 'institution' ? "Institution Name" : (role === 'admin' ? "Admin Name" : "Name")}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />

                            {role !== 'institution' && role !== 'admin' && (
                                <select
                                    className="input-field"
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            )}
                        </>
                    )}

                    <input
                        type="email"
                        className="input-field"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <div className="password-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="input-field"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? "HIDE" : "SHOW"}
                        </button>
                    </div>

                    <button type="submit" className="btn full-width" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>

                <div className="auth-divider">
                    <div className="divider-line" />
                    <span className="divider-text">OR</span>
                    <div className="divider-line" />
                </div>

                <button
                    type="button"
                    className="btn google-btn"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                >
                    G Sign in with Google
                </button>

                <div className="toggle-link" onClick={toggleMode}>
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
                </div>
                {/* DEBUG VERSION */}
                <div style={{ marginTop: '20px', fontSize: '10px', color: '#b2bec3' }}>v0.0.51 (Stable)</div>
            </div >
        </div >
    );
}
