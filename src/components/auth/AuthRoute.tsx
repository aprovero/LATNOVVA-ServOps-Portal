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

    // On first mount, inject the God Mode default identity (Manager).
    // Only do this if userId is still the uninitialized default.
    useEffect(() => {
        const currentId = useStore.getState().userId;
        if (!currentId || currentId === 'USR-Current') {
            const persona = GOD_MODE_PERSONAS['Manager'];
            setAuthData(persona.userId, persona.userEmail);
            setUserRole('Manager');
        }
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
