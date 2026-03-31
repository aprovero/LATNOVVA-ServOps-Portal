import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
    MapPin, ArrowLeft, Edit2, Check, X, Users, Clock, FileText,
    BarChart2, Search, AlertCircle, Plus, ExternalLink, Network, CheckCircle2
} from 'lucide-react';
import { ManageScopesModal } from '../components/project/ManageScopesModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects, clients, personnel, reports, timesheets, updateProject, userRole } = useStore();

    const project = projects.find(p => p.id === id);
    const client = clients.find(c => c.id === project?.clientId);
    const projectReports = reports.filter(r => r.projectId === id).sort((a, b) => b.date.localeCompare(a.date));
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

    // Personnel picklist
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [isAddingPersonnel, setIsAddingPersonnel] = useState(false);

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
        });
        setIsEditing(false);
    };

    const togglePersonnel = (persId: string) => {
        if (!project) return;
        const current = project.assignedPersonnel || [];
        const updated = current.includes(persId)
            ? current.filter(p => p !== persId)
            : [...current, persId];
        updateProject(project.id, { assignedPersonnel: updated });
    };

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                <AlertCircle size={48} className="text-gray-200" />
                <p className="text-lg font-medium">Project not found.</p>
                <Button variant="outline" onClick={() => navigate('/projects')}>Back to Projects</Button>
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

    return (
        <div className="space-y-6 pb-16">
            {/* Back */}
            <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-brand-teal transition-colors"
            >
                <ArrowLeft size={16} /> Back to Projects
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
                                <h1 className="text-2xl md:text-3xl font-bold text-accent-greyDark mb-1">{project.name}</h1>
                                {project.codeName && (
                                    <p className="text-sm font-mono font-bold text-brand-teal mb-3">{project.codeName}</p>
                                )}
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 font-medium">
                                    {project.location && (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin size={14} className="text-brand-teal" /> {project.location}
                                            <a href={`https://maps.google.com/?q=${encodeURIComponent(project.location)}`} target="_blank" rel="noreferrer" className="text-brand-teal hover:underline ml-1"><ExternalLink size={12} /></a>
                                        </span>
                                    )}
                                    {project.projectSize && <span>📐 {project.projectSize}</span>}
                                    {project.systemType && <span>⚡ {project.systemType}</span>}
                                    <span className="font-mono text-gray-400">{project.id}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-3 pt-3 border-t border-gray-100/60">
                                    {project.epc && <span className="text-gray-600"><span className="text-gray-400">EPC:</span> font-semibold {project.epc}</span>}
                                    {project.oAndM && <span className="text-gray-600"><span className="text-gray-400">O&M:</span> font-semibold {project.oAndM}</span>}
                                    {project.pointOfContact && <span className="text-gray-600"><span className="text-gray-400">PoC:</span> font-semibold {project.pointOfContact}</span>}
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
                                    <Input id="dp-location" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="lat,lng or address" />
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
                                    <Label htmlFor="dp-poc">Point of Contact</Label>
                                    <Input id="dp-poc" value={editPointOfContact} onChange={e => setEditPointOfContact(e.target.value)} placeholder="Name, Phone, Email..." />
                                </div>
                                <div className="sm:col-span-2 grid gap-1.5">
                                    <Label htmlFor="dp-notes">Notes</Label>
                                    <Input id="dp-notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="General project notes" />
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
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2"><BarChart2 size={18} className="text-brand-teal" /> Project Stats</h2>
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
                </div>

                {/* Personnel Picklist */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                            <Users size={18} className="text-brand-teal" /> {isAddingPersonnel ? 'Add Personnel' : 'Assigned Personnel'}
                            <span className="text-xs bg-brand-teal/10 text-brand-teal font-bold px-2 py-0.5 rounded-full">{assignedToThis.length}</span>
                        </h2>
                        {canEditPersonnel && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`text-xs h-7 border-brand-teal/20 hover:border-brand-teal text-brand-teal transition-all ${isAddingPersonnel ? 'bg-brand-teal/10' : ''}`}
                                onClick={() => setIsAddingPersonnel(!isAddingPersonnel)}
                            >
                                {isAddingPersonnel ? 'Done' : '+ Add Personnel'}
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
                        {(isAddingPersonnel ? availablePersonnel : personnel.filter(p => assignedToThis.includes(p.id))).map(person => {
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
                                            {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-accent-greyDark leading-tight">{person.name}</p>
                                            <p className="text-xs text-gray-500">{person.position}</p>
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

            {/* ── Scopes & WBS ────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                        <Network size={18} className="text-brand-teal" /> Scopes & WBS
                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{project.scopes?.length || 0}</span>
                    </h2>
                    {canEdit && (
                        <Button 
                            size="sm" 
                            className="bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white transition-colors text-xs font-bold gap-1.5"
                            onClick={() => setManageScopesProject(project)}
                        >
                            <Edit2 size={13} /> Manage WBS
                        </Button>
                    )}
                </div>

                {!project.scopes || project.scopes.length === 0 ? (
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

            {/* ── Reports Table ───────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-50">
                    <h2 className="text-base font-bold text-accent-greyDark flex items-center gap-2">
                        <FileText size={18} className="text-brand-teal" /> Reports
                        <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{projectReports.length}</span>
                    </h2>
                    <Link to="/reports">
                        <Button size="sm" className="bg-brand-teal hover:bg-brand-teal/90 text-white text-xs gap-1.5">
                            <Plus size={14} /> New Report
                        </Button>
                    </Link>
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
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">Report ID</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">State</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden md:table-cell">Labor Entries</th>
                                <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider text-right">Action</th>
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
                                                {rep.labor?.length || 0} entr{rep.labor?.length === 1 ? 'y' : 'ies'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link to={`/reports/${rep.id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 text-brand-teal hover:bg-brand-teal/10 font-bold text-xs">
                                                    Open →
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
