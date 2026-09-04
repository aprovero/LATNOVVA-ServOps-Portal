import { Personnel, Project, TimesheetEntry, AttendanceOverride, WorkSchedule } from '../store/useStore';
import { calculateDailyAttendance } from './attendanceCalculations';
import { getDistanceMeters, parseCoordinates } from './datetime.utils';

export function exportAttendanceToCSV(
    employees: Personnel[],
    projects: Project[],
    timesheets: TimesheetEntry[],
    overrides: AttendanceOverride[],
    schedules: WorkSchedule[],
    startDate: string,
    endDate: string,
    lang: 'en' | 'es' = 'es',
    subsidiary: string = 'US'
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
    link.setAttribute('download', `LATNOVVA${subsidiary}_reporte_asistencia_${startDate}_${endDate}.csv`);
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
    lang: 'en' | 'es' = 'es',
    subsidiary: string = 'US'
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
        'Distancia Entrada a Oficina (metros)',
        'Modo de Trabajo Entrada',
        'Origen de Hora Entrada',
        'Ajuste Manual Entrada',
        'Comentarios Entrada',
        'Hora Salida',
        'Latitud Salida',
        'Longitud Salida',
        'Precisión Salida (metros)',
        'Distancia Salida a Oficina (metros)',
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
        'Clock In Distance to Office (meters)',
        'Clock In Work Mode',
        'Clock In Time Source',
        'Clock In Manual Adjustment',
        'Clock In Comments',
        'Clock Out Time',
        'Clock Out Latitude',
        'Clock Out Longitude',
        'Clock Out Accuracy (meters)',
        'Clock Out Distance to Office (meters)',
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
            const projCoords = project && project.location ? parseCoordinates(project.location) : null;

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

            const getDistanceStr = (punch: any) => {
                if (!punch || punch.lat === 0 || punch.lng === 0 || !projCoords) return '—';
                try {
                    const dist = getDistanceMeters(punch.lat, punch.lng, projCoords.lat, projCoords.lng);
                    return Math.round(dist).toString();
                } catch {
                    return '—';
                }
            };

            const clockInTime = clockInPunch ? formatPunchTime(clockInPunch) : '—';
            const clockInLat = clockInPunch && clockInPunch.lat !== 0 ? clockInPunch.lat.toString() : '—';
            const clockInLng = clockInPunch && clockInPunch.lng !== 0 ? clockInPunch.lng.toString() : '—';
            const clockInAcc = clockInPunch && clockInPunch.lat !== 0 ? Math.round(clockInPunch.accuracy).toString() : '—';
            const clockInDist = getDistanceStr(clockInPunch);
            const clockInWorkMode = clockInPunch ? (clockInPunch.workMode || 'On Site') : '—';
            const clockInSource = clockInPunch ? (clockInPunch.timeSource || 'device') : '—';
            const clockInManual = clockInPunch ? (clockInPunch.manualAdjustment ? (lang === 'es' ? 'SÍ' : 'YES') : (lang === 'es' ? 'NO' : 'NO')) : '—';
            const clockInComment = clockInPunch ? (clockInPunch.adjustmentNote || '') : '';

            const clockOutTime = clockOutPunch ? formatPunchTime(clockOutPunch) : '—';
            const clockOutLat = clockOutPunch && clockOutPunch.lat !== 0 ? clockOutPunch.lat.toString() : '—';
            const clockOutLng = clockOutPunch && clockOutPunch.lng !== 0 ? clockOutPunch.lng.toString() : '—';
            const clockOutAcc = clockOutPunch && clockOutPunch.lat !== 0 ? Math.round(clockOutPunch.accuracy).toString() : '—';
            const clockOutDist = getDistanceStr(clockOutPunch);
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
                clockInDist,
                clockInWorkMode,
                clockInSource,
                clockInManual,
                `"${clockInComment.replace(/"/g, '""')}"`,
                clockOutTime,
                clockOutLat,
                clockOutLng,
                clockOutAcc,
                clockOutDist,
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
    link.setAttribute('download', `LATNOVVA${subsidiary}_reporte completo_asistencia_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportBinaryAttendanceToCSV(
    employees: Personnel[],
    timesheets: TimesheetEntry[],
    overrides: AttendanceOverride[],
    schedules: WorkSchedule[],
    startDate: string,
    endDate: string,
    lang: 'en' | 'es' = 'es',
    subsidiary: string = 'US'
) {
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
    
    const headers = [
        lang === 'es' ? 'Nombre Completo' : 'Full Name',
        lang === 'es' ? 'Número de Empleado' : 'Employee Number',
        lang === 'es' ? 'Puesto' : 'Position',
        ...dates
    ];

    const rows: string[][] = [];

    employees.forEach(emp => {
        const row = [
            `"${emp.name}"`,
            `"${emp.employeeNumber || ''}"`,
            `"${emp.position || ''}"`
        ];

        dates.forEach(date => {
            const dayView = calculateDailyAttendance(emp, date, timesheets, overrides, schedules, lang);
            // REGLA: Solo ausencias / faltas injustificadas son 0; todo lo demás (laborado, home office, descanso, vacaciones, turnos incompletos) es 1
            let code = '1';
            if (dayView.displayStatus === 'Absent') {
                code = '0';
            } else if (dayView.displayStatus === 'Blank') {
                code = '';
            }
            row.push(code);
        });

        rows.push(row);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `LATNOVVA${subsidiary}_reporte_binario_asistencias_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Reporte de Vacaciones (Activas e Históricas) con Saldo y Métricas LFT
 */
export function exportVacationsToCSV(
    employees: Personnel[],
    overrides: AttendanceOverride[],
    projects: Project[],
    startDate: string,
    endDate: string,
    lang: 'en' | 'es' = 'es',
    subsidiary: string = 'US'
) {
    const todayStr = new Date().toLocaleDateString('en-CA');

    const getSeniorityYears = (onboardingDate?: string): number => {
        if (!onboardingDate) return 0;
        const hire = new Date(onboardingDate + 'T00:00:00');
        if (isNaN(hire.getTime())) return 0;
        const now = new Date();
        let years = now.getFullYear() - hire.getFullYear();
        const m = now.getMonth() - hire.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < hire.getDate())) {
            years--;
        }
        return Math.max(0, years);
    };

    const getAnnualEntitlement = (years: number): number => {
        if (years <= 0) return 12;
        if (years === 1) return 12;
        if (years === 2) return 14;
        if (years === 3) return 16;
        if (years === 4) return 18;
        if (years === 5) return 20;
        if (years <= 10) return 22;
        if (years <= 15) return 24;
        if (years <= 20) return 26;
        if (years <= 25) return 28;
        return 30;
    };

    const headers = lang === 'es' ? [
        'Nombre Completo',
        'Número de Empleado',
        'Puesto',
        'Proyecto Asignado',
        'Tipo de Registro',
        'Fecha Inicio',
        'Fecha Fin',
        'Días Solicitados',
        'Estatus Periodo',
        'Aprobado Por',
        'Fecha Solicitud / Registro',
        'Notas / Motivo',
        'Antigüedad (Años)',
        'Días Anuales por Ley (LFT)',
        'Total Días Disfrutados',
        'Saldo Restante (Días)'
    ] : [
        'Full Name',
        'Employee Number',
        'Position',
        'Assigned Project',
        'Record Type',
        'Start Date',
        'End Date',
        'Requested Days',
        'Period Status',
        'Approved By',
        'Request / Created Date',
        'Notes / Reason',
        'Seniority (Years)',
        'Annual Entitlement (Days)',
        'Total Taken (Days)',
        'Remaining Balance (Days)'
    ];

    const rows: string[][] = [];

    employees.forEach(emp => {
        const empProject = projects.find(p => p.id === emp.projectId || p.assignedPersonnel?.includes(emp.id));
        const seniority = getSeniorityYears(emp.onboardingDate);
        const annualEntitlement = getAnnualEntitlement(seniority);

        // Find all vacation periods for this employee
        const empVacations = overrides
            .filter(o => o.employeeId === emp.id && o.type === 'vacation')
            .sort((a, b) => b.startDate.localeCompare(a.startDate));

        // Calculate total taken days
        let totalTakenDays = 0;
        empVacations.forEach(v => {
            if (v.duration === 'half_day') {
                totalTakenDays += 0.5;
            } else {
                const s = new Date(v.startDate + 'T00:00:00').getTime();
                const e = new Date(v.endDate + 'T00:00:00').getTime();
                const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                totalTakenDays += diffDays;
            }
        });

        const remainingBalance = Math.max(0, annualEntitlement - totalTakenDays);

        if (empVacations.length > 0) {
            empVacations.forEach(vac => {
                let periodDays = 1;
                if (vac.duration === 'half_day') {
                    periodDays = 0.5;
                } else {
                    const s = new Date(vac.startDate + 'T00:00:00').getTime();
                    const e = new Date(vac.endDate + 'T00:00:00').getTime();
                    periodDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                }

                let periodStatus = 'Histórica';
                if (todayStr >= vac.startDate && todayStr <= vac.endDate) {
                    periodStatus = lang === 'es' ? 'Activa' : 'Active';
                } else if (vac.startDate > todayStr) {
                    periodStatus = lang === 'es' ? 'Programada' : 'Scheduled';
                } else {
                    periodStatus = lang === 'es' ? 'Histórica' : 'Historical';
                }

                const createdDateStr = vac.createdAt ? vac.createdAt.split('T')[0] : '';

                rows.push([
                    `"${emp.name.replace(/"/g, '""')}"`,
                    `"${(emp.employeeNumber || '').replace(/"/g, '""')}"`,
                    `"${(emp.position || '').replace(/"/g, '""')}"`,
                    `"${(empProject?.name || 'Sin Asignar').replace(/"/g, '""')}"`,
                    `"${lang === 'es' ? 'Vacaciones' : 'Vacation'}"`,
                    `"${vac.startDate}"`,
                    `"${vac.endDate}"`,
                    `${periodDays}`,
                    `"${periodStatus}"`,
                    `"${(vac.approvedBy || 'RH').replace(/"/g, '""')}"`,
                    `"${createdDateStr}"`,
                    `"${(vac.notes || '').replace(/"/g, '""')}"`,
                    `${seniority}`,
                    `${annualEntitlement}`,
                    `${totalTakenDays}`,
                    `${remainingBalance}`
                ]);
            });
        } else {
            // Employee has no registered vacation periods yet: include summary line
            rows.push([
                `"${emp.name.replace(/"/g, '""')}"`,
                `"${(emp.employeeNumber || '').replace(/"/g, '""')}"`,
                `"${(emp.position || '').replace(/"/g, '""')}"`,
                `"${(empProject?.name || 'Sin Asignar').replace(/"/g, '""')}"`,
                `"${lang === 'es' ? 'Sin Registros' : 'No Records'}"`,
                `"-"`,
                `"-"`,
                `0`,
                `"${lang === 'es' ? 'Al Corriente' : 'Current'}"`,
                `"-"`,
                `"-"`,
                `"Sin solicitudes registradas"`,
                `${seniority}`,
                `${annualEntitlement}`,
                `0`,
                `${annualEntitlement}`
            ]);
        }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `LATNOVVA${subsidiary}_reporte_vacaciones_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
