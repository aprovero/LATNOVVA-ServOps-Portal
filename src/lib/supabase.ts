import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getAppVersion, getBuildId, getReleaseId } from '../config/release';
import { validateBackendIsolation } from '../config/environment';

const { supabaseUrl, supabaseAnonKey } = validateBackendIsolation();

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
            'x-latnovva-client-version': getAppVersion(),
            'x-latnovva-build-id': getBuildId(),
            'x-latnovva-release-id': String(getReleaseId())
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
