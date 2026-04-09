import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../../store/useStore';


// ─── GOD MODE ──────────────────────────────────────────────────────────────────
// Set GOD_MODE_ADMIN_EMAIL to the Supabase email that gets God Mode access.
// Works in bypass mode (email is seeded) AND real auth (aprovero logs in).
// Everyone else sees a normal interface with no God Mode UI.
// ───────────────────────────────────────────────────────────────────────────────
export const GOD_MODE_ADMIN_EMAIL = 'andres.provero@latnovva.com';

export const GOD_MODE_PERSONAS = {
    Manager:    { userId: 'GM-ANDRES', userEmail: 'andres.provero@latnovva.com',  displayName: 'Andres Provero' },
    Supervisor: { userId: 'GM-MARIN',  userEmail: 'marin.ledezma@latnovva.com',   displayName: 'Marin Ledezma' },
    Tech:       { userId: 'GM-JOSHUA', userEmail: 'joshua.sanchez@latnovva.com',  displayName: 'Joshua Sanchez' },
    Customer:   { userId: 'GM-CUST',   userEmail: 'customer@greensol.com',        displayName: 'Greensol' },
} as const;

export const AuthRoute: React.FC = () => {
    const { setAuthData, setUserRole, userRole, initDb } = useStore();

    // God Mode bootstrap — runs on first launch (unseeded store) or when
    // the logged-in user is the designated admin. This way:
    //   • Bypass mode: seeds aprovero's email on first run → God Mode UI appears.
    //   • Real auth: only aprovero's login email triggers this → others see nothing.
    useEffect(() => {
        const storedEmail  = useStore.getState().userEmail;
        const storedUserId = useStore.getState().userId;
        const isFirstRun       = !storedEmail || storedEmail === '';
        const isAdminEmail     = storedEmail === GOD_MODE_ADMIN_EMAIL;
        const isGodModeSession = storedUserId?.startsWith('GM-'); // any persona
        if (!isFirstRun && !isAdminEmail && !isGodModeSession) return;

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
