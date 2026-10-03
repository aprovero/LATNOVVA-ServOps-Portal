import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// ── SINGLE shared Supabase client for the entire app ──────────────────────────
// IMPORTANT: Only ONE createClient() call must exist. Multiple instances create
// competing GoTrueClient locks that cause React error #310 and auth conflicts.
const _client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'x-latnovva-client-version': typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '5.0.1',
            'x-latnovva-build-id': typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown'
        }
    }
});

// Typed export — used by authStore for type-safe personnel queries.
export const supabase = _client;

// Permissive export — used by useStore.ts where table schemas are not fully
// reflected in database.types.ts yet. Casts to the non-generic SupabaseClient
// so data is loosely typed (not `any`) but table/column constraints are relaxed.
// This is the SAME runtime instance as `supabase`.
export const supabaseUntyped: SupabaseClient = _client as unknown as SupabaseClient;
