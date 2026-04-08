import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../../store/useStore';

// ─── GOD MODE ──────────────────────────────────────────────────────────────────
// Bypasses Supabase auth entirely for local QA testing.
// Default identity on boot = Manager (Andres Provero).
// Switch roles via the sidebar role selector.
// ───────────────────────────────────────────────────────────────────────────────
export const GOD_MODE_PERSONAS = {
    Manager:    { userId: 'GM-ANDRES', userEmail: 'andres.provero@latnovva.com',  displayName: 'Andres Provero' },
    Supervisor: { userId: 'GM-MARIN',  userEmail: 'marin.ledezma@latnovva.com',   displayName: 'Marin Ledezma' },
    Tech:       { userId: 'GM-CARLOS', userEmail: 'carlos.mendoza@latnovva.com',  displayName: 'Carlos Mendoza' },
    Customer:   { userId: 'GM-CUST',   userEmail: 'customer@client.com',          displayName: 'Client User' },
} as const;

export const AuthRoute: React.FC = () => {
    const { setAuthData, setUserRole, userRole } = useStore();

    // God Mode: unconditionally apply the correct persona on every mount.
    // This prevents stale Zustand persisted state from leaving us in a
    // partial / unknown identity regardless of what localStorage had.
    useEffect(() => {
        const currentRole = useStore.getState().userRole;
        // Default to Manager if no valid God Mode role is persisted
        const resolvedRole = (currentRole && currentRole in GOD_MODE_PERSONAS)
            ? currentRole as keyof typeof GOD_MODE_PERSONAS
            : 'Manager';
        const persona = GOD_MODE_PERSONAS[resolvedRole];
        setAuthData(persona.userId, persona.userEmail);
        setUserRole(resolvedRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep identity in sync when role changes via the sidebar switcher
    useEffect(() => {
        const persona = GOD_MODE_PERSONAS[userRole as keyof typeof GOD_MODE_PERSONAS];
        if (persona) {
            setAuthData(persona.userId, persona.userEmail);
        }
    }, [userRole, setAuthData]);

    // God Mode: always authenticated — no loading spinner, no redirect.
    return <Outlet />;
};
