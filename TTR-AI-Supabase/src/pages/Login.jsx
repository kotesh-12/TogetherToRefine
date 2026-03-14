import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import anime from 'animejs/lib/anime.es.js';
import logo from '../assets/logo.png';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { signIn, signUp, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    // Setup Anime.js animation for the logo
    useEffect(() => {
        anime({
            targets: '.login-brand .brand-icon img',
            translateY: [-20, 0],
            opacity: [0, 1],
            scale: [0.8, 1],
            duration: 1500,
            easing: 'easeOutElastic(1, .5)',
            delay: 200
        });

        anime({
            targets: '.login-brand .brand-title',
            translateY: [20, 0],
            opacity: [0, 1],
            duration: 1200,
            easing: 'easeOutExpo',
            delay: 400
        });

        anime({
            targets: '.login-brand .brand-subtitle',
            opacity: [0, 1],
            duration: 1000,
            easing: 'linear',
            delay: 800
        });
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                if (!email || !password) {
                    setError('All fields are required!');
                    setLoading(false);
                    return;
                }
                await signIn(email, password);
            } else {
                if (!email || !password || !name) {
                    setError('Please fill in all required fields.');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters.');
                    setLoading(false);
                    return;
                }
                await signUp(email, password, name);
            }
            navigate('/');
        } catch (err) {
            setError(err.message || 'Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Google sign-in failed.');
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background particles */}
            <div className="bg-particles">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="particle" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 15}s`,
                        animationDuration: `${15 + Math.random() * 20}s`,
                        width: `${2 + Math.random() * 4}px`,
                        height: `${2 + Math.random() * 4}px`,
                    }} />
                ))}
            </div>

            <div className="login-container">
                {/* Logo / Brand */}
                <div className="login-brand">
                    <div className="brand-icon">
                        <img src={logo} alt="TTR" className="logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
                    </div>
                    <h1 className="brand-title">TTRAI</h1>
                    <p className="brand-subtitle">Your Intelligent Learning Companion</p>
                </div>

                {/* Auth Card */}
                <div className="login-card">
                    <div className="card-header">
                        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>{isLogin ? 'Sign in to continue your conversation' : 'Join TTRAI today'}</p>
                    </div>

                    {error && (
                        <div className="error-banner">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="auth-form">
                        {!isLogin && (
                            <div className="input-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                    required
                                />
                            </div>
                        )}

                        <div className="input-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? (
                                <span className="btn-loader"></span>
                            ) : (
                                isLogin ? 'Sign In' : 'Create Account'
                            )}
                        </button>
                    </form>
                    <div className="divider">
                        <span>or</span>
                    </div>

                    <button onClick={handleGoogle} className="btn-google" disabled={loading}>
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>


                    <div className="toggle-mode">
                        <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </div>
                </div>

                <p className="login-footer">Powered by Together To Refine</p>
            </div>
        </div>
    );
}
