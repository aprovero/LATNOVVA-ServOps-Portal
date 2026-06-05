import { Personnel, TimesheetEntry, AttendanceOverride, WorkSchedule, AttendanceDayView } from '../store/useStore';

/** Helper to parse HH:mm into minutes since midnight */
export function timeToMinutes(time?: string): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

/** Helper to convert minutes to HH:mm format */
export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Calculate worked hours for a day (subtracting 1 hour fixed lunch) */
export function calculateWorkedHours(
    clockIn?: string | null,
    _lunchStart?: string | null,
    _lunchEnd?: string | null,
    clockOut?: string | null
): { totalWorkedMinutes: number; lunchMinutes: number; error: boolean } {
    if (!clockIn || !clockOut) {
        return { totalWorkedMinutes: 0, lunchMinutes: 0, error: true };
    }

    let inM = timeToMinutes(clockIn);
    let outM = timeToMinutes(clockOut);
    if (inM === null || outM === null) {
        return { totalWorkedMinutes: 0, lunchMinutes: 0, error: true };
    }

    // Crosses midnight adjustment
    if (outM <= inM) {
        outM += 1440; // add 24 hours
    }

    let totalWorkedMinutes = outM - inM;
    let lunchMinutes = 0;

    // Fixed 1 hour (60 minutes) lunch deducted for shifts longer than 4 hours
    if (totalWorkedMinutes > 240) {
        lunchMinutes = 60;
        totalWorkedMinutes -= 60;
    }

    return {
        totalWorkedMinutes: Math.max(0, totalWorkedMinutes),
        lunchMinutes,
        error: false
    };
}

/** Determines if a date string falls inside a range (inclusive) */
export function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
    const d = new Date(dateStr + 'T00:00:00');
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T00:00:00');
    return d >= s && d <= e;
}

/** Format status enum to display label */
export function getStatusLabel(type: string, lang: 'en' | 'es'): string {
    const labels: Record<string, { en: string; es: string }> = {
        vacation: { en: 'Vacation', es: 'Vacaciones' },
        sick_leave: { en: 'Sick Leave', es: 'Incapacidad / Enfermedad' },
        home_office: { en: 'Home Office', es: 'Home Office' },
        personal_leave: { en: 'Personal Leave', es: 'Permiso' },
        unpaid_leave: { en: 'Unpaid Leave', es: 'Permiso sin goce' },
        training: { en: 'Training', es: 'Capacitación' },
        holiday: { en: 'Holiday', es: 'Feriado' },
        rest_day: { en: 'Rest Day', es: 'Descanso' },
        suspension: { en: 'Suspension', es: 'Suspensión' }
    };
    return labels[type]?.[lang] || type;
}

/** Computes the Attendance Day View for a single employee on a single date */
export function calculateDailyAttendance(
    employee: Personnel,
    date: string,
    timesheets: TimesheetEntry[],
    overrides: AttendanceOverride[],
    schedules: WorkSchedule[],
    _lang: 'en' | 'es' = 'es'
): AttendanceDayView {
    // Ignore dates before Jun 5, 2026
    if (date < '2026-06-05') {
        const dayTimesheet = timesheets.find(t => t.personnelId === employee.id && t.date === date);
        return {
            employeeId: employee.id,
            date,
            displayStatus: 'Blank',
            clockIn: dayTimesheet?.timeIn ?? undefined,
            lunchStart: dayTimesheet?.lunchStart ?? undefined,
            lunchEnd: dayTimesheet?.lunchEnd ?? undefined,
            clockOut: dayTimesheet?.timeOut ?? undefined,
            regularHours: dayTimesheet ? Number((dayTimesheet.hours || 0).toFixed(2)) : 0,
            overtimeHours: 0,
            missingPunch: false,
            conflict: false,
            source: 'schedule',
            notes: dayTimesheet?.notes || ''
        };
    }

    // 1. Find overrides for this employee and date
    const dayOverride = overrides.find(o => 
        o.employeeId === employee.id && isDateInRange(date, o.startDate, o.endDate)
    );

    // 2. Find manual/timesheet entries for this employee and date
    const dayTimesheet = timesheets.find(t => 
        t.personnelId === employee.id && t.date === date
    );

    // 3. Find applicable schedule
    const scheduleId = employee.defaultScheduleId || 'SCH-STD-MX';
    const schedule = schedules.find(s => s.id === scheduleId) || {
        id: 'SCH-STD-MX',
        name: 'Horario Estándar México',
        startTime: '08:00',
        lunchStart: '13:00',
        lunchEnd: '14:00',
        endTime: '17:30',
        standardDailyHours: 8.5,
        workDays: [1, 2, 3, 4, 5] // Mon-Fri
    };

    // 4. Determine if this day is a scheduled workday
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 (Sunday) to 6 (Saturday)
    const isScheduledWorkday = schedule.workDays.includes(dayOfWeek);

    const todayStr = new Date().toLocaleDateString('en-CA');
    const isFuture = date > todayStr;

    // Initial default variables
    let displayStatus: AttendanceDayView['displayStatus'] = isScheduledWorkday 
        ? (isFuture ? 'Blank' : 'Absent') 
        : 'Rest Day';
    let clockIn = dayTimesheet?.timeIn ?? undefined;
    let lunchStart = dayTimesheet?.lunchStart ?? undefined;
    let lunchEnd = dayTimesheet?.lunchEnd ?? undefined;
    let clockOut = dayTimesheet?.timeOut ?? undefined;
    let regularHours = 0;
    let overtimeHours = 0;
    let missingPunch = false;
    let conflict = false;
    let source: AttendanceDayView['source'] = 'schedule';
    let notes = dayTimesheet?.notes || dayOverride?.notes || '';

    // Check missing punch (one is missing but not both)
    if (dayTimesheet) {
        const hasTimeIn = !!dayTimesheet.timeIn;
        const hasTimeOut = !!dayTimesheet.timeOut;
        if (hasTimeIn !== hasTimeOut) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (date < todayStr && hasTimeIn && !hasTimeOut) {
                missingPunch = true;
            } else if (!hasTimeIn && hasTimeOut) {
                missingPunch = true;
            }
        }
    }

    // 5. Apply calculation rules & hierarchy
    
    // Check conflicts first
    // Conflict rules: If employee has clock-in/time entry data and an override type of vacation, sick_leave, unpaid_leave, rest_day, suspension, holiday
    const conflictTypes = ['vacation', 'sick_leave', 'unpaid_leave', 'rest_day', 'suspension', 'holiday'];
    const hasWorked = dayTimesheet && (dayTimesheet.timeIn || dayTimesheet.timeOut);
    
    if (dayOverride && hasWorked && conflictTypes.includes(dayOverride.type)) {
        conflict = true;
        displayStatus = 'Conflict';
        source = 'manual';
    } else if (dayOverride) {
        // HR Override is priority 1
        const labelsMap: Record<AttendanceOverride['type'], AttendanceDayView['displayStatus']> = {
            vacation: 'Vacation',
            sick_leave: 'Sick Leave',
            home_office: 'Home Office',
            personal_leave: 'Personal Leave',
            unpaid_leave: 'Unpaid Leave',
            training: 'Training',
            holiday: 'Holiday',
            rest_day: 'Rest Day',
            suspension: 'Suspension'
        };
        displayStatus = labelsMap[dayOverride.type] || 'Present';
        source = 'manual';
    } else if (dayTimesheet && (dayTimesheet.timeIn || dayTimesheet.timeOut)) {
        // Clock-in or Manual correction is priority 2 / 3
        if (missingPunch) {
            displayStatus = 'Missing Punch';
        } else {
            displayStatus = dayTimesheet.type === 'Home Office' ? 'Home Office' : 'Present';
        }
        source = dayTimesheet.source === 'gps' ? 'gps' : 'manual';
    }

    // 6. Calculate hours
    if (dayTimesheet && dayTimesheet.timeIn && dayTimesheet.timeOut) {
        const calc = calculateWorkedHours(
            dayTimesheet.timeIn ?? undefined,
            dayTimesheet.lunchStart ?? undefined,
            dayTimesheet.lunchEnd ?? undefined,
            dayTimesheet.timeOut ?? undefined
        );
        if (!calc.error) {
            const workedHours = calc.totalWorkedMinutes / 60;
            const standardHours = schedule.standardDailyHours;
            
            if (workedHours > standardHours) {
                regularHours = standardHours;
                overtimeHours = workedHours - standardHours;
            } else {
                regularHours = workedHours;
                overtimeHours = 0;
            }
        }
    }

    return {
        employeeId: employee.id,
        date,
        displayStatus,
        clockIn,
        lunchStart,
        lunchEnd,
        clockOut,
        regularHours: Number(regularHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        missingPunch,
        conflict,
        source,
        notes
    };
}

/** Format YYYY-MM-DD into DD/MM/YYYY for es or MM/DD/YYYY for en */
export function formatDisplayDate(dateStr: string, lang: 'en' | 'es'): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        if (lang === 'es') {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
}
