import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const ProtectedRoute = ({ allowedRoles }) => {
    const { user, userData, loading } = useUser();
    const [isOk, setIsOk] = useState(false);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Verifying Access...</div>;

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

    // Role Check
    if (allowedRoles && !allowedRoles.includes(userData.role)) {
        // Unauthorized. 
        if (userData.role === 'student') return <Navigate to="/student" replace />;
        if (userData.role === 'teacher') return <Navigate to="/teacher" replace />;
        if (userData.role === 'institution') return <Navigate to="/institution" replace />;
        return <Navigate to="/" replace />;
    }

    // APPROVAL CHECK (Bug Fix)
    // If they are allowed by role, but NOT approved yet, send to pending.
    if ((userData.role === 'student' || userData.role === 'teacher') && userData.approved === false) {
        return <Navigate to="/pending-approval" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
