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

export function exportDetailedPunchesToCSV(
    employees: Personnel[],
    projects: Project[],
    timesheets: TimesheetEntry[],
    startDate: string,
    endDate: string,
    lang: 'en' | 'es' = 'es'
) {
    const headers = lang === 'es' ? [
        'Nombre Completo',
        'Estado Empleado',
        'Proyecto Registrado',
        'Fecha',
        'Tipo de Marcaje',
        'Hora',
        'Latitud',
        'Longitud',
        'Precisión (metros)',
        'GPS Verificado',
        'Modo de Trabajo',
        'Origen de Hora',
        'Ajuste Manual',
        'Comentarios / Justificación'
    ] : [
        'Full Name',
        'Employee Status',
        'Registered Project',
        'Date',
        'Punch Type',
        'Time',
        'Latitude',
        'Longitude',
        'Accuracy (meters)',
        'GPS Verified',
        'Work Mode',
        'Time Source',
        'Manual Adjustment',
        'Comments / Justification'
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
        const empStatus = emp.status === 'Active' ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Inactivo' : 'Inactive');

        dates.forEach(date => {
            const entry = timesheets.find(t => t.personnelId === emp.id && t.date === date);
            if (!entry) return;

            const project = projects.find(p => p.id === entry.projectId);
            const projectName = project ? (project.codeName || project.name) : (entry.projectId || '—');

            if (entry.punches && entry.punches.length > 0) {
                entry.punches.forEach(punch => {
                    const punchTime = new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    
                    let punchTypeLabel: string = punch.type;
                    if (lang === 'es') {
                        const esPunchTypes: Record<string, string> = {
                            'clockIn': 'Entrada',
                            'clockOut': 'Salida',
                            'lunchStart': 'Inicio Almuerzo',
                            'lunchEnd': 'Fin Almuerzo'
                        };
                        punchTypeLabel = esPunchTypes[punch.type] || punch.type;
                    }

                    rows.push([
                        `"${emp.name}"`,
                        empStatus,
                        `"${projectName}"`,
                        date,
                        punchTypeLabel,
                        punchTime,
                        punch.lat !== 0 ? punch.lat.toString() : '—',
                        punch.lng !== 0 ? punch.lng.toString() : '—',
                        punch.lat !== 0 ? Math.round(punch.accuracy).toString() : '—',
                        entry.gpsVerified ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO'),
                        punch.workMode || 'On Site',
                        punch.timeSource || 'device',
                        punch.manualAdjustment ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO'),
                        `"${(punch.adjustmentNote || '').replace(/"/g, '""')}"`
                    ]);
                });
            } else {
                if (entry.timeIn) {
                    rows.push([
                        `"${emp.name}"`,
                        empStatus,
                        `"${projectName}"`,
                        date,
                        lang === 'es' ? 'Entrada (Manual)' : 'Clock In (Manual)',
                        entry.timeIn,
                        '—', '—', '—',
                        'NO',
                        entry.type || 'On Site',
                        'device',
                        'YES',
                        `"${(entry.notes || '').replace(/"/g, '""')}"`
                    ]);
                }
                if (entry.timeOut) {
                    rows.push([
                        `"${emp.name}"`,
                        empStatus,
                        `"${projectName}"`,
                        date,
                        lang === 'es' ? 'Salida (Manual)' : 'Clock Out (Manual)',
                        entry.timeOut,
                        '—', '—', '—',
                        'NO',
                        entry.type || 'On Site',
                        'device',
                        'YES',
                        `"${(entry.notes || '').replace(/"/g, '""')}"`
                    ]);
                }
            }
        });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_detalle_marcajes_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
