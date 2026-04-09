import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

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
    sectionKey?: string; // scoped to a section e.g. 'labor', 'checklists', 'occurrences', 'notes'
}

export interface CustomSection {
    id: string;
    title: string;
    content: string;
}

export interface ReportOccurrence {
    id: string;
    time: string;
    durationMinutes?: number;
    category?: 'Customer delay' | 'Equipment failure' | 'Material Related' | 'Weather' | 'Access' | 'Crew' | 'Safety' | 'Other' | string;
    description: string;
    impact?: {
        schedule: boolean;
        productivity: boolean;
        safety: boolean;
        clientVisible: boolean;
    };
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
    media?: { 
        id: string; 
        url: string; 
        caption: string; 
        storageType?: 'local' | 'sharepoint';
        sharepointId?: string;
    }[];
    occurrences?: ReportOccurrence[];
    checklists?: ChecklistGroup[];
    subReportIds?: string[];
    attachments?: { 
        id: string; 
        url: string; 
        name: string; 
        storageType?: 'local' | 'sharepoint';
        sharepointId?: string;
    }[];
    externalAttachments?: { 
        id: string; 
        url: string; 
        name: string; 
        storageType?: 'local' | 'sharepoint';
        sharepointId?: string;
    }[];
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
    discipline?: string; // Multi-team support
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
    clientId?: string; // For assigned customers to limit scopes
    supervisorId?: string;
    managerId?: string;
    phoneNumber?: string;
    prevailingWage?: boolean;
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
    selfieBlob?: string; // base64 JPEG thumbnail for identity verification
    supervisorSignatureBlob?: string; // base64 PNG — supervisor's drawn signature for batch punches
    isOutsourced?: boolean; // true for non-registered / contract personnel
    outsourcedName?: string; // display name when isOutsourced is true
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
    source?: 'gps' | 'manual'; // H-04: explicit audit flag
    manualReason?: string;      // H-04: required justification for manual entries
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
    status: 'Active' | 'Completed' | 'On Hold';
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
    startDate?: string; // ISO yyyy-mm-dd
    expectedDuration?: string; // e.g., '12 Months', '4 Weeks'
}

// Allowed report state transitions — prevents workflow bypass (C-03)
export const ALLOWED_REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
    'Draft': ['Pending Manager Review'],
    'Pending Manager Review': ['Draft', 'Pending Customer Review'],
    'Pending Customer Review': ['Pending Manager Review', 'Approved'],
    'Approved': ['Closed'],
    'Closed': [],
};

interface AppState {
    userRole: 'Tech' | 'Supervisor' | 'Manager' | 'Customer';
    userId: string;
    userEmail?: string;
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
    /** Returns the display name of the currently logged-in user (L-03). */
    getCurrentUserName: () => string;
    initDb: () => Promise<void>;
    resetDb: () => void;
    setAuthData: (id: string, email: string) => void;
    setUserRole: (role: 'Tech' | 'Supervisor' | 'Manager' | 'Customer') => void;
    setClientId: (id: string) => void;
    addClient: (client: Client) => void;
    updateClient: (id: string, updates: Partial<Client>) => void;
    deleteClient: (id: string) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    addReport: (report: Report) => void;
    updateReport: (id: string, updates: Partial<Report>) => void;
    deleteReport: (id: string) => void;
    addComment: (reportId: string, text: string, sectionKey?: string) => void;
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
    // Cloud Storage & Auth
    sharepointConfig: {
        siteId?: string;
        driveId?: string;
        siteUrl?: string;
        folderPath?: string;
    };
    microsoftAuth: {
        isAuthenticated: boolean;
        userEmail?: string;
    };
    setSharepointConfig: (config: Partial<AppState['sharepointConfig']>) => void;
    setMicrosoftAuth: (auth: Partial<AppState['microsoftAuth']>) => void;
    language: 'en' | 'es';
    setLanguage: (lang: 'en' | 'es') => void;
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
            sharepointConfig: {
                siteUrl: import.meta.env.VITE_SHAREPOINT_SITE_URL || ''
            },
            microsoftAuth: {
                isAuthenticated: false
            },
            setSharepointConfig: (config) => set((state) => ({ sharepointConfig: { ...state.sharepointConfig, ...config } })),
            setMicrosoftAuth: (auth) => set((state) => ({ microsoftAuth: { ...state.microsoftAuth, ...auth } })),
            language: (localStorage.getItem('i18nextLng') as 'en' | 'es') || 'en',
            setLanguage: (lang) => {
                set({ language: lang });
                import('../i18n').then(m => m.default.changeLanguage(lang));
            },
            initDb: async () => {
                try {
                    // Fetch real data from supabase
                    const [{ data: clientsDB }, { data: projectsDB }, { data: personnelDB }, { data: reportsDB }, { data: timesheetsDB }] = await Promise.all([
                        supabase.from('clients').select('*'),
                        supabase.from('projects').select('*'),
                        supabase.from('personnel').select('*'),
                        supabase.from('reports').select('*'),
                        supabase.from('timesheets').select('*')
                    ]);

                    // Guard: only overwrite store state if Supabase returned actual rows.
                    // An empty array [] is truthy in JS, so `data || fallback` would wipe
                    // persisted local state when RLS blocks reads or the DB is empty.
                    set((state) => ({
                        ...state,
                        clients: clientsDB?.length
                            ? clientsDB.map(c => ({
                                id: c.id,
                                name: c.name,
                                logo: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=2563EB&color=fff`
                            }))
                            : state.clients,
                        projects: projectsDB?.length
                            ? projectsDB.map(p => ({
                                id: p.id,
                                clientId: p.client_id,
                                name: p.name,
                                type: p.type,
                                status: p.status,
                                progress: p.progress,
                                location: p.location,
                                projectSize: p.project_size,
                                systemType: p.system_type,
                                codeName: p.code_name,
                                assignedPersonnel: p.assigned_personnel || [],
                                siteLeadIds: p.site_lead_ids || [],
                                hasNoDefinedScope: p.has_no_defined_scope || false,
                                disciplines: p.disciplines || [],
                                scopes: p.scopes || []
                            }))
                            : state.projects,
                        personnel: personnelDB?.length
                            ? personnelDB.map(p => ({
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
                                prevailingWage: p.prevailing_wage || false
                            }))
                            : state.personnel,
                        reports: reportsDB?.length
                            ? reportsDB.map(r => ({
                                id: r.id,
                                projectId: r.project_id,
                                projectName: '',
                                clientId: r.client_id,
                                date: r.date,
                                state: r.state,
                                schedule: r.schedule,
                                weather: r.weather,
                                location: r.location,
                                equipment: r.equipment || [],
                                customSections: r.custom_sections || [],
                                comments: r.comments || [],
                                labor: r.labor || [],
                                media: r.media || [],
                                occurrences: r.occurrences || [],
                                checklists: r.checklists || [],
                                subReportIds: r.sub_report_ids || [],
                                attachments: r.attachments || [],
                                externalAttachments: r.external_attachments || [],
                                notes: r.notes || '',
                                signatures: r.signatures || [],
                                usedTools: r.used_tools || [],
                                health: r.health,
                                activityLogs: r.activity_logs || [],
                                createdAt: r.created_at,
                                createdBy: r.created_by,
                                updatedAt: r.updated_at,
                                updatedBy: r.updated_by,
                                discipline: r.discipline
                            }))
                            : state.reports,
                        timesheets: timesheetsDB?.length
                            ? timesheetsDB.map(t => ({
                                id: t.id,
                                personnelId: t.personnel_id,
                                projectId: t.project_id,
                                date: t.date,
                                timeIn: t.time_in,
                                timeOut: t.time_out,
                                hours: t.hours,
                                type: t.type,
                                classification: t.classification,
                                notes: t.notes,
                                status: t.status,
                                approvedBy: t.approved_by,
                                signature: t.signature,
                                punches: t.punches || [],
                                gpsVerified: t.gps_verified,
                                lunchSkipped: t.lunch_skipped,
                                source: (t as any).source || 'manual',
                                manualReason: (t as any).manual_reason,
                            }))
                            : state.timesheets,
                    }));
                } catch (error) {
                    console.error('Failed to init DB from Supabase', error);
                }
            },
            resetDb: () => {
                set(() => ({
                    clients: [],
                    projects: [],
                    reports: [],
                    personnel: [],
                    tools: [],
                    timesheets: [],
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
            setAuthData: (id, email) => set({ userId: id, userEmail: email }),
            setUserRole: (role) => set({ userRole: role }),
            setClientId: (id) => set({ clientId: id }),
            addClient: async (client) => {
                set((state) => ({ clients: [...state.clients, client] }));
                await supabase.from('clients').insert({
                    id: client.id,
                    name: client.name,
                    logo: client.logo
                });
            },
            updateClient: async (id, updates) => {
                set((state) => ({ clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c) }));
                await supabase.from('clients').update({
                    name: updates.name,
                    logo: updates.logo
                }).eq('id', id);
            },
            deleteClient: async (id) => {
                set((state) => ({ clients: state.clients.filter(c => c.id !== id) }));
                await supabase.from('clients').delete().eq('id', id);
            },
            addProject: async (project) => {
                set((state) => ({ projects: [...state.projects, project] }));
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
                    code_name: project.codeName,
                    scopes: project.scopes || [],
                    assigned_personnel: project.assignedPersonnel || [],
                    site_lead_ids: project.siteLeadIds || [],
                    has_no_defined_scope: project.hasNoDefinedScope || false,
                    disciplines: project.disciplines || []
                };
                await supabase.from('projects').insert(dbPayload);
            },
            updateProject: async (id, updates) => {
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
                if (updates.codeName !== undefined) dbPayload.code_name = updates.codeName;
                if (updates.scopes !== undefined) dbPayload.scopes = updates.scopes;
                if (updates.assignedPersonnel !== undefined) dbPayload.assigned_personnel = updates.assignedPersonnel;
                if (updates.siteLeadIds !== undefined) dbPayload.site_lead_ids = updates.siteLeadIds;
                if (updates.hasNoDefinedScope !== undefined) dbPayload.has_no_defined_scope = updates.hasNoDefinedScope;
                if (updates.disciplines !== undefined) dbPayload.disciplines = updates.disciplines;
                if (Object.keys(dbPayload).length > 0) {
                    await supabase.from('projects').update(dbPayload).eq('id', id);
                }
            },
            addReport: async (report) => {
                const reportToSave = { 
                    ...report, 
                    createdAt: report.createdAt || new Date().toISOString(), 
                    createdBy: report.createdBy || get().userId 
                };
                set((state) => ({ reports: [...state.reports, reportToSave] }));
                
                const dbPayload = {
                    id: reportToSave.id,
                    project_id: reportToSave.projectId,
                    client_id: reportToSave.clientId,
                    date: reportToSave.date,
                    state: reportToSave.state,
                    schedule: reportToSave.schedule,
                    weather: reportToSave.weather,
                    location: reportToSave.location,
                    equipment: reportToSave.equipment,
                    custom_sections: reportToSave.customSections,
                    comments: reportToSave.comments,
                    labor: reportToSave.labor,
                    media: reportToSave.media,
                    occurrences: reportToSave.occurrences,
                    checklists: reportToSave.checklists,
                    sub_report_ids: reportToSave.subReportIds,
                    attachments: reportToSave.attachments,
                    external_attachments: reportToSave.externalAttachments,
                    notes: reportToSave.notes,
                    signatures: reportToSave.signatures,
                    used_tools: reportToSave.usedTools,
                    health: reportToSave.health,
                    activity_logs: reportToSave.activityLogs,
                    created_at: reportToSave.createdAt,
                    created_by: reportToSave.createdBy,
                    discipline: reportToSave.discipline
                };
                await supabase.from('reports').insert(dbPayload);
            },
            deleteReport: async (id) => {
                set((state) => ({
                    reports: state.reports.filter((r) => r.id !== id),
                }));
                await supabase.from('reports').delete().eq('id', id);
            },
            updateReport: async (id, updates) => {
                // C-03: Enforce valid state transitions
                if (updates.state) {
                    const currentReport = get().reports.find(r => r.id === id);
                    const currentState = currentReport?.state;
                    const allowed = currentState ? ALLOWED_REPORT_TRANSITIONS[currentState] ?? [] : [];
                    if (currentState && !allowed.includes(updates.state)) {
                        console.error(`[State Machine] Invalid transition: ${currentState} → ${updates.state}`);
                        return; // Silently block invalid transitions
                    }
                }

                set((state) => ({
                    reports: state.reports.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString(), updatedBy: get().userId } : r)),
                }));

                const dbPayload: any = {};
                if (updates.projectId !== undefined) dbPayload.project_id = updates.projectId;
                if (updates.clientId !== undefined) dbPayload.client_id = updates.clientId;
                if (updates.date !== undefined) dbPayload.date = updates.date;
                if (updates.state !== undefined) dbPayload.state = updates.state;
                if (updates.schedule !== undefined) dbPayload.schedule = updates.schedule;
                if (updates.weather !== undefined) dbPayload.weather = updates.weather;
                if (updates.location !== undefined) dbPayload.location = updates.location;
                if (updates.equipment !== undefined) dbPayload.equipment = updates.equipment;
                if (updates.customSections !== undefined) dbPayload.custom_sections = updates.customSections;
                if (updates.comments !== undefined) dbPayload.comments = updates.comments;
                if (updates.labor !== undefined) dbPayload.labor = updates.labor;
                if (updates.media !== undefined) dbPayload.media = updates.media;
                if (updates.occurrences !== undefined) dbPayload.occurrences = updates.occurrences;
                if (updates.checklists !== undefined) dbPayload.checklists = updates.checklists;
                if (updates.subReportIds !== undefined) dbPayload.sub_report_ids = updates.subReportIds;
                if (updates.attachments !== undefined) dbPayload.attachments = updates.attachments;
                if (updates.externalAttachments !== undefined) dbPayload.external_attachments = updates.externalAttachments;
                if (updates.notes !== undefined) dbPayload.notes = updates.notes;
                if (updates.signatures !== undefined) dbPayload.signatures = updates.signatures;
                if (updates.usedTools !== undefined) dbPayload.used_tools = updates.usedTools;
                if (updates.health !== undefined) dbPayload.health = updates.health;
                if (updates.activityLogs !== undefined) dbPayload.activity_logs = updates.activityLogs;
                if (updates.discipline !== undefined) dbPayload.discipline = updates.discipline;
                dbPayload.updated_at = new Date().toISOString();
                dbPayload.updated_by = get().userId;

                if (Object.keys(dbPayload).length > 0) {
                    await supabase.from('reports').update(dbPayload).eq('id', id);
                }
            },
            addComment: async (reportId, text, sectionKey) => {
                const { userRole, userId } = get();
                const newComment: ReportComment = {
                    id: `C-${Date.now()}`,
                    userId,
                    role: userRole,
                    timestamp: new Date().toISOString(),
                    text,
                    ...(sectionKey ? { sectionKey } : {}),
                };
                let updatedComments: ReportComment[] = [];
                set((state) => ({
                    reports: state.reports.map((r) => {
                        if (r.id === reportId) {
                            updatedComments = [...r.comments, newComment];
                            return { ...r, comments: updatedComments };
                        }
                        return r;
                    })
                }));
                // H-03: Persist comments to Supabase immediately
                if (updatedComments.length > 0) {
                    await supabase.from('reports').update({ comments: updatedComments }).eq('id', reportId);
                }
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
            addPersonnel: async (person) => {
                set((state) => ({ personnel: [...state.personnel, person] }));
                const dbPayload = {
                    id: person.id,
                    name: person.name,
                    position: person.position,
                    employee_number: person.employeeNumber,
                    app_role: person.appRole,
                    status: person.status,
                    certifications: person.certifications,
                    email: person.email,
                    phone_number: person.phoneNumber,
                    supervisor_id: person.supervisorId,
                    manager_id: person.managerId,
                    client_id: person.clientId,
                    image: person.image,
                    prevailing_wage: person.prevailingWage || false
                };
                await supabase.from('personnel').insert(dbPayload);
            },
            updatePersonnel: async (id, updates) => {
                set((state) => ({
                    personnel: state.personnel.map((p) => (p.id === id ? { ...p, ...updates } : p)),
                }));
                const dbPayload: any = {};
                if (updates.name !== undefined) dbPayload.name = updates.name;
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
                if (updates.prevailingWage !== undefined) dbPayload.prevailing_wage = updates.prevailingWage;
                if (Object.keys(dbPayload).length > 0) {
                    await supabase.from('personnel').update(dbPayload).eq('id', id);
                }
            },
            deletePersonnel: async (id) => {
                set((state) => ({
                    personnel: state.personnel.filter((p) => p.id !== id),
                }));
                await supabase.from('personnel').delete().eq('id', id);
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
            addTimesheet: async (timesheet) => {
                set((state) => ({ timesheets: [...state.timesheets, timesheet] }));
                const dbPayload = {
                    id: timesheet.id,
                    personnel_id: timesheet.personnelId,
                    project_id: timesheet.projectId,
                    date: timesheet.date,
                    time_in: timesheet.timeIn,
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
                    lunch_skipped: timesheet.lunchSkipped
                };
                await supabase.from('timesheets').insert(dbPayload);
            },
            updateTimesheet: async (id, updates) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
                }));
                const dbPayload: any = {};
                if (updates.personnelId !== undefined) dbPayload.personnel_id = updates.personnelId;
                if (updates.projectId !== undefined) dbPayload.project_id = updates.projectId;
                if (updates.date !== undefined) dbPayload.date = updates.date;
                if (updates.timeIn !== undefined) dbPayload.time_in = updates.timeIn;
                if (updates.timeOut !== undefined) dbPayload.time_out = updates.timeOut;
                if (updates.hours !== undefined) dbPayload.hours = updates.hours;
                if (updates.type !== undefined) dbPayload.type = updates.type;
                if (updates.classification !== undefined) dbPayload.classification = updates.classification;
                if (updates.notes !== undefined) dbPayload.notes = updates.notes;
                if (updates.status !== undefined) dbPayload.status = updates.status;
                if (updates.approvedBy !== undefined) dbPayload.approved_by = updates.approvedBy;
                if (updates.signature !== undefined) dbPayload.signature = updates.signature;
                if (updates.punches !== undefined) dbPayload.punches = updates.punches;
                if (updates.gpsVerified !== undefined) dbPayload.gps_verified = updates.gpsVerified;
                if (updates.lunchSkipped !== undefined) dbPayload.lunch_skipped = updates.lunchSkipped;
                if (updates.source !== undefined) dbPayload.source = updates.source;             // M-04
                if (updates.manualReason !== undefined) dbPayload.manual_reason = updates.manualReason; // M-04
                if (Object.keys(dbPayload).length > 0) {
                    await supabase.from('timesheets').update(dbPayload).eq('id', id);
                }
            },
            deleteTimesheet: async (id) => {
                set((state) => ({
                    timesheets: state.timesheets.filter((t) => t.id !== id),
                }));
                await supabase.from('timesheets').delete().eq('id', id);
            },
            approveTimesheet: async (id, approverId) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Approved', approvedBy: approverId } : t
                    )
                }));
                // H-03: persist actual approver id
                await supabase.from('timesheets').update({ status: 'Approved', approved_by: approverId }).eq('id', id);
            },
            rejectTimesheet: async (id, approverId) => {
                set((state) => ({
                    timesheets: state.timesheets.map((t) => 
                        t.id === id ? { ...t, status: 'Rejected', approvedBy: approverId } : t
                    )
                }));
                await supabase.from('timesheets').update({ status: 'Rejected', approved_by: approverId }).eq('id', id);
            },
            clockPunch: async (personnelId, punch, projectId, lunchSkipped) => {
                // C-01: Use LOCAL date so timezone differences don't cause wrong-day lookups
                const _d = new Date();
                const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

                // C-01 FIX: Convert ISO timestamp to LOCAL HH:mm (not UTC slice)
                const toHHMM = (iso: string) => {
                    const d = new Date(iso);
                    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                };

                set((state) => {
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
                });

                // H-01: Persist GPS punch to Supabase so other devices see live data
                try {
                    const updated = get().timesheets.find(
                        t => t.personnelId === personnelId && t.date === today
                    );
                    if (updated) {
                        await supabase.from('timesheets').upsert({
                            id: updated.id,
                            personnel_id: updated.personnelId,
                            project_id: updated.projectId || projectId || null,
                            date: updated.date,
                            time_in: updated.timeIn,
                            time_out: updated.timeOut,
                            hours: updated.hours,
                            type: updated.type,
                            status: updated.status,
                            punches: updated.punches,
                            gps_verified: updated.gpsVerified,
                            lunch_skipped: updated.lunchSkipped,
                        });
                    }
                } catch (e) {
                    console.warn('[clockPunch] Supabase upsert failed — punch is saved locally:', e);
                }
            },
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
