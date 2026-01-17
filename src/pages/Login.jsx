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
            // 1. Check 'institutions' (Priority High)
            let docSnap = await getDoc(doc(db, "institutions", uid));
            if (docSnap.exists()) return { role: 'institution', isNew: false, approved: true };

            // 2. Check 'teachers'
            docSnap = await getDoc(doc(db, "teachers", uid));
            if (docSnap.exists()) return { role: 'teacher', isNew: !docSnap.data().profileCompleted, approved: docSnap.data().approved };

            // 3. Check 'users' (Student - Fallback)
            docSnap = await getDoc(doc(db, "users", uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
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
                const result = await getRedirectResult(auth);
                if (result && isMounted) {
                    setLoading(true);
                    const user = result.user;
                    console.log("Redirect result user:", user.email);

                    // Check existing user role
                    const { role, isNew, approved } = await checkUserExists(user.uid);
                    console.log("Redirect Auth Checked: ", role, isNew, approved);

                    if (role && !isNew) {
                        if (approved === false) {
                            navigate('/pending-approval');
                        } else {
                            redirectToRolePage(role);
                        }
                    } else {
                        // New user or incomplete profile -> Details page
                        navigate('/details');
                    }
                    if (isMounted) setLoading(false);
                }
            } catch (err) {
                console.error("Redirect Error:", err);
                if (isMounted) {
                    setError(err.message);
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
            if (role !== 'institution' && !gender) {
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
                const prefix = role === 'student' ? 'ST' : (role === 'teacher' ? 'TE' : 'IN');
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
            console.error("Google Auth Error:", err);
            // Handle 'popup-closed-by-user' gracefully
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign-in cancelled.');
            } else {
                setError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setLoading(false);
        }
    };

    if (!auth) return <div className="login-container"><div className="card">Error: Firebase Auth not initialized.</div></div>;

    return (
        <div className="login-container">
            <div className="card login-card">
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
                                placeholder={role === 'institution' ? "Institution Name" : "Name"}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />

                            {role !== 'institution' && (
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
