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
    status: 'Matches' | 'Does not match' | 'N/A' | 'Unchecked';
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
    labor?: { id: string; personnelId?: string; role: string; qty: number; timeIn?: string; timeOut?: string; hours: number; type?: 'On Site' | 'Travel' | 'Other'; isOutsourced?: boolean }[];
    media?: { id: string; url: string; caption: string }[];
    occurrences?: ReportOccurrence[];
    checklists?: ReportChecklist[];
    subReportIds?: string[];
    notes: string;
    signatures?: ReportSignature[];
    usedTools?: string[]; // IDs of tools used in this report
    health?: number; // Project health 0-100%
    activityLogs?: {
        scopeId?: string;
        activityId?: string;
        customTaskName?: string;
        progressReported?: number;
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
    certifications: Certification[];
    appRole?: 'Tech' | 'Supervisor' | 'Manager' | 'Customer';
    supervisorId?: string;
    managerId?: string;
}

export interface ChecklistTemplate {
    id: string;
    name: string;
    items: string[];
}

export interface ScopeTemplate {
    id: string;
    name: string;
    activities: string[];
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
    date: string; // ISO yyyy-mm-dd format
    type: 'Project' | 'Maintenance' | 'Other';
    personnelId?: string;
    projectId?: string;
    toolId?: string;
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
}

export interface ProjectActivity {
    id: string;
    title: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    progress: number; // 0-100%
    expectedHours?: number;
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
    projectSize?: string;
    systemType?: 'Solar' | 'BESS' | 'Hybrid' | 'Other' | string;
    codeName?: string;
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
    addProject: (project: Project) => void;
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
    assignSupervisor: (personnelId: string, supervisorId?: string, managerId?: string) => void;
    addScopeToProject: (projectId: string, scope: ProjectScope) => void;
    addActivityToScope: (projectId: string, scopeId: string, activity: ProjectActivity) => void;
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
                    activities: ['Site Preparation', 'Trenching', 'Mounting Structures', 'Fencing']
                },
                {
                    id: 'STPL-002',
                    name: 'Commissioning Standard',
                    activities: ['Cold Commissioning', 'Hot Commissioning', 'Performance Testing', 'Handover']
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
                    date: new Date().toISOString().split('T')[0],
                    type: 'Project',
                    projectId: 'PROJ-BETA'
                }
            ],
            timesheets: [],
            initDb: () => {
                set((state) => {
                    // Update state with mock data if reports are empty
                    if (state.reports.length === 0) {
                        return {
                            clients: mockClients,
                            projects: mockProjects,
                            reports: mockReports,
                            personnel: mockPersonnel,
                            tools: mockTools,
                            timesheets: mockTimesheets,
                        };
                    }
                    return {};
                });
            },
            setUserRole: (role) => set({ userRole: role }),
            addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
            updateClient: (id, updates) => set((state) => ({ clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c) })),
            addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
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
            name: 'latnovva-storage',
        }
    )
);
