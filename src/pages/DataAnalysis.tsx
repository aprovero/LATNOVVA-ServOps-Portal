import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, FolderGit2, TrendingUp, Clock, Timer, Users, PieChart as PieChartIcon, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
import gsap from 'gsap';
import { isThisMonth } from '../utils/datetime.utils';


export default function DataAnalysis() {
    const { t } = useTranslation();
    const { reports, projects, personnel, userRole, timesheets } = useStore();
    const [activeDiscipline, setActiveDiscipline] = useState<string>('All');

    const DISCIPLINE_OPTIONS = ['All', 'Mechanical', 'Commissioning', 'Civil', 'Electrical', 'Other'];

    useEffect(() => {
        const targets = document.querySelectorAll('.dash-stagger');
        if (targets.length > 0) {
            gsap.fromTo(
                targets,
                { y: 30, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out' }
            );
        }
    }, []);

    if (!['Manager', 'Supervisor', 'HR'].includes(userRole)) {
        return (
            <div className="flex flex-col items-center justify-center pt-24 text-gray-400">
                <AlertTriangle size={48} className="mb-4 text-status-warning/50" />
                <h2 className="text-xl font-bold text-accent-grey">{t('analysis.denied')}</h2>
                <p className="text-sm mt-2">{t('analysis.denied_desc')}</p>
            </div>
        );
    }

    // 1. Overall Project Health metrics
    const overallProgress = useMemo(() => {
        const relevantProjects = projects.filter(p => 
            p.status === 'Active' && 
            !p.hasNoDefinedScope && 
            (activeDiscipline === 'All' || p.disciplines?.includes(activeDiscipline))
        );
        if (relevantProjects.length === 0) return 0;
        const total = relevantProjects.reduce((acc, p) => acc + p.progress, 0);
        return Math.round(total / relevantProjects.length);
    }, [projects, activeDiscipline]);

    // 2. Labor Hours trend (this month) - Now sourced from Timesheets (Ground Truth)
    const laborData = useMemo(() => {
        const grouping: Record<string, number> = {};
        const relevantTimesheets = timesheets.filter(t => 
            isThisMonth(t.date) && 
            t.status === 'Approved' && 
            (activeDiscipline === 'All' || projects.find(p => p.id === t.projectId)?.disciplines?.includes(activeDiscipline))
        );
        
        relevantTimesheets.forEach(ts => {
            const date = ts.date;
            const hours = ts.hours || 0;
            if (hours > 0) {
                grouping[date] = (grouping[date] || 0) + hours;
            }
        });

        return Object.entries(grouping).map(([date, hours]) => ({
            date,
            name: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            hours
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [timesheets, projects, activeDiscipline]);

    // 3. Resource Utilization
    const utilizationData = useMemo(() => {
        const assignedIds = new Set<string>();
        
        // 1. Get IDs from project assignments (primary source)
        projects.filter(p => p.status === 'Active').forEach(p => {
            p.assignedPersonnel?.forEach(id => assignedIds.add(id));
        });

        // 2. Supplement with IDs from recent reports (last 7 days)
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
        
        // Unassigned count only includes active personnel who aren't assigned AND aren't exempt (like Andres)
        const unassignedCount = personnel.filter(p => 
            p.status === 'Active' && 
            !p.benchExempt && 
            !assignedIds.has(p.id)
        ).length;

        return [
            { name: 'Assigned', value: assignedCount },
            { name: 'Available', value: unassignedCount }
        ];
    }, [personnel, projects, reports]);

    // 5. Project Velocity (S-Curve)
    const velocityData = useMemo(() => {
        const relevantReports = reports.filter(r => activeDiscipline === 'All' || r.discipline === activeDiscipline);
        const relevantProjectsCount = projects.filter(p => 
            p.status === 'Active' && 
            !p.hasNoDefinedScope && 
            (activeDiscipline === 'All' || p.disciplines?.includes(activeDiscipline))
        ).length || 1;
        
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

    // 6. Lost Time by Category (this month)
    const lostTimeData = useMemo(() => {
        const relevantReports = reports.filter(r => isThisMonth(r.date) && (activeDiscipline === 'All' || r.discipline === activeDiscipline));
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

    // Monthly totals
    const now = new Date();
    const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const activeProjects = projects.filter(p => p.status === 'Active').length;

    // Monthly reports
    const monthlyReports = reports.filter(r => isThisMonth(r.date));

    // Monthly reports filtered by discipline
    const monthlyFilteredReports = monthlyReports.filter(r => activeDiscipline === 'All' || r.discipline === activeDiscipline);

    const totalReports = monthlyFilteredReports.length;

    // Monthly total hours sourced from approved timesheets
    const totalHoursLog = useMemo(() => {
        return timesheets
            .filter(ts => 
                isThisMonth(ts.date) && 
                ts.status === 'Approved' &&
                (activeDiscipline === 'All' || projects.find(p => p.id === ts.projectId)?.disciplines?.includes(activeDiscipline))
            )
            .reduce((acc, ts) => acc + (ts.hours || 0), 0);
    }, [timesheets, projects, activeDiscipline]);

    // Monthly lost time (in minutes)
    const totalLostTimeMins = useMemo(() => {
        return monthlyFilteredReports.reduce((acc, r) => {
            return acc + (r.occurrences?.reduce((sum, occ) => sum + (occ.durationMinutes || 0), 0) || 0);
        }, 0);
    }, [monthlyFilteredReports]);

    const lostTimeDisplay = totalLostTimeMins >= 60
        ? `${(totalLostTimeMins / 60).toFixed(1)}h`
        : `${totalLostTimeMins}m`;

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            <div className="dash-stagger flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Activity className="text-brand-teal" size={28} />
                        {t('analysis.title')}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {t('analysis.subtitle')}
                        <span className="ml-2 text-[11px] font-bold text-brand-teal/70 uppercase tracking-wider bg-brand-teal/5 border border-brand-teal/20 px-2 py-0.5 rounded-lg">{monthLabel}</span>
                    </p>
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

            <div className="dash-stagger grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="card-container border-l-4 border-brand-teal p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('analysis.stats.active_projects')}</p>
                        <FolderGit2 size={20} className="text-brand-teal" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{activeProjects}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{t('analysis.time_range.currently_active', 'Currently active')}</p>
                </div>

                <div className="card-container border-l-4 border-blue-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('analysis.stats.completion')}</p>
                        <TrendingUp size={20} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{overallProgress}%</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{t('analysis.time_range.active_portfolio_avg', 'Active portfolio avg')}</p>
                </div>

                <div className="card-container border-l-4 border-purple-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('analysis.stats.reports')}</p>
                        <FileTextIcon size={20} className="text-purple-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalReports}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{t('analysis.time_range.this_month')}</p>
                </div>

                <div className="card-container border-l-4 border-orange-500 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('analysis.stats.total_hours')}</p>
                        <Clock size={20} className="text-orange-500" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalHoursLog.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{t('analysis.time_range.this_month')}</p>
                </div>

                <div className="card-container border-l-4 border-red-400 p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('analysis.stats.lost_time')}</p>
                        <Timer size={20} className="text-red-400" />
                    </div>
                    <p className="text-3xl font-black text-accent-greyDark mt-2">{totalLostTimeMins > 0 ? lostTimeDisplay : '—'}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{t('analysis.time_range.this_month')}</p>
                </div>
            </div>

            <div className="dash-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <Users className="text-brand-teal" size={20} /> {t('analysis.stats.burn_rate')}
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
                        <PieChartIcon className="text-brand-teal" size={20} /> {t('analysis.stats.utilization')}
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
                            <span className="text-xs font-bold text-gray-600">{t('analysis.charts.assigned')} ({utilizationData[0].value})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                            <span className="text-xs font-bold text-gray-600">{t('analysis.charts.bench')} ({utilizationData[1].value})</span>
                        </div>
                    </div>
                </div>

                <div className="card-container">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} /> {t('analysis.lost_time_by_cat')}
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
                            <p className="text-sm font-medium">{t('analysis.no_lost_time')}</p>
                        </div>
                    )}
                </div>

                <div className="card-container lg:col-span-3">
                    <h2 className="text-lg font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <LineChartIcon className="text-blue-500" size={20} /> {t('analysis.project_velocity')}
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
