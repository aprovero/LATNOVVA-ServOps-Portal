import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { useStore } from './store/useStore';
import { useAuthStore } from './lib/authStore';
import Projects from './pages/Projects';
import DataAnalysis from './pages/DataAnalysis';
import Settings from './pages/Settings';
import Tools from './pages/Tools';
import ReportList from './pages/ReportList';
import ReportEditor from './pages/ReportEditor';
import SubReportEditor from './pages/SubReportEditor';
import Templates from './pages/Templates';
import Calendar from './pages/Calendar';
import Layout from './components/layout/Layout';
import { AuthRoute } from './components/auth/AuthRoute';
import { Login } from './pages/Login';

import Personnel from './pages/Personnel';
import Timesheets from './pages/Timesheets';
import LiveMap from './pages/LiveMap';
import ProjectDetail from './pages/ProjectDetail';
import ClockIn from './pages/ClockIn';
import SplashScreen from './components/common/SplashScreen';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Guard: only Managers and Supervisors can access Settings.
const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
    const userRole = useStore(s => s.userRole);
    if (!['Manager', 'Supervisor'].includes(userRole)) return <Navigate to="/projects" replace />;
    return <>{children}</>;
};

// Redirect / to /clock-in for Techs, /projects for others
const HomeRedirect = () => {
    const userRole = useStore(s => s.userRole);
    const to = userRole === 'Tech' ? '/clock-in' : '/projects';
    return <Navigate to={to} replace />;
};

function App() {
    const { initDb } = useStore();

    useEffect(() => {
        // Initialize mock DB / offline storage on startup
        initDb();
        useStore.getState().initializeGlobalTemplates();
        
        // initializeAuth is now a no-op — onAuthStateChange in authStore fires automatically.
        // We still call it to avoid breaking any callers that may depend on it.
        useAuthStore.getState().initializeAuth();
    }, [initDb]);

    return (
        <>
            <SplashScreen onComplete={() => {}} />
            
            <Router>
                <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route element={<AuthRoute />}>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<HomeRedirect />} />
                        <Route path="projects" element={<Projects />} />
                    <Route path="projects/:id" element={<ProjectDetail />} />
                    <Route path="live-map" element={<LiveMap />} />
                    <Route path="reports" element={<ReportList />} />
                    <Route path="reports/:id" element={<ReportEditor />} />
                    <Route path="sub-reports/:id" element={<SubReportEditor />} />
                    <Route path="analysis" element={<DataAnalysis />} />
                    <Route path="tools" element={<Tools />} />
                    <Route path="templates" element={<Templates />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
                    <Route path="personnel" element={<Personnel />} />
                    <Route path="timesheets" element={<Timesheets />} />
                    <Route path="clock-in" element={<ClockIn />} />
                </Route>
                </Route>
            </Routes>
        </Router>
        </>
    );
}

export default App;
