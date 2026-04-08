import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';

export const AuthRoute: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    // const location = useLocation();
    const { setAuthData } = useStore();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                // Future: We can fetch the user's role from the personnel table here
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setIsAuthenticated(!!session);
            if (session?.user) {
                // If the user logs in, we hydrate the store with their info
                setAuthData(session.user.id, session.user.email || '');
            }
        });

        return () => subscription.unsubscribe();
    }, [setAuthData]);

    // Loading state while checking session
    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    // DEBUG: Always authenticated for QA
    return <Outlet />;
    
    /* Original Auth Logic
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
    */
};
