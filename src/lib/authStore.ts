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
    updateAccount: (name: string, password?: string) => Promise<void>;
}

// Module-level guard to ensure the Supabase listener is only registered once
let isListenerRegistered = false;

// Fetches the personnel profile in the BACKGROUND and syncs role into the main store.
async function fetchProfileInBackground(userId: string): Promise<PersonnelRow | null> {
    try {
        const { data } = await (supabase as any)
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
        return null;
    }
}

export const useAuthStore = create<AuthState>((set, get) => {
    // ── AUTH HARDENING: IDEMPOTENT LISTENER ──────────────────────────────────
    if (!isListenerRegistered) {
        isListenerRegistered = true;
        
        supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`[Auth] State Change: ${event}`);

            // Handle "Invalid Refresh Token" or "Refresh Token Not Found"
            // If Supabase encounters a catastrophic refresh failure, we must purge local state.
            if (event === 'SIGNED_OUT' || (event === 'USER_UPDATED' && !newSession)) {
                useStore.getState().setAuthData('', '');
                set({ session: null, user: null, profile: null, loading: false });
                return;
            }

            if (!newSession?.user) {
                set({ loading: false });
                return;
            }

            // IDEMPOTENCY CHECK: Only update store if the session is truly different.
            // This prevents the #310 re-render loop if Supabase fires redundant events.
            const currentSession = get().session;
            if (currentSession?.access_token === newSession.access_token && currentSession?.user?.id === newSession.user.id) {
                set({ loading: false });
                return;
            }

            // ── STEP 1: Unblock the router immediately ───────────────────────
            useStore.getState().setAuthData(newSession.user.id, newSession.user.email ?? '');
            set({ session: newSession, user: newSession.user, loading: false });

            // ── STEP 2: Fetch profile in background ──────────────────────────
            const profile = await fetchProfileInBackground(newSession.user.id);
            set({ profile });
        });
    }

    return {
        session: null,
        user: null,
        profile: null,
        loading: true,
        error: null,

        initializeAuth: () => {
            // No-op: handled by the top-level listener during store creation.
        },

        signInWithEmail: async (email, password) => {
            set({ loading: true, error: null });
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                if (data.session) {
                    useStore.getState().setAuthData(data.session.user.id, data.session.user.email ?? '');
                    set({ session: data.session, user: data.session.user, loading: false, error: null });
                    fetchProfileInBackground(data.session.user.id).then(profile => set({ profile }));
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
            // Immediate local clear to unblock UI
            set({ session: null, user: null, profile: null, loading: false });
            useStore.getState().setAuthData('', '');
            
            // Clear any lingering locks or state in background
            try {
                await supabase.auth.signOut();
            } catch {
                // Ignore — session is already cleared locally
            }
        },

        updateAccount: async (name, password) => {
            set({ loading: true, error: null });
            try {
                const updateData: any = {
                    data: { name }
                };
                if (password) updateData.password = password;

                const { data, error: authError } = await supabase.auth.updateUser(updateData);
                if (authError) throw authError;

                // Update session state with new user metadata
                if (data.user) {
                    set({ user: data.user });
                }

                // Sync with personnel table if user is personnel
                const currentProfile = get().profile;
                if (currentProfile) {
                    const { error: dbError } = await supabase
                        .from('personnel')
                        .update({ name })
                        .eq('id', currentProfile.id);
                    
                    if (!dbError) {
                        set({ profile: { ...currentProfile, name } });
                        // Also update the main store personnel list to reflect name change globally
                        useStore.getState().updatePersonnel(currentProfile.id, { name });
                    }
                }

                set({ loading: false });
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            }
        },
    };
});
