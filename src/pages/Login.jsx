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
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState('student'); // Default to student to avoid empty state issues
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // New Fields (Legacy for Email/Pass signup)
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');

    const navigate = useNavigate();
    const { user, userData, loading: userLoading } = useUser(); // Access global user state

    // Redirect if already logged in
    useEffect(() => {
        if (userLoading) return; // Wait for initial load

        if (user) {
            if (userData && userData.role) {


                // CRITICAL FIX: Ensure profile is REALLY completed before dashboard access
                // Check for core fields that might be missing even if flag is true
                const isStudentIncomplete = userData.role === 'student' && (!userData.class || !userData.institutionId);
                const isTeacherIncomplete = userData.role === 'teacher' && (!userData.subject || !userData.institutionId);
                const isInstitutionIncomplete = userData.role === 'institution' && (!userData.schoolName); // Basic check

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
                // User is auth'd but checking DB or no data found -> Assume new/setup needed
                // If it's effectively 404 on profile, go to details
                if (!userData) {
                    navigate('/details');
                }
            }
        }
    }, [user, userData, userLoading, navigate]);

    // PREVENT FLASH: Show loading if checking auth OR if user is found (waiting for redirect)
    // PREVENT FLASH: Show loading ONLY while checking auth.
    // Once UserContext finishes loading (userLoading=false), let useEffect handle redirects.
    // If no redirect happens (e.g. user not fully setup), fall through to render Login form.
    if (userLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p>Verifying Session...</p>
                <button
                    onClick={() => { auth.signOut(); window.location.reload(); }}
                    style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Stuck? Click to Reset
                </button>
            </div>
        );
    }

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    const checkUserExists = async (uid) => {
        try {
            // Helper to safely check doc existence (ignoring permission limitations)
            const safeGet = async (col, id) => {
                try {
                    const s = await getDoc(doc(db, col, id));
                    return s.exists() ? s : null;
                } catch (e) {
                    // Ignore permission errors, assume not found in that collection
                    return null;
                }
            };

            // 1. Check 'institutions' (Priority High)
            const instSnap = await safeGet("institutions", uid);
            if (instSnap) {
                const data = instSnap.data();
                return { role: (data.role || 'institution').toLowerCase(), isNew: false, approved: true };
            }

            // 2. Check 'teachers'
            const teachSnap = await safeGet("teachers", uid);
            if (teachSnap) {
                const data = teachSnap.data();
                return { role: (data.role || 'teacher').toLowerCase(), isNew: !data.profileCompleted, approved: data.approved };
            }

            // 3. Check 'users' (Student - Fallback)
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

    // -------------------------------------------------------------
    // REDIRECT AUTH HANDLER
    // -------------------------------------------------------------
    useEffect(() => {
        let isMounted = true;
        const checkRedirect = async () => {
            if (!auth) return;
            try {
                // Determine if we are returning from a redirect flow
                const result = await getRedirectResult(auth);
                if (result) {

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
                } else {
                    // No redirect result - just normal page load
                }
            } catch (err) {
                console.error("Redirect Login Failed:", err);
                if (isMounted) {
                    let msg = err.message;
                    if (err.code === 'auth/unauthorized-domain') {
                        msg = `DOMAIN ERROR: ${window.location.hostname} is not whitelisted in Firebase Console.`;
                        alert(msg); // Force user to see this
                    }
                    setError(msg);
                    setLoading(false);
                }
            }
        };
        checkRedirect();
        return () => { isMounted = false; };
    }, [navigate]);

    // -------------------------------------------------------------
    // EMAIL / PASSWORD AUTH
    // -------------------------------------------------------------
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

        // Password Strength Validation (VULN-011)
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
                // Login Logic
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;


                const { role: dbRole, isNew, approved } = await checkUserExists(uid);


                if (dbRole) {
                    if (isNew) {

                        navigate('/details');
                        return;
                    } else {
                        if (approved === false) {
                            navigate('/pending-approval');
                        } else {

                            redirectToRolePage(dbRole);
                        }
                    }
                } else {

                    navigate('/details');
                }

            } else {
                // Signup Logic
                let uid;
                if (auth.currentUser) {
                    uid = auth.currentUser.uid;
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    uid = userCredential.user.uid;
                }

                // Minimal User Record to start
                const userData = {
                    email,
                    role, // Role is critical for routing
                    createdAt: new Date(),
                    profileCompleted: false
                };

                // Store simplified record in 'users' temporarily or let Details handle it.
                // We will JUST navigate to Details with the desired ROLE.
                // Details.jsx will handle the actual large form submission and correct collection.


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
        // Force the 'select_account' prompt to ask Google to show the account chooser.
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;


            // Check existing user role
            // Check existing user role
            const { role: dbRole, isNew, approved } = await checkUserExists(user.uid);

            if (dbRole && !isNew) {
                if (approved === false) {
                    navigate('/pending-approval');
                } else {
                    redirectToRolePage(dbRole);
                }
            } else {
                // Pass the selected role from the UI dropdown (state 'role') to Details page
                navigate('/details', { state: { role: role } });
                return;
            }

        } catch (err) {
            console.error("Popup Error:", err);

            if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
                // Retry with Redirect for Mobile/Strict Browsers
                console.log("Popup blocked/closed. Trying Redirect...");
                try {
                    await signInWithRedirect(auth, provider);
                    // Page will unload, no further code execution here
                } catch (redirErr) {
                    setError("Redirect Failed: " + redirErr.message);
                    setLoading(false);
                }
            } else if (err.code === 'auth/unauthorized-domain') {
                const msg = `SETUP ERROR: Domain '${window.location.hostname}' is not authorized in Firebase.`;
                setError(msg);
                alert(msg); // Force visibility
                setLoading(false);
            } else {
                setError("Login Error: " + err.message);
                setLoading(false);
            }
        }
    };

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
                <div style={{ marginTop: '20px', fontSize: '10px', color: '#b2bec3' }}>v0.0.46</div>
            </div >
        </div >
    );
}
