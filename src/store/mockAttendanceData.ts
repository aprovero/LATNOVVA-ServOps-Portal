import { AttendanceOverride, WorkSchedule } from './useStore';

export const mockWorkSchedules: WorkSchedule[] = [
    {
        id: 'SCH-STD-MX',
        name: 'Horario Estándar México',
        startTime: '08:00',
        lunchStart: '13:00',
        lunchEnd: '14:00',
        endTime: '17:30',
        standardDailyHours: 8.5,
        workDays: [1, 2, 3, 4, 5] // Mon-Fri
    },
    {
        id: 'SCH-SHIFT-A',
        name: 'Turno A (Sabatino)',
        startTime: '07:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '16:00',
        standardDailyHours: 8.0,
        workDays: [1, 2, 3, 4, 5, 6] // Mon-Sat
    }
];

export const mockAttendanceOverrides: AttendanceOverride[] = [
    {
        id: 'OVR-1',
        employeeId: 'PERS-BF2', // John Anthony Aguilar Jr
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        type: 'vacation',
        duration: 'full_day',
        notes: 'Vacaciones anuales aprobadas por gerencia',
        approvedBy: 'Andres Provero',
        createdBy: 'ALICIA MENDEZ',
        createdAt: '2026-05-25T10:00:00Z',
        updatedAt: '2026-05-25T10:00:00Z'
    },
    {
        id: 'OVR-2',
        employeeId: 'PERS-BF3', // Juan Gonzalez
        startDate: '2026-06-03',
        endDate: '2026-06-03',
        type: 'sick_leave',
        duration: 'full_day',
        notes: 'Justificante médico por resfriado',
        approvedBy: 'ALICIA MENDEZ',
        createdBy: 'ALICIA MENDEZ',
        createdAt: '2026-06-03T08:30:00Z',
        updatedAt: '2026-06-03T08:30:00Z'
    },
    {
        id: 'OVR-3',
        employeeId: 'PERS-BF4', // Ediagnel Rivera
        startDate: '2026-06-02',
        endDate: '2026-06-04',
        type: 'home_office',
        duration: 'full_day',
        notes: 'Trabajo remoto por mantenimiento domiciliario',
        approvedBy: 'RICARDO OLIVA',
        createdBy: 'ALICIA MENDEZ',
        createdAt: '2026-06-01T15:45:00Z',
        updatedAt: '2026-06-01T15:45:00Z'
    }
];
