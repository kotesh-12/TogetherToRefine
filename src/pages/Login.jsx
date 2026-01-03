import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithRedirect,
    signInWithPopup,
    getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // New Fields (Legacy for Email/Pass signup)
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [grade, setGrade] = useState('');

    const navigate = useNavigate();

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    const checkUserExists = async (uid) => {
        try {
            // 1. Check 'users' (Student)
            let docSnap = await getDoc(doc(db, "users", uid));
            if (docSnap.exists()) return { role: docSnap.data().role, isNew: !docSnap.data().profileCompleted };

            // 2. Check 'teachers'
            docSnap = await getDoc(doc(db, "teachers", uid));
            if (docSnap.exists()) return { role: 'teacher', isNew: !docSnap.data().profileCompleted };

            // 3. Check 'institutions'
            docSnap = await getDoc(doc(db, "institutions", uid));
            if (docSnap.exists()) return { role: 'institution', isNew: false };

            return { role: null, isNew: true };
        } catch (e) {
            console.error("Error checking user existence:", e);
            throw e;
        }
    };

    const redirectToRolePage = (role) => {
        switch (role) {
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
                    const { role, isNew } = await checkUserExists(user.uid);
                    console.log("Redirect Auth Checked: ", role, isNew);

                    if (role && !isNew) {
                        // User exists and has profile -> Dashboard
                        redirectToRolePage(role);
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

                const { role: dbRole, isNew } = await checkUserExists(uid);
                console.log("Checked Role:", dbRole, "IsNew:", isNew);

                if (dbRole) {
                    if (isNew) {
                        console.log("Redirecting to Details...");
                        navigate('/details');
                    } else {
                        console.log("Redirecting to Role Page:", dbRole);
                        redirectToRolePage(dbRole);
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

                const userData = {
                    email,
                    role,
                    name,
                    gender,
                    createdAt: new Date(),
                    profileCompleted: false
                };

                const collectionName = role === 'institution' ? "institutions" : (role === 'teacher' ? "teachers" : "users");
                await setDoc(doc(db, collectionName, uid), userData);

                navigate('/details');
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
        try {
            // Using Popup for better Desktop experience and debugging
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check existing user role
            const { role, isNew } = await checkUserExists(user.uid);
            console.log("Google Auth Success: ", role, isNew);

            if (role && !isNew) {
                redirectToRolePage(role);
            } else {
                navigate('/details');
            }
        } catch (err) {
            console.error("Google Sign In Error:", err);
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            // Only stop loading if we didn't navigate (though navigation might unmount, it's safer)
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

                    <div className="password-wrapper" style={{ position: 'relative' }}>
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
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '35%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {showPassword ? "HIDE" : "SHOW"}
                        </button>
                    </div>

                    <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#ccc' }} />
                    <span style={{ padding: '0 10px', color: '#666', fontSize: '14px' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: '#ccc' }} />
                </div>

                <button
                    type="button"
                    className="btn"
                    style={{ width: '100%', background: '#fff', color: '#db4437', border: '1px solid #db4437' }}
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                >
                    G Sign in with Google
                </button>

                <div className="toggle-link" onClick={toggleMode}>
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
                </div>
            </div>
        </div>
    );
}
