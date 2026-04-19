import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// ── SINGLE shared Supabase client for the entire app ──────────────────────────
// IMPORTANT: Only ONE createClient() call must exist. Multiple instances create
// competing GoTrueClient locks that cause React error #310 and auth conflicts.
const _client = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Typed export — used by authStore for type-safe personnel queries.
export const supabase = _client;

// Permissive export — used by useStore.ts where table schemas are not fully
// reflected in database.types.ts yet. Casts to the non-generic SupabaseClient
// so data is loosely typed (not `any`) but table/column constraints are relaxed.
// This is the SAME runtime instance as `supabase`.
export const supabaseUntyped: SupabaseClient = _client as unknown as SupabaseClient;
