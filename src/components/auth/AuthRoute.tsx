import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../lib/authStore';

// ─── GOD MODE CONSTANTS ──────────────────────────────────────────────────────────
export const GOD_MODE_ADMIN_EMAIL = 'aprovero@latnovva.com';

// We map generic aliases since real UUIDs will be resolved dynamically
export const GOD_MODE_PERSONAS = {
    Manager:    { idAlias: 'GM-Manager',    role: 'Manager',    searchName: 'Andres',   displayName: 'Andres Provero' },
    Supervisor: { idAlias: 'GM-Supervisor', role: 'Supervisor', searchName: 'Marin',    displayName: 'Marin Ledezma' },
    Tech:       { idAlias: 'GM-Tech',       role: 'Tech',       searchName: 'Joshua',   displayName: 'Joshua Sanchez' },
    Customer:   { idAlias: 'GM-Customer',   role: 'Customer',   searchName: 'Greensol', displayName: 'Customer Admin' },
    HR:         { idAlias: 'GM-HR',         role: 'HR',         searchName: 'Alicia',   displayName: 'Alicia Mendez' },
} as const;

export const AuthRoute: React.FC = () => {
    const { session, loading } = useAuthStore();
    const { userRole, setAuthData, setClientId } = useStore();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <img src="/cor-logo.png" alt="Loading" className="h-8 animate-pulse opacity-50" />
                    <div className="w-6 h-6 border-2 border-[#0097A7] border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // Keep identity pill + clientId in sync when role changes via the switcher.
    // If God Mode is active and switching personas, use dynamic lookup to find true personnel IDs.
    useEffect(() => {
        const isGodModeActivated = useAuthStore.getState().user?.email === GOD_MODE_ADMIN_EMAIL;
        if (!isGodModeActivated) return;

        const persona = GOD_MODE_PERSONAS[userRole as keyof typeof GOD_MODE_PERSONAS];
        if (persona) {
            const allPersonnel = useStore.getState().personnel;
            const targetUser = allPersonnel.find(p => p.name.toLowerCase().includes(persona.searchName.toLowerCase()));
            
            if (targetUser) {
                setAuthData(targetUser.id, targetUser.email || '');
            } else {
                setAuthData(persona.idAlias, GOD_MODE_ADMIN_EMAIL);
            }

            // Keep the clientId synced if customer is picked.
            if (userRole === 'Customer') {
                 const clients = useStore.getState().clients;
                 const greensol = clients.find(c => c.name.toLowerCase().includes('greensol'));
                 if (greensol && useStore.getState().clientId !== greensol.id) {
                     setClientId(greensol.id);
                 }
            }
        }
    }, [userRole, setAuthData, setClientId]);

    // Pass the wall smoothly.
    return <Outlet />;
};
