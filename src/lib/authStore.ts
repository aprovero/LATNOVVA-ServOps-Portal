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

// Helper: fetch profile and sync identity into the main store
async function syncSessionToStore(session: Session | null): Promise<PersonnelRow | null> {
    if (!session?.user) {
        useStore.getState().setAuthData('', '');
        return null;
    }

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
}

export const useAuthStore = create<AuthState>((set) => {
    // ── Register the listener ONE TIME when the store is created ─────────────
    // This is the single source of truth for all auth state changes.
    // It handles: first load, login, logout, token refresh, and tab resume.
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
        const newProfile = await syncSessionToStore(newSession);
        set({
            session: newSession,
            user: newSession?.user ?? null,
            profile: newProfile,
            loading: false,
        });
    });

    return {
        session: null,
        user: null,
        profile: null,
        loading: true, // start as true — onAuthStateChange fires immediately on load and clears this
        error: null,

        initializeAuth: () => {
            // The onAuthStateChange listener above fires automatically with the
            // current session on page load. We don't need to do anything here
            // anymore, but we keep this method so callers don't break.
            // It will be a no-op going forward.
        },

        signInWithEmail: async (email, password) => {
            set({ loading: true, error: null });
            try {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // loading: false is set by onAuthStateChange after session is confirmed
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
                // onAuthStateChange will fire with null session and set loading: false
            } catch (error: any) {
                set({ error: error.message, loading: false });
            }
        },
    };
});
