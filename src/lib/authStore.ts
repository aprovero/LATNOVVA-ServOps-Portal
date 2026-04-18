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

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,

    initializeAuth: async () => {
        set({ loading: true });
        try {
            // Get current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;

            // If session exists, fetch profile from personnel table
            let profile: PersonnelRow | null = null;
            if (session?.user) {
                const { data, error: profileError } = await supabase
                    .from('personnel')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    // Ignore not found error for now while mocking setup
                    console.error('Error fetching profile:', profileError);
                } else {
                    profile = data as PersonnelRow | null;
                }
            }

            // C-01: Bridge Supabase auth identity into main useStore
            if (session?.user) {
                useStore.getState().setAuthData(session.user.id, session.user.email ?? '');
                // Set role from profile if available
                const appRole = (profile as PersonnelRow | null)?.app_role;
                if (appRole) {
                    useStore.getState().setUserRole(appRole as any);
                }
            }

            set({ session, user: session?.user || null, profile, loading: false });

            // Listen for auth changes
            supabase.auth.onAuthStateChange(async (_event, newSession) => {
                let newProfile: PersonnelRow | null = null;
                if (newSession?.user) {
                    const { data } = await supabase
                        .from('personnel')
                        .select('*')
                        .eq('id', newSession.user.id)
                        .single();
                    newProfile = (data as PersonnelRow | null) ?? null;
                    // C-01: Keep main store identity in sync
                    useStore.getState().setAuthData(newSession.user.id, newSession.user.email ?? '');
                    const newRole = (data as PersonnelRow | null)?.app_role;
                    if (newRole) {
                        useStore.getState().setUserRole(newRole as any);
                    }
                } else {
                    // Signed out — reset to default
                    useStore.getState().setAuthData('', '');
                }
                set({ session: newSession, user: newSession?.user || null, profile: newProfile });
            });
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },

    signInWithEmail: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (error: any) {
            set({ error: error.message, loading: false });
            throw error; // Rethrow to handle in UI
        }
    },

    signInWithOtp: async (email) => {
        set({ loading: true, error: null });
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
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
            set({ session: null, user: null, profile: null, loading: false });
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    }
}));
