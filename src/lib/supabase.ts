// Supabase Client — singleton instance
// ============================================================

import { createClient } from '@supabase/supabase-js';

// The public Supabase URL and publishable key are safe for browser use.
// Vercel environment variables still take precedence when configured.
const DEFAULT_SUPABASE_URL = 'https://hbpjkomkbtpiciioqggn.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2ctUw7KpKPFbK44GJoYq_A_JmaYtWi_';

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL as string | undefined
)?.trim() || DEFAULT_SUPABASE_URL;
const supabaseKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
