import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import {
    MapPin, ArrowLeft, Edit2, Check, X, Users, Clock, FileText, Wrench,
    Search, AlertCircle, Plus, ExternalLink, Network, CheckCircle2, Map, Hourglass, Target
} from 'lucide-react';
import { ManageScopesModal } from '../components/project/ManageScopesModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { gsap } from 'gsap';
import { useRef } from 'react';

export default function ProjectDetail() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects, clients, personnel, reports, timesheets, updateProject, addReport, userRole, activeSubsidiary } = useStore();

    const project = projects.find(p => p.id === id);
    const client = clients.find(c => c.id === project?.clientId);
    const allProjectReports = reports.filter(r => r.projectId === id).sort((a, b) => b.date.localeCompare(a.date));
    const projectHours = Math.ceil(timesheets.filter(t => t.projectId === id).reduce((sum, t) => sum + t.hours, 0));

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
    const [editPrevailingWage, setEditPrevailingWage] = useState(false);

    const [locationError, setLocationError] = useState('');

    // Personnel picklist
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [isAddingPersonnel, setIsAddingPersonnel] = useState(false);

    // Tools
    const { tools } = useStore();
    const projectTools = tools.filter(t => t.assignedProjectId === id);
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

    const canEdit = ['Manager', 'Supervisor'].includes(userRole) || activeSubsidiary === 'MX';
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

    const assignedToThis = useMemo(() => {
        const ids = project?.assignedPersonnel || [];
        return ids.filter(id => personnel.some(p => p.id === id));
    }, [project?.assignedPersonnel, personnel]);

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
        setEditPrevailingWage(!!project.prevailingWage);
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
            prevailingWage: editPrevailingWage,
        });
        setIsEditing(false);
    };

    const tabsContentRef = useRef<HTMLDivElement>(null);

    const handleTabChange = () => {
        if (tabsContentRef.current) {
            gsap.fromTo(tabsContentRef.current, 
                { opacity: 0, y: 10 }, 
                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
            );
        }
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
        : 0; // Forced 0% to eliminate ghost progress


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

            {/* Project Header Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`h-1.5 w-full ${project.status === 'Active' ? 'bg-brand-teal' : project.status === 'On Hold' ? 'bg-amber-400' : 'bg-gray-300'}`} />

                <div className="p-6 md:p-8">
                    {!isEditing ? (
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    {client?.logo && (
                                        <div className="h-14 w-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center p-1 overflow-hidden">
                                            <img src={client.logo} alt={client.name} className="max-h-full max-w-full object-contain" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-500">{client?.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                project.status === 'Active' ? 'bg-brand-teal/5 text-brand-teal border-brand-teal/10' :
                                                project.status === 'On Hold' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-gray-50 text-gray-400 border-gray-200'
                                            }`}>
                                                {project.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-accent-greyDark mb-1 flex items-center gap-2">
                                    {project.name}
                                    {project.prevailingWage && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-600 border border-amber-400/20 shadow-sm animate-in fade-in zoom-in duration-500">
                                            <CheckCircle2 size={10} /> Prevailing Wage
                                        </span>
                                    )}
                                    {project.hasNoDefinedScope && (
                                        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{t('projects.labor_only', 'Labor Only')}</span>
                                    )}
                                </h1>


                                
                                {project.siteLeadIds && project.siteLeadIds.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-teal/5 text-brand-teal border border-brand-teal/10 shadow-sm">
                                            <Target size={12} />
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
                                    {project.projectSize && <span className="flex items-center gap-1"><Map size={14} /> {project.projectSize}</span>}
                                    {project.systemType && <span className="flex items-center gap-1"><Target size={14} /> {project.systemType}</span>}
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
                                <div className="sm:col-span-2 flex items-center gap-2 p-3 bg-brand-teal/5 rounded-2xl border border-brand-teal/10">
                                    <Checkbox 
                                        id="dp-prevailing-wage" 
                                        checked={editPrevailingWage}
                                        onCheckedChange={(checked) => setEditPrevailingWage(!!checked)}
                                    />
                                    <div className="grid gap-1 leading-none">
                                        <Label htmlFor="dp-prevailing-wage" className="cursor-pointer font-bold text-accent-greyDark flex items-center gap-1.5">
                                            Prevailing Wage Project
                                        </Label>
                                        <p className="text-xs text-gray-500">
                                            Updates all assigned personnel to match this status.
                                        </p>
                                    </div>
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

            {/* Dashboard Stats Bar */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 md:p-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="grid grid-cols-2 lg:flex lg:items-center gap-x-8 gap-y-6 flex-1">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 px-0.5">{t('projects.stats.progress', 'Progress')}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xl md:text-2xl font-black text-brand-teal">{overallProgress}%</span>
                                {!project.hasNoDefinedScope && (
                                    <div className="w-16 md:w-24 bg-gray-100 rounded-full h-1.5 md:h-2 hidden sm:block">
                                        <div
                                            className="bg-brand-teal h-full rounded-full transition-all duration-700"
                                            style={{ width: `${overallProgress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-8 w-px bg-gray-100 hidden lg:block" />

                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 px-0.5">{t('projects.stats.hours', 'Hours')}</span>
                            <span className="text-xl md:text-2xl font-black text-accent-greyDark">{projectHours}</span>
                        </div>

                        <div className="h-8 w-px bg-gray-100 hidden lg:block" />

                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 px-0.5">{t('projects.stats.reports', 'Reports')}</span>
                            <span className="text-xl md:text-2xl font-black text-brand-teal">{projectReports.length}</span>
                        </div>
                        
                        {!project.hasNoDefinedScope && (
                            <>
                                <div className="h-8 w-px bg-gray-100 hidden lg:block" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 px-0.5">{t('projects.stats.activities', 'Activities')}</span>
                                    <span className="text-xl md:text-2xl font-black text-accent-greyDark">{completedActs}/{allActs.length}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {projectOccurrences.length > 0 && (
                        <div className="flex items-center gap-3 bg-status-warning/5 border border-status-warning/20 px-4 py-2.5 rounded-2xl animate-pulse">
                            <AlertCircle size={20} className="text-status-warning" />
                            <div>
                                <p className="text-[10px] font-bold text-status-warning uppercase tracking-tight leading-none mb-0.5">{projectOccurrences.length} Active Issues</p>
                                <p className="text-xs font-black text-status-warning/80 leading-none">{totalLostTimeHours} hr Lost</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Tabbed Content Area */}
            <Tabs defaultValue="reports" onValueChange={handleTabChange} className="space-y-6">
                <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                    <TabsList className="bg-white border border-gray-100 p-1 rounded-2xl h-11 shadow-sm w-max md:w-auto">
                        <TabsTrigger 
                            value="reports" 
                            className="rounded-xl px-4 md:px-6 data-[state=active]:bg-brand-teal data-[state=active]:text-white font-bold text-[10px] md:text-xs transition-all duration-300"
                        >
                            {t('reports.title', 'Reports Feed')}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="resources" 
                            className="rounded-xl px-4 md:px-6 data-[state=active]:bg-brand-teal data-[state=active]:text-white font-bold text-[10px] md:text-xs transition-all duration-300"
                        >
                            {t('projects.resources', 'Team & Equipment')}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="wbs" 
                            className="rounded-xl px-4 md:px-6 data-[state=active]:bg-brand-teal data-[state=active]:text-white font-bold text-[10px] md:text-xs transition-all duration-300"
                        >
                            {t('projects.scope_wbs', 'Scope & WBS')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div ref={tabsContentRef}>
                    <TabsContent value="reports" className="space-y-6 mt-0">
                        {projectOccurrences.length > 0 && (
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-orange-50/10">
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

                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-gray-50">
                                <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                                    <FileText size={18} className="text-brand-teal" /> {t('reports.title', 'Reports')}
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
                                    {activeSubsidiary !== 'MX' && (
                                        <Button size="sm" onClick={handleCreateReport} className="bg-brand-teal hover:bg-brand-teal/90 text-white text-xs gap-1.5">
                                            <Plus size={14} /> {t('reports.new_report', 'New Report')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {projectReports.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">
                                    <FileText size={40} className="mx-auto mb-3 text-gray-200" />
                                    <p className="font-medium">No reports yet</p>
                                    <p className="text-sm mt-1">Create the first report for this project.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('reports.table.id', 'Report ID')}</th>
                                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.date')}</th>
                                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('common.status')}</th>
                                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden md:table-cell">{t('reports.table.labor_entries', 'Labor Entries')}</th>
                                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider text-right">{t('common.actions', 'Actions')}</th>
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
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="resources" className="space-y-6 mt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
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
                                            className="pl-9 h-9 text-sm bg-gray-50 border-gray-100 rounded-xl"
                                            value={personnelSearch}
                                            onChange={e => setPersonnelSearch(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5 min-h-[100px]">
                                    {(isAddingPersonnel ? availablePersonnel : personnel.filter((p: any) => assignedToThis.includes(p.id))).map((person: any) => {
                                        const isAssigned = assignedToThis.includes(person.id);
                                        const isConflict = assignedElsewhere.has(person.id) && !isAssigned;
                                        return (
                                            <div
                                                key={person.id}
                                                onClick={() => canEditPersonnel && isAddingPersonnel && !isConflict && togglePersonnel(person.id)}
                                                className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 ${
                                                    isAssigned
                                                        ? 'bg-brand-teal/5 border-brand-teal/20 shadow-sm'
                                                        : isConflict
                                                        ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                                                        : canEditPersonnel && isAddingPersonnel ? 'bg-white border-gray-100 hover:border-brand-teal/30 hover:bg-brand-teal/5 cursor-pointer hover:shadow-md' : 'bg-gray-50 border-gray-100'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {/* Square Avatar (Matches Personnel.tsx) */}
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm overflow-hidden ${
                                                        isAssigned ? 'bg-brand-teal text-white' : 'bg-brand-teal/5 text-brand-teal'
                                                    }`}>
                                                        {person.image ? (
                                                            <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            person.name.charAt(0)
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-accent-greyDark truncate leading-tight">{person.name}</p>
                                                            {project.siteLeadIds?.includes(person.id) && (
                                                                <span className="flex items-center gap-1 text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                                    Lead
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 mt-0.5 truncate">{person.position}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {canEditPersonnel && (
                                                        isAddingPersonnel ? (
                                                            isAssigned
                                                                ? <Check size={18} className="text-brand-teal animate-in zoom-in duration-200" />
                                                                : isConflict
                                                                ? <span className="text-[10px] text-gray-400 font-bold uppercase bg-gray-100 px-2 py-1 rounded-lg">Busy</span>
                                                                : <Plus size={18} className="text-gray-300 group-hover:text-brand-teal" />
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); togglePersonnel(person.id); }}
                                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all hover:scale-110"
                                                                title="Unassign"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {availablePersonnel.length === 0 && isAddingPersonnel && (
                                        <div className="py-10 text-center flex flex-col items-center justify-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                                            <Search size={24} className="text-gray-200 mb-2" />
                                            <p className="text-sm text-gray-400 font-medium italic">No personnel found.</p>
                                        </div>
                                    )}
                                    {assignedToThis.length === 0 && !isAddingPersonnel && (
                                        <div className="py-10 text-center flex flex-col items-center justify-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                                            <Users size={24} className="text-gray-200 mb-2" />
                                            <p className="text-sm text-gray-400 font-medium italic">No personnel assigned.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                                        <Wrench size={18} className="text-brand-teal" /> {t('projects.assigned_tools', 'Assigned Tools')}
                                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{projectTools.length}</span>
                                    </h2>
                                    {canEdit && (
                                        <div className="flex items-center gap-2">
                                            {/* Inventory/Add buttons reaching Tool profile is handled in the Tools module */}
                                        </div>
                                    )}
                                </div>
                                
                                {projectTools.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        <p className="text-sm font-medium text-gray-500">{t('projects.no_tools', 'No tools assigned.')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="wbs" className="mt-0">
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                                    <Network size={18} className="text-brand-teal" /> {t('projects.scope_wbs', 'Scopes & WBS')}
                                    <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{project.scopes?.length || 0}</span>
                                </h2>
                                {canEdit && !project.hasNoDefinedScope && (
                                    <Button 
                                        size="sm" 
                                        className="bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white transition-colors text-xs font-bold gap-1.5"
                                        onClick={() => setManageScopesProject(project)}
                                    >
                                        <Edit2 size={13} /> {t('projects.manage_wbs', 'Manage WBS')}
                                    </Button>
                                )}
                            </div>

                            {project.hasNoDefinedScope ? (
                                <div className="py-12 text-center bg-amber-50/30 rounded-[2rem] border border-dashed border-amber-200">
                                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-bold text-amber-700">{t('projects.labor_only_project', 'Labor-Only Project')}</p>
                                    <p className="text-sm text-amber-600/70 mt-1 max-w-xs mx-auto">{t('projects.labor_only_desc', 'Metrics and WBS tracking are disabled for this discipline.')}</p>
                                </div>
                            ) : !project.scopes || project.scopes.length === 0 ? (
                                <div className="py-12 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                                    <p className="text-sm text-gray-500 mb-4">{t('projects.no_wbs', 'No work breakdown structure defined.')}</p>
                                    {canEdit && (
                                        <Button size="sm" variant="outline" className="text-xs border-brand-teal/30 text-brand-teal" onClick={() => setManageScopesProject(project)}>
                                            {t('projects.create_first_scope', 'Create First Scope')}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {project.scopes.map(scope => {
                                        const isCompleted = scope.completedDate || (scope.activities.length > 0 && scope.activities.every(a => a.progress === 100 || a.status === 'Completed'));
                                        const scopeProgress = scope.activities.length > 0 
                                            ? Math.round(scope.activities.reduce((sum, a) => sum + a.progress, 0) / scope.activities.length)
                                            : 0;
                                        return (
                                            <div key={scope.id} className={`p-5 rounded-[2rem] border relative overflow-hidden transition-all hover:shadow-md ${isCompleted ? 'bg-status-success/5 border-status-success/20' : 'bg-white border-gray-100'}`}>
                                                {isCompleted && (
                                                    <div className="absolute top-0 right-0 p-3 text-status-success">
                                                        <CheckCircle2 size={24} className="opacity-20" />
                                                    </div>
                                                )}
                                                <h3 className="font-bold text-accent-greyDark text-sm pr-8 mb-4 min-h-[2.5rem] line-clamp-2">{scope.name}</h3>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('projects.progress', 'Progress')}</span>
                                                        <span className={`text-[10px] font-black ${isCompleted ? 'text-status-success' : 'text-brand-teal'}`}>{scopeProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-700 ${isCompleted ? 'bg-status-success' : 'bg-brand-teal'}`} 
                                                            style={{ width: `${scopeProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="pt-2 flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCompleted ? 'bg-status-success/10 text-status-success' : 'bg-gray-100 text-gray-500'}`}>
                                                            {scope.activities.length} {t('projects.activities', 'Activities')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </div>
            </Tabs>

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
