import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from './AuthContextObject';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Detect if we're returning from a Google OAuth redirect.
        // The URL will contain #access_token=... (implicit flow) or ?code=... (PKCE flow).
        const hash = window.location.hash;
        const search = window.location.search;
        const isOAuthCallback = hash.includes('access_token=') || 
                                 hash.includes('error=') || 
                                 search.includes('code=') ||
                                 search.includes('error=');

        // STEP 1: Subscribe to auth state changes.
        // This catches the SIGNED_IN event fired by Supabase when it processes the OAuth token.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            // Release the loading guard — this is the authoritative signal that auth is resolved.
            setLoading(false);

            // After Google OAuth, clean up and navigate to home
            if (event === 'SIGNED_IN' && session?.user) {
                // Replace the ugly token URL with the clean home route
                window.location.replace(window.location.origin + '/#/');
            }
        });

        // STEP 2: For normal page loads (no OAuth callback), quickly recover any existing session.
        // For OAuth callbacks, we skip this and let onAuthStateChange do the work —
        // because calling setLoading(false) here would unmount the guard before Supabase
        // finishes parsing the access_token from the URL.
        if (!isOAuthCallback) {
            supabase.auth.getSession()
                .then(({ data: { session } }) => {
                    setUser(session?.user ?? null);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }

        // STEP 3: Safety timeout — if onAuthStateChange never fires (e.g. bad/expired token),
        // release the guard after 6 seconds so the app doesn't get stuck on a white screen.
        const safetyTimeout = setTimeout(() => setLoading(false), 6000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const signUp = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
                emailRedirectTo: window.location.origin + '/#/'
            }
        });
        if (error) throw error;
        return data;
    };

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signInWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirect to the bare origin — Supabase will append #access_token=...
                // Our loading guard will hold the Router back until the token is processed.
                redirectTo: window.location.origin + '/'
            }
        });
        if (error) throw error;
        return data;
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
            {/* Loading guard: keeps HashRouter from mounting until auth state is resolved.
                This prevents the router from clearing the #access_token OAuth fragment. */}
            {!loading && children}
        </AuthContext.Provider>
    );
}

// useAuth moved to src/hooks/useAuth.js
