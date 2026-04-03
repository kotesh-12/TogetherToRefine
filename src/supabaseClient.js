import { createClient } from '@supabase/supabase-js';

// Read from VITE_ env vars (set in .env.local for dev, Vercel dashboard for prod)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rpfkargirziintpqyuda.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmthcmdpcnppaW50cHF5dWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjE4MTYsImV4cCI6MjA4ODM5NzgxNn0.K_LyyOUX2V5LbKFI34mPETLPnWQvVGKbA8XYz4pnuX8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Use implicit flow — this returns #access_token= in the URL hash
        // (matches what the Supabase dashboard is configured to use)
        flowType: 'implicit',
        // Tell Supabase to automatically detect and parse the session from the URL
        detectSessionInUrl: true,
        // Persist the session in localStorage so users stay logged in
        persistSession: true,
        // Don't auto-redirect — our AuthProvider loading guard handles navigation
        autoRefreshToken: true,
    }
});
