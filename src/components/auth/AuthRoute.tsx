import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../lib/authStore';

export const AuthRoute: React.FC = () => {
    // ─── AUTH HARDENING ────────────────────────────────────────────────────────
    // We use a selector to only subscribe to session and loading state.
    // This stops the infinite render loop caused by watching the whole store.
    const session = useAuthStore(state => state.session);
    const loading = useAuthStore(state => state.loading);

    React.useEffect(() => {
        // Hardened Auth Guard: Imperative redirect if initialized but no session
        if (!loading && !session) {
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
    }, [loading, session]);

    if (loading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <img src="/cor-logo.png" alt="Loading" className="h-8 animate-pulse opacity-50" />
                    <div className="w-6 h-6 border-2 border-[#0097A7] border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!session) {
        return null; // The useEffect will handle the redirect imperatively to completely wipe memory state
    }

    // Pass the wall smoothly. Logic for identity is now strictly handled by
    // the Supabase session and personnel profile in background, with NO 
    // reactive persona switching loops.
    return <Outlet />;
};
