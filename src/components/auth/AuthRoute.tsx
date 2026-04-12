import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../../store/useStore';


// ─── GOD MODE ──────────────────────────────────────────────────────────────────
// Set GOD_MODE_ADMIN_EMAIL to the Supabase email that gets God Mode access.
// Works in bypass mode (email is seeded) AND real auth (aprovero logs in).
// Everyone else sees a normal interface with no God Mode UI.
// ───────────────────────────────────────────────────────────────────────────────
export const GOD_MODE_ADMIN_EMAIL = 'aprovero@latnovva.com';

export const GOD_MODE_PERSONAS = {
    Manager:    { userId: 'PERS-GOD',  userEmail: 'aprovero@latnovva.com',        displayName: 'Andres Provero' },
    Supervisor: { userId: 'PERS-BY2',  userEmail: 'msalaya@latnovva.com',         displayName: 'Marin Ledezma' },
    Tech:       { userId: 'PERS-BF7',  userEmail: 'jsanchez@latnovva.com',        displayName: 'Joshua Sanchez' },
    Customer:   { userId: 'GM-CUST',   userEmail: 'customer@greensol.com',        displayName: 'Greensol' },
    HR:         { userId: 'PERS-HR1',  userEmail: 'amendez@latnovva.com',         displayName: 'Alicia Mendez' },
} as const;

export const AuthRoute: React.FC = () => {
    const { setAuthData, setUserRole, userRole, initDb, setClientId } = useStore();

    // God Mode bootstrap — runs on first launch (unseeded store) or when
    // the logged-in user is the designated admin. This way:
    //   • Bypass mode: seeds aprovero's email on first run → God Mode UI appears.
    //   • Real auth: only aprovero's login email triggers this → others see nothing.
    useEffect(() => {
        const storedEmail  = useStore.getState().userEmail;
        const storedUserId = useStore.getState().userId;
        const isFirstRun       = !storedEmail || storedEmail === '';
        const isAdminEmail     = storedEmail === GOD_MODE_ADMIN_EMAIL;
        
        // Include any email/ID from the God Mode personas list
        const isPersonaMatch = Object.values(GOD_MODE_PERSONAS).some(p => p.userEmail === storedEmail || p.userId === storedUserId);
        const isGodModeSession = storedUserId?.startsWith('GM-') || isPersonaMatch;

        if (!isFirstRun && !isAdminEmail && !isGodModeSession) return;

        const currentRole = useStore.getState().userRole;
        const resolvedRole = (currentRole && currentRole in GOD_MODE_PERSONAS)
            ? currentRole as keyof typeof GOD_MODE_PERSONAS
            : 'Manager';
        const persona = GOD_MODE_PERSONAS[resolvedRole];
        setAuthData(persona.userId, persona.userEmail);
        setUserRole(resolvedRole);

        // Re-fetch all data. After load, auto-assign clientId for Customer persona.
        initDb().then(() => {
            if (resolvedRole === 'Customer') {
                const clients = useStore.getState().clients;
                const greensol = clients.find(c => c.name.toLowerCase().includes('greensol'));
                if (greensol) setClientId(greensol.id);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep identity pill + clientId in sync when role changes via the switcher.
    useEffect(() => {
        const persona = GOD_MODE_PERSONAS[userRole as keyof typeof GOD_MODE_PERSONAS];
        if (persona) {
            setAuthData(persona.userId, persona.userEmail);
            // For Customer persona, resolve and set Greensol's real clientId.
            if (userRole === 'Customer') {
                const clients = useStore.getState().clients;
                const greensol = clients.find(c => c.name.toLowerCase().includes('greensol'));
                if (greensol) setClientId(greensol.id);
            }
        }
    }, [userRole, setAuthData, setClientId]);

    // God Mode: always authenticated — no redirect.
    return <Outlet />;
};
