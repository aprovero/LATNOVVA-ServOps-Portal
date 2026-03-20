import { useStore } from '../store/useStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Users, Clock, AlertTriangle, FolderGit2 } from 'lucide-react';
import { useMemo, useEffect } from 'react';
import gsap from 'gsap';

export default function DataAnalysis() {
    const { reports, projects } = useStore();

    useEffect(() => {
        gsap.fromTo(
            '.dash-stagger',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out' }
        );
    }, []);

    // 1. Overall Project Health metrics
    const overallProgress = useMemo(() => {
        if (projects.length === 0) return 0;
        const total = projects.reduce((acc, p) => acc + p.progress, 0);
        return Math.round(total / projects.length);
    }, [projects]);

    // 2. Labor Hours trend
    const laborData = useMemo(() => {
        // Group by date
        const grouping: Record<string, number> = {};
        reports.forEach(r => {
            const date = r.date;
            const hours = r.labor?.reduce((acc, l) => acc + (l.hours * l.qty), 0) || 0;
            if (hours > 0) {
                grouping[date] = (grouping[date] || 0) + hours;
            }
        });

        return Object.entries(grouping).map(([date, hours]) => ({
            name: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            hours
        })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()).slice(-7); // Last 7 days
    }, [reports]);

    // 3. Incidents/Occurrences Distribution
    const incidentData = useMemo(() => {
        const counts: Record<string, number> = { 'Safety': 0, 'Weather Delay': 0, 'Equipment Failure': 0, 'Other': 0 };
        reports.forEach(r => {
            r.occurrences?.forEach(occ => {
                const desc = occ.description.toLowerCase();
                if (desc.includes('weather') || desc.includes('rain')) counts['Weather Delay']++;
                else if (desc.includes('equip') || desc.includes('machine') || desc.includes('broken')) counts['Equipment Failure']++;
                else if (desc.includes('safet') || desc.includes('injur') || desc.includes('hazard')) counts['Safety']++;
                else counts['Other']++;
            });
        });

        return Object.entries(counts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    }, [reports]);

    const COLORS = ['#0F766E', '#F59E0B', '#EF4444', '#64748B']; // Teal, Orange, Red, Gray

    // Stats calculations
    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const totalReports = reports.length;
    const totalHoursLog = reports.reduce((acc, r) => acc + (r.labor?.reduce((sum, l) => sum + (l.hours * l.qty), 0) || 0), 0);

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            <div className="dash-stagger flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Activity className="text-brand-teal" size={28} />
                        Global Intelligence
                    </h1>
                    <p className="text-gray-500 mt-1">Key metrics and operational analytics across all portfolios.</p>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div className="dash-stagger grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="card-container border-l-4 border-brand-teal p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Active Portfolios</p>
                        <FolderGit2 size={20} className="text-brand-teal" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{activeProjects}</p>
                </div>

                <div className="card-container border-l-4 border-blue-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Global Completion</p>
                        <TrendingUp size={20} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{overallProgress}%</p>
                </div>

                <div className="card-container border-l-4 border-purple-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Total Field Logs</p>
                        <FileTextIcon size={20} className="text-purple-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalReports}</p>
                </div>

                <div className="card-container border-l-4 border-orange-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Workforce Hrs</p>
                        <Clock size={20} className="text-orange-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalHoursLog.toLocaleString()}</p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="dash-stagger grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Labor Burn Rate Chart */}
                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <Users className="text-brand-teal" size={20} /> Field Labor Trends (Last 7 Days)
                    </h2>
                    <div className="h-72 w-full">
                        {laborData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={laborData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="hours" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                No labor data available for this period.
                            </div>
                        )}
                    </div>
                </div>

                {/* Risk / Incidents Chart */}
                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} /> Incident Distribution Map
                    </h2>
                    <div className="h-72 w-full flex items-center justify-center">
                        {incidentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={incidentData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {incidentData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Excellent! No incidents or delays logged.
                            </div>
                        )}
                    </div>
                    {/* Legend manually placed for better styling */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                        {incidentData.map((entry, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                <span className="text-xs font-bold text-gray-600">{entry.name} ({entry.value})</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}

// Inline Icon to avoid import failure if it doesn't exist
function FileTextIcon(props: any) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
}
