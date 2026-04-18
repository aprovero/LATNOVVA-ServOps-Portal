import { create } from 'zustand';
import { supabase } from './supabaseClient';
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

// Helper: fetch profile and sync identity into the main store.
// Never throws — always returns null on any error.
async function syncSessionToStore(session: Session | null): Promise<PersonnelRow | null> {
    if (!session?.user) {
        useStore.getState().setAuthData('', '');
        return null;
    }

    try {
        const { data } = await supabase
            .from('personnel')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const profile = (data as PersonnelRow | null) ?? null;
        useStore.getState().setAuthData(session.user.id, session.user.email ?? '');
        const appRole = profile?.app_role;
        if (appRole) {
            useStore.getState().setUserRole(appRole as any);
        }
        return profile;
    } catch {
        // Profile row may not exist yet for new users — still sync identity
        useStore.getState().setAuthData(session.user.id, session.user.email ?? '');
        return null;
    }
}

export const useAuthStore = create<AuthState>((set) => {
    // ── Register the listener ONE TIME when the store is created ─────────────
    // This handles: initial page load, login, logout, token refresh, tab resume.
    // Use the subscription's data.session for the initial call to avoid
    // an extra round-trip on every reload.
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
        try {
            const newProfile = await syncSessionToStore(newSession);
            set({
                session: newSession,
                user: newSession?.user ?? null,
                profile: newProfile,
                loading: false,
            });
        } catch {
            // Should never reach here since syncSessionToStore is safe, but
            // always ensure loading is cleared so the UI doesn't freeze.
            set({ session: newSession, user: newSession?.user ?? null, loading: false });
        }
    });

    return {
        session: null,
        user: null,
        profile: null,
        // Start as true — onAuthStateChange fires immediately on load with
        // the current session (INITIAL_SESSION event) and sets this to false.
        loading: true,
        error: null,

        // No-op: kept for API compatibility. The listener above handles everything.
        initializeAuth: () => {},

        signInWithEmail: async (email, password) => {
            set({ loading: true, error: null });
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Proactively sync state immediately rather than waiting for the
                // onAuthStateChange event, to eliminate any UI delay.
                if (data.session) {
                    const profile = await syncSessionToStore(data.session);
                    set({
                        session: data.session,
                        user: data.session.user,
                        profile,
                        loading: false,
                        error: null,
                    });
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
            set({ loading: true });
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                // onAuthStateChange will fire SIGNED_OUT and clear session.
                // We also clear here immediately for instant UI response.
                set({ session: null, user: null, profile: null, loading: false });
                useStore.getState().setAuthData('', '');
            } catch (error: any) {
                set({ error: error.message, loading: false });
            }
        },
    };
});
