import { Personnel, Project, TimesheetEntry, AttendanceOverride, WorkSchedule } from '../store/useStore';
import { calculateDailyAttendance } from './attendanceCalculations';

export function exportAttendanceToCSV(
    employees: Personnel[],
    projects: Project[],
    timesheets: TimesheetEntry[],
    overrides: AttendanceOverride[],
    schedules: WorkSchedule[],
    startDate: string,
    endDate: string,
    lang: 'en' | 'es' = 'es'
) {
    const headers = lang === 'es' ? [
        'Nombre Completo',
        'Estado Empleado',
        'Proyecto Asignado',
        'Fecha',
        'Entrada',
        'Inicio Almuerzo',
        'Fin Almuerzo',
        'Salida',
        'Horas Regulares',
        'Horas Extras',
        'Estado Día',
        'Conflicto',
        'Falta de Registro',
        'Notas'
    ] : [
        'Full Name',
        'Employee Status',
        'Assigned Project',
        'Date',
        'Clock In',
        'Lunch Start',
        'Lunch End',
        'Clock Out',
        'Regular Hours',
        'Overtime Hours',
        'Day Status',
        'Conflict',
        'Missing Punch',
        'Notes'
    ];

    const getDatesArray = (start: string, end: string): string[] => {
        const arr = [];
        const dt = new Date(start + 'T00:00:00');
        const endDt = new Date(end + 'T00:00:00');
        while (dt <= endDt) {
            arr.push(new Date(dt).toISOString().split('T')[0]);
            dt.setDate(dt.getDate() + 1);
        }
        return arr;
    };

    const dates = getDatesArray(startDate, endDate);
    const rows: string[][] = [];

    employees.forEach(emp => {
        // Find employee project
        const project = projects.find(p => p.assignedPersonnel?.includes(emp.id));
        const projectName = project ? (project.codeName || project.name) : '—';
        const empStatus = emp.status === 'Active' ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Inactivo' : 'Inactive');

        dates.forEach(date => {
            const dayView = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
            
            // Format labels
            let displayStatus: string = dayView.displayStatus;
            if (lang === 'es') {
                const esStatus: Record<string, string> = {
                    'Present': 'Presente',
                    'Vacation': 'Vacaciones',
                    'Sick Leave': 'Incapacidad / Enfermedad',
                    'Home Office': 'Home Office',
                    'Personal Leave': 'Permiso',
                    'Unpaid Leave': 'Permiso sin goce',
                    'Training': 'Capacitación',
                    'Holiday': 'Feriado',
                    'Rest Day': 'Descanso',
                    'Suspension': 'Suspensión',
                    'Absent': 'Ausente',
                    'Missing Punch': 'Registro Faltante',
                    'Conflict': 'Conflicto'
                };
                displayStatus = esStatus[dayView.displayStatus] || dayView.displayStatus;
            }

            rows.push([
                `"${emp.name}"`,
                empStatus,
                `"${projectName}"`,
                date,
                dayView.clockIn || '',
                dayView.lunchStart || '',
                dayView.lunchEnd || '',
                dayView.clockOut || '',
                dayView.regularHours?.toFixed(2) || '0.00',
                dayView.overtimeHours?.toFixed(2) || '0.00',
                displayStatus,
                dayView.conflict ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO'),
                dayView.missingPunch ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO'),
                `"${(dayView.notes || '').replace(/"/g, '""')}"`
            ]);
        });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_asistencia_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
