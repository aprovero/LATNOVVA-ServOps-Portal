import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockClients, mockProjects, mockReports, mockPersonnel, mockTools, mockTimesheets } from './mockData';

export type ReportState = 'Draft' | 'Pending Manager Review' | 'Pending Customer Review' | 'Approved' | 'Closed';

export interface ToolHistoryEntry {
    date: string;
    description: string;
    projectId?: string;
}

export interface Tool {
    id: string;
    name: string;
    model: string;
    serialNumber: string;
    certificationExpiry: string;
    assignedProjectId?: string;
    history: ToolHistoryEntry[];
}

export interface ReportComment {
    id: string;
    userId: string;
    role: string;
    timestamp: string;
    text: string;
}

export interface CustomSection {
    id: string;
    title: string;
    content: string;
}

export interface ReportOccurrence {
    id: string;
    time: string;
    description: string;
}

export interface ReportChecklist {
    id: string;
    item: string;
    status: 'Pass' | 'Fail' | 'Yes' | 'No' | 'N/A' | 'Unchecked';
    responseType?: 'Pass/Fail' | 'Yes/No';
    attachmentUrl?: string; // For external/paper checklist proof
    notes?: string;
}

export interface ChecklistGroup {
    id: string;
    title: string;
    locked: boolean;
    items: ReportChecklist[];
    attachmentUrl?: string; // For paper checklist scan or group evidence
}

export interface ReportSignature {
    role: 'Supervisor' | 'Management' | 'Customer';
    signedBy: string;
    timestamp: string;
    blob: string;
}

export interface Report {
    id: string;
    projectId: string;
    projectName: string;
    clientId: string;
    date: string;
    state: ReportState;
    schedule?: {
        arrival: string;
        departure: string;
        shift: 'Morning' | 'Afternoon' | 'Evening' | 'All Day';
    };
    weather: {
        temp: number;
        condition: 'Clear' | 'Cloudy' | 'Rainy' | string;
        practicable?: boolean | null;
        rainfallMm?: number;
    };
    location?: {
        lat: number;
        lng: number;
    };
    equipment: {
        serialNumber: string;
        scanned: boolean;
        type: string;
    }[];
    customSections: CustomSection[];
    comments: ReportComment[];
    labor?: { id: string; personnelId?: string; outsourcedName?: string; role: string; qty: number; timeIn?: string; timeOut?: string; hours: number; type?: 'On Site' | 'Travel' | 'Other'; isOutsourced?: boolean }[];
    media?: { id: string; url: string; caption: string }[];
    occurrences?: ReportOccurrence[];
    checklists?: ChecklistGroup[];
    subReportIds?: string[];
    attachments?: { id: string; url: string; name: string }[];
    externalAttachments?: { id: string; url: string; name: string }[];
    notes: string;
    signatures?: ReportSignature[];
    usedTools?: string[]; // IDs of tools used in this report
    health?: number; // Project health 0-100%
    activityLogs?: {
        scopeId?: string;
        activityId?: string;
        customTaskName?: string;
        progressReported?: number;
        priorProgress?: number;
        notes?: string;
    }[];
    createdAt?: string; // ISO string
    createdBy?: string; // User ID
    updatedAt?: string; // ISO string
    updatedBy?: string; // User ID
}

export interface Client {
    id: string;
    name: string;
    logo?: string;
}

export interface Certification {
    name: string;
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
    image?: string; // Profile picture URL or base64
    status: 'Active' | 'Inactive';
    sharedFolderLink?: string; // Link to certifications folder
    certifications: Certification[];
    appRole?: 'Tech' | 'Supervisor' | 'Manager' | 'Customer';
    supervisorId?: string;
    managerId?: string;
    phoneNumber?: string;
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

export type SubReportFieldType = 'text' | 'number' | 'checkbox' | 'picture';

export interface SubReportFieldDef {
    id: string;
    name: string;
    type: SubReportFieldType;
}

export interface SubReportTemplate {
    id: string;
    name: string;
    fields: SubReportFieldDef[];
}

export interface SubReportInstance {
    id: string;
    templateId: string;
    templateName: string;
    projectId: string;
    parentReportId: string;
    createdAt: string;
    updatedAt?: string;
    createdBy?: string;
    state: ReportState;
    values: Record<string, any>; // Maps Field ID -> Value
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
    timestamp: string;   // ISO string — always UTC
    lat: number;
    lng: number;
    accuracy: number;    // GPS accuracy in meters
    type: 'clockIn' | 'lunchOut' | 'lunchIn' | 'clockOut';
    timeSource: 'gps' | 'device'; // gps = satellite atomic clock, device = system clock
    manualAdjustment?: boolean; // true if time was entered retroactively
    adjustmentNote?: string;
}

export interface TimesheetEntry {
    id: string;
    personnelId: string;
    date: string; // ISO yyyy-mm-dd
    timeIn?: string; // HH:mm
    timeOut?: string; // HH:mm
    hours: number;
    type: 'On Site' | 'Travel' | 'Other';
    classification?: 'Regular' | 'Overtime' | 'Double Time' | 'Unclassified';
    projectId?: string;
    notes?: string;
    status?: 'Pending' | 'Approved' | 'Rejected';
    approvedBy?: string;
    signature?: {
        name: string;
        timestamp: string;
        blob: string;
    };
    punches?: ClockPunch[];     // GPS audit trail from clock-in system
    gpsVerified?: boolean;      // true when all punches have accuracy <= 50m
    lunchSkipped?: boolean;     // true when tech explicitly skipped lunch
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
    activities: ProjectActivity[];
    completedDate?: string;
}

export interface Project {
    id: string;
    clientId: string;
    name: string;
    type: 'Complete' | 'Simple';
    status: 'Active' | 'Completed' | 'On Hold';
    progress: number;
    scopes: ProjectScope[];
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
}

interface AppState {
    userRole: 'Tech' | 'Supervisor' | 'Manager' | 'Customer';
    userId: string;
    clientId: string;
    clients: Client[];
    reports: Report[];
    projects: Project[];
    tools: Tool[];
    personnel: Personnel[];
    templates: ChecklistTemplate[];
    scopeTemplates: ScopeTemplate[];
    subReportTemplates: SubReportTemplate[];
    subReportInstances: SubReportInstance[];
    events: ScheduledEvent[];
    timesheets: TimesheetEntry[];
    initDb: () => void;
    setUserRole: (role: 'Tech' | 'Supervisor' | 'Manager' | 'Customer') => void;
    addClient: (client: Client) => void;
    updateClient: (id: string, updates: Partial<Client>) => void;
    deleteClient: (id: string) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    addReport: (report: Report) => void;
    updateReport: (id: string, updates: Partial<Report>) => void;
    addComment: (reportId: string, text: string) => void;
    addTool: (tool: Tool) => void;
    updateTool: (id: string, updates: Partial<Tool>) => void;
    deleteTool: (id: string) => void;
    addPersonnel: (person: Personnel) => void;
    updatePersonnel: (id: string, updates: Partial<Personnel>) => void;
    deletePersonnel: (id: string) => void;
    addTemplate: (template: ChecklistTemplate) => void;
    updateTemplate: (id: string, updates: Partial<ChecklistTemplate>) => void;
    deleteTemplate: (id: string) => void;
    addScopeTemplate: (template: ScopeTemplate) => void;
    updateScopeTemplate: (id: string, updates: Partial<ScopeTemplate>) => void;
    deleteScopeTemplate: (id: string) => void;
    addSubReportTemplate: (template: SubReportTemplate) => void;
    updateSubReportTemplate: (id: string, updates: Partial<SubReportTemplate>) => void;
    deleteSubReportTemplate: (id: string) => void;
    addSubReportInstance: (instance: SubReportInstance) => void;
    updateSubReportInstance: (id: string, updates: Partial<SubReportInstance>) => void;
    deleteSubReportInstance: (id: string) => void;
    addEvent: (event: ScheduledEvent) => void;
    updateEvent: (id: string, updates: Partial<ScheduledEvent>) => void;
    deleteEvent: (id: string) => void;
    addTimesheet: (timesheet: TimesheetEntry) => void;
    updateTimesheet: (id: string, updates: Partial<TimesheetEntry>) => void;
    deleteTimesheet: (id: string) => void;
    approveTimesheet: (id: string, approverId: string) => void;
    rejectTimesheet: (id: string, approverId: string) => void;
    clockPunch: (personnelId: string, punch: ClockPunch, projectId?: string, lunchSkipped?: boolean) => void;
    assignSupervisor: (personnelId: string, supervisorId?: string, managerId?: string) => void;
    addScopeToProject: (projectId: string, scope: ProjectScope) => void;
    updateProjectScope: (projectId: string, scopeId: string, updates: Partial<ProjectScope>) => void;
    deleteProjectScope: (projectId: string, scopeId: string) => void;
    addActivityToScope: (projectId: string, scopeId: string, activity: ProjectActivity) => void;
    deleteProjectActivity: (projectId: string, scopeId: string, activityId: string) => void;
    updateActivityProgress: (projectId: string, scopeId: string, activityId: string, updates: Partial<ProjectActivity>) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            userRole: 'Tech',
            userId: 'USR-Current',
            clientId: 'CUST_POWER_ELEC',
            clients: [],
            reports: [],
            projects: [],
            tools: [],
            personnel: [],
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
                }
            ],
            subReportTemplates: [
                {
                    id: 'SRT-001',
                    name: 'Transformer Commissioning',
                    fields: [
                        { id: 'f1', name: 'Serial Number', type: 'text' },
                        { id: 'f2', name: 'Insulation Resistance (MΩ)', type: 'number' },
                        { id: 'f3', name: 'Visual Inspection Passed?', type: 'checkbox' },
                        { id: 'f4', name: 'Nameplate Picture', type: 'picture' }
                    ]
                }
            ],
            subReportInstances: [],
            events: [
                {
                    id: 'EVT-001',
                    title: 'Beta Commissioning',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    type: 'Project',
                    projectId: 'PROJ-BETA'
                }
            ],
            timesheets: [],
            initDb: () => {
                set((state) => {
                    if (state.reports.length === 0) {
                        // Fresh install - load all mock data
                        return {
                            clients: mockClients,
                            projects: mockProjects,
                            reports: mockReports,
                            personnel: mockPersonnel,
                            tools: mockTools,
                            timesheets: mockTimesheets,
                        };
                    }
                    // Already have data - merge location/metadata from mockData into existing projects
                    // This ensures updated coordinates in mockData are reflected without clearing storage
                    const mergedProjects = state.projects.map(p => {
                        const mock = mockProjects.find(m => m.id === p.id);
                        if (!mock) return p;
                        return {
                            ...p,
                            // Always sync location/metadata from mockData so coordinate updates propagate
                            location: mock.location ?? p.location,
                            codeName: p.codeName ?? mock.codeName,
                            projectSize: p.projectSize ?? mock.projectSize,
                            systemType: p.systemType ?? mock.systemType,
                        };
                    });
                    return { projects: mergedProjects };
                });
            },
            setUserRole: (role) => set({ userRole: role }),
            addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
            updateClient: (id, updates) => set((state) => ({ clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c) })),
            deleteClient: (id) => set((state) => ({ clients: state.clients.filter(c => c.id !== id) })),
            addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
            updateProject: (id, updates) => set((state) => ({ projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p) })),
            addReport: (report) => set((state) => ({ 
                reports: [...state.reports, { 
                    ...report, 
                    createdAt: report.createdAt || new Date().toISOString(), 
                    createdBy: report.createdBy || state.userId 
                }] 
            })),
            updateReport: (id, updates) =>
                set((state) => ({
                    reports: state.reports.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString(), updatedBy: state.userId } : r)),
                })),
            addComment: (reportId, text) => {
                const { userRole, userId } = get();
                set((state) => ({
                    reports: state.reports.map((r) => {
                        if (r.id === reportId) {
                            const newComment = {
                                id: `C-${Date.now()}`,
                                userId,
                                role: userRole,
                                timestamp: new Date().toISOString(),
                                text
                            };
                            return { ...r, comments: [...r.comments, newComment] };
                        }
                        return r;
                    })
                }));
            },
            addTool: (tool) => set((state) => ({ tools: [...state.tools, tool] })),
            updateTool: (id, updates) =>
                set((state) => ({
                    tools: state.tools.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteTool: (id) =>
                set((state) => ({
                    tools: state.tools.filter((t) => t.id !== id),
                })),
            addPersonnel: (person) => set((state) => ({ personnel: [...state.personnel, person] })),
            updatePersonnel: (id, updates) =>
                set((state) => ({
                    personnel: state.personnel.map((p) => (p.id === id ? { ...p, ...updates } : p)),
                })),
            deletePersonnel: (id) =>
                set((state) => ({
                    personnel: state.personnel.filter((p) => p.id !== id),
                })),
            addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
            updateTemplate: (id, updates) =>
                set((state) => ({
                    templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteTemplate: (id) =>
                set((state) => ({
                    templates: state.templates.filter((t) => t.id !== id),
                })),
            addScopeTemplate: (template) => set((state) => ({ scopeTemplates: [...state.scopeTemplates, template] })),
            updateScopeTemplate: (id, updates) =>
                set((state) => ({
                    scopeTemplates: state.scopeTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteScopeTemplate: (id) =>
                set((state) => ({
                    scopeTemplates: state.scopeTemplates.filter((t) => t.id !== id),
                })),
            addSubReportTemplate: (template) => set((state) => ({ subReportTemplates: [...state.subReportTemplates, template] })),
            updateSubReportTemplate: (id, updates) =>
                set((state) => ({
                    subReportTemplates: state.subReportTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteSubReportTemplate: (id) =>
                set((state) => ({
                    subReportTemplates: state.subReportTemplates.filter((t) => t.id !== id),
                })),
            addSubReportInstance: (instance) => set((state) => ({ subReportInstances: [...state.subReportInstances, instance] })),
            updateSubReportInstance: (id, updates) =>
                set((state) => ({
                    subReportInstances: state.subReportInstances.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)),
                })),
            deleteSubReportInstance: (id) =>
                set((state) => ({
                    subReportInstances: state.subReportInstances.filter((t) => t.id !== id),
                })),
            addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
            updateEvent: (id, updates) =>
                set((state) => ({
                    events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
                })),
            deleteEvent: (id) =>
                set((state) => ({
                    events: state.events.filter((e) => e.id !== id),
                })),
            addTimesheet: (timesheet) => set((state) => ({ timesheets: [...state.timesheets, timesheet] })),
            updateTimesheet: (id, updates) =>
                set((state) => ({
                    timesheets: state.timesheets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                })),
            deleteTimesheet: (id) =>
                set((state) => ({
                    timesheets: state.timesheets.filter((t) => t.id !== id),
                })),
            approveTimesheet: (id, approverId) => 
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Approved', approvedBy: approverId } : t
                    )
                })),
            rejectTimesheet: (id, approverId) => 
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Rejected', approvedBy: approverId } : t
                    )
                })),
            clockPunch: (personnelId, punch, projectId, lunchSkipped) =>
                set((state) => {
                    const today = new Date().toISOString().split('T')[0];
                    const existing = state.timesheets.find(
                        t => t.personnelId === personnelId && t.date === today
                    );

                    const updatedPunches = [...(existing?.punches ?? []), punch];
                    const allAccurate = updatedPunches.every(p => p.accuracy <= 50);

                    // Compute timeIn / timeOut / hours from punches
                    const clockIn = updatedPunches.find(p => p.type === 'clockIn');
                    const clockOut = updatedPunches.find(p => p.type === 'clockOut');
                    const lunchOut = updatedPunches.find(p => p.type === 'lunchOut');
                    const lunchIn = updatedPunches.find(p => p.type === 'lunchIn');

                    const toHHMM = (iso: string) => iso.substring(11, 16);

                    let computedHours = 0;
                    if (clockIn && clockOut) {
                        const totalMs = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
                        let lunchMs = 0;
                        if (lunchOut && lunchIn) {
                            lunchMs = new Date(lunchIn.timestamp).getTime() - new Date(lunchOut.timestamp).getTime();
                        }
                        computedHours = Math.round(((totalMs - lunchMs) / 3600000) * 100) / 100;
                    }

                    const entryUpdates: Partial<TimesheetEntry> = {
                        punches: updatedPunches,
                        gpsVerified: allAccurate,
                        ...(clockIn ? { timeIn: toHHMM(clockIn.timestamp) } : {}),
                        ...(clockOut ? { timeOut: toHHMM(clockOut.timestamp), status: 'Pending' } : {}),
                        ...(computedHours > 0 ? { hours: computedHours } : {}),
                        ...(projectId ? { projectId } : {}),
                        ...(lunchSkipped !== undefined ? { lunchSkipped } : {}),
                    };

                    if (existing) {
                        return {
                            timesheets: state.timesheets.map(t =>
                                t.id === existing.id ? { ...t, ...entryUpdates } : t
                            )
                        };
                    } else {
                        const newEntry: TimesheetEntry = {
                            id: `TS-${Date.now()}`,
                            personnelId,
                            date: today,
                            hours: 0,
                            type: 'On Site',
                            status: 'Pending',
                            ...entryUpdates,
                        };
                        return { timesheets: [...state.timesheets, newEntry] };
                    }
                }),
            assignSupervisor: (personnelId, supervisorId, managerId) =>
                set((state) => ({
                    personnel: state.personnel.map((p) => 
                        p.id === personnelId ? { ...p, supervisorId, managerId } : p
                    )
                })),
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
        }),
        {
            name: 'latnovva-storage-v2',
        }
    )
);
