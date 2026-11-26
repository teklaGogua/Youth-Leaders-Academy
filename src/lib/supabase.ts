import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';
import type { Database } from './database.types';

export const supabase =
  isSupabaseConfigured && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          flowType: 'pkce',
        },
      })
    : null;
