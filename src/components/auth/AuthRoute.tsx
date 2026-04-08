import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../../store/useStore';


// ─── GOD MODE ──────────────────────────────────────────────────────────────────
// Bypasses Supabase UI auth for local QA testing.
// RLS is disabled on all tables — anon reads work without a session.
// Default identity on boot = Manager (Andres Provero).
// ───────────────────────────────────────────────────────────────────────────────
export const GOD_MODE_PERSONAS = {
    Manager:    { userId: 'GM-ANDRES', userEmail: 'andres.provero@latnovva.com',  displayName: 'Andres Provero' },
    Supervisor: { userId: 'GM-MARIN',  userEmail: 'marin.ledezma@latnovva.com',   displayName: 'Marin Ledezma' },
    Tech:       { userId: 'GM-JOSHUA', userEmail: 'joshua.sanchez@latnovva.com',  displayName: 'Joshua Sanchez' },
    Customer:   { userId: 'GM-CUST',   userEmail: 'customer@greensol.com',        displayName: 'Greensol' },
} as const;

export const AuthRoute: React.FC = () => {
    const { setAuthData, setUserRole, userRole, initDb } = useStore();

    // God Mode bootstrap — runs once on mount.
    // 1. Resolve stored role (default Manager).
    // 2. Sign in anonymously so Supabase has a valid session → RLS passes.
    // 3. Re-run initDb so personnel/projects/etc. are fetched with auth.
    useEffect(() => {
        const currentRole = useStore.getState().userRole;
        const resolvedRole = (currentRole && currentRole in GOD_MODE_PERSONAS)
            ? currentRole as keyof typeof GOD_MODE_PERSONAS
            : 'Manager';
        const persona = GOD_MODE_PERSONAS[resolvedRole];
        setAuthData(persona.userId, persona.userEmail);
        setUserRole(resolvedRole);

        // Re-fetch all data with the seeded identity.
        // RLS is disabled so the anon key reads succeed without a session.
        initDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep identity pill in sync when role changes via the sidebar switcher.
    useEffect(() => {
        const persona = GOD_MODE_PERSONAS[userRole as keyof typeof GOD_MODE_PERSONAS];
        if (persona) {
            setAuthData(persona.userId, persona.userEmail);
        }
    }, [userRole, setAuthData]);

    // God Mode: always authenticated — no redirect.
    return <Outlet />;
};
