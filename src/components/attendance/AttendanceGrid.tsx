import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Personnel, Project, TimesheetEntry, AttendanceOverride, WorkSchedule, useStore } from '../../store/useStore';
import { calculateDailyAttendance } from '../../utils/attendanceCalculations';
import { parseCoordinates, getDistanceMeters } from '../../utils/datetime.utils';
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
        projects: string[];
        statusFilter: string | null;
        activeFilter: 'all' | 'active' | 'inactive';
        missingPunchesOnly: boolean;
        overtimeOnly: boolean;
        conflictsOnly: boolean;
        clockedInTodayOnly: boolean;
        presentAhoraOnly: boolean;
        zombieShiftsOnly?: boolean;
    };
    showHours?: boolean;
}

export default function AttendanceGrid({
    employees,
    projects,
    timesheets,
    overrides,
    schedules,
    startDate,
    endDate,
    filters,
    showHours = false
}: AttendanceGridProps) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'es';

    const [selectedCell, setSelectedCell] = useState<{ employee: Personnel; date: string; project?: Project } | null>(null);
    const { platformSettings } = useStore();

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
            t => t.personnelId === emp.id && dates.includes(t.date) && !!t.projectId && filters.projects.includes(t.projectId)
        );
        if (filters.projects && filters.projects.length > 0 && (!empProject || !filters.projects.includes(empProject.id)) && !hasClockedInProject) return false;

        // Filter by who clocked in today
        if (filters.clockedInTodayOnly) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayView = calculateDailyAttendance(emp, todayStr, timesheets, overrides, schedules, lang);
            const clockedInToday = ['present', 'home_office', 'home office', 'conflict', 'missing_punch', 'missing punch'].includes(todayView.displayStatus.toLowerCase());
            if (!clockedInToday) return false;
        }

        // Filter by who is clocked in right now (Presente Ahora - open timesheet today)
        if (filters.presentAhoraOnly) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const empTimesheets = timesheets.filter(t => t.personnelId === emp.id && t.date === todayStr);
            const hasOpenTimesheet = empTimesheets.some(t => t.timeIn && !t.timeOut);
            if (!hasOpenTimesheet) return false;
        }

        // Filter by today's status if a dashboard status filter is active (Vacation, Absent, Home Office, Sick Leave)
        if (filters.statusFilter) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayView = calculateDailyAttendance(emp, todayStr, timesheets, overrides, schedules, lang);
            if (todayView.displayStatus.toLowerCase() !== filters.statusFilter.toLowerCase()) {
                return false;
            }
        }

        // Compute daily views to filter by KPIs/flags
        let hasConflict = false;
        let hasMissingPunch = false;
        let hasOvertime = false;
        let hasZombie = false;

        for (const date of dates) {
            const dv = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
            if (dv.conflict) hasConflict = true;
            if (dv.missingPunch) hasMissingPunch = true;
            if ((dv.overtimeHours || 0) > 0) hasOvertime = true;

            const timesheetEntry = timesheets.find(t => t.personnelId === emp.id && t.date === date);
            const isZombie = !!(timesheetEntry && timesheetEntry.notes && timesheetEntry.notes.includes('System: Auto closed'));
            if (isZombie) hasZombie = true;
        }

        if (filters.conflictsOnly && !hasConflict) return false;
        if (filters.missingPunchesOnly && !hasMissingPunch) return false;
        if (filters.overtimeOnly && !hasOvertime) return false;
        if (filters.zombieShiftsOnly && !hasZombie) return false;

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
                                                const dynamicGpsVerified = !dayTimesheet ? true : (
                                                    dayTimesheet.gpsVerified || (
                                                        !dayTimesheet.punches || dayTimesheet.punches.every((p: any) => {
                                                            const gpsThreshold = platformSettings.gpsAccuracyThreshold ?? 100;
                                                            const radius = platformSettings.geofenceRadius ?? 250;
                                                            const targetProjId = dayTimesheet.projectId;
                                                            const targetProject = targetProjId ? projects.find((proj: any) => proj.id === targetProjId) : null;
                                                            const geofenceRequired = targetProject?.locationValidated ?? false;
                                                            const projCoords = targetProject ? parseCoordinates(targetProject.location) : null;
                                                            
                                                            if (p.accuracy > gpsThreshold) return false;
                                                            if (geofenceRequired && projCoords && p.workMode !== 'Home Office') {
                                                                const dist = projCoords && p.lat !== 0 ? getDistanceMeters(p.lat, p.lng, projCoords.lat, projCoords.lng) : 0;
                                                                if (dist > radius) return false;
                                                            }
                                                            return true;
                                                        })
                                                    )
                                                );
                                                
                                                let cellBg = style.bg;
                                                let cellBorder = style.border;
                                                if (dayView.displayStatus === 'Present' && dayTimesheet && !dynamicGpsVerified) {
                                                    cellBg = 'bg-amber-50/20';
                                                    cellBorder = 'border-l-amber-500';
                                                }

                                                const cellProject = dayTimesheet?.projectId 
                                                    ? (projects.find(p => p.id === dayTimesheet.projectId) || project)
                                                    : project;

                                                return (
                                                    <td
                                                        key={date}
                                                        onClick={() => setSelectedCell({ employee: emp, date, project: cellProject || undefined })}
                                                        className="p-0 border-r border-b border-gray-100 text-center cursor-pointer transition-all hover:bg-brand-teal/5 relative"
                                                    >
                                                        <div className={`h-12 w-full flex flex-col justify-center px-1.5 select-none border-l-[3.5px] transition-all active:scale-95 ${cellBg} ${style.text} ${cellBorder}`}>
                                                            {dayView.displayStatus === 'Present' ? (
                                                                <div className="flex flex-col items-center justify-center">
                                                                    {showHours ? (
                                                                        <>
                                                                            <span className="text-xs font-mono font-bold leading-none tracking-tight block text-brand-teal">
                                                                                {dayView.regularHours ? `${dayView.regularHours.toFixed(1)}h` : '—'}
                                                                            </span>
                                                                            {dayView.overtimeHours && dayView.overtimeHours > 0 ? (
                                                                                <span className="text-[10px] font-mono leading-none tracking-tight block text-amber-500 mt-0.5">
                                                                                    +{dayView.overtimeHours.toFixed(1)}h
                                                                                </span>
                                                                            ) : null}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-xs font-mono font-bold leading-none tracking-tight block">
                                                                                {dayView.clockIn || '—'}
                                                                            </span>
                                                                            <span className="text-xs font-mono leading-none tracking-tight block text-gray-400/80 mt-0.5">
                                                                                {dayView.clockOut || '—'}
                                                                            </span>
                                                                            {dayView.overtimeHours && dayView.overtimeHours > 0 ? (
                                                                                <span className="absolute top-1 right-1 bg-brand-teal text-white font-extrabold text-[8px] px-1 rounded-full flex items-center justify-center border border-white" title={`Extra: +${dayView.overtimeHours}h`}>
                                                                                    +{Math.round(dayView.overtimeHours)}h
                                                                                </span>
                                                                            ) : null}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-extrabold uppercase leading-none tracking-tight block truncate text-center">
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
                                                            {dayView.displayStatus === 'Present' && dayTimesheet && !dynamicGpsVerified && !dayView.conflict && !dayView.missingPunch && (
                                                                <span className="absolute bottom-1 right-1 bg-amber-500 text-white w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold border border-white" title="Alerta GPS">⚠</span>
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

            {/* Mobile Table View (Name and Current/Latest Day) */}
            <div className="block md:hidden bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                            <th className="p-3 w-[60%] border-r border-gray-100">{t('personnel.table.name', 'Nombre')}</th>
                            {(() => {
                                const mobileDate = dates.includes(new Date().toLocaleDateString('en-CA')) 
                                    ? new Date().toLocaleDateString('en-CA') 
                                    : dates[dates.length - 1];
                                const { dayName, dayNum } = formatDateHeader(mobileDate);
                                return (
                                    <th className="p-2 text-center w-[40%]">
                                        <span className="block text-[9px] font-bold text-gray-400">{dayName}</span>
                                        <span className="block text-sm font-extrabold text-accent-greyDark">{dayNum}</span>
                                    </th>
                                );
                            })()}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="p-8 text-center text-gray-500 font-medium bg-white">
                                    🔍 {t('attendance.filters.no_results', 'No se encontraron colaboradores.')}
                                </td>
                            </tr>
                        ) : (
                            filteredEmployees.map(emp => {
                                const mobileDate = dates.includes(new Date().toLocaleDateString('en-CA')) 
                                    ? new Date().toLocaleDateString('en-CA') 
                                    : dates[dates.length - 1];

                                const dayView = calculateDailyAttendance(emp, mobileDate, timesheets, overrides, schedules, lang);
                                
                                // Accent border and styles
                                const style = statusStyles[dayView.displayStatus] || statusStyles['Blank'];
                                const cellBg = dayView.displayStatus === 'Blank' ? 'bg-white' : style.bg;
                                const cellBorder = style.border;

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

                                const dayTimesheet = timesheets.find(t => t.personnelId === emp.id && t.date === mobileDate);
                                const isGpsVerified = dayTimesheet?.gpsVerified;
                                const hasPunches = dayTimesheet?.punches && dayTimesheet.punches.length > 0;
                                const dynamicGpsVerified = hasPunches ? isGpsVerified : true;

                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="p-3 border-r border-gray-100 w-[60%] align-middle">
                                            <div className="font-bold text-xs text-accent-greyDark truncate uppercase">
                                                {emp.name}
                                            </div>
                                        </td>
                                        <td className="p-1 text-center w-[40%] relative align-middle">
                                            <div 
                                                onClick={() => setSelectedCell({ employee: emp, date: mobileDate, project })}
                                                className={`h-12 w-full flex flex-col justify-center px-1.5 select-none border-l-[3.5px] transition-all active:scale-95 cursor-pointer ${cellBg} ${style.text} ${cellBorder}`}
                                            >
                                                {dayView.displayStatus === 'Present' ? (
                                                    <div className="flex flex-col items-center justify-center">
                                                        {showHours ? (
                                                            <>
                                                                <span className="text-xs font-mono font-bold leading-none tracking-tight block text-brand-teal">
                                                                    {dayView.regularHours ? `${dayView.regularHours.toFixed(1)}h` : '—'}
                                                                </span>
                                                                {dayView.overtimeHours && dayView.overtimeHours > 0 ? (
                                                                    <span className="text-[10px] font-mono leading-none tracking-tight block text-amber-500 mt-0.5">
                                                                        +{dayView.overtimeHours.toFixed(1)}h
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-xs font-mono font-bold leading-none tracking-tight block">
                                                                    {dayView.clockIn || '—'}
                                                                </span>
                                                                <span className="text-xs font-mono leading-none tracking-tight block text-gray-400/80 mt-0.5">
                                                                    {dayView.clockOut || '—'}
                                                                </span>
                                                                {dayView.overtimeHours && dayView.overtimeHours > 0 ? (
                                                                    <span className="absolute top-1 right-1 bg-brand-teal text-white font-extrabold text-[8px] px-1 rounded-full flex items-center justify-center border border-white" title={`Extra: +${dayView.overtimeHours}h`}>
                                                                        +{Math.round(dayView.overtimeHours)}h
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-extrabold uppercase leading-none tracking-tight block truncate text-center">
                                                        {dayView.displayStatus === 'Rest Day' && mobileDate >= new Date().toLocaleDateString('en-CA') 
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
                                                {dayView.displayStatus === 'Present' && dayTimesheet && !dynamicGpsVerified && !dayView.conflict && !dayView.missingPunch && (
                                                    <span className="absolute bottom-1 right-1 bg-amber-500 text-white w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold border border-white" title="Alerta GPS">⚠</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
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
