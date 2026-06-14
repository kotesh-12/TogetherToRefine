import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from './AuthContextObject';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (email, password, name) => {
        const cleanEmail = email?.trim();
        const cleanName = name?.trim();
        const redirectTo = Capacitor.isNativePlatform() 
            ? 'https://www.ttrai.in' 
            : window.location.origin;

        const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: { name: cleanName },
                emailRedirectTo: redirectTo
            }
        });
        if (error) throw error;
        return data;
    };

    const signIn = async (email, password) => {
        const cleanEmail = email?.trim();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signInWithGoogle = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                // Initialize plugin just in case (sometimes needed outside capacitor.config.json)
                GoogleAuth.initialize({
                    clientId: '676208521434-tp9scpi477tkvgnjmfpk38afgu9545u7.apps.googleusercontent.com',
                    scopes: ['profile', 'email'],
                    grantOfflineAccess: true,
                });
                const googleUser = await GoogleAuth.signIn();
                
                if (googleUser?.authentication?.idToken) {
                    const { data, error } = await supabase.auth.signInWithIdToken({
                        provider: 'google',
                        token: googleUser.authentication.idToken
                    });
                    if (error) throw error;
                    return data;
                } else {
                    throw new Error("Google Sign-In failed to return an ID token.");
                }
            } catch (err) {
                console.error("Native Google Auth Error:", err);
                throw err;
            }
        } else {
            // Web standard flow
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
            return data;
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = {
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// useAuth moved to src/hooks/useAuth.js
