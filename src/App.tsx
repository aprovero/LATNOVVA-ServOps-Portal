import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { useStore } from './store/useStore';
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

import Personnel from './pages/Personnel';
import Timesheets from './pages/Timesheets';
import OrgChart from './pages/OrgChart';
import LiveMap from './pages/LiveMap';
import ProjectDetail from './pages/ProjectDetail';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

function App() {
    const { initDb } = useStore();

    useEffect(() => {
        // Initialize mock DB / offline storage on startup
        initDb();
    }, [initDb]);

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/projects" replace />} />
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
                    <Route path="settings" element={<Settings />} />
                    <Route path="personnel" element={<Personnel />} />
                    <Route path="org-chart" element={<OrgChart />} />
                    <Route path="timesheets" element={<Timesheets />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
