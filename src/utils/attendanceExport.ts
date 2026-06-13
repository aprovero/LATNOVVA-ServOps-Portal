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
        'Hora Entrada',
        'Latitud Entrada',
        'Longitud Entrada',
        'Precisión Entrada (metros)',
        'Modo de Trabajo Entrada',
        'Origen de Hora Entrada',
        'Ajuste Manual Entrada',
        'Comentarios Entrada',
        'Hora Salida',
        'Latitud Salida',
        'Longitud Salida',
        'Precisión Salida (metros)',
        'Modo de Trabajo Salida',
        'Origen de Hora Salida',
        'Ajuste Manual Salida',
        'Comentarios Salida',
        'GPS Verificado'
    ] : [
        'Full Name',
        'Employee Status',
        'Registered Project',
        'Date',
        'Clock In Time',
        'Clock In Latitude',
        'Clock In Longitude',
        'Clock In Accuracy (meters)',
        'Clock In Work Mode',
        'Clock In Time Source',
        'Clock In Manual Adjustment',
        'Clock In Comments',
        'Clock Out Time',
        'Clock Out Latitude',
        'Clock Out Longitude',
        'Clock Out Accuracy (meters)',
        'Clock Out Work Mode',
        'Clock Out Time Source',
        'Clock Out Manual Adjustment',
        'Clock Out Comments',
        'GPS Verified'
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

            // Extract clock-in and clock-out details
            let clockInPunch = entry.punches?.find(p => p.type === 'clockIn');
            let clockOutPunch = entry.punches?.find(p => p.type === 'clockOut');

                        // Fallbacks for manual inputs if punches list is empty
            if (!clockInPunch && entry.timeIn) {
                clockInPunch = {
                    type: 'clockIn',
                    timestamp: `${date}T${entry.timeIn}:00`,
                    lat: 0,
                    lng: 0,
                    accuracy: 0,
                    workMode: entry.type === 'Home Office' ? 'Home Office' : 'On Site',
                    timeSource: 'device',
                    manualAdjustment: true,
                    adjustmentNote: entry.notes || ''
                };
            }

            if (!clockOutPunch && entry.timeOut) {
                clockOutPunch = {
                    type: 'clockOut',
                    timestamp: `${date}T${entry.timeOut}:00`,
                    lat: 0,
                    lng: 0,
                    accuracy: 0,
                    workMode: entry.type === 'Home Office' ? 'Home Office' : 'On Site',
                    timeSource: 'device',
                    manualAdjustment: true,
                    adjustmentNote: entry.notes || ''
                };
            }

            // Skip if no records at all for this timesheet entry
            if (!clockInPunch && !clockOutPunch) return;

            const formatPunchTime = (punch: any) => {
                if (!punch) return '';
                try {
                    // Try parsing or using time format directly if simulated
                    const dt = new Date(punch.timestamp);
                    if (isNaN(dt.getTime())) {
                        return punch.timestamp.split('T')[1]?.substring(0, 5) || '';
                    }
                    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                } catch {
                    return '';
                }
            };

            const clockInTime = clockInPunch ? formatPunchTime(clockInPunch) : '—';
            const clockInLat = clockInPunch && clockInPunch.lat !== 0 ? clockInPunch.lat.toString() : '—';
            const clockInLng = clockInPunch && clockInPunch.lng !== 0 ? clockInPunch.lng.toString() : '—';
            const clockInAcc = clockInPunch && clockInPunch.lat !== 0 ? Math.round(clockInPunch.accuracy).toString() : '—';
            const clockInWorkMode = clockInPunch ? (clockInPunch.workMode || 'On Site') : '—';
            const clockInSource = clockInPunch ? (clockInPunch.timeSource || 'device') : '—';
            const clockInManual = clockInPunch ? (clockInPunch.manualAdjustment ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO')) : '—';
            const clockInComment = clockInPunch ? (clockInPunch.adjustmentNote || '') : '';

            const clockOutTime = clockOutPunch ? formatPunchTime(clockOutPunch) : '—';
            const clockOutLat = clockOutPunch && clockOutPunch.lat !== 0 ? clockOutPunch.lat.toString() : '—';
            const clockOutLng = clockOutPunch && clockOutPunch.lng !== 0 ? clockOutPunch.lng.toString() : '—';
            const clockOutAcc = clockOutPunch && clockOutPunch.lat !== 0 ? Math.round(clockOutPunch.accuracy).toString() : '—';
            const clockOutWorkMode = clockOutPunch ? (clockOutPunch.workMode || 'On Site') : '—';
            const clockOutSource = clockOutPunch ? (clockOutPunch.timeSource || 'device') : '—';
            const clockOutManual = clockOutPunch ? (clockOutPunch.manualAdjustment ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO')) : '—';
            const clockOutComment = clockOutPunch ? (clockOutPunch.adjustmentNote || '') : '';

            const gpsVerified = entry.gpsVerified ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO');

            rows.push([
                `"${emp.name}"`,
                empStatus,
                `"${projectName}"`,
                date,
                clockInTime,
                clockInLat,
                clockInLng,
                clockInAcc,
                clockInWorkMode,
                clockInSource,
                clockInManual,
                `"${clockInComment.replace(/"/g, '""')}"`,
                clockOutTime,
                clockOutLat,
                clockOutLng,
                clockOutAcc,
                clockOutWorkMode,
                clockOutSource,
                clockOutManual,
                `"${clockOutComment.replace(/"/g, '""')}"`,
                gpsVerified
            ]);
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
