import { useStore, ClockPunch, TimesheetEntry } from '../store/useStore';
import { GPS_ACCURACY_THRESHOLD } from '../utils/datetime.utils';

export type AttendanceState = 'idle' | 'clocked-in' | 'clocked-out';

export function useAttendance() {
    const { timesheets, clockPunch } = useStore();

    /**
     * Determines the current attendance state for a specific person.
     */
    const getAttendanceState = (personnelId: string): AttendanceState => {
        const openEntry = timesheets.find(t => t.personnelId === personnelId && t.timeIn && !t.timeOut);
        if (openEntry) return 'clocked-in';
        
        // Optional: check if they already finished a shift today
        const today = new Date().toISOString().split('T')[0];
        const finishedToday = timesheets.some(t => t.personnelId === personnelId && t.date === today && t.timeOut);
        if (finishedToday) return 'clocked-out';
        
        return 'idle';
    };

    /**
     * Finds the active timesheet entry for a person.
     */
    const getActiveEntry = (personnelId: string): TimesheetEntry | undefined => {
        return timesheets.find(t => t.personnelId === personnelId && t.timeIn && !t.timeOut);
    };

    /**
     * Checks if a person is allowed to perform a specific punch action.
     * Prevents double clock-ins or clock-outs without a session.
     */
    const canPunch = (personnelId: string, type: ClockPunch['type']): boolean => {
        const state = getAttendanceState(personnelId);
        if (type === 'clockIn') return state === 'idle' || state === 'clocked-out'; // Allow multiple shifts if logic supports it
        if (type === 'clockOut') return state === 'clocked-in';
        if (type === 'lunchOut') return state === 'clocked-in';
        if (type === 'lunchIn') return true; // always allowed if in an active session
        return false;
    };

    /**
     * Executes a punch with state validation.
     */
    const performPunch = async (personnelId: string, punch: ClockPunch, projectId?: string) => {
        if (!canPunch(personnelId, punch.type)) {
            console.warn(`[useAttendance] Invalid punch state: ${personnelId} attempted ${punch.type} while in ${getAttendanceState(personnelId)} state.`);
            return false;
        }
        
        await clockPunch(personnelId, punch, projectId);
        return true;
    };

    /**
     * Bulk punch validation.
     */
    const getBulkActions = (personnelIds: string[]) => {
        return personnelIds.map(id => ({
            id,
            state: getAttendanceState(id),
            nextAction: getAttendanceState(id) === 'clocked-in' ? 'clockOut' : 'clockIn'
        }));
    };

    return {
        getAttendanceState,
        getActiveEntry,
        canPunch,
        performPunch,
        getBulkActions,
        GPS_ACCURACY_THRESHOLD
    };
}
