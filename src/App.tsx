import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { useStore } from './store/useStore';
import { useAuthStore } from './lib/authStore';
import {
    normalizeRole,
    isStaffRole,
    canAccessSettings,
    canAccessManagerHR,
    canAccessOps,
} from './lib/roleAuth';
import { attemptOneShotChunkRecovery, clearChunkRecoveryMarker } from './lib/chunkRecovery';
import Layout from './components/layout/Layout';
import { AuthRoute } from './components/auth/AuthRoute';
import { Login } from './pages/Login';
import ClockIn from './pages/ClockIn';
import Projects from './pages/Projects';
import SplashScreen from './components/common/SplashScreen';
import FaceLockScreen from './components/shared/FaceLockScreen';
import VersionUpdateGate from './components/VersionUpdateGate';
import PasswordChangeGate from './components/PasswordChangeGate';
import StagingBanner from './components/common/StagingBanner';

function lazyWithRecovery<T extends React.ComponentType<any>>(
    importer: () => Promise<{ default: T }>
) {
    return lazy(async () => {
        try {
            const mod = await importer();
            clearChunkRecoveryMarker();
            return mod;
        } catch (err) {
            const res = await attemptOneShotChunkRecovery(err);
            if (res.recovered) {
                // Keep Suspense mounted briefly while page reloads
                return new Promise<{ default: T }>(() => {});
            }
            throw err;
        }
    });
}

// Lazy-loaded heavy routes with one-shot ChunkLoadError recovery
const ProjectDetail = lazyWithRecovery(() => import('./pages/ProjectDetail'));
const LiveMap = lazyWithRecovery(() => import('./pages/LiveMap'));
const Settings = lazyWithRecovery(() => import('./pages/Settings'));
const Personnel = lazyWithRecovery(() => import('./pages/Personnel'));
const Timesheets = lazyWithRecovery(() => import('./pages/Timesheets'));
const Attendance = lazyWithRecovery(() => import('./pages/Attendance'));
const SurveyResults = lazyWithRecovery(() => import('./pages/SurveyResults'));
const Nomina = lazyWithRecovery(() => import('./pages/Nomina'));
const CommercialPortal = lazyWithRecovery(() => import('./pages/CommercialPortal'));

gsap.registerPlugin(ScrollTrigger);

const RouteFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-sm font-medium">
        <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
            <span>Cargando módulo...</span>
        </div>
    </div>
);

const UnauthorizedFallback = () => {
    const userRole = useStore(s => s.userRole);
    const normalized = normalizeRole(userRole);
    if (!normalized) {
        return <Navigate to="/login" replace />;
    }
    if (normalized === 'Customer') return <Navigate to="/projects" replace />;
    if (normalized === 'Tech') return <Navigate to="/clock-in" replace />;
    if (normalized === 'HR') return <Navigate to="/attendance" replace />;
    return <Navigate to="/projects" replace />;
};

// Guard: Settings & User Administration (Manager and HR only — aligned with hardened server RPCs)
const SettingsRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!canAccessSettings(userRole)) return <UnauthorizedFallback />;
    return <>{children}</>;
};

// Guard: Attendance, Nomina & Survey Results (Manager and HR only)
const ManagerHRRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!canAccessManagerHR(userRole)) return <UnauthorizedFallback />;
    return <>{children}</>;
};

// Guard: Live Map & Personnel Directory View (Manager, HR, Supervisor)
const OpsRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!canAccessOps(userRole)) return <UnauthorizedFallback />;
    return <>{children}</>;
};

// Guard: Fail-closed explicit Staff roles (Manager, HR, Supervisor, Office, Tech). Denies Customer, null, unknown.
const StaffRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!isStaffRole(userRole)) return <UnauthorizedFallback />;
    return <>{children}</>;
};

// Guard: Any valid authenticated role (denies null/unknown/malformed roles)
const ValidRoleRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!normalizeRole(userRole)) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

// Redirect / based on explicit normalized role (fail-closed if role is null/unknown)
const HomeRedirect = () => {
    const userRole = useStore(s => s.userRole);
    const normalized = normalizeRole(userRole);
    if (!normalized) return <Navigate to="/login" replace />;
    if (normalized === 'Tech') return <Navigate to="/clock-in" replace />;
    if (normalized === 'HR') return <Navigate to="/attendance" replace />;
    return <Navigate to="/projects" replace />;
};

function App() {
    const sessionUserId = useAuthStore(s => s.session?.user?.id ?? null);
    const enableFastLogin = useStore(s => s.platformSettings.enableFastLogin);
    const prevUserIdRef = useRef<string | null>(null);

    const [isAppLocked, setIsAppLocked] = useState(() => {
        return localStorage.getItem('device_fast_login_enabled') === 'true';
    });

    useEffect(() => {
        useStore.getState().initializeGlobalTemplates();
        useAuthStore.getState().initializeAuth();

        if (typeof window !== 'undefined') {
            if ('requestIdleCallback' in window) {
                const idleId = (window as any).requestIdleCallback(() =>
                    import('./utils/faceId.utils').then(m => m.loadFaceModels()).catch(() => {})
                );
                return () => {
                    if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(idleId);
                };
            }
            const timerId = setTimeout(
                () => import('./utils/faceId.utils').then(m => m.loadFaceModels()).catch(() => {}),
                1500
            );
            return () => clearTimeout(timerId);
        }
    }, []);

    useEffect(() => {
        if (!sessionUserId) {
            prevUserIdRef.current = null;
            setIsAppLocked(false);
        } else if (prevUserIdRef.current !== sessionUserId) {
            prevUserIdRef.current = sessionUserId;
            if (localStorage.getItem('device_fast_login_enabled') === 'true') {
                setIsAppLocked(true);
            }
        }
    }, [sessionUserId]);

    const showLockScreen = !!sessionUserId && isAppLocked && enableFastLogin;

    return (
        <>
            <StagingBanner />
            <VersionUpdateGate />
            <PasswordChangeGate />

            <SplashScreen onComplete={() => {}} />

            {showLockScreen && (
                <FaceLockScreen onUnlock={() => setIsAppLocked(false)} />
            )}

            <Router>
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/commercial-portal" element={<CommercialPortal />} />

                        <Route element={<AuthRoute />}>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<HomeRedirect />} />
                                <Route path="projects" element={<ValidRoleRoute><Projects /></ValidRoleRoute>} />
                                <Route path="projects/:id" element={<ValidRoleRoute><ProjectDetail /></ValidRoleRoute>} />
                                <Route path="live-map" element={<OpsRoute><LiveMap /></OpsRoute>} />
                                <Route path="settings" element={<SettingsRoute><Settings /></SettingsRoute>} />
                                <Route path="personnel" element={<OpsRoute><Personnel /></OpsRoute>} />
                                <Route path="timesheets" element={<StaffRoute><Timesheets /></StaffRoute>} />
                                <Route path="attendance" element={<ManagerHRRoute><Attendance /></ManagerHRRoute>} />
                                <Route path="survey-results" element={<ManagerHRRoute><SurveyResults /></ManagerHRRoute>} />
                                <Route path="nomina" element={<ManagerHRRoute><Nomina /></ManagerHRRoute>} />
                                <Route path="clock-in" element={<StaffRoute><ClockIn /></StaffRoute>} />
                                <Route path="*" element={<HomeRedirect />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </Router>
        </>
    );
}

export default App;
