import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const ProtectedRoute = ({ allowedRoles }) => {
    const { user, userData, loading } = useUser();
    const location = useLocation();
    const [isOk, setIsOk] = useState(false);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <p>Verifying Access...</p>
                <button
                    onClick={() => {
                        // Force logout via auth and clear session
                        import('../firebase').then(({ auth }) => {
                            auth.signOut();
                            sessionStorage.clear();
                            window.location.href = '/';
                        });
                    }}
                    style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Stuck? Click to Reset
                </button>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (!userData) {
        // Technically logged in but no data (maybe network slow or detail setup pending)
        // If really no data, maybe send to Details? But usually UserContext handles loading until it's sure.
        // Let's assume if loading is false and no userData, they need setup.
        // However, if they just signed up, they might be here.
        return <Navigate to="/details" replace />;
    }

    // Role Check (Case Insensitive)
    const userRole = (userData.role || '').toLowerCase();
    const isAuthorized = allowedRoles.some(r => r.toLowerCase() === userRole);

    if (allowedRoles && !isAuthorized) {
        // Unauthorized. 
        console.warn(`Access Denied: Role '${userRole}' is not in [${allowedRoles}]`);
        return <Navigate to="/access-denied" replace />;
    }

    // APPROVAL CHECK (Bug Fix)
    // If they are allowed by role, but NOT approved yet, send to pending.
    // SECURE FIX: Check explicitly for !== true to catch undefined/null cases
    if ((userData.role === 'student' || userData.role === 'teacher') && userData.approved !== true) {
        return <Navigate to="/pending-approval" replace />;
    }

    // ONBOARDING CHECK
    // If user is logged in but hasn't done setup, send to Onboarding
    // Exception: If already there, allow it.
    // FIX: Make this user-specific so new users on same device see it
    const setupKey = user?.uid ? `ttr_setup_done_${user.uid}` : 'ttr_setup_done';
    if (!localStorage.getItem(setupKey) && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
