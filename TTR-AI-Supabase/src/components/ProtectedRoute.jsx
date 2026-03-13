import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loader-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) return <Navigate to="/" replace />;
    return children;
}
