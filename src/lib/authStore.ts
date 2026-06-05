import { create } from 'zustand';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { useStore } from '../store/useStore';

type PersonnelRow = Database['public']['Tables']['personnel']['Row'];

interface IdentityProfile {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
    client_id: string | null;
}

// Fetches the identity profile and optionally the personnel data.
async function fetchAccountData(userId: string): Promise<{ profile: IdentityProfile | null; personnel: PersonnelRow | null }> {
    try {
        // 1. Fetch the universal identity profile
        const { data: profileData } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = (profileData as IdentityProfile | null) ?? null;
        
        if (profile?.role) {
            useStore.getState().setUserRole(profile.role as any);
        }
        
        if (profile?.client_id) {
            useStore.getState().setClientId(profile.client_id);
        } else {
            useStore.getState().setClientId(null);
        }

        // 2. If they are NOT a customer, fetch their heavy personnel data
        let personnel: PersonnelRow | null = null;
        if (profile && profile.role !== 'Customer') {
            const { data: personnelData } = await (supabase as any)
                .from('personnel')
                .select('*')
                .eq('id', userId)
                .single();
            personnel = (personnelData as PersonnelRow | null) ?? null;
        }

        return { profile, personnel };
    } catch {
        return { profile: null, personnel: null };
    }
}


interface AuthState {
    session: Session | null;
    user: User | null;
    identity: IdentityProfile | null;
    profile: PersonnelRow | null; // Staff only
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

// ... (fetchAccountData remains the same)

export const useAuthStore = create<AuthState>((set, get) => {
    // ── AUTH HARDENING: IDEMPOTENT LISTENER ──────────────────────────────────
    if (!isListenerRegistered) {
        isListenerRegistered = true;
        
        supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`[Auth] State Change: ${event}`);

            try {
                // Handle "Invalid Refresh Token" or "Refresh Token Not Found"
                // If Supabase encounters a catastrophic refresh failure, we must purge local state.
                if (event === 'SIGNED_OUT' || (event === 'USER_UPDATED' && !newSession)) {
                    useStore.getState().resetDb();
                    set({ session: null, user: null, profile: null, loading: false });
                    window.location.href = '/login';
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

                // ── STEP 1: Fetch account data to set user role first ──────────
                useStore.getState().setAuthData(newSession.user.id, newSession.user.email ?? '');
                const { profile, personnel } = await fetchAccountData(newSession.user.id);

                // ── STEP 2: Initialize Database and Unblock Router ──────────────
                await useStore.getState().initDb();
                set({ 
                    session: newSession, 
                    user: newSession.user, 
                    identity: profile, 
                    profile: personnel, 
                    loading: false 
                });
            } catch (err: any) {
                console.error('[Auth Error] Catastrophic failure in auth listener:', err);
                // Hardened fallback: if this is an AuthApiError or related to token invalidation, wipe and reboot
                if (err?.name === 'AuthApiError' || err?.message?.includes('Refresh Token') || err?.message?.includes('token')) {
                    localStorage.clear();
                    window.location.href = '/login';
                } else {
                    set({ loading: false, error: 'Authentication failed' });
                }
            }
        });
    }

    return {
        session: null,
        user: null,
        identity: null,
        profile: null,
        loading: true,
        error: null,

        initializeAuth: async () => {
            console.log('[Auth] Initializing auth state explicitly...');
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) {
                    console.log('[Auth] No active session found on initialization.');
                    set({ loading: false });
                    return;
                }

                console.log('[Auth] Active session found on initialization, loading profile and DB...');
                useStore.getState().setAuthData(currentSession.user.id, currentSession.user.email ?? '');
                const { profile, personnel } = await fetchAccountData(currentSession.user.id);
                await useStore.getState().initDb();
                
                set({
                    session: currentSession,
                    user: currentSession.user,
                    identity: profile,
                    profile: personnel,
                    loading: false
                });
            } catch (err) {
                console.error('[Auth Error] Explicit initialization failed:', err);
                set({ loading: false });
            }
        },

        signInWithEmail: async (email, password) => {
            set({ loading: true, error: null });
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    console.error('[Auth Error Details] signInWithPassword failed:', error);
                    throw error;
                }
                
                if (data.session) {
                    useStore.getState().setAuthData(data.session.user.id, data.session.user.email ?? '');
                    const { profile, personnel } = await fetchAccountData(data.session.user.id);
                    await useStore.getState().initDb();
                    set({ 
                        session: data.session, 
                        user: data.session.user, 
                        identity: profile, 
                        profile: personnel, 
                        loading: false, 
                        error: null 
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
            console.log('[Auth] Initiating sign out sequence...');
            
            // ── STEP 2: Clear Local Stores ──────────────────────────────────
            set({ session: null, user: null, identity: null, profile: null, loading: false });
            useStore.getState().resetDb();
            
            // ── STEP 3: Clear Storage Hard Link ──────────────────────────────
            // This force-kills GoTrue locks and stale tokens that cause "nothing happens" loops.
            try {
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
                        localStorage.removeItem(k);
                    }
                });
            } catch (e) {
                console.warn('[Auth] Failed to purge localStorage:', e);
            }

            // ── STEP 4: Supabase Cloud SignOut ──────────────────────────────
            try {
                // Non-blocking call — session is already cleared locally.
                supabase.auth.signOut().catch(() => {});
            } catch {
                // Ignore — local state is primary
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
                    const { error: dbError } = await (supabase as any)
                        .from('personnel')
                        .update({ name })
                        .eq('id', currentProfile.id);
                    
                    if (!dbError) {
                        // LATNOVVA SYSTEM OPS // v2.5.8
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
