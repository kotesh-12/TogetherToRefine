import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rpfkargirziintpqyuda.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmthcmdpcnppaW50cHF5dWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjE4MTYsImV4cCI6MjA4ODM5NzgxNn0.K_LyyOUX2V5LbKFI34mPETLPnWQvVGKbA8XYz4pnuX8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
