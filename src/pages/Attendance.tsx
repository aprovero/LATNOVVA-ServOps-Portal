import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Download, RefreshCw, FileSpreadsheet, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import AttendanceDashboard from '../components/attendance/AttendanceDashboard';
import AttendanceGrid from '../components/attendance/AttendanceGrid';
import AddOverrideModal from '../components/attendance/AddOverrideModal';
import { exportAttendanceToCSV, exportDetailedPunchesToCSV } from '../utils/attendanceExport';
import { calculateDailyAttendance, formatDisplayDate } from '../utils/attendanceCalculations';

export default function Attendance() {
    const { t, i18n } = useTranslation();
    const { personnel, projects, timesheets, attendanceOverrides, workSchedules, refreshAttendance, activeSubsidiary } = useStore();

    const filteredPersonnel = useMemo(() => {
        return personnel.filter(p => (p.subsidiary || 'US') === activeSubsidiary);
    }, [personnel, activeSubsidiary]);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => (p.subsidiary || 'US') === activeSubsidiary);
    }, [projects, activeSubsidiary]);

    // Default dates: Current Week (Monday to Sunday)
    const getFormattedDate = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = new Date();
    
    const monday = new Date(today);
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    monday.setDate(today.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const [startDate, setStartDate] = useState(getFormattedDate(monday));
    const [endDate, setEndDate] = useState(getFormattedDate(sunday));
    
    // Filters state
    const [search, setSearch] = useState('');
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active'); // default show active
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [missingPunchesOnly, setMissingPunchesOnly] = useState(false);
    const [overtimeOnly, setOvertimeOnly] = useState(false);
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const [clockedInTodayOnly, setClockedInTodayOnly] = useState(false); // Default false to show active colaboradores
    const [presentAhoraOnly, setPresentAhoraOnly] = useState(false);
    const [zombieShiftsOnly, setZombieShiftsOnly] = useState(false);

    // Modal state
    const [isAddOverrideOpen, setIsAddOverrideOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Real-time automatic refreshes for office/HR roles
    useEffect(() => {
        const isMx = activeSubsidiary === 'MX';
        const timesheetTable = isMx ? 'mx_timesheets' : 'timesheets';
        const overridesTable = isMx ? 'mx_attendance_overrides' : 'attendance_overrides';
        const personnelTable = isMx ? 'mx_personnel' : 'personnel';

        const channel = supabase
            .channel(`attendance-db-realtime-${activeSubsidiary}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: timesheetTable },
                (payload) => {
                    console.log(`[Realtime] Timesheet change detected on ${timesheetTable}:`, payload);
                    refreshAttendance();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: overridesTable },
                (payload) => {
                    console.log(`[Realtime] Attendance override change detected on ${overridesTable}:`, payload);
                    refreshAttendance();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: personnelTable },
                (payload) => {
                    console.log(`[Realtime] Personnel change detected on ${personnelTable}:`, payload);
                    refreshAttendance();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [refreshAttendance, activeSubsidiary]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshAttendance();
        } finally {
            setTimeout(() => {
                setIsRefreshing(false);
            }, 600);
        }
    };

    // Compute stats for today & selected date range (for overtime)
    const computeStats = () => {
        const activeCount = filteredPersonnel.filter(p => p.status === 'Active').length;
        const todayStr = getFormattedDate(new Date());
        
        let presentToday = 0;
        let onVacation = 0;
        let onSickLeave = 0;
        let onHomeOffice = 0;
        let absentToday = 0;
        let missingPunches = 0;
        let pendingConflicts = 0;
        let overtimeHours = 0;

        // Helper to get dates in selected range
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

        const rangeDates = getDatesInRange(startDate, endDate);

        filteredPersonnel.forEach(emp => {
            // Today's states
            const dv = calculateDailyAttendance(emp, todayStr, timesheets, attendanceOverrides, workSchedules);
            if (dv.displayStatus === 'Present' || dv.displayStatus === 'Home Office') presentToday++;
            if (dv.displayStatus === 'Vacation') onVacation++;
            if (dv.displayStatus === 'Sick Leave') onSickLeave++;
            if (dv.displayStatus === 'Home Office') onHomeOffice++;
            if (dv.displayStatus === 'Absent') absentToday++;
            if (dv.missingPunch) missingPunches++;
            if (dv.conflict) pendingConflicts++;
            
            // Overtime hours (accumulated across the entire active date range view!)
            rangeDates.forEach(date => {
                const dateDv = calculateDailyAttendance(emp, date, timesheets, attendanceOverrides, workSchedules);
                overtimeHours += dateDv.overtimeHours || 0;
            });
        });

        return {
            activeCount,
            presentToday,
            onVacation,
            onSickLeave,
            onHomeOffice,
            absentToday,
            missingPunches,
            pendingConflicts,
            overtimeHours
        };
    };

    const stats = computeStats();

    const handleExport = () => {
        const lang = i18n.language === 'en' ? 'en' : 'es';
        // Filter out employees depending on active / inactive toggle before passing
        const filteredEmp = filteredPersonnel.filter(emp => {
            if (activeFilter === 'active' && emp.status !== 'Active') return false;
            if (activeFilter === 'inactive' && emp.status !== 'Inactive') return false;
            return true;
        });

        const confirmMsg = lang === 'es' 
            ? '¿Deseas exportar el reporte detallado con información de GPS y justificaciones individuales?\n\nAceptar = Reporte Detallado (GPS)\nCancelar = Reporte Básico (Diario)'
            : 'Do you want to export the detailed report with GPS logs and justifications?\n\nOK = Detailed Report (GPS)\nCancel = Basic Report (Daily)';

        const isDetailed = window.confirm(confirmMsg);

        if (isDetailed) {
            exportDetailedPunchesToCSV(
                filteredEmp,
                projects,
                timesheets,
                startDate,
                endDate,
                lang
            );
        } else {
            exportAttendanceToCSV(
                filteredEmp,
                projects,
                timesheets,
                attendanceOverrides,
                workSchedules,
                startDate,
                endDate,
                lang
            );
        }
    };

    const handleDashboardFilterClick = (filter: string | null) => {
        // Reset all toggles first
        setConflictsOnly(false);
        setMissingPunchesOnly(false);
        setOvertimeOnly(false);
        setStatusFilter(null);
        setClockedInTodayOnly(false);
        setPresentAhoraOnly(false);
        setZombieShiftsOnly(false);

        if (filter === 'conflict') setConflictsOnly(true);
        else if (filter === 'missing_punch') setMissingPunchesOnly(true);
        else if (filter === 'overtime') setOvertimeOnly(true);
        else if (filter === 'present') {
            setClockedInTodayOnly(true);
        }
        else if (filter === 'vacation') setStatusFilter('Vacation');
        else if (filter === 'sick_leave') setStatusFilter('Sick Leave');
        else if (filter === 'home_office') setStatusFilter('Home Office');
        else if (filter === 'absent') setStatusFilter('Absent');
        else if (filter === 'active') {
            setActiveFilter('active');
        }
    };

    const getActiveDashboardFilter = (): string | null => {
        if (conflictsOnly) return 'conflict';
        if (missingPunchesOnly) return 'missing_punch';
        if (overtimeOnly) return 'overtime';
        if (clockedInTodayOnly) return 'present';
        if (statusFilter === 'Vacation') return 'vacation';
        if (statusFilter === 'Sick Leave') return 'sick_leave';
        if (statusFilter === 'Home Office') return 'home_office';
        if (statusFilter === 'Absent') return 'absent';
        return 'active'; // Default active card selected
    };

    const handlePrevWeek = () => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        start.setDate(start.getDate() - 7);
        end.setDate(end.getDate() - 7);
        setStartDate(getFormattedDate(start));
        setEndDate(getFormattedDate(end));
    };

    const handleNextWeek = () => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        start.setDate(start.getDate() + 7);
        end.setDate(end.getDate() + 7);
        setStartDate(getFormattedDate(start));
        setEndDate(getFormattedDate(end));
    };

    const handleCurrentWeek = () => {
        const todayVal = new Date();
        const mondayVal = new Date(todayVal);
        const dayVal = todayVal.getDay();
        const diffToMondayVal = dayVal === 0 ? -6 : 1 - dayVal;
        mondayVal.setDate(todayVal.getDate() + diffToMondayVal);
        
        const sundayVal = new Date(mondayVal);
        sundayVal.setDate(mondayVal.getDate() + 6);
        
        setStartDate(getFormattedDate(mondayVal));
        setEndDate(getFormattedDate(sundayVal));
    };

    return (
        <div className="space-y-6 w-full max-w-[100%] ml-0 mr-auto p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-accent-greyDark flex items-center gap-3">
                        <FileSpreadsheet className="text-brand-teal" size={32} />
                        {t('attendance.title', 'Asistencias')}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {t('attendance.subtitle', 'Monitoreo diario, vacaciones, incapacidades y conciliación de registros')}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-3 bg-white text-gray-500 hover:text-brand-teal rounded-xl border hover:bg-gray-50 shadow-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        title={t('common.refresh', 'Actualizar')}
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-brand-teal' : ''} />
                    </button>
                    
                    <button 
                        onClick={handleExport}
                        className="bg-white border text-gray-700 hover:bg-gray-50 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-sm h-11 transition-all"
                    >
                        <Download size={16} /> {t('common.export', 'Exportar CSV')}
                    </button>

                    <button 
                        onClick={() => setIsAddOverrideOpen(true)}
                        className="bg-brand-teal text-white hover:bg-brand-teal/90 rounded-xl px-5 py-2 text-sm font-bold flex items-center gap-2 shadow-soft h-11 transition-all"
                    >
                        <Plus size={16} /> {t('attendance.override.add_btn', 'Agregar')}
                    </button>
                </div>
            </div>

            {/* Dashboard summary */}
            <AttendanceDashboard
                stats={stats}
                activeFilter={getActiveDashboardFilter()}
                setActiveFilter={handleDashboardFilterClick}
            />

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Search */}
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <Search size={12} /> {t('personnel.search_placeholder', 'Buscar colaborador...')}
                        </label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('attendance.filters.search_placeholder', 'Buscar por nombre...')}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal outline-none h-11"
                        />
                    </div>

                    {/* Project Multi-Select Dropdown with Checkboxes */}
                    <div className="space-y-1.5 flex-1 min-w-[200px] relative">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {t('timesheets.filters.project', 'Proyecto')}
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal outline-none h-11 cursor-pointer flex items-center justify-between font-medium text-gray-700"
                            >
                                <span className="truncate">
                                    {selectedProjects.length === 0
                                        ? t('timesheets.filters.all_projects', 'Todos los Proyectos')
                                        : selectedProjects.length === 1
                                        ? (() => {
                                              const proj = filteredProjects.find(p => p.id === selectedProjects[0]);
                                              return proj ? (proj.codeName || proj.name) : selectedProjects[0];
                                          })()
                                        : `${selectedProjects.length} ${t('timesheets.filters.projects', 'Proyectos')}`}
                                </span>
                                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isProjectDropdownOpen && (
                                <>
                                    {/* Backdrop overlay to close when clicking outside */}
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setIsProjectDropdownOpen(false)}
                                    />
                                    <div className="absolute left-0 w-full bg-white border border-gray-200 rounded-xl mt-1.5 shadow-xl p-3 z-50 space-y-2 max-h-[300px] flex flex-col">
                                        {/* Select All checkbox */}
                                        <label className="flex items-center gap-2 px-1 py-1 hover:bg-gray-50 rounded-lg cursor-pointer text-xs font-bold text-gray-700 select-none">
                                            <input
                                                type="checkbox"
                                                checked={selectedProjects.length === filteredProjects.filter(p => p.status === 'Active' || p.status === 'In Progress').length}
                                                onChange={(e) => {
                                                    const activeProjs = filteredProjects.filter(p => p.status === 'Active' || p.status === 'In Progress');
                                                    if (e.target.checked) {
                                                        setSelectedProjects(activeProjs.map(p => p.id));
                                                    } else {
                                                        setSelectedProjects([]);
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal w-4 h-4"
                                            />
                                            <span>{t('attendance.filters.select_all', 'Seleccionar Todos')}</span>
                                        </label>
                                        <hr className="border-gray-100" />
                                        
                                        {/* List of projects */}
                                        <div className="overflow-y-auto space-y-1 pr-1 flex-1">
                                            {filteredProjects
                                                .filter(p => p.status === 'Active' || p.status === 'In Progress')
                                                .map(p => {
                                                    const isChecked = selectedProjects.includes(p.id);
                                                    return (
                                                        <label key={p.id} className="flex items-center gap-2 px-1 py-1 hover:bg-gray-50 rounded-lg cursor-pointer text-xs text-gray-700 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    if (isChecked) {
                                                                        setSelectedProjects(selectedProjects.filter(id => id !== p.id));
                                                                    } else {
                                                                        setSelectedProjects([...selectedProjects, p.id]);
                                                                    }
                                                                }}
                                                                className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal w-4 h-4"
                                                            />
                                                            <span className="truncate">{p.codeName || p.name}</span>
                                                        </label>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Active/Inactive */}
                    <div className="space-y-1.5 flex-1 min-w-[150px]">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {t('attendance.filters.active_status', 'Contrato Empleado')}
                        </label>
                        <select
                            value={activeFilter}
                            onChange={e => setActiveFilter(e.target.value as any)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal outline-none h-11 cursor-pointer"
                        >
                            <option value="active">{t('attendance.filters.active_only', 'Solo Activos')}</option>
                            <option value="inactive">{t('attendance.filters.inactive_only', 'Solo Bajas (Inactivos)')}</option>
                            <option value="all">{t('attendance.filters.all', 'Todos')}</option>
                        </select>
                    </div>

                    {/* Date Range Start */}
                    <div className="space-y-1.5 flex-1 min-w-[150px]">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {t('timesheets.filters.from_date', 'Desde')}</span>
                            <span className="text-[10px] text-gray-400 font-mono normal-case">{formatDisplayDate(startDate, i18n.language === 'en' ? 'en' : 'es')}</span>
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none h-11 font-mono"
                        />
                    </div>

                    {/* Date Range End */}
                    <div className="space-y-1.5 flex-1 min-w-[150px]">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {t('timesheets.filters.to_date', 'Hasta')}</span>
                            <span className="text-[10px] text-gray-400 font-mono normal-case">{formatDisplayDate(endDate, i18n.language === 'en' ? 'en' : 'es')}</span>
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none h-11 font-mono"
                        />
                    </div>
                </div>

                {/* Quick Flags Toggles & Week Navigation */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setPresentAhoraOnly(!presentAhoraOnly);
                                if (!presentAhoraOnly) {
                                    setClockedInTodayOnly(false);
                                    setZombieShiftsOnly(false); // disable zombie shifts if present now is active
                                }
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                presentAhoraOnly 
                                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm' 
                                    : 'bg-white text-brand-teal border-teal-200 hover:bg-teal-50'
                            }`}
                        >
                            ✓ {t('attendance.filters.present_now', 'Presente Ahora')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setZombieShiftsOnly(!zombieShiftsOnly);
                                if (!zombieShiftsOnly) {
                                    setPresentAhoraOnly(false);
                                    setClockedInTodayOnly(false);
                                }
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                zombieShiftsOnly 
                                    ? 'bg-red-500 text-white border-red-500 shadow-sm' 
                                    : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                            }`}
                        >
                            🧟 {t('attendance.filters.zombie_shifts', 'Turnos Zombie')}
                        </button>
                    </div>

                    {/* Week Navigation Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrevWeek}
                            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-teal transition-all flex items-center gap-1 shadow-sm h-8"
                            title={t('attendance.filters.prev_week_title', 'Semana Anterior')}
                        >
                            <ChevronLeft size={14} />
                            <span>{t('attendance.filters.prev_week', 'Anterior')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCurrentWeek}
                            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-teal transition-all flex items-center gap-1 shadow-sm h-8"
                        >
                            <span>{t('attendance.filters.current_week', 'Semana Actual')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleNextWeek}
                            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-teal transition-all flex items-center gap-1 shadow-sm h-8"
                            title={t('attendance.filters.next_week_title', 'Semana Siguiente')}
                        >
                            <span>{t('attendance.filters.next_week', 'Siguiente')}</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Attendance Spreadsheet Grid */}
            <AttendanceGrid
                employees={filteredPersonnel}
                projects={filteredProjects}
                timesheets={timesheets}
                overrides={attendanceOverrides}
                schedules={workSchedules}
                startDate={startDate}
                endDate={endDate}
                filters={{
                    search,
                    projects: selectedProjects,
                    activeFilter,
                    statusFilter,
                    missingPunchesOnly,
                    overtimeOnly,
                    conflictsOnly,
                    clockedInTodayOnly,
                    presentAhoraOnly,
                    zombieShiftsOnly
                }}
            />

            {/* Add Absence Modal */}
            <AddOverrideModal
                isOpen={isAddOverrideOpen}
                onClose={() => setIsAddOverrideOpen(false)}
            />
        </div>
    );
}
