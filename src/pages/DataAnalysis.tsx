import { useStore } from '../store/useStore';
import { Activity, TrendingUp, Users, Clock, AlertTriangle, FolderGit2, PieChart as PieChartIcon, LineChart as LineChartIcon } from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import gsap from 'gsap';

export default function DataAnalysis() {
    const { reports, projects, personnel, userRole } = useStore();
    const [activeDiscipline, setActiveDiscipline] = useState<string>('All');

    const DISCIPLINE_OPTIONS = ['All', 'Mechanical', 'Commissioning', 'Civil', 'Electrical', 'Other'];

    if (userRole !== 'Manager') {
        return (
            <div className="flex flex-col items-center justify-center pt-24 text-gray-400">
                <AlertTriangle size={48} className="mb-4 text-status-warning/50" />
                <h2 className="text-xl font-bold text-accent-grey">Access Denied</h2>
                <p className="text-sm mt-2">Global intelligence requires Manager privileges.</p>
            </div>
        );
    }

    useEffect(() => {
        gsap.fromTo(
            '.dash-stagger',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out' }
        );
    }, []);

    // 1. Overall Project Health metrics
    const overallProgress = useMemo(() => {
        const relevantProjects = projects.filter(p => !p.hasNoDefinedScope && (activeDiscipline === 'All' || p.disciplines?.includes(activeDiscipline)));
        if (relevantProjects.length === 0) return 0;
        const total = relevantProjects.reduce((acc, p) => acc + p.progress, 0);
        return Math.round(total / relevantProjects.length);
    }, [projects, activeDiscipline]);

    // 2. Labor Hours trend
    const laborData = useMemo(() => {
        const grouping: Record<string, number> = {};
        const relevantReports = reports.filter(r => activeDiscipline === 'All' || r.discipline === activeDiscipline);
        
        relevantReports.forEach(r => {
            const date = r.date;
            const hours = r.labor?.reduce((acc, l) => acc + (l.hours * l.qty), 0) || 0;
            if (hours > 0) {
                grouping[date] = (grouping[date] || 0) + hours;
            }
        });

        return Object.entries(grouping).map(([date, hours]) => ({
            date,
            name: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            hours
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);
    }, [reports, activeDiscipline]);

    // 3. Resource Utilization
    const utilizationData = useMemo(() => {
        const activePersonnel = personnel.filter(p => p.status === 'Active');
        const assignedIds = new Set<string>();
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        reports.forEach(r => {
            if (new Date(r.date) >= last7Days) {
                r.labor?.forEach(l => {
                    if (l.personnelId) assignedIds.add(l.personnelId);
                });
            }
        });

        const assignedCount = assignedIds.size;
        const unassignedCount = Math.max(0, activePersonnel.length - assignedCount);

        return [
            { name: 'Assigned', value: assignedCount },
            { name: 'Available', value: unassignedCount }
        ];
    }, [personnel, reports]);

    // 5. Project Velocity (S-Curve)
    const velocityData = useMemo(() => {
        const relevantReports = reports.filter(r => activeDiscipline === 'All' || r.discipline === activeDiscipline);
        const relevantProjectsCount = projects.filter(p => !p.hasNoDefinedScope && (activeDiscipline === 'All' || p.disciplines?.includes(activeDiscipline))).length || 1;
        
        const sortedReports = [...relevantReports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const dates = Array.from(new Set(sortedReports.map(r => r.date))).sort();
        
        let cumulativeProgress = 0;
        const result = dates.map(date => {
            const dayReports = sortedReports.filter(r => r.date === date);
            const dailyDelta = dayReports.reduce((acc, r) => {
                const logDelta = r.activityLogs?.reduce((sum, log) => sum + (log.progressReported || 0), 0) || 0;
                return acc + logDelta;
            }, 0) / relevantProjectsCount;
            
            cumulativeProgress = Math.min(100, cumulativeProgress + dailyDelta);
            return {
                name: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                progress: Math.round(cumulativeProgress)
            };
        });

        if (result.length < 2) {
             return [
                 { name: 'Phase 1', progress: 0 },
                 { name: 'Current', progress: overallProgress }
             ];
        }
        return result;
    }, [reports, projects, overallProgress, activeDiscipline]);

    // 6. Lost Time by Category
    const lostTimeData = useMemo(() => {
        const relevantReports = reports.filter(r => activeDiscipline === 'All' || r.discipline === activeDiscipline);
        const grouping: Record<string, number> = {};
        
        relevantReports.forEach(r => {
            if (r.occurrences) {
                r.occurrences.forEach(occ => {
                    if (occ.durationMinutes && occ.durationMinutes > 0) {
                        const cat = occ.category || 'Other';
                        grouping[cat] = (grouping[cat] || 0) + occ.durationMinutes;
                    }
                });
            }
        });

        const totalLostMins = Object.values(grouping).reduce((sum, val) => sum + val, 0);
        
        if (totalLostMins === 0) return [];

        return Object.entries(grouping)
            .map(([name, value]) => ({
                name,
                value,
                percentage: Math.round((value / totalLostMins) * 100)
            }))
            .sort((a, b) => b.value - a.value);
    }, [reports, activeDiscipline]);

    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const totalReports = reports.length;
    const totalHoursLog = reports.reduce((acc, r) => acc + (r.labor?.reduce((sum, l) => sum + (l.hours * l.qty), 0) || 0), 0);

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            <div className="dash-stagger flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Activity className="text-brand-teal" size={28} />
                        Intelligence Feed
                    </h1>
                    <p className="text-gray-500 mt-1">Operational analytics and portfolio trends.</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    {DISCIPLINE_OPTIONS.map(d => (
                        <button
                            key={d}
                            onClick={() => setActiveDiscipline(d)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${activeDiscipline === d ? 'bg-brand-teal text-white border-brand-teal shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dash-stagger grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="card-container border-l-4 border-brand-teal p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Active Projects</p>
                        <FolderGit2 size={20} className="text-brand-teal" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{activeProjects}</p>
                </div>

                <div className="card-container border-l-4 border-blue-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Completion</p>
                        <TrendingUp size={20} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{overallProgress}%</p>
                </div>

                <div className="card-container border-l-4 border-purple-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Reports</p>
                        <FileTextIcon size={20} className="text-purple-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalReports}</p>
                </div>

                <div className="card-container border-l-4 border-orange-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Total Hours</p>
                        <Clock size={20} className="text-orange-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalHoursLog.toLocaleString()}</p>
                </div>
            </div>

            <div className="dash-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <Users className="text-brand-teal" size={20} /> Labor Burn Rate
                    </h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={laborData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} />
                                <RechartsTooltip cursor={{ fill: '#F1F5F9' }} />
                                <Bar dataKey="hours" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <PieChartIcon className="text-brand-teal" size={20} /> Resource Utilization
                    </h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={utilizationData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                                    <Cell fill="#0F766E" />
                                    <Cell fill="#E2E8F0" />
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-brand-teal"></span>
                            <span className="text-xs font-bold text-gray-600">Assigned ({utilizationData[0].value})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                            <span className="text-xs font-bold text-gray-600">Bench ({utilizationData[1].value})</span>
                        </div>
                    </div>
                </div>

                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} /> Lost Time by Category
                    </h2>
                    {lostTimeData.length > 0 ? (
                        <>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={lostTimeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                                            {lostTimeData.map((_entry, index) => {
                                                const colors = ['#F97316', '#EAB308', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'];
                                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                            })}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `${Math.round((value as number)/60*10)/10} hrs`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 mt-2">
                                {lostTimeData.map((entry, index) => {
                                    const colors = ['#F97316', '#EAB308', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'];
                                    return (
                                        <div key={entry.name} className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></span>
                                            <span className="text-xs font-bold text-gray-600">{entry.name} ({entry.percentage}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="h-72 flex items-center justify-center text-gray-400">
                            <p className="text-sm font-medium">No lost time reported</p>
                        </div>
                    )}
                </div>

                <div className="card-container lg:col-span-3">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <LineChartIcon className="text-blue-500" size={20} /> Project Velocity (S-Curve)
                    </h2>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={velocityData}>
                                <defs>
                                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} unit="%" />
                                <RechartsTooltip />
                                <Area type="monotone" dataKey="progress" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" dot={{ r: 4, fill: '#3B82F6' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FileTextIcon(props: any) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
}
