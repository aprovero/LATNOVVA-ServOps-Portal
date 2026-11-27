import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabaseUntyped as supabase } from '../lib/supabase';
import { createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/idbStorage';
import { getGPSAccuracyThreshold, getDistanceMeters, parseCoordinates, isWarehouseBypass } from '../utils/datetime.utils';

import { NormalizedPendingPunch, processNormalizedPunchItem, getSignedMediaUrl } from '../lib/normalizedPunchSync';
import { getActiveShift, setActiveShift, clearActiveShift, recoverActiveShift } from '../lib/activeShiftManager';
import { checkRequiredClientRelease, recordReleaseTelemetry, ReleaseCheckStatus } from '../lib/releaseCheck';
import { getAppVersion, getReleaseId } from '../config/release';
import { getAttendanceV2Engine, computeSelfieSha256 } from '../lib/attendanceV2/transport';
import { attendanceV2Db } from '../lib/attendanceV2/db';
import { AuthorizedRole, normalizeRole } from '../lib/roleAuth';
import { canBootstrapOfflineV2WithLease } from '../lib/attendanceV2/offlineBootstrap';

export type AttendanceWriteMode = 'UNKNOWN' | 'RESOLVING' | 'CANARY' | 'LEGACY' | 'ERROR' | 'V2';

export const TIMESHEET_LIGHTWEIGHT_COLUMNS = 'id, personnel_id, project_id, date, time_in, time_out, hours, type, classification, notes, status, approved_by, gps_verified, source, manual_reason, created_at, updated_at, corrected_by, corrected_at, correction_reason, lunch_start, lunch_end';
export const PERSONNEL_LIGHTWEIGHT_COLUMNS = 'id, name, position, app_role, employee_number, status, email, phone_number, certifications, supervisor_id, manager_id, client_id, prevailing_wage, bench_exempt, regular_rate, rainy_day_rate, overtime_rate, meal_allowance, gas_allowance, truck_allowance, lead_pay, per_diem, dbo, emergency_contact_name, emergency_contact_phone, subsidiary, subsidiary_metadata, faceDescriptor';


export interface PendingSyncItem {
    table: string;
    id: string;
    action: 'insert' | 'update' | 'delete' | 'upsert';
    payload: any;
    timestamp: string;
}

export interface Client {
    id: string;
    name: string;
    logo?: string;
}

export interface Certification {
    name: string;
    issuedDate?: string; // ISO string
    expirationDate: string; // ISO string
    attachmentName?: string;
    hasAttachment?: boolean;
}

export interface Personnel {
    id: string;
    name: string;
    position: string;
    employeeNumber: string;
    email?: string;
    password?: string; // transient field
    image?: string; // Profile picture URL or base64
    faceDescriptor?: number[]; // Biometric 128-float vector
    faceDescriptorVersion?: number; // v6 re-enrollment provenance stamp (6 = v6.0.0+)
    status: 'Active' | 'Inactive';
    sharedFolderLink?: string; // Link to certifications folder
    certifications: Certification[];
    appRole?: 'Tech' | 'Supervisor' | 'Manager' | 'Customer' | 'HR' | 'Office';
    clientId?: string; // For assigned customers to limit scopes
    supervisorId?: string;
    managerId?: string;
    phoneNumber?: string;
    prevailingWage?: boolean;
    isApprentice?: boolean;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    onboardingDate?: string;
    dbo?: string;
    // Financial Fields (HR/Manager Only)
    regularRate?: number;
    rainyDayRate?: number;
    overtimeRate?: number;
    mealAllowance?: number;
    gasAllowance?: number;
    truckAllowance?: number;
    leadPay?: number;
    totalPerdiem?: number;
    /** If true, this person appears in project/report selectors but never on the Deployments bench. */
    benchExempt?: boolean;
    hasPassword?: boolean;
    subsidiary?: 'US' | 'MX';
    subsidiaryMetadata?: any;
    tempProjectId?: string;
    rfc?: string;
    rfcPostalCode?: string;
    documents?: { id: string; name: string; url: string; type: string; uploadDate: string; }[];
    defaultScheduleId?: string;
    projectId?: string;
}

export interface ChecklistTemplate {
    id: string;
    name: string;
    items: string[];
}

export interface ScopeTemplateActivity {
    id: string;
    title: string;
    steps: string[];
    expectedDays: number;
}

export interface ScopeTemplate {
    id: string;
    name: string;
    activities: ScopeTemplateActivity[];
}

export interface ScheduledEvent {
    id: string;
    title: string;
    startDate: string; // ISO yyyy-mm-dd format
    endDate: string;   // ISO yyyy-mm-dd format
    type: 'Project' | 'Maintenance' | 'Other';
    personnelId?: string;
    projectId?: string;
    toolId?: string;
}

export interface ClockPunch {
    id?: string;
    timestamp: string;   // ISO string — always UTC
    lat: number;
    lng: number;
    accuracy: number;    // GPS accuracy in meters
    type: 'clockIn' | 'clockOut';
    timeSource: 'gps' | 'device'; // gps = satellite atomic clock, device = system clock
    manualAdjustment?: boolean; // true if time was entered retroactively
    adjustmentReason?: string; // e.g. 'FORGOTTEN_CLOCKOUT'
    adjustmentNote?: string;
    selfieBlob?: string; // base64 JPEG thumbnail for identity verification
    selfieUrl?: string; // Storage path / signed URL for private selfie image
    supervisorSignatureBlob?: string; // base64 PNG — supervisor's drawn signature for batch punches
    supervisorSignatureUrl?: string; // Storage path / signed URL for private signature image
    isOutsourced?: boolean; // true for non-registered / contract personnel
    outsourcedName?: string; // display name when isOutsourced is true
    workMode?: 'On Site' | 'Home Office';
    isZombieClose?: boolean;
    faceVerified?: boolean;
    faceBypassReason?: string;
    gpsVerified?: boolean;
}

export interface TimesheetEntry {
    id: string;
    personnelId: string;
    date: string; // ISO yyyy-mm-dd
    timeIn?: string | null; // HH:mm
    lunchStart?: string | null; // HH:mm
    lunchEnd?: string | null; // HH:mm
    timeOut?: string | null; // HH:mm
    hours: number;
    type: 'On Site' | 'Travel' | 'Other' | 'Home Office';
    classification?: 'Regular' | 'Overtime' | 'Double Time' | 'Unclassified';
    projectId?: string;
    notes?: string | null;
    status?: 'Pending' | 'Approved' | 'Rejected';
    approvedBy?: string;
    signature?: {
        name: string;
        timestamp: string;
        blob: string;
    };
    punches?: ClockPunch[];     // GPS audit trail from clock-in system
    gpsVerified?: boolean;      // true when all punches have accuracy <= 50m
    source?: 'gps' | 'manual'; // H-04: explicit audit flag
    manualReason?: string;      // H-04: required justification for manual entries
    correctedBy?: string;
    correctedAt?: string;
    correctionReason?: string;
}

export function mapV2ShiftToTimesheetEntry(s: any): TimesheetEntry {
    const startDate = s.first_clock_in_at ? new Date(s.first_clock_in_at) : new Date();
    // Use local calendar date (prevents UTC midnight split for evening shifts in MX)
    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const timeInStr = s.first_clock_in_at
        ? `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
        : null;
    let timeOutStr: string | null = null;
    if (s.final_clock_out_at) {
        const endDate = new Date(s.final_clock_out_at);
        timeOutStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    }
    const workMode = s.work_type === 'HOME_OFFICE' ? 'Home Office' : 'On Site';
    const isForgotten = s.close_method === 'FORGOTTEN_CLOCKOUT_8H' || s.status === 'COMPLETED_FORGOTTEN_8H';
    const isZombie = s.close_method === 'ZOMBIE_AUTO_CLOSE_8H' || s.status === 'ZOMBIE_PENDING_RECONCILIATION';
    const isManual = s.close_method === 'MANUAL_SUPERVISOR_ADJUSTMENT';

    let mappedStatus: 'Pending' | 'Approved' | 'Rejected' = 'Approved';
    if (s.review_status === 'REJECTED') {
        mappedStatus = 'Rejected';
    } else if (s.status === 'OPEN' || s.requires_review || s.review_status === 'PENDING' || isZombie) {
        mappedStatus = 'Pending';
    }

    const totalHours = Number(s.payable_hours || 0) + Number(s.overtime_hours || 0);

    return {
        id: s.shift_id,
        personnelId: s.personnel_id,
        projectId: s.project_id,
        date: dateStr,
        timeIn: timeInStr,
        timeOut: timeOutStr,
        hours: Math.round(totalHours * 100) / 100,
        type: workMode as any,
        status: mappedStatus,
        notes: s.review_notes || undefined,
        approvedBy: s.reviewed_by || undefined,
        gpsVerified: !isForgotten && !isZombie && !s.requires_review,
        source: isManual ? 'manual' : 'gps',
        punches: [
            {
                type: 'clockIn',
                timestamp: s.first_clock_in_at,
                workMode: workMode as any,
                lat: 0,
                lng: 0,
                accuracy: 0,
                timeSource: 'device',
                gpsVerified: !isManual
            },
            ...(s.final_clock_out_at ? [{
                type: 'clockOut' as const,
                timestamp: s.final_clock_out_at,
                workMode: workMode as any,
                lat: 0,
                lng: 0,
                accuracy: 0,
                timeSource: 'device' as const,
                gpsVerified: !isForgotten && !isZombie && !isManual,
                manualAdjustment: isForgotten || isZombie || isManual,
                adjustmentReason: isForgotten ? 'FORGOTTEN_CLOCKOUT' : undefined,
                isZombieClose: isZombie,
                adjustmentNote: s.review_notes || undefined
            }] : [])
        ]
    };
}

export interface ProjectActivity {
    id: string;
    title: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    progress: number; // 0-100%
    expectedHours?: number;
    startDate?: string; // ISO yyyy-mm-dd
    expectedDays?: number;
    steps: { name: string; completed: boolean }[];
}

export interface ProjectScope {
    id: string;
    name: string;
    discipline?: 'Mechanical' | 'Commissioning' | 'Civil' | 'Electrical' | 'Other';
    startDate?: string;
    expectedDuration?: string;
    activities: ProjectActivity[];
    completedDate?: string;
}

export interface Project {
    id: string;
    clientId: string;
    name: string;
    type: 'Complete' | 'Simple';
    status: 'Active' | 'Completed' | 'On Hold' | 'In Progress';
    progress: number;
    scopes: ProjectScope[];
    hasNoDefinedScope?: boolean; // Labor only
    disciplines?: string[];       // Active disciplines
    assignedPersonnel?: string[];
    location?: string;
    locationValidated?: boolean;
    projectSize?: string;
    systemType?: 'Solar' | 'BESS' | 'Hybrid' | 'Other' | string;
    codeName?: string;
    epc?: string;
    oAndM?: string;
    pointOfContact?: string;
    notes?: string;
    siteLeadIds?: string[]; // Multiple leads per project
    expectedDuration?: string; // e.g., '12 Months', '4 Weeks'
    prevailingWage?: boolean;
    subsidiary?: 'US' | 'MX';
    subsidiaryMetadata?: any;
    defaultScheduleId?: string;
    geofenceRadius?: number;
}

export interface AttendanceOverride {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    type: 'vacation' | 'sick_leave' | 'home_office' | 'personal_leave' | 'unpaid_leave' | 'training' | 'holiday' | 'rest_day' | 'suspension';
    duration: 'full_day' | 'half_day' | 'custom_hours';
    customHours?: number;
    notes?: string;
    approvedBy?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface WorkSchedule {
    id: string;
    name: string;
    startTime: string; // HH:mm
    lunchStart?: string; // HH:mm
    lunchEnd?: string; // HH:mm
    endTime: string; // HH:mm
    standardDailyHours: number;
    workDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface AttendanceDayView {
    employeeId: string;
    date: string;
    displayStatus: 'Present' | 'Vacation' | 'Sick Leave' | 'Home Office' | 'Personal Leave' | 'Unpaid Leave' | 'Training' | 'Holiday' | 'Rest Day' | 'Suspension' | 'Absent' | 'Missing Punch' | 'Conflict' | 'Blank';
    clockIn?: string | null;
    lunchStart?: string | null;
    lunchEnd?: string | null;
    clockOut?: string | null;
    regularHours?: number;
    overtimeHours?: number;
    missingPunch: boolean;
    conflict: boolean;
    zombie?: boolean;
    source?: 'clockin' | 'manual' | 'import' | 'gps' | 'schedule';
    notes?: string | null;
    shifts?: Array<{
        timeIn?: string | null;
        lunchStart?: string | null;
        lunchEnd?: string | null;
        timeOut?: string | null;
        hours: number;
        projectId?: string;
        notes?: string | null;
    }>;
}

interface AppState {
    userRole: AuthorizedRole | null;
    userId: string;
    userEmail?: string;
    activeSubsidiary: 'US' | 'MX';
    clientId: string | null;
    clients: Client[];
    projects: Project[];
    personnel: Personnel[];
    templates: ChecklistTemplate[];
    scopeTemplates: ScopeTemplate[];
    events: ScheduledEvent[];
    timesheets: TimesheetEntry[];
    /** Returns the display name of the currently logged-in user (L-03). */
    getCurrentUserName: () => string;
    /** Resolves the Personnel ID for the currently logged-in user. */
    resolvePersonnelId: () => string | null;
    attendanceWriteMode: AttendanceWriteMode;
    normalizedAttendanceEnabled: boolean;
    checkAttendanceWriteMode: () => Promise<boolean>;
    clientReleaseStatus: ReleaseCheckStatus;
    showUpdateModal: boolean;
    setShowUpdateModal: (show: boolean) => void;
    initDb: () => Promise<void>;
    fetchTimesheetsForRange: (startDate: string, endDate: string) => Promise<void>;
    fetchTimesheetDetail: (timesheetId: string) => Promise<any>;
    resetDb: () => void;
    setAuthData: (id: string, email: string) => void;
    setUserRole: (role: AuthorizedRole | null) => void;
    setActiveSubsidiary: (sub: 'US' | 'MX') => void;
    setClientId: (id: string | null) => void;
    addClient: (client: Client) => void;
    updateClient: (id: string, updates: Partial<Client>) => void;
    deleteClient: (id: string) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    addPersonnel: (person: Personnel) => void;
    updatePersonnel: (id: string, updates: Partial<Personnel>) => void;
    deletePersonnel: (id: string) => void;
    addTemplate: (template: ChecklistTemplate) => void;
    updateTemplate: (id: string, updates: Partial<ChecklistTemplate>) => void;
    deleteTemplate: (id: string) => void;
    addScopeTemplate: (template: ScopeTemplate) => void;
    updateScopeTemplate: (id: string, updates: Partial<ScopeTemplate>) => void;
    deleteScopeTemplate: (id: string) => void;
    addEvent: (event: ScheduledEvent) => void;
    updateEvent: (id: string, updates: Partial<ScheduledEvent>) => void;
    deleteEvent: (id: string) => void;
    addTimesheet: (timesheet: TimesheetEntry) => Promise<void>;
    updateTimesheet: (id: string, updates: Partial<TimesheetEntry>) => Promise<void>;
    deleteTimesheet: (id: string) => Promise<void>;
    approveTimesheet: (id: string, approverId: string) => Promise<void>;
    rejectTimesheet: (id: string, approverId: string) => Promise<void>;
    clockPunch: (personnelId: string, punch: ClockPunch, projectId?: string, lunchSkipped?: boolean, explicitTimesheetId?: string) => Promise<void>;
    discardStaleShift: (timesheetId: string) => Promise<void>;
    discardShortShift: (timesheetId: string) => Promise<void>;
    attendanceOverrides: AttendanceOverride[];
    workSchedules: WorkSchedule[];
    addAttendanceOverride: (override: AttendanceOverride) => void;
    updateAttendanceOverride: (id: string, updates: Partial<AttendanceOverride>) => void;
    deleteAttendanceOverride: (id: string) => void;
    addWorkSchedule: (schedule: WorkSchedule) => void;
    updateWorkSchedule: (id: string, updates: Partial<WorkSchedule>) => void;
    deleteWorkSchedule: (id: string) => void;
    assignSupervisor: (personnelId: string, supervisorId?: string, managerId?: string) => void;
    transferPersonnel: (personnelId: string, targetProjectId: string | null) => Promise<void>;
    addScopeToProject: (projectId: string, scope: ProjectScope) => void;
    updateProjectScope: (projectId: string, scopeId: string, updates: Partial<ProjectScope>) => void;
    deleteProjectScope: (projectId: string, scopeId: string) => void;
    addActivityToScope: (projectId: string, scopeId: string, activity: ProjectActivity) => void;
    deleteProjectActivity: (projectId: string, scopeId: string, activityId: string) => void;
    updateActivityProgress: (projectId: string, scopeId: string, activityId: string, updates: Partial<ProjectActivity>) => void;
    // Notifications Clearing
    dismissedNotifications: string[];
    dismissNotification: (id: string) => void;
    clearNotifications: (ids: string[]) => void;
    language: 'en' | 'es';
    setLanguage: (lang: 'en' | 'es') => void;
    platformSettings: {
        shiftLengthThreshold: number;
        enableShiftNotifications: boolean;
        enableAutoClockOut: boolean;
        autoClockOutThreshold: number;
        geofenceRadius: number;
        gpsAccuracyThreshold: number;
        enableFacialId: boolean;
        enableFastLogin: boolean;
        enableSurvey?: boolean;
        customProjectTypes?: string[];
        minimumClientVersion: string;
        minimumClientVersionEffectiveAt: string | null;
        minimumClientVersionEnabled: boolean;
        requiredClientRelease?: number;
        requiredPasswordPolicyVersion: number;
        passwordRotationEffectiveAt: string | null;
        passwordRotationEnabled: boolean;
    };
    updatePlatformSettings: (settings: Partial<AppState['platformSettings']>) => void;
    checkZombieSessions: () => Promise<void>;
    refreshAttendance: () => Promise<void>;
    initializeGlobalTemplates: () => Promise<void>;
    // Sync Queue Management
    pendingSync: PendingSyncItem[];
    isSyncing: boolean;
    isInitializing: boolean;
    syncError: string | null;
    processSyncQueue: () => Promise<void>;
    safeSync: (table: string, id: string, action: 'insert' | 'update' | 'upsert' | 'delete', payload: any) => Promise<void>;
    clearSyncQueue: () => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            userRole: null,
            userId: '',
            activeSubsidiary: 'MX',
            clientId: null,
            clients: [],
            projects: [],
            personnel: [],
            dismissedNotifications: [],
            pendingSync: [],
            clearSyncQueue: () => set({ pendingSync: [] }),
            isSyncing: false,
            isInitializing: false,
            syncError: null,

            templates: [
                {
                    id: 'TPL-001',
                    name: 'Standard Startup Check',
                    items: ['Verify PPE', 'Check weather conditions', 'Inspect equipment for damage', 'Review safety protocols']
                }
            ],
            scopeTemplates: [
                {
                    id: 'STPL-001',
                    name: 'Civil Works Default',
                    activities: [
                        { id: 'act-1', title: 'Site Preparation', steps: ['Clearing', 'Leveling'], expectedDays: 5 },
                        { id: 'act-2', title: 'Trenching', steps: ['Marking', 'Digging'], expectedDays: 10 }
                    ]
                },
                {
                    id: 'STPL-002',
                    name: 'Commissioning Standard',
                    activities: [
                        { id: 'act-3', title: 'Cold Commissioning', steps: ['Visual Check', 'Continuity'], expectedDays: 3 },
                        { id: 'act-4', title: 'Hot Commissioning', steps: ['Power on', 'Functional'], expectedDays: 7 }
                    ]
                },
                {
                    id: 'STPL-INV-COLD',
                    name: 'Inverter COLD COMMISSIONING',
                    activities: [
                        { 
                            id: 'inv-c-1', 
                            title: '1. Visual Inspection', 
                            steps: [
                                'Verify inverter model, serial number, and rating match project documentation',
                                'Inspect enclosure for physical damage, corrosion, or water ingress',
                                'Confirm proper mounting, alignment, and clearance per OEM specs',
                                'Check cable routing (AC, DC, control) for mechanical stress or sharp bends',
                                'Verify labeling of cables, terminals, and equipment (as per drawings)',
                                'Confirm grounding connections are present and properly terminated'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-c-2', 
                            title: '2. Mechanical & Torque Verification', 
                            steps: [
                                'Verify torque of AC terminals (L1, L2, L3, N if applicable) per OEM spec',
                                'Verify torque of DC input terminals or busbars',
                                'Check grounding/bonding connections torque',
                                'Inspect internal busbars and connections (if accessible)',
                                'Verify torque on auxiliary power and control connections',
                                'Confirm all covers and shields are in place and secured'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-c-3', 
                            title: '3. Cable & Insulation Checks', 
                            steps: [
                                'Check phase-to-phase and phase-to-ground insulation resistance on AC cables',
                                'Check positive-to-negative and pole-to-ground insulation resistance on DC cables',
                                'Verify continuity of all grounding and bonding conductors',
                                'Ensure control and communication cables are separated from power cables',
                                'Perform point-to-point wiring check for control and signal circuits',
                                'Verify all cable glands and entries are sealed/weather-tight'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-c-4', 
                            title: '4. Firmware & Parameter Verification', 
                            steps: [
                                'Verify inverter firmware version matches latest OEM/Project requirement',
                                'Check and record pre-set grid protection parameters (over/under voltage, frequency)',
                                'Verify communication settings (IP address, Modbus ID, Baud rate)',
                                'Confirm time and date settings are synchronized with site server/GPS',
                                'Check that internal clock batteries are functional (if applicable)',
                                'Ensure all configurable safety features (e.g., AFCI, RISO) are enabled as per specs'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-c-5', 
                            title: '5. Auxiliary Systems & Communications Check', 
                            steps: [
                                'Verify auxiliary power supply voltage matches rating',
                                'Test operation of internal cooling fans or liquid cooling pumps',
                                'Confirm communication link between inverter and site monitoring/SCADA',
                                'Test emergency stop (E-Stop) circuit continuity',
                                'Check status of internal surge protection devices (SPDs)',
                                'Perform loop test on remote control/shutdown signals'
                            ],
                            expectedDays: 1
                        }
                    ]
                },
                {
                    id: 'STPL-INV-HOT',
                    name: 'Inverter HOT COMMISSIONING',
                    activities: [
                        { 
                            id: 'inv-h-1', 
                            title: '1. Pre-Energization Voltage Checks', 
                            steps: [
                                'Measure AC grid voltage on all phases and confirm it is within inverter operating range',
                                'Confirm proper phase rotation of the AC supply',
                                'Measure DC input voltage from strings/combiners and verify polarity',
                                'Confirm DC voltage is within PV start-up range',
                                'Measure auxiliary power supply voltage again while fully loaded',
                                'Ensure no ground faults exist on AC or DC systems'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-h-2', 
                            title: '2. Energization (Step-by-Step)', 
                            steps: [
                                'Close auxiliary power breaker and verify HMI/Display boots correctly',
                                'Release emergency stop and confirm "Ready" status',
                                'Close DC input breakers one by one and check for immediate faults',
                                'Close AC output breaker according to the switching sequence',
                                'Initiate the inverter start sequence via HMI or remote command',
                                'Monitor the "Grid Synchronization" process',
                                'Confirm the inverter reaches "Producing" or "Mains Operation" state'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-h-3', 
                            title: '3. Functional Operation Test', 
                            steps: [
                                'Monitor output current and power levels for stability',
                                'Verify MPPT tracking is active and balanced (if multi-MPPT)',
                                'Check and record internal temperatures (heat sinks, capacitors, inductors)',
                                'Observe fan/pump operation at higher loads',
                                'Confirm all HMI data (kW, kWh, PF, V, I) matches external meter readings',
                                'Verify reactive power control (if requested by utility/grid controller)'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-h-4', 
                            title: '4. Protection & Safety Testing', 
                            steps: [
                                'Simulate a grid failure (Anti-Islanding test) and record disconnection time',
                                'Simulate an AC over-voltage/under-voltage condition and verify trip',
                                'Perform a DC ground fault simulation (if safe and equipment supports)',
                                'Trigger an E-Stop and confirm immediate shutdown and AC/DC disconnection',
                                'Verify that the inverter does not auto-restart (if manual reset is required)',
                                'Check that fault alarms are correctly received at SCADA/Monitoring'
                            ],
                            expectedDays: 1
                        },
                        { 
                            id: 'inv-h-5', 
                            title: '5. Performance & Final Validation', 
                            steps: [
                                'Compare calculated DC input power vs AC output power for efficiency check',
                                'Check for any abnormal noise, vibration, or odors during full load',
                                'Verify that communication logs are continuous without dropped packets',
                                'Take thermal images of all internal power connections under load',
                                'Download final inverter event log and configuration report',
                                'Secure all enclosure doors and ensure seals are intact for final handover'
                            ],
                            expectedDays: 1
                        }
                    ]
                }
            ],
            events: [],
            timesheets: [],
            attendanceOverrides: [],
            workSchedules: [],
            language: (localStorage.getItem('i18nextLng') as 'en' | 'es') || 'en',
            setLanguage: (lang) => {
                set({ language: lang });
                import('../i18n').then(m => m.default.changeLanguage(lang));
            },
            platformSettings: {
                shiftLengthThreshold: 8,
                enableShiftNotifications: true,
                enableAutoClockOut: true,
                autoClockOutThreshold: 14,
                geofenceRadius: 1000,
                gpsAccuracyThreshold: 100,
                enableFacialId: true,
                enableFastLogin: false,
                enableSurvey: false,
                customProjectTypes: [],
                minimumClientVersion: '6.0.0',
                minimumClientVersionEffectiveAt: null,
                minimumClientVersionEnabled: true,
                requiredClientRelease: 60,
                requiredPasswordPolicyVersion: 1,
                passwordRotationEffectiveAt: null,
                passwordRotationEnabled: true,
            },
            updatePlatformSettings: (settings) => {
                const next = { ...get().platformSettings, ...settings };
                set({ platformSettings: next });
                // Send ONLY actual public.platform_settings DB columns (avoids PGRST204 wedging pendingSync)
                const dbPayload = {
                    id: 'global',
                    shiftLengthThreshold: next.shiftLengthThreshold,
                    enableShiftNotifications: next.enableShiftNotifications,
                    enableAutoClockOut: next.enableAutoClockOut,
                    autoClockOutThreshold: next.autoClockOutThreshold,
                    geofenceRadius: next.geofenceRadius,
                    gpsAccuracyThreshold: next.gpsAccuracyThreshold,
                    enableFacialId: next.enableFacialId,
                    enableFastLogin: next.enableFastLogin,
                    enableSurvey: next.enableSurvey ?? false,
                    customProjectTypes: next.customProjectTypes ?? [],
                    minimum_client_version: next.minimumClientVersion,
                    minimum_client_version_enabled: next.minimumClientVersionEnabled,
                    minimum_client_version_effective_at: next.minimumClientVersionEffectiveAt,
                    required_client_release: next.requiredClientRelease,
                    required_password_policy_version: next.requiredPasswordPolicyVersion,
                    password_rotation_enabled: next.passwordRotationEnabled,
                    password_rotation_effective_at: next.passwordRotationEffectiveAt
                };
                get().safeSync('platform_settings', 'global', 'upsert', dbPayload);
            },

            checkZombieSessions: async () => {
                const { timesheets, platformSettings, clockPunch, pendingSync, userRole, userId, attendanceWriteMode } = get();
                // In Attendance V2, zombie shift closure (8.00h standard) is server-authoritative via pg_cron & record_attendance_event.
                if (attendanceWriteMode === 'V2') return;
                if (!platformSettings.enableAutoClockOut) return;

                // Find open sessions where the current time is past 11:59 PM (23:59) on the shift's date
                const zombies = timesheets.filter(t => {
                    if (!t.timeIn || t.timeOut) return false;
                    
                    // Tech role can only auto-close their own zombie shifts (prevents RPC 400 forbidden errors)
                    if (userRole === 'Tech' && userId && t.personnelId !== userId) return false;

                    // Skip if it's already in the pendingSync queue to be updated/inserted
                    const hasPendingSync = pendingSync.some(p => p.table === 'mx_timesheets' && p.id === t.id);
                    if (hasPendingSync) return false;

                    const todayStr = new Date().toLocaleDateString('en-CA'); // Local YYYY-MM-DD
                    return t.date < todayStr;
                });

                if (zombies.length === 0) return;

                console.log(`[Zombie] Cleaning up ${zombies.length} stale sessions with standard schedule (10h) credited...`);
                
                for (const z of zombies) {
                    const [year, month, day] = z.date.split('-').map(Number);
                    let autoOutTime = new Date(year, month - 1, day, 18, 0, 0); // Standard office close 18:00
                    if (z.timeIn && z.timeIn.includes(':')) {
                        const [inH, inM] = z.timeIn.split(':').map(Number);
                        const outH = Math.min(23, inH + 10);
                        autoOutTime = new Date(year, month - 1, day, outH, inM, 0);
                    }
                    
                    try {
                        await clockPunch(z.personnelId, {
                            timestamp: autoOutTime.toISOString(),
                            lat: 0, lng: 0, accuracy: 0,
                            type: 'clockOut',
                            timeSource: 'device',
                            manualAdjustment: true,
                            isZombieClose: true,
                            adjustmentNote: `System: Auto closed (>14h) - 10h acreditadas`
                        });
                    } catch (e) {
                        console.error(`[Zombie] Failed to close session for ${z.personnelId}:`, e);
                    }
                }
            },

            processSyncQueue: async () => {
                const { isSyncing, pendingSync } = get();
                
                // SAFETY GUARD: If sync has been "running" for > 30s, assume it hung and force reset
                const now = Date.now();
                const lastSyncAttempt = (get() as any).lastSyncTimestamp || 0;
                const isHanging = isSyncing && (now - lastSyncAttempt > 30000);

                if ((isSyncing && !isHanging) || pendingSync.length === 0 || !navigator.onLine) return;

                set({ isSyncing: true, syncError: null, lastSyncTimestamp: now } as any);

                try {
                    // Process while we have items and we are online
                    while (get().pendingSync.length > 0 && navigator.onLine) {
                        const item = get().pendingSync[0]; // Take the first one

                        // Stage 2 Normalized Punch Event Queue Handler
                        if (item.action === ('normalized_punch' as any) || item.table === 'mx_timesheet_punches') {
                            if (get().attendanceWriteMode === 'V2') {
                                console.warn(`[processSyncQueue] Dropping obsolete pre-V2 normalized punch ${item.id} from queue.`);
                                set(state => ({
                                    pendingSync: state.pendingSync.filter(i => i !== item),
                                    syncError: null
                                }));
                                continue;
                            }
                            const personnel = get().personnel.find(p => p.id === item.payload?.targetPersonnelId);
                            const subsidiary = personnel?.subsidiary || 'MX';
                            const { updatedItem, isComplete } = await processNormalizedPunchItem(item.payload, subsidiary);
                            
                            if (isComplete) {
                                set(state => ({
                                    pendingSync: state.pendingSync.filter(i => i !== item)
                                }));
                            } else {
                                // Update payload in queue with state machine progression
                                set(state => ({
                                    pendingSync: state.pendingSync.map(i => i === item ? { ...i, payload: updatedItem } : i)
                                }));
                                // On retryable/conflict error, break out of loop
                                break;
                            }
                            continue;
                        }

                        try {
                            let query;
                            const payload = { ...item.payload };
                            if (item.table === 'platform_settings' && !payload.id) {
                                payload.id = item.id;
                            }

                            if (item.action === 'insert') {
                                query = supabase.from(item.table).insert(payload);
                            } else if (item.action === 'update') {
                                query = supabase.from(item.table).update(payload).eq('id', item.id);
                            } else if (item.action === 'upsert') {
                                query = supabase.from(item.table).upsert(payload);
                            } else if (item.action === 'delete') {
                                query = supabase.from(item.table).delete().eq('id', item.id);
                            }

                            if (query) {
                                let { error } = await query;
                                if (error && item.table === 'platform_settings' && payload.customProjectTypes && (error.message?.includes('customProjectTypes') || (error as any).code === '42703')) {
                                    console.warn('customProjectTypes column not found in Supabase platform_settings, retrying sync without it...');
                                    const sanitized = { ...payload };
                                    delete sanitized.customProjectTypes;
                                    const retryQuery = item.action === 'upsert'
                                        ? supabase.from(item.table).upsert(sanitized)
                                        : supabase.from(item.table).update(sanitized).eq('id', item.id);
                                    const retryRes = await retryQuery;
                                    error = retryRes.error;
                                }
                                if (error) throw error;
                            }

                            // Success: remove from queue
                            set(state => ({
                                pendingSync: state.pendingSync.filter(i => i !== item)
                            }));
                        } catch (err: any) {
                            console.error(`Sync failed for ${item.table}/${item.id}:`, err);
                            const lastError = err.message || err.toString();

                            // If an operation on mx_timesheets failed with permission denied in V2 mode,
                            // discard the invalid legacy sync mutation so the queue does not stay permanently wedged.
                            if (item.table === 'mx_timesheets' && (lastError.includes('permission denied') || (err as any).code === '42501')) {
                                console.warn(`[processSyncQueue] Dropping unauthorized legacy mx_timesheets mutation for ${item.id} from queue.`);
                                set(state => ({
                                    pendingSync: state.pendingSync.filter(i => i !== item),
                                    syncError: null
                                }));
                                continue;
                            }

                            set({ syncError: `Sync Error: ${lastError} (${get().pendingSync.length} pending)` });
                            // On failure, we stop processing this queue to avoid out-of-order issues
                            break;
                        }
                    }
                } finally {
                    set({ isSyncing: false });
                    // Also replay any Attendance V2 offline events & pending selfies when online
                    if (navigator.onLine && get().attendanceWriteMode === 'V2') {
                        try {
                            const { engine, mediaSync } = getAttendanceV2Engine();
                            engine.syncOfflineQueue().catch((e: any) => console.warn('[V2] Offline queue sync warning:', e));
                            mediaSync.syncAllPendingMedia().catch((e: any) => console.warn('[V2] Media sync warning:', e));
                        } catch { /* non-fatal */ }
                    }
                }
            },

            safeSync: async (table, id, action, payload) => {
                // PASS 12N: Client-Side Canary Write Boundary Guard
                if (table === 'mx_timesheets' && (action === 'insert' || action === 'update' || action === 'upsert')) {
                    if (get().attendanceWriteMode === 'CANARY' || get().normalizedAttendanceEnabled) {
                        const targetPid = payload?.personnel_id;
                        const callerPid = get().resolvePersonnelId() || get().userId;
                        if (targetPid && (targetPid === callerPid) && (payload?.time_in || payload?.time_out || payload?.punches)) {
                            console.error(`[safeSync] CANARY direct legacy attendance write blocked for ${targetPid}`);
                            await recordReleaseTelemetry('CANARY_LEGACY_WRITE_BLOCKED', { personnelId: targetPid, operation: action });
                            throw new Error('CANARY_NORMALIZED_WRITE_REQUIRED');
                        }
                    }
                }

                const syncItem: PendingSyncItem = { table, id, action, payload, timestamp: new Date().toISOString() };
                
                // Add to queue first (Optimistic)
                set(state => ({ 
                    pendingSync: [...state.pendingSync, syncItem],
                    syncError: null 
                }));

                // Immediately try to process the queue
                await get().processSyncQueue();
            },

            clientReleaseStatus: 'CURRENT' as ReleaseCheckStatus,
            showUpdateModal: false,
            setShowUpdateModal: (show: boolean) => set({ showUpdateModal: show }),

            attendanceWriteMode: 'UNKNOWN' as AttendanceWriteMode,
            normalizedAttendanceEnabled: false,

            checkAttendanceWriteMode: async () => {
                set({ attendanceWriteMode: 'RESOLVING' });
                try {
                    // PASS 13I-0: Check Attendance V2 Authoritative Control State
                    try {
                        const { data: v2Control, error: v2Err } = await supabase
                            .from('attendance_v2_control')
                            .select('system_state, minimum_v2_client_release_id')
                            .eq('control_id', 1)
                            .maybeSingle();

                        if (!v2Err && v2Control && v2Control.system_state === 'V2_ACTIVE') {
                            const myRelease = getReleaseId();
                            if (v2Control.minimum_v2_client_release_id && myRelease < v2Control.minimum_v2_client_release_id) {
                                console.warn(`[checkAttendanceWriteMode] V2 active but client release ${myRelease} < required ${v2Control.minimum_v2_client_release_id}`);
                                set((state) => ({
                                    attendanceWriteMode: 'ERROR',
                                    clientReleaseStatus: 'UPDATE_REQUIRED',
                                    showUpdateModal: true,
                                    platformSettings: {
                                        ...state.platformSettings,
                                        requiredClientRelease: v2Control.minimum_v2_client_release_id,
                                    }
                                }));
                                return false;
                            }
                            set({ 
                                attendanceWriteMode: 'V2', 
                                normalizedAttendanceEnabled: true 
                            });
                            return true;
                        }
                    } catch (v2CheckEx) {
                        // Non-fatal if table does not exist in legacy database
                    }

                    const { data, error } = await supabase.rpc('get_attendance_write_mode');
                    if (!error && data && typeof data.mode === 'string') {
                        // FAIL CLOSED: If server reports ERROR or identity was unresolved, never assume legacy!
                        if (data.mode === 'ERROR' || !data.personnel_id) {
                            console.warn('[checkAttendanceWriteMode] Identity unresolved or server ERROR:', data.reason || 'Missing personnel_id');
                            set({ 
                                attendanceWriteMode: 'ERROR', 
                                normalizedAttendanceEnabled: false 
                            });
                            return false;
                        }

                        if (data.mode === 'CANARY') {
                            set({ 
                                attendanceWriteMode: 'CANARY',
                                normalizedAttendanceEnabled: true 
                            });
                            return true;
                        }

                        if (data.mode === 'LEGACY') {
                            set({ 
                                attendanceWriteMode: 'LEGACY',
                                normalizedAttendanceEnabled: false 
                            });
                            return false;
                        }
                    }
                    console.error('[checkAttendanceWriteMode] RPC error or invalid data:', error || data);
                } catch (e) {
                    console.error('[checkAttendanceWriteMode] RPC exception:', e);
                }

                // Item 15 & 16 (PASS 15D): Offline Write-Mode Bootstrap
                // Fallback to persisted authenticated userId when personnel[] has not yet hydrated from IndexedDB.
                try {
                    const resolvedPid = get().resolvePersonnelId() || (get().userId || null);
                    if (resolvedPid) {
                        await attendanceV2Db.init();
                        const lease = await attendanceV2Db.getLatestOfflineLeaseForPersonnel(resolvedPid);
                        const localDeviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('attendance_device_id') : null;
                        if (canBootstrapOfflineV2WithLease(lease, resolvedPid, localDeviceId)) {
                            console.info('[checkAttendanceWriteMode] Offline with valid V2 lease — enabling V2 offline mode.');
                            set({ attendanceWriteMode: 'V2', normalizedAttendanceEnabled: true });
                            return true;
                        }
                    }
                } catch (leaseErr) {
                    console.warn('[checkAttendanceWriteMode] Offline lease check failed:', leaseErr);
                }

                // FAIL CLOSED: No server confirmation and no valid unexpired offline lease.
                set({ attendanceWriteMode: 'ERROR', normalizedAttendanceEnabled: false });
                return false;
            },

            initDb: async () => {
                const now = Date.now();
                const lastInit = (get() as any)._lastInitTime || 0;
                if (get().isInitializing || (now - lastInit < 15000)) {
                    console.log('[initDb] Already initializing or throttled (<15s), skipping...');
                    return;
                }
                set({ isInitializing: true, _lastInitTime: now } as any);
                try {
                    // Ensure auth session is loaded/refreshed first to prevent concurrent lock issues
                    await supabase.auth.getSession();
                    await get().checkAttendanceWriteMode();

                    // PASS 12N: Central Release Freshness Check on startup
                    try {
                        const releaseCheck = await checkRequiredClientRelease();
                        if (releaseCheck.status === 'UPDATE_REQUIRED') {
                            set((state) => ({
                                showUpdateModal: true,
                                clientReleaseStatus: 'UPDATE_REQUIRED',
                                platformSettings: {
                                    ...state.platformSettings,
                                    minimumClientVersion: releaseCheck.requiredVersion || state.platformSettings.minimumClientVersion,
                                    requiredClientRelease: releaseCheck.requiredRelease ?? state.platformSettings.requiredClientRelease,
                                }
                            }));
                        } else if (get().clientReleaseStatus !== 'UPDATE_REQUIRED') {
                            set({ clientReleaseStatus: releaseCheck.status });
                        }
                    } catch (rcErr) {
                        console.warn('[initDb] Release check warning:', rcErr);
                    }

                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

                    const currentRole = normalizeRole(get().userRole);
                    const isCustomerUser = currentRole === 'Customer';

                    const [
                        clientsRes,
                        projectsRes,
                        personnelRes,
                        timesheetsRes,
                        schedulesRes,
                        settingsRes,
                        v2ShiftsRes
                    ] = await Promise.allSettled([
                        supabase.from('clients').select('*'),
                        supabase.from('projects').select('*'),
                        isCustomerUser
                            ? Promise.resolve({ data: null, error: null })
                            : supabase.from('mx_personnel').select(PERSONNEL_LIGHTWEIGHT_COLUMNS),
                        isCustomerUser
                            ? Promise.resolve({ data: null, error: null })
                            : supabase.from('mx_timesheets').select(TIMESHEET_LIGHTWEIGHT_COLUMNS).gte('date', thirtyDaysAgoStr).order('date', { ascending: false }),
                        isCustomerUser
                            ? Promise.resolve({ data: null, error: null })
                            : supabase.from('mx_work_schedules').select('*'),
                        supabase.from('platform_settings').select('*').eq('id', 'global').maybeSingle(),
                        isCustomerUser
                            ? Promise.resolve({ data: null, error: null })
                            : supabase.from('attendance_shifts').select('*').gte('first_clock_in_at', thirtyDaysAgoStr).order('first_clock_in_at', { ascending: false })
                    ]);

                    const clientsDB = clientsRes.status === 'fulfilled' ? clientsRes.value.data : null;
                    const projectsDB = projectsRes.status === 'fulfilled' ? projectsRes.value.data : null;
                    const personnelDB = personnelRes.status === 'fulfilled' ? personnelRes.value.data : null;
                    const timesheetsDB = timesheetsRes.status === 'fulfilled' ? timesheetsRes.value.data : null;
                    const schedulesDB = schedulesRes.status === 'fulfilled' ? schedulesRes.value.data : null;
                    const settingsDB = settingsRes.status === 'fulfilled' ? settingsRes.value.data : null;
                    const v2ShiftsDB = v2ShiftsRes.status === 'fulfilled' ? v2ShiftsRes.value.data : null;

                    // Guard: only overwrite store state if Supabase returned actual rows.
                    // An empty array [] is truthy in JS, so `data || fallback` would wipe
                    // persisted local state when RLS blocks reads or the DB is empty.
                    set((state) => ({
                        ...state,
                        clients: (() => {
                            const mappedClients = clientsDB?.length
                                ? clientsDB.map(c => ({
                                    id: c.id,
                                    name: c.name,
                                    logo: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=2563EB&color=fff`
                                }))
                                : (isCustomerUser ? [] : state.clients);
                            return isCustomerUser
                                ? mappedClients.filter(c => state.clientId && c.id === state.clientId)
                                : mappedClients;
                        })(),
                        projects: (() => {
                            const mappedProjects = projectsDB?.length
                                ? projectsDB.map(p => ({
                                    id: p.id,
                                    clientId: p.client_id,
                                    name: p.name,
                                    type: p.type,
                                    status: p.status,
                                    progress: p.progress,
                                    location: p.location,
                                    locationValidated: p.location_validated ?? true,
                                    projectSize: p.project_size,
                                    systemType: p.system_type,
                                    codeName: p.code_name,
                                    assignedPersonnel: p.assigned_personnel || [],
                                    siteLeadIds: p.site_lead_ids || [],
                                    hasNoDefinedScope: p.has_no_defined_scope || false,
                                    disciplines: p.disciplines || [],
                                    scopes: p.scopes || [],
                                    subsidiary: p.subsidiary || 'MX',
                                    subsidiaryMetadata: p.subsidiary_metadata || {},
                                    defaultScheduleId: p.subsidiary_metadata?.defaultScheduleId || p.default_schedule_id || undefined,
                                    geofenceRadius: p.subsidiary_metadata?.geofenceRadius ? Number(p.subsidiary_metadata.geofenceRadius) : (p.geofence_radius ? Number(p.geofence_radius) : undefined)
                                }))
                                : (isCustomerUser ? [] : state.projects);
                            return isCustomerUser
                                ? mappedProjects.filter(p => state.clientId && p.clientId === state.clientId)
                                : mappedProjects;
                        })(),
                        personnel: (() => {
                            const dbRecords = personnelDB?.length
                                ? personnelDB.map((p: any) => ({
                                    id: p.id,
                                    name: p.name,
                                    position: p.position,
                                    appRole: p.app_role,
                                    employeeNumber: p.employee_number,
                                    status: p.status,
                                    email: p.email,
                                    phoneNumber: p.phone_number,
                                    certifications: p.certifications || [],
                                    supervisorId: p.supervisor_id,
                                    managerId: p.manager_id,
                                    clientId: p.client_id,
                                    image: p.image,
                                    faceDescriptor: p.faceDescriptor || (p as any).face_descriptor || undefined,
                                    prevailingWage: p.prevailing_wage || false,
                                    benchExempt: p.bench_exempt || false,
                                    regularRate: p.regular_rate,
                                    rainyDayRate: p.rainy_day_rate,
                                    overtimeRate: p.overtime_rate,
                                    mealAllowance: p.meal_allowance,
                                    gasAllowance: p.gas_allowance,
                                    truckAllowance: p.truck_allowance,
                                    leadPay: p.lead_pay,
                                    totalPerdiem: p.per_diem,
                                    dbo: p.dbo,
                                    emergencyContactName: p.emergency_contact_name,
                                    emergencyContactPhone: p.emergency_contact_phone,
                                    subsidiary: p.subsidiary || 'MX',
                                    subsidiaryMetadata: p.subsidiary_metadata || {},
                                    faceDescriptorVersion: (p.faceDescriptor || (p as any).face_descriptor) ? 6 : undefined
                                }))
                                : (isCustomerUser ? [] : state.personnel);

                            return isCustomerUser ? [] : dbRecords;
                        })(),
                        timesheets: (() => {
                            if (isCustomerUser) return [];
                            if (!timesheetsDB && !v2ShiftsDB) return state.timesheets;
                            const legacyMapped = (timesheetsDB || []).map((t: any) => ({
                                id: t.id,
                                personnelId: t.personnel_id,
                                projectId: t.project_id,
                                date: t.date,
                                timeIn: t.time_in,
                                lunchStart: t.lunch_start,
                                lunchEnd: t.lunch_end,
                                timeOut: t.time_out,
                                hours: t.hours,
                                type: t.type,
                                classification: t.classification,
                                notes: t.notes,
                                status: t.status,
                                approvedBy: t.approved_by,
                                signature: t.signature || undefined,
                                punches: t.punches || [],
                                gpsVerified: t.gps_verified,
                                source: (t as any).source || 'manual',
                                manualReason: (t as any).manual_reason,
                                correctedBy: (t as any).corrected_by,
                                correctedAt: (t as any).corrected_at,
                                correctionReason: (t as any).correction_reason,
                            }));

                            const v2Mapped = (v2ShiftsDB || []).map(mapV2ShiftToTimesheetEntry);
                            const dbMapped = [...legacyMapped, ...v2Mapped];

                            const pendingIds = new Set(
                                state.pendingSync
                                    .filter(item => item.table === 'mx_timesheets')
                                    .map(item => item.id)
                            );

                            const dbMap = new Map(dbMapped.map(t => [t.id, t]));
                            const merged = state.timesheets
                                .filter(t => {
                                    if (pendingIds.has(t.id)) return true;
                                    if (dbMap.has(t.id)) return true;
                                    // Keep historical rows outside the 30-day refresh window; prune deleted/stale rows inside it
                                    return Boolean(t.date && t.date < thirtyDaysAgoStr);
                                })
                                .map(t => {
                                    if (pendingIds.has(t.id)) return t;
                                    const fromDb = dbMap.get(t.id);
                                    if (fromDb) {
                                        dbMap.delete(t.id);
                                        const localHasRealPunches = t.punches && t.punches.some((p: any) => p.lat !== 0 || p.lng !== 0 || p.selfieUrl || p.faceVerified);
                                        const dbHasMore = (fromDb.punches?.length || 0) > (t.punches?.length || 0);
                                        return {
                                            ...fromDb,
                                            punches: (localHasRealPunches && !dbHasMore) ? t.punches : (fromDb.punches || []),
                                            signature: t.signature || fromDb.signature,
                                        };
                                    }
                                    return t;
                                });
                            for (const remaining of dbMap.values()) {
                                if (!pendingIds.has(remaining.id)) {
                                    merged.push(remaining);
                                }
                            }
                            return merged;
                        })(),
                        attendanceOverrides: [],
                        workSchedules: schedulesDB?.length
                            ? schedulesDB.map(s => ({
                                id: s.id,
                                name: s.name,
                                startTime: s.start_time,
                                lunchStart: s.lunch_start,
                                lunchEnd: s.lunch_end,
                                endTime: s.end_time,
                                standardDailyHours: s.standard_daily_hours,
                                workDays: s.work_days
                            }))
                            : [],
                        platformSettings: settingsDB
                            ? {
                                shiftLengthThreshold: Number(settingsDB.shiftLengthThreshold) || state.platformSettings.shiftLengthThreshold,
                                enableShiftNotifications: settingsDB.enableShiftNotifications !== null ? !!settingsDB.enableShiftNotifications : state.platformSettings.enableShiftNotifications,
                                enableAutoClockOut: settingsDB.enableAutoClockOut !== null ? !!settingsDB.enableAutoClockOut : state.platformSettings.enableAutoClockOut,
                                autoClockOutThreshold: Number(settingsDB.autoClockOutThreshold) || state.platformSettings.autoClockOutThreshold,
                                geofenceRadius: Number(settingsDB.geofenceRadius) || state.platformSettings.geofenceRadius,
                                gpsAccuracyThreshold: Number(settingsDB.gpsAccuracyThreshold) || state.platformSettings.gpsAccuracyThreshold,
                                enableFacialId: settingsDB.enableFacialId !== null ? !!settingsDB.enableFacialId : state.platformSettings.enableFacialId,
                                enableFastLogin: settingsDB.enableFastLogin !== null ? !!settingsDB.enableFastLogin : state.platformSettings.enableFastLogin,
                                enableSurvey: settingsDB.enableSurvey !== undefined && settingsDB.enableSurvey !== null ? !!settingsDB.enableSurvey : state.platformSettings.enableSurvey,
                                customProjectTypes: Array.isArray(settingsDB.customProjectTypes) ? settingsDB.customProjectTypes : state.platformSettings.customProjectTypes || [],
                                minimumClientVersion: settingsDB.minimum_client_version || settingsDB.minimumClientVersion || settingsDB.minimum_version || state.platformSettings.minimumClientVersion,
                                minimumClientVersionEffectiveAt: settingsDB.minimum_client_version_effective_at || settingsDB.minimumClientVersionEffectiveAt || settingsDB.minimum_version_effective_at || null,
                                minimumClientVersionEnabled: settingsDB.minimum_client_version_enabled !== undefined && settingsDB.minimum_client_version_enabled !== null ? !!settingsDB.minimum_client_version_enabled : (settingsDB.minimum_version_enabled !== undefined && settingsDB.minimum_version_enabled !== null ? !!settingsDB.minimum_version_enabled : (settingsDB.minimumClientVersionEnabled !== undefined ? !!settingsDB.minimumClientVersionEnabled : state.platformSettings.minimumClientVersionEnabled)),
                                requiredClientRelease: settingsDB.required_client_release !== undefined && settingsDB.required_client_release !== null ? Number(settingsDB.required_client_release) : state.platformSettings.requiredClientRelease,
                                requiredPasswordPolicyVersion: Number(settingsDB.required_password_policy_version || settingsDB.requiredPasswordPolicyVersion) || state.platformSettings.requiredPasswordPolicyVersion,
                                passwordRotationEffectiveAt: settingsDB.password_rotation_effective_at || settingsDB.passwordRotationEffectiveAt || null,
                                passwordRotationEnabled: settingsDB.password_rotation_enabled !== undefined && settingsDB.password_rotation_enabled !== null ? !!settingsDB.password_rotation_enabled : (settingsDB.passwordRotationEnabled !== undefined ? !!settingsDB.passwordRotationEnabled : state.platformSettings.passwordRotationEnabled),
                            }
                            : state.platformSettings,
                    }));

                    // ── SMART MERGE ──
                    // After fetching from DB, re-apply any local pending changes that haven't synced yet.
                    set((state) => {
                        const { pendingSync } = state;
                        if (pendingSync.length === 0) return state;

                        const newState = { ...state };
                        
                        pendingSync.forEach(item => {
                            // Map table name to store key
                            const tableToKey: Record<string, keyof AppState> = {
                                'clients': 'clients',
                                'projects': 'projects',
                                'mx_personnel': 'personnel',
                                'mx_timesheets': 'timesheets',
                                'scope_templates': 'scopeTemplates'
                            };

                            const key = tableToKey[item.table];
                            if (key && Array.isArray(newState[key])) {
                                const list = [...(newState[key] as any[])];
                                const idx = list.findIndex(l => l.id === item.id);

                                if (item.action === 'delete') {
                                    if (idx !== -1) list.splice(idx, 1);
                                } else if (item.action === 'insert' || item.action === 'upsert' || item.action === 'update') {
                                    if (idx !== -1) {
                                        list[idx] = { ...list[idx], ...item.payload };
                                    } else if (item.action !== 'update') {
                                        list.push(item.payload);
                                    }
                                }
                                (newState as any)[key] = list;
                            }
                        });
                        
                        return newState;
                    });
                    
                    // Trigger background sync for anything pending
                    get().processSyncQueue();
                    
                    // Attendance V2: replay offline queue/media and ensure a valid offline lease is cached
                    if (navigator.onLine && get().attendanceWriteMode === 'V2') {
                        (async () => {
                            try {
                                const { engine, mediaSync } = getAttendanceV2Engine();
                                await engine.syncOfflineQueue();
                                await mediaSync.syncAllPendingMedia();
                                const pid = get().resolvePersonnelId();
                                if (pid) {
                                    const deviceId = typeof localStorage !== 'undefined'
                                        ? (localStorage.getItem('attendance_device_id') || 'DEV-WEB')
                                        : 'DEV-WEB';
                                    const existingLease = await attendanceV2Db.getLatestOfflineLeaseForPersonnel(pid);
                                    const remainingMs = existingLease ? (Date.parse(existingLease.valid_until) - Date.now()) : 0;
                                    const needsRefresh =
                                        !existingLease ||
                                        existingLease.is_revoked ||
                                        existingLease.device_id !== deviceId ||
                                        !Number.isFinite(remainingMs) ||
                                        remainingMs < 2 * 3600 * 1000;
                                    if (needsRefresh) {
                                        const { data: leaseRes } = await supabase.rpc('issue_attendance_offline_lease', {
                                            p_device_id: deviceId,
                                            p_device_platform: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'Web',
                                            p_client_release_id: getReleaseId(),
                                            p_client_app_version: getAppVersion(),
                                            p_duration_hours: 24
                                        });
                                        if (leaseRes?.success && leaseRes.lease_id) {
                                            await attendanceV2Db.saveOfflineLease({
                                                lease_id: leaseRes.lease_id,
                                                auth_user_id: get().userId || '',
                                                personnel_id: pid,
                                                subsidiary: get().activeSubsidiary || 'MX',
                                                device_id: deviceId,
                                                attendance_protocol_version: 2,
                                                client_release_id: getReleaseId(),
                                                client_app_version: getAppVersion(),
                                                valid_from: leaseRes.valid_from,
                                                valid_until: leaseRes.valid_until,
                                                is_revoked: false,
                                                scopes: leaseRes.scopes || [],
                                                cached_at: new Date().toISOString()
                                            });
                                        }
                                    }
                                }
                            } catch (v2InitErr) {
                                console.warn('[initDb] Attendance V2 background sync/lease warning:', v2InitErr);
                            }
                        })();
                    }

                    // Cleanup stale sessions (Zombies — legacy mode only)
                    get().checkZombieSessions();

                } catch (error) {
                    console.error('Failed to init DB from Supabase', error);
                } finally {
                    set({ isInitializing: false });
                }
            },

            refreshAttendance: async () => {
                try {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

                    const [timesheetsRes, overridesRes, v2ShiftsRes] = await Promise.allSettled([
                        supabase.from('mx_timesheets').select(TIMESHEET_LIGHTWEIGHT_COLUMNS).gte('date', thirtyDaysAgoStr).order('date', { ascending: false }),
                        supabase.from('mx_attendance_overrides').select('*').gte('start_date', thirtyDaysAgoStr),
                        supabase.from('attendance_shifts').select('*').gte('first_clock_in_at', thirtyDaysAgoStr).order('first_clock_in_at', { ascending: false })
                    ]);

                    const timesheetsDB = timesheetsRes.status === 'fulfilled' ? timesheetsRes.value.data : null;
                    const overridesDB = overridesRes.status === 'fulfilled' ? overridesRes.value.data : null;
                    const v2ShiftsDB = v2ShiftsRes.status === 'fulfilled' ? v2ShiftsRes.value.data : null;

                    set(state => {
                        const newState: Partial<AppState> = {};

                        if (timesheetsDB || v2ShiftsDB) {
                            const legacyMapped = (timesheetsDB || []).map((t: any) => ({
                                id: t.id,
                                personnelId: t.personnel_id,
                                projectId: t.project_id,
                                date: t.date,
                                timeIn: t.time_in,
                                lunchStart: t.lunch_start,
                                lunchEnd: t.lunch_end,
                                timeOut: t.time_out,
                                hours: t.hours,
                                type: t.type,
                                classification: t.classification,
                                notes: t.notes,
                                status: t.status,
                                approvedBy: t.approved_by,
                                signature: t.signature || undefined,
                                punches: t.punches || [],
                                gpsVerified: t.gps_verified,
                                source: (t as any).source || 'manual',
                                manualReason: (t as any).manual_reason,
                                correctedBy: (t as any).corrected_by,
                                correctedAt: (t as any).corrected_at,
                                correctionReason: (t as any).correction_reason,
                            }));

                            const v2Mapped = (v2ShiftsDB || []).map(mapV2ShiftToTimesheetEntry);
                            const dbMapped = [...legacyMapped, ...v2Mapped];

                            const pendingIds = new Set(
                                state.pendingSync
                                    .filter(item => item.table === 'mx_timesheets')
                                    .map(item => item.id)
                            );

                            const dbMap = new Map(dbMapped.map(t => [t.id, t]));
                            const merged = state.timesheets
                                .filter(t => {
                                    if (pendingIds.has(t.id)) return true;
                                    if (dbMap.has(t.id)) return true;
                                    // Keep historical rows outside the 30-day refresh window; prune deleted/stale rows inside it
                                    return Boolean(t.date && t.date < thirtyDaysAgoStr);
                                })
                                .map(t => {
                                    if (pendingIds.has(t.id)) return t;
                                    const fromDb = dbMap.get(t.id);
                                    if (fromDb) {
                                        dbMap.delete(t.id);
                                        const localHasRealPunches = t.punches && t.punches.some((p: any) => p.lat !== 0 || p.lng !== 0 || p.selfieUrl || p.faceVerified);
                                        const dbHasMore = (fromDb.punches?.length || 0) > (t.punches?.length || 0);
                                        return {
                                            ...fromDb,
                                            punches: (localHasRealPunches && !dbHasMore) ? t.punches : (fromDb.punches || []),
                                            signature: t.signature || fromDb.signature,
                                        };
                                    }
                                    return t;
                                });
                            for (const remaining of dbMap.values()) {
                                if (!pendingIds.has(remaining.id)) {
                                    merged.push(remaining);
                                }
                            }
                            newState.timesheets = merged;
                        }

                        if (overridesDB) {
                            newState.attendanceOverrides = (overridesDB as any[]).map(o => ({
                                id: o.id,
                                employeeId: o.employee_id,
                                startDate: o.start_date,
                                endDate: o.end_date,
                                type: o.type,
                                duration: o.duration,
                                customHours: o.custom_hours,
                                notes: o.notes,
                                approvedBy: o.approved_by,
                                createdBy: o.created_by,
                                createdAt: o.createdAt || o.created_at,
                                updatedAt: o.updatedAt || o.updated_at
                            }));
                        }

                        return newState;
                    });
                } catch (e) {
                    console.error('[Sync] Failed to refresh attendance:', e);
                }
            },
            dismissNotification: (id) => set((state) => ({
                dismissedNotifications: [...state.dismissedNotifications, id]
            })),
            clearNotifications: (ids) => set((state) => ({
                dismissedNotifications: [...state.dismissedNotifications, ...ids]
            })),
            fetchTimesheetsForRange: async (startDate: string, endDate: string) => {
                if (!startDate || !endDate) return;
                try {
                    // Convert local calendar date bounds to ISO timestamps so evening shifts in MX are not missed
                    const localStartIso = new Date(`${startDate}T00:00:00`).toISOString();
                    const localEndIso = new Date(`${endDate}T23:59:59.999`).toISOString();
                    const [legacyRes, v2Res] = await Promise.allSettled([
                        supabase
                            .from('mx_timesheets')
                            .select(TIMESHEET_LIGHTWEIGHT_COLUMNS)
                            .gte('date', startDate)
                            .lte('date', endDate),
                        supabase
                            .from('attendance_shifts')
                            .select('*')
                            .gte('first_clock_in_at', localStartIso)
                            .lte('first_clock_in_at', localEndIso)
                    ]);
                    
                    const legacyData = legacyRes.status === 'fulfilled' ? legacyRes.value.data : null;
                    const v2Data = v2Res.status === 'fulfilled' ? v2Res.value.data : null;

                    if ((legacyData && legacyData.length > 0) || (v2Data && v2Data.length > 0)) {
                        set((state) => {
                            const legacyMapped = (legacyData || []).map((t: any) => ({
                                id: t.id,
                                personnelId: t.personnel_id,
                                projectId: t.project_id,
                                date: t.date,
                                timeIn: t.time_in,
                                lunchStart: t.lunch_start,
                                lunchEnd: t.lunch_end,
                                timeOut: t.time_out,
                                hours: t.hours,
                                type: t.type,
                                classification: t.classification,
                                notes: t.notes,
                                status: t.status,
                                approvedBy: t.approved_by,
                                signature: t.signature || undefined,
                                punches: t.punches || [],
                                gpsVerified: t.gps_verified,
                                source: (t as any).source || 'manual',
                                manualReason: (t as any).manual_reason,
                                correctedBy: (t as any).corrected_by,
                                correctedAt: (t as any).corrected_at,
                                correctionReason: (t as any).correction_reason,
                            }));

                            const v2Mapped = (v2Data || []).map(mapV2ShiftToTimesheetEntry);
                            const dbMapped = [...legacyMapped, ...v2Mapped];

                            const existingMap = new Map(state.timesheets.map(t => [t.id, t]));
                            const dbMap = new Map(dbMapped.map(d => [d.id, d]));
                            const merged = state.timesheets.map(t => {
                                const fromDb = dbMap.get(t.id);
                                if (fromDb) {
                                    const localHasRealPunches = t.punches && t.punches.some((p: any) => p.lat !== 0 || p.lng !== 0 || p.selfieUrl || p.faceVerified);
                                    const dbHasMore = (fromDb.punches?.length || 0) > (t.punches?.length || 0);
                                    return {
                                        ...fromDb,
                                        punches: (localHasRealPunches && !dbHasMore) ? t.punches : (fromDb.punches || []),
                                        signature: t.signature || fromDb.signature,
                                    };
                                }
                                return t;
                            });
                            for (const fresh of dbMapped) {
                                if (!existingMap.has(fresh.id)) {
                                    merged.push(fresh);
                                }
                            }
                            return { timesheets: merged };
                        });
                    }
                } catch (e) {
                    console.error('[Store] Failed to fetch timesheets for range:', e);
                }
            },
            fetchTimesheetDetail: async (timesheetId: string) => {
                if (!timesheetId) return null;
                try {
                    // 1. Attendance V2: query attendance_events + attendance_event_media first
                    if (get().attendanceWriteMode === 'V2' || get().normalizedAttendanceEnabled) {
                        const { data: v2Events, error: v2Err } = await supabase
                            .from('attendance_events')
                            .select('*')
                            .eq('shift_id', timesheetId)
                            .order('device_event_timestamp', { ascending: true });

                        if (!v2Err && v2Events && v2Events.length > 0) {
                            const eventIds = v2Events.map((e: any) => e.event_id);
                            const { data: mediaRows } = await supabase
                                .from('attendance_event_media')
                                .select('event_id, media_type, storage_bucket, storage_path')
                                .in('event_id', eventIds);

                            const mediaByEvent = new Map<string, any[]>();
                            for (const m of (mediaRows || [])) {
                                const list = mediaByEvent.get(m.event_id) || [];
                                list.push(m);
                                mediaByEvent.set(m.event_id, list);
                            }

                            const mappedPunches = await Promise.all(v2Events.map(async (e: any) => {
                                const mList = mediaByEvent.get(e.event_id) || [];
                                const selfieRow = mList.find((m: any) => m.media_type === 'SELFIE');
                                const sigRow = mList.find((m: any) => m.media_type === 'SUPERVISOR_SIGNATURE');
                                let selfieSigned: string | undefined;
                                let sigSigned: string | undefined;
                                if (selfieRow?.storage_path) {
                                    const { data: signed } = await supabase.storage
                                        .from(selfieRow.storage_bucket || 'attendance-v2-media-private')
                                        .createSignedUrl(selfieRow.storage_path, 3600);
                                    selfieSigned = signed?.signedUrl;
                                }
                                if (sigRow?.storage_path) {
                                    const { data: signed } = await supabase.storage
                                        .from(sigRow.storage_bucket || 'attendance-v2-media-private')
                                        .createSignedUrl(sigRow.storage_path, 3600);
                                    sigSigned = signed?.signedUrl;
                                }
                                return {
                                    id: e.event_id,
                                    timestamp: e.reported_departure_timestamp || e.device_event_timestamp,
                                    type: (e.event_type === 'CLOCK_OUT' ? 'clockOut' : 'clockIn') as ('clockIn' | 'clockOut'),
                                    workMode: (e.work_type === 'HOME_OFFICE' ? 'Home Office' : 'On Site') as ('On Site' | 'Home Office'),
                                    lat: Number(e.latitude) || 0,
                                    lng: Number(e.longitude) || 0,
                                    accuracy: Number(e.accuracy_meters) || 0,
                                    timeSource: (e.gps_verified ? 'gps' : 'device') as ('gps' | 'device'),
                                    manualAdjustment: Boolean(e.is_manual_adjustment),
                                    adjustmentReason: e.adjustment_reason || undefined,
                                    adjustmentNote: e.worker_explanation || undefined,
                                    faceVerified: Boolean(e.face_verified),
                                    faceBypassReason: e.face_bypass_reason || undefined,
                                    gpsVerified: Boolean(e.gps_verified),
                                    selfieBlob: selfieSigned,
                                    selfieUrl: selfieSigned,
                                    supervisorSignatureBlob: sigSigned,
                                    supervisorSignatureUrl: sigSigned,
                                };
                            }));

                            set((state) => ({
                                timesheets: state.timesheets.map(t =>
                                    t.id === timesheetId
                                        ? { ...t, punches: mappedPunches }
                                        : t
                                )
                            }));
                            return { id: timesheetId, punches: mappedPunches };
                        }
                    }

                    // 2. Legacy CANARY normalized punches fallback (only if rows exist)
                    if (get().attendanceWriteMode === 'CANARY') {
                        const { data: punchesData, error } = await supabase
                            .from('mx_timesheet_punches')
                            .select('*')
                            .eq('timesheet_id', timesheetId)
                            .order('timestamp', { ascending: true });

                        if (!error && punchesData && punchesData.length > 0) {
                            const mappedPunches = await Promise.all(punchesData.map(async (p: any) => {
                                const selfieSigned = await getSignedMediaUrl(p.selfie_url);
                                const sigSigned = await getSignedMediaUrl(p.supervisor_signature_url);
                                return {
                                    id: p.id,
                                    timestamp: p.timestamp,
                                    type: p.type as ('clockIn' | 'clockOut'),
                                    workMode: p.work_mode,
                                    lat: p.lat,
                                    lng: p.lng,
                                    accuracy: p.accuracy,
                                    timeSource: p.time_source,
                                    manualAdjustment: p.manual_adjustment,
                                    adjustmentNote: p.adjustment_note,
                                    faceVerified: p.face_verified,
                                    faceBypassReason: p.face_bypass_reason,
                                    isOutsourced: p.is_outsourced,
                                    outsourcedName: p.outsourced_name,
                                    isZombieClose: p.is_zombie_close,
                                    gpsVerified: p.gps_verified,
                                    selfieBlob: selfieSigned || undefined,
                                    selfieUrl: selfieSigned || undefined,
                                    supervisorSignatureBlob: sigSigned || undefined,
                                    supervisorSignatureUrl: sigSigned || undefined,
                                };
                            }));

                            set((state) => ({
                                timesheets: state.timesheets.map(t =>
                                    t.id === timesheetId
                                        ? { ...t, punches: mappedPunches }
                                        : t
                                )
                            }));
                            return { id: timesheetId, punches: mappedPunches };
                        }
                    }

                    // Legacy shadow read fallback
                    const { data, error } = await supabase
                        .from('mx_timesheets')
                        .select('id, punches, signature')
                        .eq('id', timesheetId)
                        .maybeSingle();

                    if (error) {
                        console.warn('[fetchTimesheetDetail] Error fetching detail:', error);
                        return null;
                    }

                    if (data) {
                        set((state) => ({
                            timesheets: state.timesheets.map(t =>
                                t.id === timesheetId
                                    ? {
                                        ...t,
                                        punches: data.punches || t.punches || [],
                                        signature: data.signature ?? t.signature
                                      }
                                    : t
                            )
                        }));
                        return data;
                    }
                } catch (err) {
                    console.error('[fetchTimesheetDetail] Exception:', err);
                }
                return null;
            },

            resetDb: () => {
                set(() => ({
                    userRole: null,
                    userId: '',
                    userEmail: '',
                    clientId: null,
                    clients: [],
                    projects: [],
                    personnel: [],
                    timesheets: [],
                    dismissedNotifications: [],
                    attendanceOverrides: [],
                    workSchedules: [],
                    pendingSync: []
                }));
            },
            /** Returns the display name of the currently logged-in user (H-02). 
             *  Strategy: (1) match personnel.id = userId (UUID match, works when personnel row uses auth UID)
             *            (2) match personnel.email = userEmail (fallback for legacy IDs)
             *            (3) format email as "Firstname L." from userEmail
             *            (4) raw userId as last resort
             */
            getCurrentUserName: () => {
                const { userId, userEmail, personnel } = get();
                // 1. Direct ID match (works when personnel.id === supabase auth uid)
                const byId = personnel.find(p => p.id === userId);
                if (byId) return byId.name;
                // 2. Email match (works when personnel record has email stored)
                if (userEmail) {
                    const byEmail = personnel.find(p => p.email?.toLowerCase() === userEmail.toLowerCase());
                    if (byEmail) return byEmail.name;
                    // 3. Format email as readable name: "john.smith@co.com" → "John Smith"
                    const local = userEmail.split('@')[0];
                    return local.split(/[._-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
                return userId;
            },
            resolvePersonnelId: () => {
                const { userId, userEmail, personnel } = get();
                // 1. Direct ID match
                const byId = personnel.find(p => p.id === userId);
                if (byId) return byId.id;
                // 2. Email match
                if (userEmail) {
                    const byEmail = personnel.find(p => p.email?.toLowerCase() === userEmail.toLowerCase());
                    if (byEmail) return byEmail.id;
                }
                return null;
            },
            setAuthData: (id, email) => {
                set({ userId: id, userEmail: email });
                get().checkAttendanceWriteMode();
            },
            setUserRole: (role) => set({ userRole: normalizeRole(role) }),
            setActiveSubsidiary: (sub) => set({ activeSubsidiary: sub }),
            setClientId: (id) => set({ clientId: id }),
            addClient: async (client) => {
                set((state) => ({ clients: [...state.clients, client] }));
                await get().safeSync('clients', client.id, 'insert', client);
            },
            updateClient: async (id, updates) => {
                set((state) => ({ clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c) }));
                await get().safeSync('clients', id, 'update', {
                    name: updates.name,
                    logo: updates.logo
                });
            },
            deleteClient: async (id) => {
                set((state) => ({ clients: state.clients.filter(c => c.id !== id) }));
                await get().safeSync('clients', id, 'delete', null);
            },
            addProject: async (project) => {
                const sub = project.subsidiary || 'MX';
                set((state) => ({ projects: [...state.projects, { ...project, subsidiary: sub }] }));
                const dbPayload = {
                    id: project.id,
                    client_id: project.clientId,
                    name: project.name,
                    type: project.type,
                    status: project.status,
                    progress: project.progress,
                    project_size: project.projectSize,
                    system_type: project.systemType,
                    location: project.location,
                    location_validated: project.locationValidated ?? true,
                    code_name: project.codeName,
                    scopes: project.scopes || [],
                    assigned_personnel: project.assignedPersonnel || [],
                    site_lead_ids: project.siteLeadIds || [],
                    has_no_defined_scope: project.hasNoDefinedScope || false,
                    disciplines: project.disciplines || [],
                    prevailing_wage: project.prevailingWage || false,
                    subsidiary: sub,
                    subsidiary_metadata: {
                        ...(project.subsidiaryMetadata || {}),
                        ...(project.defaultScheduleId ? { defaultScheduleId: project.defaultScheduleId } : {}),
                        ...(project.geofenceRadius !== undefined ? { geofenceRadius: project.geofenceRadius } : {})
                    }
                };
                await get().safeSync('projects', project.id, 'insert', dbPayload);

                // Initial propagation for people assigned during creation
                if (project.prevailingWage && project.assignedPersonnel?.length) {
                    set((state) => ({
                        personnel: state.personnel.map(p => 
                            project.assignedPersonnel?.includes(p.id) ? { ...p, prevailingWage: true } : p
                        )
                    }));
                    // Sync individual personnel records to ensure we don't violate NOT NULL constraints with partial upserts
                    for (const pid of project.assignedPersonnel) {
                        await get().safeSync('mx_personnel', pid, 'update', { prevailing_wage: true });
                    }
                }
            },
            updateProject: async (id, updates) => {
                const currentProject = get().projects.find(p => p.id === id);
                
                // SIDE EFFECT: When a project is completed, unassign all personnel (H-05)
                if (updates.status === 'Completed' && currentProject?.status !== 'Completed') {
                    updates.assignedPersonnel = [];
                }

                // SIDE EFFECT: Prevailing Wage Propagation (Two-Way)
                const newPrevailingWage = updates.prevailingWage !== undefined ? updates.prevailingWage : currentProject?.prevailingWage;
                const newAssignedList = updates.assignedPersonnel !== undefined ? updates.assignedPersonnel : currentProject?.assignedPersonnel;
                const wageChanged = updates.prevailingWage !== undefined && updates.prevailingWage !== currentProject?.prevailingWage;
                const listChanged = updates.assignedPersonnel !== undefined;

                if (wageChanged || listChanged) {
                    const targetWage = !!newPrevailingWage;
                    const peopleToUpdate = newAssignedList || [];

                    if (peopleToUpdate.length > 0) {
                        set((state) => ({
                            personnel: state.personnel.map(p => 
                                peopleToUpdate.includes(p.id) ? { ...p, prevailingWage: targetWage } : p
                            )
                        }));
                        // Sync individual personnel records to ensure we don't violate NOT NULL constraints with partial upserts
                        for (const pid of peopleToUpdate) {
                            await get().safeSync('mx_personnel', pid, 'update', { prevailing_wage: targetWage });
                        }
                    }
                }

                set((state) => ({ projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p) }));
                const dbPayload: any = {};
                if (updates.clientId !== undefined) dbPayload.client_id = updates.clientId;
                if (updates.name !== undefined) dbPayload.name = updates.name;
                if (updates.type !== undefined) dbPayload.type = updates.type;
                if (updates.status !== undefined) dbPayload.status = updates.status;
                if (updates.progress !== undefined) dbPayload.progress = updates.progress;
                if (updates.projectSize !== undefined) dbPayload.project_size = updates.projectSize;
                if (updates.systemType !== undefined) dbPayload.system_type = updates.systemType;
                if (updates.location !== undefined) dbPayload.location = updates.location;
                if (updates.locationValidated !== undefined) dbPayload.location_validated = updates.locationValidated;
                if (updates.codeName !== undefined) dbPayload.code_name = updates.codeName;
                if (updates.scopes !== undefined) dbPayload.scopes = updates.scopes;
                if (updates.assignedPersonnel !== undefined) dbPayload.assigned_personnel = updates.assignedPersonnel;
                if (updates.siteLeadIds !== undefined) dbPayload.site_lead_ids = updates.siteLeadIds;
                if (updates.disciplines !== undefined) dbPayload.disciplines = updates.disciplines;
                if (updates.prevailingWage !== undefined) dbPayload.prevailing_wage = updates.prevailingWage;
                if (updates.subsidiary !== undefined) dbPayload.subsidiary = updates.subsidiary;
                if (updates.defaultScheduleId !== undefined || updates.geofenceRadius !== undefined || updates.subsidiaryMetadata !== undefined) {
                    const currentMeta = currentProject?.subsidiaryMetadata || {};
                    dbPayload.subsidiary_metadata = {
                        ...currentMeta,
                        ...(updates.subsidiaryMetadata || {}),
                        ...(updates.defaultScheduleId !== undefined ? { defaultScheduleId: updates.defaultScheduleId } : {}),
                        ...(updates.geofenceRadius !== undefined ? { geofenceRadius: updates.geofenceRadius } : {})
                    };
                }
                
                if (Object.keys(dbPayload).length > 0) {
                    await get().safeSync('projects', id, 'update', dbPayload);
                }
            },
            addPersonnel: async (person) => {
                const sub = person.subsidiary || 'MX';
                set((state) => ({ personnel: [...state.personnel, { ...person, subsidiary: sub }] }));
                const dbPayload = {
                    id: person.id,
                    name: person.name || 'Unnamed Personnel',
                    position: person.position || 'Technician',
                    employee_number: person.employeeNumber || null,
                    app_role: person.appRole || 'Tech',
                    status: person.status || 'Active',
                    certifications: person.certifications,
                    email: person.email,
                    phone_number: person.phoneNumber,
                    supervisor_id: person.supervisorId,
                    manager_id: person.managerId,
                    client_id: person.clientId,
                    image: person.image,
                    faceDescriptor: person.faceDescriptor,
                    prevailing_wage: person.prevailingWage || false,
                    bench_exempt: person.benchExempt || false,
                    dbo: person.dbo,
                    regular_rate: person.regularRate,
                    rainy_day_rate: person.rainyDayRate,
                    overtime_rate: person.overtimeRate,
                    meal_allowance: person.mealAllowance,
                    gas_allowance: person.gasAllowance,
                    truck_allowance: person.truckAllowance,
                    lead_pay: person.leadPay,
                    per_diem: person.totalPerdiem,
                    emergency_contact_name: person.emergencyContactName,
                    emergency_contact_phone: person.emergencyContactPhone,
                    subsidiary: sub,
                    subsidiary_metadata: person.subsidiaryMetadata || {}
                };
                await get().safeSync('mx_personnel', person.id, 'upsert', dbPayload);

                // Auto-provision Auth if the person has an email and login-capable role, or a corporate email
                if (person.email && (['Office', 'HR', 'Manager', 'Supervisor'].includes(person.appRole || '') || person.email.includes('@latnovva.com'))) {
                    try {
                        const { data: existingUid } = await supabase.rpc('get_user_id_by_email' as any, { email_query: person.email.trim() } as any);
                        if (!existingUid) {
                            console.log(`[AutoProvision] Provisioning Auth user for ${person.email}...`);
                            const { data: newUid } = await supabase.rpc('admin_create_user' as any, {
                                user_email: person.email.trim(),
                                user_name: person.name || 'LATNOVVA Staff',
                                user_role: person.appRole || 'Tech',
                                user_password: '',
                                user_client_id: person.appRole === 'Customer' ? (person.clientId || null) : null,
                                user_subsidiary: sub
                            } as any);
                            if (newUid && person.id !== newUid) {
                                await (supabase.from('mx_personnel') as any).update({ id: newUid }).eq('id', person.id);
                                set((state) => ({
                                    personnel: state.personnel.map((p) => (p.id === person.id ? { ...p, id: newUid } : p))
                                }));
                            }
                        }
                    } catch (autoErr) {
                        console.warn('[AutoProvision] Non-fatal auto-provisioning error:', autoErr);
                    }
                }
            },
            updatePersonnel: async (id, updates) => {
                const stampedUpdates: Partial<Personnel> = updates.faceDescriptor !== undefined
                    ? {
                        ...updates,
                        faceDescriptorVersion: Array.isArray(updates.faceDescriptor) && updates.faceDescriptor.length === 128 ? 6 : undefined,
                    }
                    : updates;
                set((state) => ({
                    personnel: state.personnel.map((p) => (p.id === id ? { ...p, ...stampedUpdates } : p)),
                }));
                const dbPayload: any = {};
                if (updates.name !== undefined) dbPayload.name = updates.name || 'Unnamed Personnel';
                if (updates.position !== undefined) dbPayload.position = updates.position;
                if (updates.employeeNumber !== undefined) dbPayload.employee_number = updates.employeeNumber;
                if (updates.appRole !== undefined) dbPayload.app_role = updates.appRole;
                if (updates.status !== undefined) dbPayload.status = updates.status;
                if (updates.certifications !== undefined) dbPayload.certifications = updates.certifications;
                if (updates.email !== undefined) dbPayload.email = updates.email;
                if (updates.phoneNumber !== undefined) dbPayload.phone_number = updates.phoneNumber;
                if (updates.supervisorId !== undefined) dbPayload.supervisor_id = updates.supervisorId;
                if (updates.managerId !== undefined) dbPayload.manager_id = updates.managerId;
                if (updates.clientId !== undefined) dbPayload.client_id = updates.clientId;
                if (updates.image !== undefined) dbPayload.image = updates.image;
                if (updates.faceDescriptor !== undefined) dbPayload.faceDescriptor = updates.faceDescriptor;
                if (updates.prevailingWage !== undefined) dbPayload.prevailing_wage = updates.prevailingWage;
                if (updates.benchExempt !== undefined) dbPayload.bench_exempt = updates.benchExempt;
                if (updates.dbo !== undefined) dbPayload.dbo = updates.dbo;
                if (updates.regularRate !== undefined) dbPayload.regular_rate = updates.regularRate;
                if (updates.rainyDayRate !== undefined) dbPayload.rainy_day_rate = updates.rainyDayRate;
                if (updates.overtimeRate !== undefined) dbPayload.overtime_rate = updates.overtimeRate;
                if (updates.mealAllowance !== undefined) dbPayload.meal_allowance = updates.mealAllowance;
                if (updates.gasAllowance !== undefined) dbPayload.gas_allowance = updates.gasAllowance;
                if (updates.truckAllowance !== undefined) dbPayload.truck_allowance = updates.truckAllowance;
                if (updates.leadPay !== undefined) dbPayload.lead_pay = updates.leadPay;
                if (updates.totalPerdiem !== undefined) dbPayload.per_diem = updates.totalPerdiem;
                if (updates.emergencyContactName !== undefined) dbPayload.emergency_contact_name = updates.emergencyContactName;
                if (updates.emergencyContactPhone !== undefined) dbPayload.emergency_contact_phone = updates.emergencyContactPhone;
                if (updates.subsidiary !== undefined) dbPayload.subsidiary = updates.subsidiary;
                if (updates.subsidiaryMetadata !== undefined) dbPayload.subsidiary_metadata = updates.subsidiaryMetadata;
                if (Object.keys(dbPayload).length > 0) {
                    await get().safeSync('mx_personnel', id, 'update', dbPayload);

                    // Auto-provision Auth if the user now has an email and login-capable role, but is missing an Auth record
                    const currentPerson = get().personnel.find(p => p.id === id);
                    const targetEmail = updates.email || currentPerson?.email;
                    const targetRole = updates.appRole || currentPerson?.appRole;
                    if (targetEmail && (['Office', 'HR', 'Manager', 'Supervisor'].includes(targetRole || '') || targetEmail.includes('@latnovva.com'))) {
                        try {
                            const { data: existingUid } = await supabase.rpc('get_user_id_by_email' as any, { email_query: targetEmail.trim() } as any);
                            if (!existingUid) {
                                console.log(`[AutoProvision] Provisioning Auth user during update for ${targetEmail}...`);
                                const targetSubsidiary = updates.subsidiary || currentPerson?.subsidiary || get().activeSubsidiary || 'MX';
                                const { data: newUid } = await supabase.rpc('admin_create_user' as any, {
                                    user_email: targetEmail.trim(),
                                    user_name: updates.name || currentPerson?.name || 'LATNOVVA Staff',
                                    user_role: targetRole || 'Tech',
                                    user_password: '',
                                    user_client_id: targetRole === 'Customer' ? (updates.clientId || currentPerson?.clientId || null) : null,
                                    user_subsidiary: targetSubsidiary
                                } as any);
                                if (newUid && id !== newUid) {
                                    await (supabase.from('mx_personnel') as any).update({ id: newUid }).eq('id', id);
                                    set((state) => ({
                                        personnel: state.personnel.map((p) => (p.id === id ? { ...p, id: newUid } : p))
                                    }));
                                }
                            }
                        } catch (autoErr) {
                            console.warn('[AutoProvision] Non-fatal update auto-provisioning error:', autoErr);
                        }
                    }

                    // PASS 15F / P1-5: Identity & role changes in public.profiles are updated atomically
                    // via the hardened admin_update_user RPC (never via direct client PATCH on profiles).
                }
            },
            deletePersonnel: async (id) => {
                // Soft Delete: We mark them as Inactive and filter them out.
                // This prevents orphaning the Auth account and preserves referential integrity
                // for past reports.
                set((state) => ({
                    personnel: state.personnel.filter((p) => p.id !== id),
                }));
                await get().safeSync('mx_personnel', id, 'update', { status: 'Inactive' });
            },
            addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
            updateTemplate: (id, updates) =>
                set((state) => ({
                    templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteTemplate: (id) =>
                set((state) => ({
                    templates: state.templates.filter((t) => t.id !== id),
                })),
            addScopeTemplate: async (template) => {
                set((state) => ({ scopeTemplates: [...state.scopeTemplates, template] }));
                const { userRole } = get();
                if (userRole === 'Manager' || userRole === 'Supervisor') {
                    await get().safeSync('scope_templates', template.id, 'insert', {
                        id: template.id,
                        name: template.name,
                        activities: template.activities
                    });
                }
            },
            updateScopeTemplate: async (id, updates) => {
                set((state) => ({
                    scopeTemplates: state.scopeTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                }));
                const { userRole } = get();
                if (userRole === 'Manager' || userRole === 'Supervisor') {
                    const dbPayload: any = {};
                    if (updates.name !== undefined) dbPayload.name = updates.name;
                    if (updates.activities !== undefined) dbPayload.activities = updates.activities;
                    if (Object.keys(dbPayload).length > 0) {
                        await get().safeSync('scope_templates', id, 'update', dbPayload);
                    }
                }
            },
            deleteScopeTemplate: async (id) => {
                set((state) => ({
                    scopeTemplates: state.scopeTemplates.filter((t) => t.id !== id),
                }));
                const { userRole } = get();
                if (userRole === 'Manager' || userRole === 'Supervisor') {
                    await get().safeSync('scope_templates', id, 'delete', null);
                }
            },
            addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
            updateEvent: (id, updates) =>
                set((state) => ({
                    events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
                })),
            deleteEvent: (id) =>
                set((state) => ({
                    events: state.events.filter((e) => e.id !== id),
                })),
            addTimesheet: async (timesheet) => {
                if (get().attendanceWriteMode === 'V2') {
                    const clockInIso = timesheet.timeIn
                        ? new Date(`${timesheet.date}T${timesheet.timeIn}:00`).toISOString()
                        : new Date(`${timesheet.date}T08:00:00`).toISOString();
                    const clockOutIso = timesheet.timeOut
                        ? new Date(`${timesheet.date}T${timesheet.timeOut}:00`).toISOString()
                        : null;
                    const totalHours = (timesheet.hours !== undefined && timesheet.hours !== null && !Number.isNaN(Number(timesheet.hours)))
                        ? Number(timesheet.hours)
                        : 8;
                    const payable = Math.min(8, Math.max(0, totalHours));
                    const overtime = Math.max(0, Math.round((totalHours - 8) * 100) / 100);
                    const { data, error } = await supabase.rpc('v2_create_manual_shift', {
                        p_personnel_id: timesheet.personnelId,
                        p_project_id: timesheet.projectId,
                        p_work_type: timesheet.type === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
                        p_clock_in: clockInIso,
                        p_clock_out: clockOutIso,
                        p_payable_hours: payable,
                        p_overtime_hours: overtime,
                        p_reason: timesheet.manualReason || timesheet.notes || 'Registro manual'
                    });
                    if (error || !data?.success) {
                        console.error('[addTimesheet] V2 RPC error:', error?.message || data?.error);
                        throw new Error(error?.message || data?.error || 'Error al crear registro V2');
                    }
                    await get().refreshAttendance();
                    return;
                }

                set((state) => ({ timesheets: [...state.timesheets, timesheet] }));
                const dbPayload = {
                    id: timesheet.id,
                    personnel_id: timesheet.personnelId,
                    project_id: timesheet.projectId,
                    date: timesheet.date,
                    time_in: timesheet.timeIn,
                    lunch_start: timesheet.lunchStart,
                    lunch_end: timesheet.lunchEnd,
                    time_out: timesheet.timeOut,
                    hours: timesheet.hours,
                    type: timesheet.type,
                    classification: timesheet.classification,
                    notes: timesheet.notes,
                    status: timesheet.status,
                    approved_by: timesheet.approvedBy,
                    signature: timesheet.signature,
                    punches: timesheet.punches,
                    gps_verified: timesheet.gpsVerified,
                    source: timesheet.source,
                    manual_reason: timesheet.manualReason,
                    corrected_by: timesheet.correctedBy,
                    corrected_at: timesheet.correctedAt,
                    correction_reason: timesheet.correctionReason
                };
                await get().safeSync('mx_timesheets', timesheet.id, 'insert', dbPayload);
            },
            updateTimesheet: async (id, updates) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                }));

                if (get().attendanceWriteMode === 'V2') {
                    const existing = get().timesheets.find(t => t.id === id);
                    // Status or GPS-only approval (never prematurely closes an OPEN shift)
                    if ((updates.status || updates.gpsVerified !== undefined) && updates.hours === undefined && updates.timeOut === undefined) {
                        const reviewStatus = updates.status === 'Rejected' ? 'REJECTED' : (updates.status === 'Pending' ? 'PENDING' : 'APPROVED');
                        const { data, error } = await supabase.rpc('v2_approve_or_reject_shift', {
                            p_shift_id: id,
                            p_review_status: reviewStatus,
                            p_notes: updates.notes || updates.correctionReason || null
                        });
                        if (error || !data?.success) {
                            console.error('[updateTimesheet] V2 review RPC error:', error?.message || data?.error);
                            throw new Error(error?.message || data?.error || 'Error al actualizar estado V2');
                        }
                    } else {
                        const totalHours = updates.hours !== undefined ? Number(updates.hours) : Number(existing?.hours || 8);
                        const payable = Math.min(8, Math.max(0, totalHours));
                        const overtime = Math.max(0, Math.round((totalHours - 8) * 100) / 100);
                        const reason = updates.correctionReason || updates.notes || updates.manualReason || 'Corrección administrativa';
                        const { data, error } = await supabase.rpc('reconcile_shift', {
                            p_shift_id: id,
                            p_payable_hours: payable,
                            p_overtime_hours: overtime,
                            p_reason: reason
                        });
                        if (error || !data?.success) {
                            console.error('[updateTimesheet] V2 reconcile_shift RPC error:', error?.message || data?.error);
                            throw new Error(error?.message || data?.error || 'Error al reconciliar turno V2');
                        }
                    }
                    await get().refreshAttendance();
                    return;
                }

                const dbPayload: any = {};
                if (updates.personnelId !== undefined) dbPayload.personnel_id = updates.personnelId;
                if (updates.projectId !== undefined) dbPayload.project_id = updates.projectId;
                if (updates.date !== undefined) dbPayload.date = updates.date;
                if (updates.timeIn !== undefined) dbPayload.time_in = updates.timeIn ?? null;
                if (updates.lunchStart !== undefined) dbPayload.lunch_start = updates.lunchStart ?? null;
                if (updates.lunchEnd !== undefined) dbPayload.lunch_end = updates.lunchEnd ?? null;
                if (updates.timeOut !== undefined) dbPayload.time_out = updates.timeOut ?? null;
                if (updates.hours !== undefined) dbPayload.hours = updates.hours;
                if (updates.type !== undefined) dbPayload.type = updates.type;
                if (updates.classification !== undefined) dbPayload.classification = updates.classification;
                if (updates.notes !== undefined) dbPayload.notes = updates.notes ?? null;
                if (updates.status !== undefined) dbPayload.status = updates.status;
                if (updates.approvedBy !== undefined) dbPayload.approved_by = updates.approvedBy;
                if (updates.signature !== undefined) dbPayload.signature = updates.signature;
                if (updates.punches !== undefined) dbPayload.punches = updates.punches;
                if (updates.gpsVerified !== undefined) dbPayload.gps_verified = updates.gpsVerified;
                if (updates.source !== undefined) dbPayload.source = updates.source;             
                if (updates.manualReason !== undefined) dbPayload.manual_reason = updates.manualReason; 
                if (updates.correctedBy !== undefined) dbPayload.corrected_by = updates.correctedBy;
                if (updates.correctedAt !== undefined) dbPayload.corrected_at = updates.correctedAt;
                if (updates.correctionReason !== undefined) dbPayload.correction_reason = updates.correctionReason;
                if (Object.keys(dbPayload).length > 0) {
                    await get().safeSync('mx_timesheets', id, 'update', dbPayload);
                }
            },
            deleteTimesheet: async (id) => {
                set((state) => ({
                    timesheets: state.timesheets.filter((t) => t.id !== id),
                }));
                if (get().attendanceWriteMode === 'V2') {
                    const { data, error } = await supabase.rpc('v2_void_shift', {
                        p_shift_id: id,
                        p_reason: 'Anulado desde gestión de tiempos'
                    });
                    if (error || !data?.success) {
                        console.error('[deleteTimesheet] V2 void RPC error:', error?.message || data?.error);
                    }
                    await get().refreshAttendance();
                    return;
                }
                await get().safeSync('mx_timesheets', id, 'delete', null);
            },
            approveTimesheet: async (id, approverId) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Approved', approvedBy: approverId } : t
                    )
                }));
                if (get().attendanceWriteMode === 'V2') {
                    const { data, error } = await supabase.rpc('v2_approve_or_reject_shift', {
                        p_shift_id: id,
                        p_review_status: 'APPROVED',
                        p_notes: null
                    });
                    if (error || !data?.success) {
                        console.error('[approveTimesheet] V2 RPC error:', error?.message || data?.error);
                    }
                    await get().refreshAttendance();
                    return;
                }
                // H-03: persist actual approver id
                await get().safeSync('mx_timesheets', id, 'update', { status: 'Approved', approved_by: approverId });
            },
            rejectTimesheet: async (id, approverId) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Rejected', approvedBy: approverId } : t
                    )
                }));
                if (get().attendanceWriteMode === 'V2') {
                    const { data, error } = await supabase.rpc('v2_approve_or_reject_shift', {
                        p_shift_id: id,
                        p_review_status: 'REJECTED',
                        p_notes: null
                    });
                    if (error || !data?.success) {
                        console.error('[rejectTimesheet] V2 RPC error:', error?.message || data?.error);
                    }
                    await get().refreshAttendance();
                    return;
                }
                await get().safeSync('mx_timesheets', id, 'update', { status: 'Rejected', approved_by: approverId });
            },
            addAttendanceOverride: (override) => {
                set((state) => ({ attendanceOverrides: [...state.attendanceOverrides, override] }));
                get().safeSync('mx_attendance_overrides', override.id, 'insert', {
                    id: override.id,
                    employee_id: override.employeeId,
                    start_date: override.startDate,
                    end_date: override.endDate,
                    type: override.type,
                    duration: override.duration,
                    custom_hours: override.customHours,
                    notes: override.notes,
                    approved_by: override.approvedBy,
                    created_by: override.createdBy,
                    created_at: override.createdAt,
                    updated_at: override.updatedAt
                }).catch(() => {});
            },
            updateAttendanceOverride: (id, updates) => {
                set((state) => ({
                    attendanceOverrides: state.attendanceOverrides.map((o) => o.id === id ? { ...o, ...updates } : o)
                }));
                const dbPayload: any = {};
                if (updates.employeeId !== undefined) dbPayload.employee_id = updates.employeeId;
                if (updates.startDate !== undefined) dbPayload.start_date = updates.startDate;
                if (updates.endDate !== undefined) dbPayload.end_date = updates.endDate;
                if (updates.type !== undefined) dbPayload.type = updates.type;
                if (updates.duration !== undefined) dbPayload.duration = updates.duration;
                if (updates.customHours !== undefined) dbPayload.custom_hours = updates.customHours;
                if (updates.notes !== undefined) dbPayload.notes = updates.notes;
                if (updates.approvedBy !== undefined) dbPayload.approved_by = updates.approvedBy;
                if (updates.updatedAt !== undefined) dbPayload.updated_at = updates.updatedAt;
                if (Object.keys(dbPayload).length > 0) {
                    get().safeSync('mx_attendance_overrides', id, 'update', dbPayload).catch(() => {});
                }
            },
            deleteAttendanceOverride: (id) => {
                set((state) => ({
                    attendanceOverrides: state.attendanceOverrides.filter((o) => o.id !== id)
                }));
                get().safeSync('mx_attendance_overrides', id, 'delete', null).catch(() => {});
            },
            addWorkSchedule: (schedule) => {
                set((state) => ({ workSchedules: [...state.workSchedules, schedule] }));
                get().safeSync('mx_work_schedules', schedule.id, 'insert', {
                    id: schedule.id,
                    name: schedule.name,
                    start_time: schedule.startTime,
                    lunch_start: schedule.lunchStart,
                    lunch_end: schedule.lunchEnd,
                    end_time: schedule.endTime,
                    standard_daily_hours: schedule.standardDailyHours,
                    work_days: schedule.workDays
                }).catch(() => {});
            },
            updateWorkSchedule: (id, updates) => {
                set((state) => ({
                    workSchedules: state.workSchedules.map((s) => s.id === id ? { ...s, ...updates } : s)
                }));
                const dbPayload: any = {};
                if (updates.name !== undefined) dbPayload.name = updates.name;
                if (updates.startTime !== undefined) dbPayload.start_time = updates.startTime;
                if (updates.lunchStart !== undefined) dbPayload.lunch_start = updates.lunchStart;
                if (updates.lunchEnd !== undefined) dbPayload.lunch_end = updates.lunchEnd;
                if (updates.endTime !== undefined) dbPayload.end_time = updates.endTime;
                if (updates.standardDailyHours !== undefined) dbPayload.standard_daily_hours = updates.standardDailyHours;
                if (updates.workDays !== undefined) dbPayload.work_days = updates.workDays;
                if (Object.keys(dbPayload).length > 0) {
                    get().safeSync('mx_work_schedules', id, 'update', dbPayload).catch(() => {});
                }
            },
            deleteWorkSchedule: (id) => {
                set((state) => ({
                    workSchedules: state.workSchedules.filter((s) => s.id !== id)
                }));
                get().safeSync('mx_work_schedules', id, 'delete', null).catch(() => {});
            },
            discardStaleShift: async (timesheetId: string) => {
                // Stale prior-day shift closes with 8.00 standard hours per payroll policy
                const ts = get().timesheets.find(t => t.id === timesheetId);
                const _now = new Date();
                const toHHMM = `${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`;
                const noteReason = ts?.notes ? `${ts.notes} | Cierre de turno pendiente (8.00h estándar)` : 'Cierre de turno pendiente (8.00h estándar)';

                set((state) => ({
                    timesheets: state.timesheets.map(t =>
                        t.id === timesheetId
                            ? { ...t, timeOut: toHHMM, hours: 8, status: 'Pending' as any, notes: noteReason }
                            : t
                    )
                }));

                const personnelId = ts?.personnelId || get().resolvePersonnelId() || get().userId;
                clearActiveShift(personnelId);

                if (get().attendanceWriteMode === 'V2') {
                    try {
                        const { engine } = getAttendanceV2Engine();
                        const res = await engine.clockOut({
                            shift_id: timesheetId,
                            personnel_id: personnelId,
                            project_id: ts?.projectId || null,
                            work_type: ts?.type === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
                            gps_verified: false,
                            geofence_status: 'NOT_APPLICABLE' as any,
                            face_verified: false,
                            face_bypass_reason: 'STALE_SHIFT_CLOSED_8H',
                            is_forgotten_clockout: true,
                            reported_departure_timestamp: _now.toISOString(),
                            worker_explanation: noteReason
                        });
                        if (!res.success) {
                            console.warn('[discardStaleShift] V2 engine clockOut rejected:', res.error || res.status);
                        }
                        await attendanceV2Db.deleteActiveShift(timesheetId);
                    } catch (e) {
                        console.warn('[discardStaleShift] V2 engine clockOut warning:', e);
                    }
                    await get().refreshAttendance();
                } else {
                    try {
                        await get().safeSync('mx_timesheets', timesheetId, 'update', {
                            time_out: toHHMM,
                            hours: 8,
                            status: 'Pending',
                            notes: noteReason
                        });
                    } catch (e) {
                        console.error('[discardStaleShift] Sync error:', e);
                    }
                }
            },
            discardShortShift: async (timesheetId: string) => {
                // Accidental <3 min punch -> 0.00h Rejected
                const ts = get().timesheets.find(t => t.id === timesheetId);
                const _now = new Date();
                const toHHMM = `${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`;
                const noteReason = 'Turno accidental (< 3 min) descartado por usuario';

                set((state) => ({
                    timesheets: state.timesheets.map(t =>
                        t.id === timesheetId
                            ? { ...t, timeOut: toHHMM, hours: 0, status: 'Rejected' as any, notes: noteReason }
                            : t
                    )
                }));

                const personnelId = ts?.personnelId || get().resolvePersonnelId() || get().userId;
                clearActiveShift(personnelId);

                if (get().attendanceWriteMode === 'V2') {
                    try {
                        const { engine } = getAttendanceV2Engine();
                        await engine.clockOut({
                            shift_id: timesheetId,
                            personnel_id: personnelId,
                            project_id: ts?.projectId || null,
                            work_type: ts?.type === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
                            gps_verified: false,
                            geofence_status: 'NOT_APPLICABLE' as any,
                            face_verified: false,
                            face_bypass_reason: 'SHORT_SHIFT_DISCARDED',
                            is_short_shift_discard: true,
                            worker_explanation: noteReason
                        });
                        await attendanceV2Db.deleteActiveShift(timesheetId);
                    } catch (e) {
                        console.warn('[discardShortShift] V2 engine clockOut warning:', e);
                    }
                    await get().refreshAttendance();
                } else {
                    await get().deleteTimesheet(timesheetId);
                }
            },
            clockPunch: async (personnelId: string, punch: ClockPunch, projectId?: string, _lunchSkipped?: boolean, explicitTimesheetId?: string) => {
                const _d = new Date();
                const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

                const toHHMM = (iso: string) => {
                    const d = new Date(iso);
                    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                };

                let targetId: string = '';
                let existing: any = null;
                const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;

                // PASS 12N Step 1: Authoritative Pre-Write Release Freshness Gate (bypassed offline so V2 lease queue works)
                if (!isOfflineNow) {
                    const releaseCheck = await checkRequiredClientRelease();
                    if (releaseCheck.status === 'UPDATE_REQUIRED') {
                        console.warn(`[clockPunch] Stale client blocked at transaction boundary (client r${getReleaseId()} < r${releaseCheck.requiredRelease}). Rejecting punch.`);
                        set({ showUpdateModal: true, clientReleaseStatus: 'UPDATE_REQUIRED' });
                        throw new Error('Actualización requerida: Debes actualizar la aplicación antes de registrar asistencia.');
                    }
                    if (releaseCheck.status === 'CHECK_ERROR') {
                        const errLower = String(releaseCheck.error || '').toLowerCase();
                        const isTransportErr =
                            errLower.includes('failed to fetch') ||
                            errLower.includes('network') ||
                            errLower.includes('timeout') ||
                            errLower.includes('load failed');
                        if (!isTransportErr) {
                            console.error(`[clockPunch] FAIL CLOSED: Release check failed (${releaseCheck.error}). Rejecting punch.`);
                            set({ clientReleaseStatus: 'CHECK_ERROR' });
                            throw new Error('No se pudo verificar la versión de la aplicación con el servidor. Intente nuevamente.');
                        }
                        console.warn(`[clockPunch] Release check hit transport error (${releaseCheck.error}); falling through to offline V2 lease verification.`);
                    } else {
                        set({ clientReleaseStatus: 'CURRENT' });
                    }
                }

                let currentMode = get().attendanceWriteMode;
                if (currentMode === 'UNKNOWN' || currentMode === 'RESOLVING' || (isOfflineNow && currentMode === 'ERROR')) {
                    // Item 16 (PASS 15D): NEVER blindly force 'V2' offline; checkAttendanceWriteMode enforces
                    // canBootstrapOfflineV2WithLease (valid unexpired device-matched lease) and fails closed otherwise.
                    await get().checkAttendanceWriteMode();
                    currentMode = get().attendanceWriteMode;
                }

                if (currentMode === 'ERROR' || currentMode === 'UNKNOWN' || currentMode === 'RESOLVING') {
                    console.error(`[clockPunch] FAIL CLOSED: Attendance routing mode is ${currentMode} for ${personnelId}. Rejecting punch to prevent unverified write.`);
                    throw new Error('No se pudo verificar el modo de sincronización de asistencia con el servidor. Por favor verifique su conexión e intente nuevamente.');
                }

                if (currentMode === 'V2') {
                    const { engine, mediaSync } = getAttendanceV2Engine();
                    const workType = punch.workMode === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE';
                    const isForgotten = Boolean(punch.manualAdjustment && punch.adjustmentReason === 'FORGOTTEN_CLOCKOUT');
                    const workerSubsidiary = get().personnel.find(p => p.id === personnelId)?.subsidiary || get().activeSubsidiary || 'MX';

                    let geofenceStatus = 'UNKNOWN';
                    if (workType === 'HOME_OFFICE') {
                        geofenceStatus = 'NOT_APPLICABLE';
                    } else if (punch.gpsVerified) {
                        geofenceStatus = 'INSIDE';
                    } else {
                        geofenceStatus = 'OUTSIDE';
                    }

                    if (punch.type === 'clockIn') {
                        const res = await engine.clockIn({
                            personnel_id: personnelId,
                            project_id: projectId || '',
                            work_type: workType,
                            latitude: punch.lat,
                            longitude: punch.lng,
                            accuracy_meters: punch.accuracy,
                            gps_verified: Boolean(punch.gpsVerified),
                            geofence_status: geofenceStatus as any,
                            face_verified: Boolean(punch.faceVerified),
                            face_bypass_reason: punch.faceBypassReason || null
                        });

                        if (!res.success) {
                            throw new Error(`Error en registro V2 (Entrada): ${res.error || res.status}`);
                        }

                        if (punch.selfieBlob) {
                            try {
                                const base64Data = punch.selfieBlob.replace(/^data:image\/[a-z]+;base64,/, '');
                                const byteSize = Math.round((base64Data.length * 3) / 4);
                                const sha256Hash = await computeSelfieSha256(punch.selfieBlob);
                                await mediaSync.queueSelfie({
                                    eventId: res.event_id,
                                    shiftId: res.shift_id,
                                    personnelId: personnelId,
                                    subsidiary: workerSubsidiary,
                                    dataBase64: punch.selfieBlob,
                                    mimeType: 'image/jpeg',
                                    sha256Hash,
                                    byteSize
                                });
                                mediaSync.syncAllPendingMedia().catch((err: any) => console.warn('[AttendanceV2] Background media sync error:', err));
                            } catch (mErr) {
                                console.warn('[AttendanceV2] Failed to queue selfie:', mErr);
                            }
                        }

                        setActiveShift({
                            personnelId,
                            timesheetId: res.shift_id,
                            date: today,
                            projectId: projectId || '',
                            workMode: punch.workMode || 'On Site',
                            startedAt: punch.timestamp,
                            clockInPunchId: res.event_id || crypto.randomUUID()
                        });
                        if (!isOfflineNow) {
                            await get().refreshAttendance();
                        }
                        return;
                    } else { // clockOut
                        const releaseId = getReleaseId();
                        let active = await attendanceV2Db.getCurrentActiveShiftForPersonnel(personnelId);
                        if (!active && explicitTimesheetId) {
                            active = await attendanceV2Db.getActiveShift(explicitTimesheetId);
                        }
                        if (!active) {
                            const localActive = getActiveShift(personnelId);
                            if (localActive) {
                                active = {
                                    shift_id: localActive.timesheetId,
                                    personnel_id: personnelId,
                                    clock_in_event_id: localActive.clockInPunchId || crypto.randomUUID(),
                                    project_id: localActive.projectId || projectId || '',
                                    work_type: localActive.workMode === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
                                    started_at: localActive.startedAt,
                                    timezone_offset_minutes: 0,
                                    created_offline: false,
                                    offline_lease_id: null,
                                    geofence_version_id: null,
                                    protocol_version: 2,
                                    client_release_id: releaseId,
                                    state: 'ACTIVE',
                                    created_at: localActive.startedAt,
                                    updated_at: localActive.startedAt
                                };
                                await attendanceV2Db.saveActiveShift(active);
                            }
                        }
                        if (!active) {
                            const candidate: any = explicitTimesheetId
                                ? get().timesheets.find(t => t.id === explicitTimesheetId)
                                : (recoverActiveShift(personnelId, get().timesheets) || get().timesheets.find((t: any) => t.personnelId === personnelId && t.timeIn && !t.timeOut));
                            if (candidate) {
                                const candId = candidate.timesheetId || candidate.id;
                                active = {
                                    shift_id: candId,
                                    personnel_id: personnelId,
                                    clock_in_event_id: candidate.clockInPunchId || crypto.randomUUID(),
                                    project_id: candidate.projectId || projectId || '',
                                    work_type: (candidate.workMode === 'Home Office' || candidate.type === 'Home Office') ? 'HOME_OFFICE' : 'ON_SITE',
                                    started_at: candidate.startedAt || candidate.createdAt || (candidate.date ? `${candidate.date}T${candidate.timeIn || '08:00'}:00Z` : new Date().toISOString()),
                                    timezone_offset_minutes: 0,
                                    created_offline: false,
                                    offline_lease_id: null,
                                    geofence_version_id: null,
                                    protocol_version: 2,
                                    client_release_id: releaseId,
                                    state: 'ACTIVE',
                                    created_at: candidate.startedAt || candidate.createdAt || new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                };
                                await attendanceV2Db.saveActiveShift(active);
                            } else if (explicitTimesheetId) {
                                active = {
                                    shift_id: explicitTimesheetId,
                                    personnel_id: personnelId,
                                    clock_in_event_id: crypto.randomUUID(),
                                    project_id: projectId || '',
                                    work_type: punch.workMode === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
                                    started_at: new Date().toISOString(),
                                    timezone_offset_minutes: 0,
                                    created_offline: false,
                                    offline_lease_id: null,
                                    geofence_version_id: null,
                                    protocol_version: 2,
                                    client_release_id: releaseId,
                                    state: 'ACTIVE',
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                };
                                await attendanceV2Db.saveActiveShift(active);
                            }
                        }
                        if (!active) {
                            console.error(`[clockPunch] V2: No active shift found for personnel ${personnelId}`);
                            throw new Error('No se encontró un turno activo para registrar la salida.');
                        }

                        const res = await engine.clockOut({
                            shift_id: active.shift_id,
                            personnel_id: personnelId,
                            project_id: active.project_id || projectId || null,
                            work_type: active.work_type,
                            latitude: punch.lat,
                            longitude: punch.lng,
                            accuracy_meters: punch.accuracy,
                            gps_verified: Boolean(punch.gpsVerified),
                            geofence_status: geofenceStatus as any,
                            face_verified: Boolean(punch.faceVerified),
                            face_bypass_reason: punch.faceBypassReason || null,
                            is_forgotten_clockout: isForgotten,
                            reported_departure_timestamp: isForgotten ? punch.timestamp : null,
                            worker_explanation: isForgotten ? (punch.adjustmentNote || null) : null
                        });

                        if (!res.success) {
                            throw new Error(`Error en registro V2 (Salida): ${res.error || res.status}`);
                        }

                        if (punch.selfieBlob) {
                            try {
                                const base64Data = punch.selfieBlob.replace(/^data:image\/[a-z]+;base64,/, '');
                                const byteSize = Math.round((base64Data.length * 3) / 4);
                                const sha256Hash = await computeSelfieSha256(punch.selfieBlob);
                                await mediaSync.queueSelfie({
                                    eventId: res.event_id,
                                    shiftId: res.shift_id,
                                    personnelId: personnelId,
                                    subsidiary: workerSubsidiary,
                                    dataBase64: punch.selfieBlob,
                                    mimeType: 'image/jpeg',
                                    sha256Hash,
                                    byteSize
                                });
                                mediaSync.syncAllPendingMedia().catch((err: any) => console.warn('[AttendanceV2] Background media sync error:', err));
                            } catch (mErr) {
                                console.warn('[AttendanceV2] Failed to queue selfie:', mErr);
                            }
                        }

                        clearActiveShift(personnelId);
                        if (active.shift_id) {
                            await attendanceV2Db.deleteActiveShift(active.shift_id);
                        }
                        if (!isOfflineNow) {
                            await get().refreshAttendance();
                        }
                        return;
                    }
                }

                const isNormalized = currentMode === 'CANARY';

                if (isNormalized) {
                    if (punch.type === 'clockIn') {
                        const active = getActiveShift(personnelId);
                        if (active) {
                            console.warn(`[clockPunch] Personnel ${personnelId} already has an active open shift (${active.timesheetId}). Rejecting duplicate clockIn.`);
                            return;
                        }
                        targetId = explicitTimesheetId || crypto.randomUUID();
                        existing = null;
                        setActiveShift({
                            personnelId,
                            timesheetId: targetId,
                            date: today,
                            projectId: projectId || '',
                            workMode: punch.workMode || 'On Site',
                            startedAt: punch.timestamp,
                            clockInPunchId: punch.id || crypto.randomUUID()
                        });
                    } else { // clockOut
                        let active = explicitTimesheetId ? { timesheetId: explicitTimesheetId } : getActiveShift(personnelId);
                        if (!active) {
                            const recovered = recoverActiveShift(personnelId, get().timesheets);
                            if (recovered) {
                                active = recovered;
                            }
                        }
                        if (!active || !active.timesheetId) {
                            console.error(`[clockPunch] FAIL CLOSED: Unable to resolve stable active timesheet ID for clockOut of personnel ${personnelId}.`);
                            throw new Error(`MissingTimesheetForClockOut: Cannot clock out personnel ${personnelId} because no active timesheet ID is available.`);
                        }
                        targetId = active.timesheetId;
                        existing = get().timesheets.find(t => t.id === targetId) || null;
                    }
                } else {
                    const openToday = get().timesheets
                        .filter(t => t.personnelId === personnelId && t.date === today && t.timeIn && !t.timeOut)
                        .sort((a, b) => {
                            const tA = new Date((a as any).createdAt || `${a.date}T${a.timeIn || '00:00'}:00`).getTime();
                            const tB = new Date((b as any).createdAt || `${b.date}T${b.timeIn || '00:00'}:00`).getTime();
                            return tB - tA;
                        });
                    existing = openToday[0];

                    if (punch.type === 'clockOut' && !existing) {
                        existing = [...get().timesheets]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .find(t => t.personnelId === personnelId && t.timeIn && !t.timeOut);

                        const recentlyClosedToday = get().timesheets.find(t =>
                            t.personnelId === personnelId &&
                            t.date === today &&
                            t.timeOut &&
                            t.punches?.some(p => p.type === 'clockOut' && (Math.abs(new Date(punch.timestamp).getTime() - new Date(p.timestamp).getTime()) < 60000))
                        );
                        if (recentlyClosedToday) {
                            console.warn(`[clockPunch] Personnel ${personnelId} already clocked out recently (${recentlyClosedToday.id}). Duplicate clockOut ignored.`);
                            return;
                        }
                    }

                    if (punch.type === 'clockIn' && existing) {
                        console.warn(`[clockPunch] Personnel ${personnelId} already has an active open shift (${existing.id}). Rejecting duplicate clockIn.`);
                        return;
                    }

                    targetId = existing ? existing.id : crypto.randomUUID();
                }

                const isNewEntry = !existing && punch.type === 'clockIn';

                // Salvaguarda Anti-truncamiento: Si la sesión existente no ha cargado el detalle de punches,
                // intentar recuperar la lista completa de Supabase. Si no está creada localmente offline
                // y el fetch falla (offline / RLS / timeout), abortar para no sobreescribir historial en el servidor.
                if (existing && (!existing.punches || existing.punches.length === 0)) {
                    const isLocalUnsynced = get().pendingSync.some(p => p.table === 'mx_timesheets' && p.id === existing!.id);
                    if (!isLocalUnsynced) {
                        const detailResult = await get().fetchTimesheetDetail(existing.id);
                        const refreshed = get().timesheets.find(t => t.id === existing!.id);
                        if (!detailResult && (!refreshed?.punches || refreshed.punches.length === 0)) {
                            console.error(`[clockPunch] Aborting punch mutation for ${existing.id}: unable to load authoritative punch history from server.`);
                            throw new Error('No se pudo verificar el historial de marcajes con el servidor. Reintente con conexión.');
                        }
                        existing = refreshed || existing;
                    }
                }

                // Cooldown anti-rebote (30 segundos) para el mismo tipo de marcaje en la sesión
                if (existing?.punches && existing.punches.length > 0) {
                    const lastPunch = existing.punches[existing.punches.length - 1];
                    const lastTime = new Date(lastPunch.timestamp).getTime();
                    const currentTime = new Date(punch.timestamp).getTime();
                    if (lastPunch.type === punch.type && Math.abs(currentTime - lastTime) < 30000) {
                        console.warn(`[clockPunch] Duplicate punch of type '${punch.type}' within 30s ignored for ${personnelId}.`);
                        return;
                    }
                }
                
                const punchId = punch.id || crypto.randomUUID();
                const punchWithId: ClockPunch = { ...punch, id: punchId };
                const isForgottenPunch = punchWithId.adjustmentReason === 'FORGOTTEN_CLOCKOUT' || Boolean(punchWithId.adjustmentNote && punchWithId.adjustmentNote.includes('Olvidé registrar mi salida'));

                set((state) => {
                    let sessionToUpdate = existing ? state.timesheets.find(t => t.id === existing.id) : null;

                    const activeProjId = projectId || sessionToUpdate?.projectId || '';
                    const targetProject = activeProjId ? state.projects.find(p => p.id === activeProjId) : null;
                    const geofenceRequired = targetProject?.locationValidated ?? false;
                    const projCoords = parseCoordinates(targetProject?.location);
                    const threshold = getGPSAccuracyThreshold(state.platformSettings?.gpsAccuracyThreshold);

                    const updatedPunches = [...(sessionToUpdate?.punches ?? []), punchWithId];
                    const radius = targetProject?.geofenceRadius || state.platformSettings?.geofenceRadius || 1000;
                    const allAccurate = updatedPunches.every(p => {
                        if (p.accuracy > threshold) return false;
                        if (geofenceRequired && projCoords && p.workMode !== 'Home Office') {
                            if (isWarehouseBypass(personnelId, p.lat, p.lng, radius)) {
                                return true;
                            }
                            const dist = getDistanceMeters(p.lat, p.lng, projCoords.lat, projCoords.lng);
                            if (dist > radius) return false;
                        }
                        return true;
                    });

                    const clockIn = updatedPunches.find(p => p.type === 'clockIn');
                    const clockOut = updatedPunches.find(p => p.type === 'clockOut');

                    let computedHours = 0;
                    const isZombie = punch.isZombieClose || (punch.adjustmentNote && punch.adjustmentNote.includes('Auto closed'));
                    const isForgotten = isForgottenPunch;

                    if (clockIn && clockOut) {
                        if (isZombie || isForgotten) {
                            computedHours = 8.0;
                        } else {
                            const totalMs = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
                            computedHours = Math.round((totalMs / 3600000) * 100) / 100;
                        }
                    }

                    const existingNotes = sessionToUpdate?.notes || '';
                    const newNotes = punch.adjustmentNote 
                        ? (existingNotes ? `${existingNotes} | ${punch.adjustmentNote}` : punch.adjustmentNote)
                        : existingNotes;

                    const entryUpdates: Partial<TimesheetEntry> = {
                        punches: updatedPunches,
                        gpsVerified: isForgotten ? false : allAccurate,
                        source: isForgotten ? 'manual' : 'gps',
                        ...(clockIn ? { timeIn: toHHMM(clockIn.timestamp) } : {}),
                        ...(clockOut ? { timeOut: toHHMM(clockOut.timestamp), status: 'Pending' } : {}),
                        hours: computedHours,
                        ...(projectId ? { projectId } : {}),
                        ...(punch.workMode ? { type: punch.workMode } : {}),
                        notes: newNotes || null,
                    };

                    if (sessionToUpdate) {
                        return {
                            timesheets: state.timesheets.map(t =>
                                t.id === sessionToUpdate.id ? { ...t, ...entryUpdates } : t
                            )
                        };
                    } else {
                        const newEntry: TimesheetEntry = {
                            id: targetId,
                            personnelId,
                            date: today,
                            hours: 0,
                            type: punch.workMode || 'On Site',
                            status: 'Pending',
                            ...entryUpdates,
                        };
                        return { timesheets: [...state.timesheets, newEntry] };
                    }
                });

                try {
                    const updated = get().timesheets.find(t => t.id === targetId);

                    if (isNormalized) {
                        const threshold = getGPSAccuracyThreshold(get().platformSettings?.gpsAccuracyThreshold);
                        const normItem: NormalizedPendingPunch = {
                            punchId: punchId,
                            timestamp: punchWithId.timestamp,
                            date: today,
                            type: punchWithId.type,
                            targetPersonnelId: personnelId,
                            timesheetId: targetId,
                            projectId: projectId || updated?.projectId,
                            workMode: punchWithId.workMode || 'On Site',
                            lat: punchWithId.lat,
                            lng: punchWithId.lng,
                            accuracy: punchWithId.accuracy,
                            timeSource: punchWithId.timeSource || 'device',
                            manualAdjustment: punchWithId.manualAdjustment || isForgottenPunch || false,
                            adjustmentReason: punchWithId.adjustmentReason || (isForgottenPunch ? 'FORGOTTEN_CLOCKOUT' : undefined),
                            adjustmentNote: punchWithId.adjustmentNote,
                            faceVerified: punchWithId.faceVerified || false,
                            faceBypassReason: punchWithId.faceBypassReason,
                            isOutsourced: punchWithId.isOutsourced || false,
                            outsourcedName: punchWithId.outsourcedName,
                            isZombieClose: punchWithId.isZombieClose || false,
                            gpsVerified: isForgottenPunch ? false : ((punchWithId.accuracy ?? 9999) <= threshold),
                            selfieBase64: punchWithId.selfieBlob,
                            signatureBase64: punchWithId.supervisorSignatureBlob,
                            queueState: 'LOCAL_PENDING',
                            retryCount: 0,
                            createdAt: new Date().toISOString()
                        };

                        await get().safeSync('mx_timesheet_punches', punchId, 'normalized_punch' as any, normItem);
                    } else if (updated) {
                        const dbPayload: any = {
                            id: updated.id,
                            personnel_id: updated.personnelId,
                            project_id: updated.projectId || projectId || null,
                            date: updated.date,
                            time_in: updated.timeIn || null,
                            time_out: updated.timeOut || null,
                            hours: updated.hours || 0,
                            type: updated.type || 'On Site',
                            status: updated.status || 'Pending',
                            punches: updated.punches || [],
                            gps_verified: updated.gpsVerified ?? false,
                            notes: updated.notes || null,
                        };

                        if (updated.source) dbPayload.source = updated.source;
                        if ((updated as any).manualReason) dbPayload.manual_reason = (updated as any).manualReason;

                        if (isNewEntry) {
                            await get().safeSync('mx_timesheets', updated.id, 'insert', dbPayload);
                        } else {
                            await get().safeSync('mx_timesheets', updated.id, 'upsert', dbPayload);
                        }
                    }

                    if (punch.type === 'clockOut') {
                        clearActiveShift(personnelId);
                    }
                } catch (e) {
                    console.warn('[clockPunch] Sync queue failed:', e);
                }
            },
            assignSupervisor: (personnelId, supervisorId, managerId) =>
                set((state) => ({
                    personnel: state.personnel.map((p) => 
                        p.id === personnelId ? { ...p, supervisorId, managerId } : p
                    )
                })),
            transferPersonnel: async (personnelId, targetProjectId) => {
                const state = get();
                const person = state.personnel.find(p => p.id === personnelId);
                if (!person) return;

                // 1. Find all projects currently containing this person
                const currentProjects = state.projects.filter(p => p.assignedPersonnel?.includes(personnelId));
                
                // 2. Perform local update for all affected projects in one go
                set((state) => ({
                    projects: state.projects.map(proj => {
                        let nextPersonnel = proj.assignedPersonnel || [];
                        
                        // Remove from old projects
                        if (currentProjects.some(cp => cp.id === proj.id)) {
                            nextPersonnel = nextPersonnel.filter(id => id !== personnelId);
                        }
                        
                        // Add to new project (avoid duplicates)
                        if (proj.id === targetProjectId) {
                            if (!nextPersonnel.includes(personnelId)) {
                                nextPersonnel = [...nextPersonnel, personnelId];
                            }
                        }
                        
                        return { ...proj, assignedPersonnel: nextPersonnel };
                    })
                }));

                // 3. Update PW flag if needed
                if (targetProjectId) {
                    const targetProject = get().projects.find(p => p.id === targetProjectId);
                    if (targetProject) {
                        set((state) => ({
                            personnel: state.personnel.map(p => 
                                p.id === personnelId ? { ...p, prevailingWage: !!targetProject.prevailingWage } : p
                            )
                        }));
                        await get().safeSync('mx_personnel', personnelId, 'update', { prevailing_wage: !!targetProject.prevailingWage });
                    }
                } else if (targetProjectId === null) {
                    set((state) => ({
                        personnel: state.personnel.map(p => 
                            p.id === personnelId ? { ...p, prevailingWage: false } : p
                        )
                    }));
                    await get().safeSync('mx_personnel', personnelId, 'update', { prevailing_wage: false });
                }

                // 4. Persist to DB
                // Remove from old
                for (const proj of currentProjects) {
                    if (proj.id !== targetProjectId) {
                        const nextList = (proj.assignedPersonnel || []).filter(id => id !== personnelId);
                        await get().safeSync('projects', proj.id, 'update', { assigned_personnel: nextList });
                    }
                }
                // Add to new
                if (targetProjectId) {
                    const targetProject = get().projects.find(p => p.id === targetProjectId);
                    const currentList = targetProject?.assignedPersonnel || [];
                    if (!currentList.includes(personnelId)) {
                        await get().safeSync('projects', targetProjectId, 'update', { 
                            assigned_personnel: [...currentList, personnelId] 
                        });
                    }
                }
            },
            addScopeToProject: (projectId, scope) => 
                set((state) => ({
                    projects: state.projects.map((p) => 
                        p.id === projectId ? { ...p, scopes: [...p.scopes, scope] } : p
                    )
                })),
            addActivityToScope: (projectId, scopeId, activity) =>
                set((state) => ({
                    projects: state.projects.map((p) => {
                        if (p.id === projectId) {
                            return {
                                ...p,
                                scopes: p.scopes.map((s) => 
                                    s.id === scopeId ? { ...s, activities: [...s.activities, activity], completedDate: undefined } : s
                                )
                            };
                        }
                        return p;
                    })
                })),
            updateProjectScope: (projectId, scopeId, updates) =>
                set((state) => ({
                    projects: state.projects.map((p) => 
                        p.id === projectId ? {
                            ...p,
                            scopes: p.scopes.map(s => s.id === scopeId ? { ...s, ...updates } : s)
                        } : p
                    )
                })),
            deleteProjectScope: (projectId, scopeId) =>
                set((state) => ({
                    projects: state.projects.map((p) => 
                        p.id === projectId ? {
                            ...p,
                            scopes: p.scopes.filter(s => s.id !== scopeId)
                        } : p
                    )
                })),
            deleteProjectActivity: (projectId, scopeId, activityId) =>
                set((state) => ({
                    projects: state.projects.map((p) => 
                        p.id === projectId ? {
                            ...p,
                            scopes: p.scopes.map(s => s.id === scopeId ? {
                                ...s,
                                activities: s.activities.filter(a => a.id !== activityId)
                            } : s)
                        } : p
                    )
                })),
            updateActivityProgress: (projectId, scopeId, activityId, updates) =>
                set((state) => ({
                    projects: state.projects.map((p) => {
                        if (p.id === projectId) {
                            return {
                                ...p,
                                scopes: p.scopes.map((s) => {
                                    if (s.id === scopeId) {
                                        const newActivities = s.activities.map((a) =>
                                            a.id === activityId ? { ...a, ...updates } : a
                                        );
                                        const allCompleted = newActivities.length > 0 && newActivities.every(a => a.progress === 100 || a.status === 'Completed');
                                        return {
                                            ...s,
                                            activities: newActivities,
                                            completedDate: allCompleted && !s.completedDate ? new Date().toISOString() : (!allCompleted ? undefined : s.completedDate)
                                        };
                                    }
                                    return s;
                                })
                            };
                        }
                        return p;
                    })
                })),
            /** Fetches templates from Supabase and handles initial seeding if empty. */
            initializeGlobalTemplates: async () => {
                const { userRole } = get();
                
                try {
                    const scopeRes = await supabase.from('scope_templates').select('*');
                    const finalScopes = scopeRes.data || [];

                    // AUTO-INJECTION: If DB is empty, seed it with hardcoded defaults (Manager/Supervisor only)
                    if (finalScopes.length === 0 && (userRole === 'Manager' || userRole === 'Supervisor')) {
                        console.log('[Sync] Seeding scope templates to Supabase...');
                        await supabase.from('scope_templates').insert(
                            get().scopeTemplates.map(t => ({ id: t.id, name: t.name, activities: t.activities }))
                        );
                    }

                    // Refresh from DB if we just seeded or if we have data
                    if (scopeRes.data && scopeRes.data.length > 0) {
                        set({ scopeTemplates: scopeRes.data.map(t => ({ id: t.id, name: t.name, activities: t.activities })) });
                    }
                } catch (e) {
                    console.error('[Sync] Failed to initialize global templates:', e);
                }
            },
        }),
        {
            name: 'latnovva-storage-v3',
            storage: createJSONStorage(() => idbStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.isInitializing = false;
                    state.isSyncing = false;
                    state.syncError = null;
                    state.attendanceWriteMode = 'UNKNOWN';
                    state.normalizedAttendanceEnabled = false;
                    state.clientReleaseStatus = 'CURRENT';
                    state.showUpdateModal = false;
                    // Item 18 (PASS 15D): Strip unversioned v5 faceDescriptor from persisted IndexedDB personnel[]
                    // so stale v5 TinyFaceDetector vectors are NEVER treated as v6 SSD enrollments offline.
                    // Preserves Attendance V2 IndexedDB, offline queue, pending media, and leases untouched.
                    if (Array.isArray(state.personnel)) {
                        state.personnel = state.personnel.map((p: any) =>
                            p?.faceDescriptor && p?.faceDescriptorVersion !== 6
                                ? { ...p, faceDescriptor: undefined }
                                : p
                        );
                    }
                }
            },
            partialize: (state) => {
                const { isInitializing, isSyncing, syncError, attendanceWriteMode, normalizedAttendanceEnabled, showUpdateModal, clientReleaseStatus, ...rest } = state;
                return rest;
            }
        }
    )
);

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).__ZUSTAND_STORE__ = useStore;
}


