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
                console.log("User already logged in. Redirecting...", userData.role);
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
    if (userLoading || user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
                    console.log("Redirect Result Found:", result.user.email);
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

        setLoading(true);

        try {
            if (isLogin) {
                // Login Logic
                console.log("Attempting SignInWithEmailAndPassword...", email);
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("User Logged In:", userCredential.user.uid);
                const uid = userCredential.user.uid;

                const { role: dbRole, isNew, approved } = await checkUserExists(uid);
                console.log("Checked Role:", dbRole, "IsNew:", isNew, "Approved:", approved);

                if (dbRole) {
                    if (isNew) {
                        console.log("Redirecting to Details...");
                        navigate('/details');
                    } else {
                        if (approved === false) {
                            navigate('/pending-approval');
                        } else {
                            console.log("Redirecting to Role Page:", dbRole);
                            redirectToRolePage(dbRole);
                        }
                    }
                } else {
                    console.log("Role not found in DB. Navigate to details for setup.");
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

                // Generate Permanent ID (PID)
                const prefix = role === 'student' ? 'ST' : (role === 'teacher' ? 'TE' : (role === 'institution' ? 'IN' : 'AD'));
                const randomNum = Math.floor(100000 + Math.random() * 900000); // 6 digit random
                const pid = `${prefix}-${randomNum}`;

                const userData = {
                    email,
                    role,
                    name,
                    gender,
                    pid, // Save PID
                    createdAt: new Date(),
                    profileCompleted: false
                };

                const collectionName = role === 'institution' ? "institutions" : (role === 'teacher' ? "teachers" : "users");
                await setDoc(doc(db, collectionName, uid), userData);

                navigate('/details', { state: { role } });
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
            console.log("Google Popup Success:", user.email);

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
            </div >
        </div >
    );
}
