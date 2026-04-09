import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import {
    MapPin, ArrowLeft, Edit2, Check, X, Users, Clock, FileText, Wrench,
    BarChart2, Search, AlertCircle, Plus, ExternalLink, Network, CheckCircle2, Map, Hourglass, Target
} from 'lucide-react';
import { ManageScopesModal } from '../components/project/ManageScopesModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function ProjectDetail() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects, clients, personnel, reports, timesheets, updateProject, addReport, userRole, updateTool } = useStore();

    const project = projects.find(p => p.id === id);
    const client = clients.find(c => c.id === project?.clientId);
    const allProjectReports = reports.filter(r => r.projectId === id).sort((a, b) => b.date.localeCompare(a.date));
    const projectHours = timesheets.filter(t => t.projectId === id).reduce((sum, t) => sum + t.hours, 0);

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editCodeName, setEditCodeName] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editSize, setEditSize] = useState('');
    const [editSystemType, setEditSystemType] = useState('');
    const [editStatus, setEditStatus] = useState<'Active' | 'On Hold' | 'Completed'>('Active');
    const [editClientId, setEditClientId] = useState('');
    const [editEpc, setEditEpc] = useState('');
    const [editOandM, setEditOandM] = useState('');
    const [editPointOfContact, setEditPointOfContact] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editHasNoDefinedScope, setEditHasNoDefinedScope] = useState(false);
    const [editDisciplines, setEditDisciplines] = useState<string[]>([]);
    const [editSiteLeadIds, setEditSiteLeadIds] = useState<string[]>([]);

    const [locationError, setLocationError] = useState('');

    // Personnel picklist
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [isAddingPersonnel, setIsAddingPersonnel] = useState(false);

    // Tools
    const { tools, addTool } = useStore();
    const projectTools = tools.filter(t => t.assignedProjectId === id);
    const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);
    const [isAssignInventoryOpen, setIsAssignInventoryOpen] = useState(false);
    const [toolSearch, setToolSearch] = useState('');
    const [newTool, setNewTool] = useState<{name: string, model: string, serialNumber: string, certificationExpiry: string}>({
        name: '', model: '', serialNumber: '', certificationExpiry: ''
    });

    const unassignedTools = useMemo(() => {
        return tools.filter(t => 
            !t.assignedProjectId && 
            (t.name.toLowerCase().includes(toolSearch.toLowerCase()) || 
             t.serialNumber.toLowerCase().includes(toolSearch.toLowerCase()))
        );
    }, [tools, toolSearch]);

    const handleAssignFromInventory = (toolId: string) => {
        updateTool(toolId, { assignedProjectId: id });
        setIsAssignInventoryOpen(false);
        setToolSearch('');
    };

    const handleQuickAddTool = () => {
        if (!newTool.name || !newTool.serialNumber) return;
        addTool({
            id: `TOOL-${Date.now()}`,
            name: newTool.name,
            model: newTool.model,
            serialNumber: newTool.serialNumber,
            certificationExpiry: newTool.certificationExpiry,
            assignedProjectId: id,
            history: [{
                date: new Date().toISOString().split('T')[0],
                description: `Tool registered directly to project: ${project?.name}`,
                projectId: id
            }]
        });
        setNewTool({ name: '', model: '', serialNumber: '', certificationExpiry: '' });
        setIsAddToolModalOpen(false);
    };

    // Reports filter
    const [filterReportState, setFilterReportState] = useState<string>('All');
    const projectReports = allProjectReports.filter(r => filterReportState === 'All' || r.state === filterReportState);

    // Occurrences & Blockers
    const projectOccurrences = useMemo(() => {
        return allProjectReports.flatMap(r => 
            (r.occurrences || []).map(o => ({...o, reportId: r.id, reportDate: r.date}))
        ).sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
    }, [allProjectReports]);

    const totalLostTimeMinutes = useMemo(() => {
        return projectOccurrences.reduce((sum, o) => sum + (o.durationMinutes || 0), 0);
    }, [projectOccurrences]);
    
    const totalLostTimeHours = Math.round((totalLostTimeMinutes / 60) * 10) / 10;

    // Modals
    const [manageScopesProject, setManageScopesProject] = useState<any>(null);

    const canEdit = ['Manager', 'Supervisor'].includes(userRole);
    const canEditPersonnel = canEdit && project?.status !== 'Completed';

    // People already assigned to OTHER projects (conflict check)
    const assignedElsewhere = useMemo(() => {
        const elsewhere = new Set<string>();
        projects.forEach(p => {
            if (p.id === id) return;
            (p.assignedPersonnel || []).forEach(pid => elsewhere.add(pid));
        });
        return elsewhere;
    }, [projects, id]);

    const assignedToThis = project?.assignedPersonnel || [];

    const availablePersonnel = useMemo(() => {
        return personnel.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(personnelSearch.toLowerCase()) ||
                p.position.toLowerCase().includes(personnelSearch.toLowerCase());
            const notElsewhere = !assignedElsewhere.has(p.id) || assignedToThis.includes(p.id);
            return matchesSearch && notElsewhere;
        });
    }, [personnel, personnelSearch, assignedElsewhere, assignedToThis]);

    const openEdit = () => {
        if (!project) return;
        setEditName(project.name);
        setEditCodeName(project.codeName || '');
        setEditLocation(project.location || '');
        setEditSize(project.projectSize || '');
        setEditSystemType(project.systemType || 'Solar');
        setEditStatus(project.status as any);
        setEditClientId(project.clientId);
        setEditEpc(project.epc || '');
        setEditOandM(project.oAndM || '');
        setEditPointOfContact(project.pointOfContact || '');
        setEditNotes(project.notes || '');
        setEditHasNoDefinedScope(!!project.hasNoDefinedScope);
        setEditDisciplines(project.disciplines || []);
        setEditSiteLeadIds(project.siteLeadIds || []);
        setIsEditing(true);
    };

    const saveEdit = () => {
        if (!project || !editName.trim()) return;
        updateProject(project.id, {
            name: editName,
            codeName: editCodeName || undefined,
            location: editLocation || undefined,
            projectSize: editSize || undefined,
            systemType: editSystemType || undefined,
            status: editStatus,
            clientId: editClientId,
            epc: editEpc || undefined,
            oAndM: editOandM || undefined,
            pointOfContact: editPointOfContact || undefined,
            notes: editNotes || undefined,
            hasNoDefinedScope: editHasNoDefinedScope,
            disciplines: editDisciplines,
            siteLeadIds: editSiteLeadIds,
        });
        setIsEditing(false);
    };



    const togglePersonnel = (personId: string) => {
        if (!project) return;
        const currentlyAssigned = project.assignedPersonnel || [];
        if (currentlyAssigned.includes(personId)) {
            updateProject(project.id, { assignedPersonnel: currentlyAssigned.filter(id => id !== personId) });
        } else {
            updateProject(project.id, { assignedPersonnel: [...currentlyAssigned, personId] });
        }
    };

    const handleCreateReport = () => {
        if (!project) return;
        const newId = `REP-${Date.now().toString().slice(-6)}`;
        addReport({
            id: newId,
            projectId: project.id,
            clientId: project.clientId || '',
            projectName: project.name,
            date: new Date().toISOString().split('T')[0],
            state: 'Draft',
            schedule: '',
            weather: { temp: 0, condition: 'Unknown' },
            location: project.location,
            equipment: [],
            customSections: [],
            comments: [],
            labor: [],
            media: [],
            occurrences: [],
            checklists: [],
            subReportIds: [],
            attachments: [],
            externalAttachments: [],
            notes: '',
            signatures: [],
            usedTools: [],
            health: 'On Track',
            activityLogs: []
        } as any);
        navigate(`/reports/${newId}`);
    };

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                <AlertCircle size={48} className="text-gray-200" />
                <p className="text-lg font-medium">{t('projects.empty.title', 'Project not found.')}</p>
                <Button variant="outline" onClick={() => navigate('/projects')}>{t('projects.back_to_projects', 'Back to Projects')}</Button>
            </div>
        );
    }

    const allActs = project.scopes?.flatMap(s => s.activities) || [];
    const completedActs = allActs.filter(a => a.status === 'Completed').length;
    const overallProgress = allActs.length > 0
        ? Math.round(allActs.reduce((sum, a) => sum + a.progress, 0) / allActs.length)
        : project.progress || 0;

    const statusColor = project.status === 'Active'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : project.status === 'On Hold'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

    const DISCIPLINE_OPTIONS = ['Mechanical', 'Commissioning', 'Civil', 'Electrical', 'Other'];

    return (
        <div className="space-y-6 pb-16">
            {/* Back */}
            <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-brand-teal transition-colors"
            >
                <ArrowLeft size={16} /> {t('projects.back_to_projects', 'Back to Projects')}
            </button>

            {/* ── Project Header Card ─────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Color bar */}
                <div className={`h-1.5 w-full ${project.status === 'Active' ? 'bg-brand-teal' : project.status === 'On Hold' ? 'bg-amber-400' : 'bg-gray-300'}`} />

                <div className="p-6 md:p-8">
                    {!isEditing ? (
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    {client?.logo && (
                                        <img src={client.logo} alt={client.name} className="h-8 w-8 rounded-full object-cover" />
                                    )}
                                    <span className="text-sm font-semibold text-gray-500">{client?.name}</span>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>
                                        {project.status}
                                    </span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-accent-greyDark mb-1 flex items-center gap-2">
                                    {project.name}
                                    {project.hasNoDefinedScope && (
                                        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{t('projects.labor_only', 'Labor Only')}</span>
                                    )}
                                </h1>
 domestic: False
                                {project.codeName && (
                                    <p className="text-sm font-mono font-bold text-brand-teal mb-3">{project.codeName}</p>
                                )}
                                
                                {project.siteLeadIds && project.siteLeadIds.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-status-success/10 text-status-success border border-status-success/20 rounded-xl text-xs font-bold shadow-sm">
                                            <Target size={14} />
                                            {t('projects.site_leads', 'Site Leads')}:
                                        </div>
                                        {project.siteLeadIds.map(leadId => {
                                            const lead = personnel.find(p => p.id === leadId);
                                            return lead ? (
                                                <div key={leadId} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-100 rounded-lg text-xs font-bold text-accent-greyDark shadow-sm">
                                                    <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[8px] font-black text-gray-500 overflow-hidden">
                                                        {lead.image ? <img src={lead.image} className="w-full h-full object-cover" /> : lead.name.charAt(0)}
                                                    </div>
                                                    {lead.name}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 font-medium">
                                    {project.location && (
                                        <div className="flex items-center gap-2">
                                            <a 
                                                href={`https://www.google.com/maps?q=${project.location}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-brand-teal hover:underline font-bold"
                                            >
                                                <MapPin size={14} />
                                                <span>{project.location}</span>
                                                <ExternalLink size={12} />
                                            </a>
                                            
                                            {canEdit && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-6 text-[10px] uppercase font-bold border-brand-teal/30 text-brand-teal hover:bg-brand-teal/10 px-2 group flex items-center gap-1 ml-2"
                                                    onClick={() => {
                                                        if (navigator.geolocation) {
                                                            navigator.geolocation.getCurrentPosition((pos) => {
                                                                updateProject(project.id, { location: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}` });
                                                            }, () => {
                                                                alert('Unable to retrieve location. Please allow location permissions in your browser.');
                                                            });
                                                        } else {
                                                            alert('Geolocation is not supported by your browser.');
                                                        }
                                                    }}
                                                >
                                                    <MapPin size={10} className="group-hover:animate-ping" /> {t('projects.update_gps', 'Update via GPS')}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {project.projectSize && <span>📐 {project.projectSize}</span>}
                                    {project.systemType && <span>⚡ {project.systemType}</span>}
                                    <span className="font-mono text-gray-400">{project.id}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-3 pt-3 border-t border-gray-100/60">
                                    {project.epc && <span className="text-gray-600"><span className="text-gray-400">EPC:</span> <span className="font-semibold">{project.epc}</span></span>}
                                    {project.oAndM && <span className="text-gray-600"><span className="text-gray-400">O&M:</span> <span className="font-semibold">{project.oAndM}</span></span>}
                                    {project.pointOfContact && <span className="text-gray-600"><span className="text-gray-400">PoC:</span> <span className="font-semibold">{project.pointOfContact}</span></span>}
                                </div>
                                {project.notes && (
                                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        {project.notes}
                                    </p>
                                )}
                            </div>
                            {canEdit && (
                                <Button onClick={openEdit} variant="outline" className="flex items-center gap-2 shrink-0 border-gray-200 hover:border-brand-teal hover:text-brand-teal transition-colors">
                                    <Edit2 size={15} /> Edit Info
                                </Button>
                            )}
                        </div>
                    ) : (
                        /* Inline edit form */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold text-accent-greyDark">Edit Project Info</h2>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="gap-1"><X size={14} /> Cancel</Button>
                                    <Button size="sm" onClick={saveEdit} className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-1"><Check size={14} /> Save</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2 grid gap-1.5">
                                    <Label htmlFor="dp-name">Project Name *</Label>
                                    <Input id="dp-name" value={editName} onChange={e => setEditName(e.target.value)} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-code">Code Name</Label>
                                    <Input id="dp-code" value={editCodeName} onChange={e => setEditCodeName(e.target.value)} placeholder="E.g. EST-LNV-000 CDMX" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-client">Client</Label>
                                    <select id="dp-client" value={editClientId} onChange={e => setEditClientId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-teal">
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-location">Coordinates / Address</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            id="dp-location" 
                                            value={editLocation} 
                                            onChange={e => {
                                                setEditLocation(e.target.value);
                                                setLocationError('');
                                            }} 
                                            placeholder="lat,lng or address" 
                                            className="flex-1"
                                        />
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => {
                                                if (editLocation.trim()) window.open(`https://maps.google.com/maps?q=${editLocation}`, '_blank');
                                            }}
                                            className={`px-3 ${editLocation.trim() ? 'border-brand-teal text-brand-teal bg-brand-teal/5' : ''}`}
                                            disabled={!editLocation.trim()}
                                            title="Validate on Map"
                                        >
                                            <Map size={16} />
                                        </Button>
                                    </div>
                                    {locationError && <p className="text-[10px] text-red-500 font-medium">{locationError}</p>}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-status">Status</Label>
                                    <select id="dp-status" value={editStatus} onChange={e => setEditStatus(e.target.value as any)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-teal">
                                        <option value="Active">Active</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-size">Project Size</Label>
                                    <Input id="dp-size" value={editSize} onChange={e => setEditSize(e.target.value)} placeholder="E.g. 100 MW" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-sys">System Type</Label>
                                    <select id="dp-sys" value={editSystemType} onChange={e => setEditSystemType(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-teal">
                                        <option value="Solar">Solar</option>
                                        <option value="BESS">BESS</option>
                                        <option value="Hybrid">Hybrid</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-epc">EPC</Label>
                                    <Input id="dp-epc" value={editEpc} onChange={e => setEditEpc(e.target.value)} placeholder="EPC Contractor" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dp-oandm">O&M</Label>
                                    <Input id="dp-oandm" value={editOandM} onChange={e => setEditOandM(e.target.value)} placeholder="O&M Provider" />
                                </div>
                                <div className="sm:col-span-2 grid gap-1.5">
                                    <Label htmlFor="dp-notes">Notes</Label>
                                    <Input id="dp-notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="General project notes" />
                                </div>
                                <div className="sm:col-span-2 flex items-center gap-2 py-2 px-1">
                                    <input 
                                        type="checkbox" 
                                        id="dp-labor-only" 
                                        checked={editHasNoDefinedScope} 
                                        onChange={e => setEditHasNoDefinedScope(e.target.checked)}
                                        className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal"
                                    />
                                    <Label htmlFor="dp-labor-only" className="cursor-pointer font-bold">No Defined Scope (Labor Only / IE Support)</Label>
                                </div>
                                <div className="sm:col-span-2 grid gap-1.5">
                                    <Label>Active Disciplines / Streams</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {DISCIPLINE_OPTIONS.map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => {
                                                    setEditDisciplines((prev: string[]) => prev.includes(d) ? prev.filter((x: string) => x !== d) : [...prev, d]);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${editDisciplines.includes(d) ? 'bg-brand-teal text-white border-brand-teal shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="sm:col-span-2 grid gap-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Site Leads (Accountable for Reports/Logs)</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                        {assignedToThis.map(pid => {
                                            const person = personnel.find(p => p.id === pid);
                                            if (!person) return null;
                                            const isLead = editSiteLeadIds.includes(pid);
                                            return (
                                                <button
                                                    key={pid}
                                                    type="button"
                                                    onClick={() => {
                                                        setEditSiteLeadIds((prev: string[]) => isLead ? prev.filter((id: string) => id !== pid) : [...prev, pid]);
                                                    }}
                                                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${isLead ? 'border-status-success/30 bg-status-success/5 shadow-sm' : 'border-gray-50 bg-gray-50/50 grayscale opacity-60'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                                                            {person.image ? <img src={person.image} className="w-full h-full object-cover" /> : person.name.charAt(0)}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-bold text-accent-greyDark leading-none mb-1">{person.name}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase font-medium">{person.position}</p>
                                                        </div>
                                                    </div>
                                                    <Target size={16} className={isLead ? 'text-status-success' : 'text-gray-300'} />
                                                </button>
                                            );
                                        })}
                                        {assignedToThis.length === 0 && (
                                            <p className="text-xs text-gray-400 italic py-2">No personnel assigned to this project yet. Assign people first to select leads.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Stats + Personnel Row ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Stats */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2"><BarChart2 size={18} className="text-brand-teal" /> {t('projects.stats', 'Project Stats')}</h2>
                    
                    {project.hasNoDefinedScope ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                                    <p className="text-2xl font-bold text-brand-teal">{projectReports.length}</p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Reports</p>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                                    <p className="text-2xl font-bold text-accent-greyDark">{projectHours}</p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Hours Logged</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 text-center mt-auto pt-2">Detailed metrics disabled for Labor-Only</p>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                                    <p className="text-2xl font-bold text-brand-teal">{overallProgress}%</p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Progress</p>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                                    <p className="text-2xl font-bold text-accent-greyDark">{completedActs}/{allActs.length}</p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Activities</p>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                                    <p className="text-2xl font-bold text-accent-greyDark">{projectHours}</p>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Hours</p>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                    className="bg-brand-teal h-2.5 rounded-full transition-all duration-700"
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 text-center">{projectReports.length} report{projectReports.length !== 1 ? 's' : ''} on file</p>
                        </>
                    )}
                </div>

                {/* Personnel Picklist */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                            <Users size={18} className="text-brand-teal" /> {isAddingPersonnel ? t('projects.add_personnel', 'Add Personnel') : t('projects.assigned_personnel', 'Assigned Personnel')}
                            <span className="text-xs bg-brand-teal/10 text-brand-teal font-bold px-2 py-0.5 rounded-full">{assignedToThis.length}</span>
                        </h2>
                        {canEditPersonnel && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`text-xs h-7 border-brand-teal/20 hover:border-brand-teal text-brand-teal transition-all ${isAddingPersonnel ? 'bg-brand-teal/10' : ''}`}
                                onClick={() => setIsAddingPersonnel(!isAddingPersonnel)}
                            >
                                {isAddingPersonnel ? t('common.done', 'Done') : t('projects.add_personnel_action', '+ Add Personnel')}
                            </Button>
                        )}
                    </div>

                    {isAddingPersonnel && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <Input
                                placeholder="Search by name or role..."
                                className="pl-9 h-9 text-sm bg-gray-50 border-gray-100"
                                value={personnelSearch}
                                onChange={e => setPersonnelSearch(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="overflow-y-auto max-h-52 space-y-1.5 pr-1">
                        {(isAddingPersonnel ? availablePersonnel : personnel.filter((p: any) => assignedToThis.includes(p.id))).map((person: any) => {
                            const isAssigned = assignedToThis.includes(person.id);
                            const isConflict = assignedElsewhere.has(person.id) && !isAssigned;
                            return (
                                <div
                                    key={person.id}
                                    onClick={() => canEditPersonnel && isAddingPersonnel && !isConflict && togglePersonnel(person.id)}
                                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                        isAssigned
                                            ? 'bg-brand-teal/5 border-brand-teal/20'
                                            : isConflict
                                            ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                                            : canEditPersonnel && isAddingPersonnel ? 'bg-gray-50 border-gray-100 hover:border-brand-teal/30 hover:bg-brand-teal/5 cursor-pointer' : 'bg-gray-50 border-gray-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isAssigned ? 'bg-brand-teal text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                        </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-bold text-accent-greyDark truncate">{person.name}</p>
                                                    {project.siteLeadIds?.includes(person.id) && (
                                                        <span className="flex items-center gap-1 text-[9px] bg-status-success/10 text-status-success border border-status-success/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                            <Target size={10} /> Lead
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 font-medium">{person.position}</p>
                                            </div>
                                    </div>
                                    {canEditPersonnel && (
                                        isAddingPersonnel ? (
                                            isAssigned
                                                ? <span className="text-brand-teal"><Check size={16} /></span>
                                                : isConflict
                                                ? <span className="text-xs text-gray-400 italic">On project</span>
                                                : <span className="text-gray-300"><Plus size={16} /></span>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); togglePersonnel(person.id); }}
                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )
                                    )}
                                </div>
                            );
                        })}
                        {availablePersonnel.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4 italic">No personnel match your search.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Assigned Tools ────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                        <Wrench size={18} className="text-brand-teal" /> Assigned Tools
                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{projectTools.length}</span>
                    </h2>
                    {canEdit && (
                        <div className="flex items-center gap-2">
                            <Button 
                                size="sm" 
                                variant="outline"
                                className="border-brand-teal/30 text-brand-teal hover:bg-brand-teal/5 transition-colors text-xs font-bold gap-1.5"
                                onClick={() => setIsAssignInventoryOpen(true)}
                            >
                                <Search size={13} /> Assign from Inventory
                            </Button>
                            <Button 
                                size="sm" 
                                className="bg-brand-teal text-white hover:bg-brand-teal/90 transition-colors text-xs font-bold gap-1.5"
                                onClick={() => setIsAddToolModalOpen(true)}
                            >
                                <Plus size={13} /> Quick Add Tool
                            </Button>
                        </div>
                    )}
                </div>
                
                {projectTools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {projectTools.map(tool => (
                            <div key={tool.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-accent-greyDark block truncate">{tool.name}</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{tool.model || 'N/A'}</p>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs font-mono font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded">{tool.serialNumber}</span>
                                    {tool.certificationExpiry && new Date(tool.certificationExpiry) < new Date() && (
                                        <span title="Certification Expired"><AlertCircle size={14} className="text-red-500" /></span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-500">No tools assigned to this site.</p>
                    </div>
                )}
            </div>

            {/* Assign Existing Tool Modal */}
            {isAssignInventoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex items-center gap-3 mb-4 text-brand-teal">
                            <Search size={22} />
                            <h2 className="text-lg font-bold text-accent-greyDark flex-1">Assign from Inventory</h2>
                            <button onClick={() => setIsAssignInventoryOpen(false)} className="text-gray-400 hover:text-gray-600 border border-gray-100 p-1.5 rounded-xl"><X size={18}/></button>
                        </div>
                        
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <Input 
                                placeholder="Search inventory..." 
                                className="pl-9 h-9 text-sm bg-gray-50 border-gray-100" 
                                value={toolSearch}
                                onChange={e => setToolSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[100px]">
                            {unassignedTools.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => handleAssignFromInventory(tool.id)}
                                    className="w-full text-left p-3 rounded-2xl bg-gray-50 border border-transparent hover:border-brand-teal/30 hover:bg-brand-teal/5 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-accent-greyDark group-hover:text-brand-teal transition-colors">{tool.name}</p>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Free</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-[10px] text-gray-400 font-medium">{tool.model || 'No model'}</p>
                                        <p className="text-[10px] font-mono text-gray-400 font-bold">{tool.serialNumber}</p>
                                    </div>
                                </button>
                            ))}
                            {unassignedTools.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-sm text-gray-400 font-medium italic">No unassigned tools found.</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <Button variant="outline" className="w-full rounded-2xl" onClick={() => setIsAssignInventoryOpen(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Tool Modal */}
            {isAddToolModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-brand-teal">
                            <Plus size={24} />
                            <h2 className="text-xl font-bold text-accent-greyDark flex-1">Register Site Tool</h2>
                            <button onClick={() => setIsAddToolModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="grid gap-1">
                                <Label>Tool Name *</Label>
                                <Input value={newTool.name} onChange={e => setNewTool({...newTool, name: e.target.value})} placeholder="e.g. Torque Wrench" />
                            </div>
                            <div className="grid gap-1">
                                <Label>Serial Number *</Label>
                                <Input value={newTool.serialNumber} onChange={e => setNewTool({...newTool, serialNumber: e.target.value})} placeholder="e.g. SN-12345" />
                            </div>
                            <div className="grid gap-1">
                                <Label>Model (Optional)</Label>
                                <Input value={newTool.model} onChange={e => setNewTool({...newTool, model: e.target.value})} placeholder="e.g. Fluke 100" />
                            </div>
                            <div className="grid gap-1">
                                <Label>Cert. Expiry (Optional)</Label>
                                <Input type="date" value={newTool.certificationExpiry} onChange={e => setNewTool({...newTool, certificationExpiry: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setIsAddToolModalOpen(false)}>Cancel</Button>
                            <Button className="flex-1 bg-brand-teal text-white hover:bg-brand-teal/90" onClick={handleQuickAddTool}>Save Tool</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Scopes & WBS ────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                        <Network size={18} className="text-brand-teal" /> Scopes & WBS
                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{project.scopes?.length || 0}</span>
                    </h2>
                    {canEdit && !project.hasNoDefinedScope && (
                        <Button 
                            size="sm" 
                            className="bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white transition-colors text-xs font-bold gap-1.5"
                            onClick={() => setManageScopesProject(project)}
                        >
                            <Edit2 size={13} /> Manage WBS
                        </Button>
                    )}
                </div>

                {project.hasNoDefinedScope ? (
                    <div className="py-8 text-center bg-amber-50/30 rounded-3xl border border-dashed border-amber-200">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold text-amber-700">Labor-Only Project</p>
                        <p className="text-xs text-amber-600/70 mt-1">Metrics and WBS tracking are disabled for this discipline.</p>
                    </div>
                ) : !project.scopes || project.scopes.length === 0 ? (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-500 mb-2">No work breakdown structure defined.</p>
                        {canEdit && (
                            <Button size="sm" variant="outline" className="text-xs border-brand-teal/30 text-brand-teal" onClick={() => setManageScopesProject(project)}>
                                Create First Scope
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {project.scopes.map(scope => {
                            const isCompleted = scope.completedDate || (scope.activities.length > 0 && scope.activities.every(a => a.progress === 100 || a.status === 'Completed'));
                            const scopeProgress = scope.activities.length > 0 
                                ? Math.round(scope.activities.reduce((sum, a) => sum + a.progress, 0) / scope.activities.length)
                                : 0;
                            return (
                                <div key={scope.id} className={`p-4 rounded-2xl border relative overflow-hidden ${isCompleted ? 'bg-status-success/5 border-status-success/20' : 'bg-white border-gray-100'}`}>
                                    {isCompleted && (
                                        <div className="absolute top-0 right-0 p-2 text-status-success">
                                            <CheckCircle2 size={24} className="opacity-20" />
                                        </div>
                                    )}
                                    <h3 className="font-bold text-accent-greyDark text-sm pr-6 truncate">{scope.name}</h3>
                                    <div className="flex items-center gap-2 mt-3 mb-1">
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full ${isCompleted ? 'bg-status-success' : 'bg-brand-teal'}`} 
                                                style={{ width: `${scopeProgress}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold ${isCompleted ? 'text-status-success' : 'text-brand-teal'}`}>{scopeProgress}%</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">{scope.activities.length} Activities</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Field Issues / Blockers ───────────────────────────────────── */}
            {projectOccurrences.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-50 gap-4">
                        <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                            <AlertCircle size={18} className="text-orange-500" /> {t('projects.issues', 'Reported Issues / Blockers')}
                            <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">{projectOccurrences.length}</span>
                        </h2>
                        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                            <Hourglass size={14} className="text-orange-500" />
                            <span className="text-xs font-bold text-orange-600">{t('projects.lost_time', 'Total Lost Time')}:</span>
                            <span className="text-sm font-black text-orange-700">{totalLostTimeHours} hr</span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.date')}</th>
                                    <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('reports.category', 'Category')}</th>
                                    <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.description', 'Description')}</th>
                                    <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden sm:table-cell">{t('reports.impact', 'Impact')}</th>
                                    <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider text-right">{t('projects.lost_time_col', 'Lost Time')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {projectOccurrences.map((occ: any, idx: number) => (
                                    <tr key={`${occ.id}-${idx}`} className="hover:bg-orange-50/30 transition-colors group cursor-pointer" onClick={() => navigate(`/reports/${occ.reportId}`)}>
                                        <td className="p-4 text-sm font-semibold text-gray-500 whitespace-nowrap">
                                            {new Date(occ.reportDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})} <span className="text-gray-400 font-normal">{t('common.at', 'at')} {occ.time}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 flex items-center gap-1.5 w-max">
                                                <Target size={12} className="text-gray-400" /> {occ.category || t('common.other')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-accent-greyDark font-medium min-w-[200px]">
                                            {occ.description || <span className="text-gray-400 italic">{t('reports.no_description', 'No description provided')}</span>}
                                        </td>
                                        <td className="p-4 hidden sm:table-cell">
                                            <div className="flex gap-1.5 flex-wrap">
                                                {occ.impact?.schedule && <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-bold">{t('reports.impact_schedule', 'Schedule')}</span>}
                                                {occ.impact?.productivity && <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded font-bold">{t('reports.impact_productivity', 'Productivity')}</span>}
                                                {occ.impact?.safety && <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded font-bold">{t('reports.impact_safety', 'Safety')}</span>}
                                                {occ.impact?.clientVisible && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-bold">{t('reports.impact_visible', 'Visible')}</span>}
                                                {!occ.impact?.schedule && !occ.impact?.productivity && !occ.impact?.safety && !occ.impact?.clientVisible && (
                                                    <span className="text-xs text-gray-300">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Hourglass size={12} className="text-orange-400" />
                                                <span className="text-sm font-bold text-orange-600">{occ.durationMinutes ? `${(occ.durationMinutes/60).toFixed(1)}h` : '0h'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Reports Table ───────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-50">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                        <FileText size={18} className="text-brand-teal" /> {t('reports.title')}
                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{projectReports.length}</span>
                    </h2>
                        <div className="flex items-center gap-4">
                            <select
                                className="bg-gray-50 border border-gray-100 text-sm font-medium text-gray-600 rounded-xl px-3 py-1.5 outline-none focus:border-brand-teal/50"
                                value={filterReportState}
                                onChange={e => setFilterReportState(e.target.value)}
                            >
                                <option value="All">{t('reports.all_states', 'All States')}</option>
                                <option value="Draft">{t('reports.draft')}</option>
                                <option value="Pending Manager Review">{t('reports.pending_manager')}</option>
                                <option value="Available for Customer Review">{t('reports.pending_customer')}</option>
                                <option value="Approved">{t('reports.approved')}</option>
                                <option value="Closed">{t('reports.closed')}</option>
                            </select>
                            <Button size="sm" onClick={handleCreateReport} className="bg-brand-teal hover:bg-brand-teal/90 text-white text-xs gap-1.5">
                                <Plus size={14} /> {t('reports.new_report', 'New Report')}
                            </Button>
                        </div>
                </div>

                {projectReports.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <FileText size={40} className="mx-auto mb-3 text-gray-200" />
                        <p className="font-medium">No reports yet</p>
                        <p className="text-sm mt-1">Create the first report for this project.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('reports.table.id', 'Report ID')}</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.date')}</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.status')}</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden md:table-cell">{t('reports.table.labor_entries', 'Labor Entries')}</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {projectReports.map(rep => {
                                const stateColor =
                                    rep.state === 'Approved' || rep.state === 'Closed' ? 'bg-emerald-100 text-emerald-700' :
                                    rep.state === 'Draft' ? 'bg-blue-100 text-blue-700' :
                                    rep.state.includes('Review') ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-600';
                                return (
                                    <tr key={rep.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="p-4 font-mono text-sm text-brand-teal font-bold">{rep.id}</td>
                                        <td className="p-4 text-sm text-gray-600 font-medium">{rep.date}</td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stateColor}`}>
                                                {rep.state}
                                            </span>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <span className="flex items-center gap-1.5 text-sm text-gray-500">
                                                <Clock size={13} className="text-gray-300" />
                                                {rep.labor?.length || 0} {rep.labor?.length === 1 ? t('reports.labor_entry', 'entry') : t('reports.labor_entries_count', 'entries')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link to={`/reports/${rep.id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 text-brand-teal hover:bg-brand-teal/10 font-bold text-xs">
                                                    {t('common.open', 'Open')} →
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {manageScopesProject && (
                <ManageScopesModal
                    open={!!manageScopesProject}
                    onOpenChange={(open) => !open && setManageScopesProject(null)}
                    project={manageScopesProject}
                />
            )}


        </div>
    );
}
