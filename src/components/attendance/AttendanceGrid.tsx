import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Personnel, Project, TimesheetEntry, AttendanceOverride, WorkSchedule } from '../../store/useStore';
import { calculateDailyAttendance } from '../../utils/attendanceCalculations';
import DayDetailPanel from './DayDetailPanel';

interface AttendanceGridProps {
    employees: Personnel[];
    projects: Project[];
    timesheets: TimesheetEntry[];
    overrides: AttendanceOverride[];
    schedules: WorkSchedule[];
    startDate: string;
    endDate: string;
    filters: {
        search: string;
        project: string;
        statusFilter: string | null;
        activeFilter: 'all' | 'active' | 'inactive';
        missingPunchesOnly: boolean;
        overtimeOnly: boolean;
        conflictsOnly: boolean;
        clockedInTodayOnly: boolean;
    };
}

export default function AttendanceGrid({
    employees,
    projects,
    timesheets,
    overrides,
    schedules,
    startDate,
    endDate,
    filters
}: AttendanceGridProps) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'es';

    const [selectedCell, setSelectedCell] = useState<{ employee: Personnel; date: string; project?: Project } | null>(null);

    // Get date array in range
    const getDatesInRange = (startStr: string, endStr: string): string[] => {
        const dates: string[] = [];
        const current = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const dates = getDatesInRange(startDate, endDate);

    // Apply filtering to employees
    const filteredEmployees = employees.filter(emp => {
        // Active / Inactive filter
        if (filters.activeFilter === 'active' && emp.status !== 'Active') return false;
        if (filters.activeFilter === 'inactive' && emp.status !== 'Inactive') return false;

        // Search text
        if (filters.search && !emp.name.toLowerCase().includes(filters.search.toLowerCase())) return false;

        // Assigned project OR project clocked in during selected range
        const empProject = projects.find(p => p.assignedPersonnel?.includes(emp.id));
        const hasClockedInProject = timesheets.some(
            t => t.personnelId === emp.id && dates.includes(t.date) && t.projectId === filters.project
        );
        if (filters.project && empProject?.id !== filters.project && !hasClockedInProject) return false;

        // Filter by who clocked in today
        if (filters.clockedInTodayOnly) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayView = calculateDailyAttendance(emp, todayStr, timesheets, overrides, schedules, lang);
            const clockedInToday = ['present', 'home_office', 'home office', 'conflict', 'missing_punch', 'missing punch'].includes(todayView.displayStatus.toLowerCase());
            if (!clockedInToday) return false;
        }

        // Compute daily views to filter by KPIs/flags
        let hasConflict = false;
        let hasMissingPunch = false;
        let hasOvertime = false;
        let matchedStatus = false;

        for (const date of dates) {
            const dv = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
            if (dv.conflict) hasConflict = true;
            if (dv.missingPunch) hasMissingPunch = true;
            if ((dv.overtimeHours || 0) > 0) hasOvertime = true;
            if (filters.statusFilter && dv.displayStatus.toLowerCase() === filters.statusFilter.toLowerCase()) {
                matchedStatus = true;
            }
        }

        if (filters.conflictsOnly && !hasConflict) return false;
        if (filters.missingPunchesOnly && !hasMissingPunch) return false;
        if (filters.overtimeOnly && !hasOvertime) return false;
        if (filters.statusFilter && !matchedStatus) return false;

        return true;
    });

    // Formatting date headers
    const formatDateHeader = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const dayName = d.toLocaleDateString(i18n.language, { weekday: 'short' }).toUpperCase();
        const dayNum = d.getDate();
        return { dayName, dayNum };
    };

    // Color codes mapping (Left Accent Stripe Design)
    const statusStyles: Record<string, { bg: string; text: string; border: string; label: string; es: string }> = {
        'Present': { bg: 'bg-emerald-50/20', text: 'text-emerald-800', border: 'border-l-emerald-500', label: 'Present', es: 'Laborado' },
        'Vacation': { bg: 'bg-indigo-50/20', text: 'text-indigo-800', border: 'border-l-indigo-500', label: 'Vacation', es: 'Vacaciones' },
        'Sick Leave': { bg: 'bg-red-50/20', text: 'text-red-800', border: 'border-l-red-500', label: 'Sick Leave', es: 'Incapacidad' },
        'Home Office': { bg: 'bg-purple-50/20', text: 'text-purple-800', border: 'border-l-purple-500', label: 'Home Office', es: 'Home Office' },
        'Personal Leave': { bg: 'bg-pink-50/20', text: 'text-pink-800', border: 'border-l-pink-500', label: 'Leave', es: 'Permiso' },
        'Unpaid Leave': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-l-gray-400', label: 'Unpaid', es: 'Permiso S/G' },
        'Training': { bg: 'bg-blue-50/20', text: 'text-blue-800', border: 'border-l-blue-500', label: 'Training', es: 'Capacitación' },
        'Holiday': { bg: 'bg-yellow-50/20', text: 'text-yellow-800', border: 'border-l-yellow-500', label: 'Holiday', es: 'Feriado' },
        'Rest Day': { bg: 'bg-slate-50/10', text: 'text-slate-400', border: 'border-l-slate-300', label: 'Off', es: 'Descanso' },
        'Suspension': { bg: 'bg-orange-50/20', text: 'text-orange-800', border: 'border-l-orange-500', label: 'Suspended', es: 'Suspensión' },
        'Absent': { bg: 'bg-rose-50/20', text: 'text-rose-800 font-bold', border: 'border-l-rose-500', label: 'Absent', es: 'Falta' },
        'Missing Punch': { bg: 'bg-amber-50/30', text: 'text-amber-800 font-bold', border: 'border-l-amber-500', label: 'Missing', es: 'Reg. Faltante' },
        'Conflict': { bg: 'bg-amber-100/50', text: 'text-amber-900 font-bold', border: 'border-l-amber-600', label: 'Conflict', es: 'Conflicto' },
        'Blank': { bg: 'bg-white', text: 'text-transparent', border: 'border-l-transparent', label: '', es: '' }
    };

    return (
        <div className="space-y-4">
            {/* Desktop and Tablet spreadsheet Grid */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="overflow-x-auto overflow-y-visible max-w-full">
                    <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                {/* Frozen left columns header */}
                                <th className="p-3 sticky left-0 bg-gray-50/90 backdrop-blur-sm z-10 w-20 border-r border-gray-100">{t('personnel.table.status', 'Estado')}</th>
                                <th className="p-3 sticky left-20 bg-gray-50/90 backdrop-blur-sm z-10 w-40 border-r border-gray-100">{t('personnel.table.name', 'Nombre')}</th>
                                <th className="p-3 sticky left-[240px] bg-gray-50/90 backdrop-blur-sm z-10 w-32 border-r border-gray-100">{t('projects.table.project', 'Proyecto')}</th>
                                
                                {/* Dynamic date columns */}
                                {dates.map(date => {
                                    const { dayName, dayNum } = formatDateHeader(date);
                                    const isWeekend = dayName === 'SAT' || dayName === 'SUN' || dayName === 'SÁB' || dayName === 'DOM';
                                    return (
                                        <th key={date} className={`p-2 text-center w-20 border-r border-gray-100 min-w-[80px] ${isWeekend ? 'bg-gray-100/30' : ''}`}>
                                            <span className="block text-[9px] font-bold text-gray-400">{dayName}</span>
                                            <span className="block text-sm font-extrabold text-accent-greyDark">{dayNum}</span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={dates.length + 3} className="p-12 text-center text-gray-500 font-medium bg-white">
                                        🔍 {t('attendance.filters.no_results', 'No se encontraron colaboradores correspondientes.')}
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map(emp => {
                                    // Get employee project: first try range clockins, then fallback to assigned project
                                    const rangeTimesheets = timesheets.filter(t => t.personnelId === emp.id && dates.includes(t.date));
                                    const latestWithProject = [...rangeTimesheets]
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .find(t => t.projectId);

                                    let project = null;
                                    if (latestWithProject && latestWithProject.projectId) {
                                        project = projects.find(p => p.id === latestWithProject.projectId);
                                    }
                                    if (!project) {
                                        project = projects.find(p => p.assignedPersonnel?.includes(emp.id));
                                    }
                                    const projectName = project ? (project.codeName || project.name) : '—';

                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50/30 transition-colors">
                                            {/* Frozen employee metadata */}
                                            <td className="p-3 sticky left-0 bg-white hover:bg-gray-50 transition-colors z-10 border-r border-gray-100 border-b">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    {emp.status === 'Active' ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Baja' : 'Inactive')}
                                                </span>
                                            </td>
                                            <td className="p-3 sticky left-20 bg-white hover:bg-gray-50 transition-colors z-10 border-r border-gray-100 border-b font-bold text-xs text-accent-greyDark truncate">
                                                {emp.name}
                                            </td>
                                            <td className="p-3 sticky left-[240px] bg-white hover:bg-gray-50 transition-colors z-10 border-r border-gray-100 border-b text-xs text-gray-500 truncate">
                                                {projectName}
                                            </td>

                                            {/* Dynamic cells */}
                                            {dates.map(date => {
                                                const dayView = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
                                                const style = statusStyles[dayView.displayStatus] || { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-l-slate-300', label: 'Off', es: 'Libre' };

                                                const dayTimesheet = timesheets.find(t => t.personnelId === emp.id && t.date === date);
                                                const cellProject = dayTimesheet?.projectId 
                                                    ? (projects.find(p => p.id === dayTimesheet.projectId) || project)
                                                    : project;

                                                return (
                                                    <td
                                                        key={date}
                                                        onClick={() => setSelectedCell({ employee: emp, date, project: cellProject || undefined })}
                                                        className="p-0 border-r border-b border-gray-100 text-center cursor-pointer transition-all hover:bg-brand-teal/5 relative"
                                                    >
                                                        <div className={`h-12 w-full flex flex-col justify-center px-1.5 select-none border-l-[3.5px] transition-all active:scale-95 ${style.bg} ${style.text} ${style.border}`}>
                                                            {dayView.displayStatus === 'Present' ? (
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <span className="text-[10px] font-mono font-bold leading-none tracking-tight block">
                                                                        {dayView.clockIn || '—'}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono leading-none tracking-tight block text-gray-400/80 mt-0.5">
                                                                        {dayView.clockOut || '—'}
                                                                    </span>
                                                                    {dayView.overtimeHours && dayView.overtimeHours > 0 ? (
                                                                        <span className="absolute top-1 right-1 bg-brand-teal text-white font-extrabold text-[8px] px-1 rounded-full flex items-center justify-center border border-white" title={`Extra: +${dayView.overtimeHours}h`}>
                                                                            +{Math.round(dayView.overtimeHours)}h
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[9px] font-extrabold uppercase leading-none tracking-wider block truncate text-center">
                                                                    {dayView.displayStatus === 'Rest Day' && date >= new Date().toLocaleDateString('en-CA') 
                                                                        ? '' 
                                                                        : (lang === 'es' ? style.es : style.label)}
                                                                </span>
                                                            )}
                                                            
                                                            {/* Mini warning badge inside cells */}
                                                            {dayView.conflict && (
                                                                <span className="absolute bottom-1 right-1 bg-orange-600 text-white w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold border border-white" title="Conflict">!</span>
                                                            )}
                                                            {dayView.missingPunch && !dayView.conflict && (
                                                                <span className="absolute bottom-1 right-1 bg-amber-600 text-white w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold border border-white" title="Missing Punch">?</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards View (Employee-by-Employee summaries) */}
            <div className="block md:hidden space-y-4">
                {filteredEmployees.length === 0 ? (
                    <div className="bg-white p-8 border rounded-2xl text-center text-gray-500 font-medium">
                        🔍 {t('attendance.filters.no_results')}
                    </div>
                ) : (
                    filteredEmployees.map(emp => {
                        const rangeTimesheets = timesheets.filter(t => t.personnelId === emp.id && dates.includes(t.date));
                        const latestWithProject = [...rangeTimesheets]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .find(t => t.projectId);

                        let project = null;
                        if (latestWithProject && latestWithProject.projectId) {
                            project = projects.find(p => p.id === latestWithProject.projectId);
                        }
                        if (!project) {
                            project = projects.find(p => p.assignedPersonnel?.includes(emp.id));
                        }
                        const projectName = project ? (project.codeName || project.name) : '—';
                        
                        // Compute summaries for this range
                        let conflictsCount = 0;
                        let missingPunchesCount = 0;
                        let otHours = 0;
                        let regHours = 0;
                        
                        dates.forEach(date => {
                            const dv = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
                            if (dv.conflict) conflictsCount++;
                            if (dv.missingPunch) missingPunchesCount++;
                            otHours += dv.overtimeHours || 0;
                            regHours += dv.regularHours || 0;
                        });

                        return (
                            <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-soft space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center text-sm font-bold">
                                        {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-sm text-accent-greyDark truncate">{emp.name}</h4>
                                        <p className="text-[11px] text-gray-400">{projectName} · Joined: {emp.onboardingDate || '—'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                                    <div className="flex justify-between"><span className="text-gray-400">Regular:</span><span className="font-bold text-accent-greyDark">{regHours.toFixed(1)} hrs</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Extra (OT):</span><span className="font-bold text-brand-teal">{otHours.toFixed(1)} hrs</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Conflictos:</span><span className={`font-bold ${conflictsCount > 0 ? 'text-orange-600': 'text-gray-400'}`}>{conflictsCount}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Faltantes:</span><span className={`font-bold ${missingPunchesCount > 0 ? 'text-amber-600': 'text-gray-400'}`}>{missingPunchesCount}</span></div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedCell({ employee: emp, date: dates[dates.length - 1], project })}
                                        className="w-full text-center py-2.5 bg-brand-teal/10 hover:bg-brand-teal/20 transition-colors text-brand-teal rounded-xl text-xs font-bold"
                                    >
                                        ⚙️ Ver Detalle Día a Día
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Render details slide-out drawer on selection */}
            {selectedCell && (
                <DayDetailPanel
                    employee={selectedCell.employee}
                    date={selectedCell.date}
                    project={selectedCell.project}
                    onClose={() => setSelectedCell(null)}
                />
            )}
        </div>
    );
}
