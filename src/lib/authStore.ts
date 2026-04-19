import { create } from 'zustand';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { useStore } from '../store/useStore';

type PersonnelRow = Database['public']['Tables']['personnel']['Row'];

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: PersonnelRow | null;
    loading: boolean;
    error: string | null;
    initializeAuth: () => void;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signInWithOtp: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
}

// Fetches the personnel profile in the BACKGROUND and syncs role into the main store.
// Never blocks the auth flow - always fire-and-forget.
async function fetchProfileInBackground(userId: string): Promise<PersonnelRow | null> {
    try {
        const { data } = await supabase
            .from('personnel')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = (data as PersonnelRow | null) ?? null;
        if (profile?.app_role) {
            useStore.getState().setUserRole(profile.app_role as any);
        }
        return profile;
    } catch {
        // Profile may not exist yet or network may be offline.
        // Auth still works — user gets their default role.
        return null;
    }
}

export const useAuthStore = create<AuthState>((set) => {
    // ── Register the listener ONE TIME when the store is created ─────────────
    // CRITICAL: Do NOT await any network calls before setting loading: false.
    // The session alone is sufficient to unblock AuthRoute. Profile is loaded
    // in the background and does not gate access.
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!newSession?.user) {
            // Signed out — clear immediately and unblock router
            useStore.getState().setAuthData('', '');
            set({ session: null, user: null, profile: null, loading: false });
            return;
        }

        // ── STEP 1: Unblock the router immediately with the session ───────────
        useStore.getState().setAuthData(newSession.user.id, newSession.user.email ?? '');
        set({ session: newSession, user: newSession.user, loading: false });

        // ── STEP 2: Fetch profile for role assignment in background ───────────
        // This does NOT block AuthRoute. If it fails or is slow, the user is
        // still in the app with their default role.
        const profile = await fetchProfileInBackground(newSession.user.id);
        set({ profile });
    });

    return {
        session: null,
        user: null,
        profile: null,
        // Start as true — onAuthStateChange fires immediately on load and clears this.
        loading: true,
        error: null,

        // No-op: kept for API compatibility.
        initializeAuth: () => {},

        signInWithEmail: async (email, password) => {
            set({ loading: true, error: null });
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Unblock router immediately
                if (data.session) {
                    useStore.getState().setAuthData(data.session.user.id, data.session.user.email ?? '');
                    set({ session: data.session, user: data.session.user, loading: false, error: null });
                    // Load profile in background
                    fetchProfileInBackground(data.session.user.id)
                        .then(profile => set({ profile }));
                }
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            }
        },

        signInWithOtp: async (email) => {
            set({ loading: true, error: null });
            try {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: window.location.origin },
                });
                if (error) throw error;
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            } finally {
                set({ loading: false });
            }
        },

        signOut: async () => {
            // Clear session immediately — AuthRoute redirects to /login at once.
            set({ session: null, user: null, profile: null, loading: false });
            useStore.getState().setAuthData('', '');
            // Revoke Supabase token in the background (fire-and-forget).
            supabase.auth.signOut().catch(() => {/* ignore — already locally signed out */});
        },
    };
});
