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

    // Role normalization
    const normalizedRole = (userData.role || '').toLowerCase().trim();

    // 1. APPROVAL GATE (Top Priority)
    // If not approved, must go to pending-approval (unless special case)
    const isApproved = userData.approved === true;
    const isSpecialRole = normalizedRole === 'admin';
    // Smart Admission bypass: institution-created users who completed profile are allowed through
    // even if the context hasn't updated with approved:true yet (race condition)
    const isSmartAdmissionBypass = userData.isInstitutionCreated === true && userData.profileCompleted === true;

    if (!isApproved && !isSpecialRole && !isSmartAdmissionBypass) {
        if (location.pathname !== '/pending-approval') {
            console.log(`[Gatekeeper] Denied access to ${location.pathname} for unapproved ${normalizedRole}. -> /pending-approval`);
            return <Navigate to="/pending-approval" replace />;
        }
    }

    // 2. ONBOARDING GATE
    // Only if approved and role is valid, check onboarding completion.
    if (isApproved && !userData.onboardingCompleted) {
        if (location.pathname !== '/onboarding') {
            console.log(`[Gatekeeper] ${normalizedRole} approved but not onboarded. -> /onboarding`);
            return <Navigate to="/onboarding" replace />;
        }
    }

    // 3. ROLE AUTHORIZATION
    const isAuthorized = allowedRoles.some(r => r.toLowerCase().trim() === normalizedRole);
    if (allowedRoles && !isAuthorized) {
        console.warn(`[Gatekeeper] Access Denied: '${normalizedRole}' not in allowed: [${allowedRoles.join(', ')}]`);
        return <Navigate to="/access-denied" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
