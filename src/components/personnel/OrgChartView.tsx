import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, Personnel } from '../../store/useStore';
import { User, ChevronRight, UserMinus, Check, Users, Briefcase, Plus } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export default function OrgChartView() {
    const { personnel, projects, updateProject, userId, clients } = useStore();

    const activeProjects = projects.filter(p => p.status === 'Active');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        activeProjects.length > 0 ? activeProjects[0].id : null
    );
    
    const OFFICE_MANAGERS = ['ANDRES PROVERO', 'FERNANDO ASENSIO', 'JESUS REINA', 'JUAN MARIA'];

    // Only exclude inactive personnel and the current user from assignments.
    // Also exclude high-level office managers who should never be on the bench/projects.
    const fieldPersonnel = personnel.filter(p => 
        p.status !== 'Inactive' && 
        p.id !== userId &&
        !OFFICE_MANAGERS.includes(p.name.toUpperCase())
    );

    const assignedPersonnelIds = new Set(projects.flatMap(p => p.assignedPersonnel || []));
    // Bench = active, assigned to no project, and NOT bench-exempt (e.g. Andres â€” occasional field visits)
    const benchedPersonnel = fieldPersonnel.filter(p => !assignedPersonnelIds.has(p.id) && !p.benchExempt);
    // Staff available to add to a specific project: unassigned OR bench-exempt (but not already on THIS project)
    const getAddableStaff = (project: typeof activeProjects[0]) => {
        const currentIds = new Set(project.assignedPersonnel || []);
        return fieldPersonnel.filter(p =>
            !currentIds.has(p.id) &&
            (!assignedPersonnelIds.has(p.id) || p.benchExempt)
        );
    };

    const selectedProject = activeProjects.find(p => p.id === selectedProjectId) ?? null;

    const handleAssignToProject = (personId: string, projectId: string | null) => {
        // Remove from all projects first
        projects.forEach(p => {
            if ((p.assignedPersonnel || []).includes(personId)) {
                updateProject(p.id, { assignedPersonnel: p.assignedPersonnel!.filter(id => id !== personId) });
            }
        });
        if (projectId) {
            const target = projects.find(p => p.id === projectId);
            if (target) {
                updateProject(projectId, { assignedPersonnel: [...(target.assignedPersonnel || []), personId] });
            }
        }
    };

    const renderPersonnelCard = (member: Personnel, currentProjectId: string | null, isLead: boolean = false) => {
        // Limit name to ~22 characters for UI consistency as requested
        const displayName = member.name.length > 22 ? member.name.substring(0, 20) + '...' : member.name;

        return (
            <div key={member.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-brand-teal/30 group h-[64px]">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden shrink-0">
                        {member.image ? <img src={member.image} className="w-full h-full object-cover" alt={member.name} /> : member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-bold text-accent-greyDark leading-none truncate flex-1" title={member.name}>{displayName}</p>
                            {member.prevailingWage && (
                                <span className="text-[10px] font-black text-emerald-600 shrink-0" title="Prevailing Wage">P</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-hidden">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${member.appRole === 'Supervisor' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {member.appRole}
                            </span>
                            {isLead && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/20 uppercase tracking-wider shrink-0">
                                    Lead
                                </span>
                            )}
                            <p className="text-[10px] text-gray-400 font-semibold uppercase truncate">{member.position}</p>
                        </div>
                    </div>
                </div>

            {currentProjectId ? (
                <button
                    onClick={() => handleAssignToProject(member.id, null)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Move to Unassigned"
                >
                    <UserMinus size={14} />
                </button>
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button 
                            className="p-1.5 bg-gray-50 border border-gray-100 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-all outline-none"
                            title="Assign to Project"
                        >
                            <Plus size={14} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-gray-100">
                        <DropdownMenuLabel className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">
                            Assign to Project
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {activeProjects.length > 0 ? (
                            activeProjects.map(p => (
                                <DropdownMenuItem 
                                    key={p.id} 
                                    onClick={() => handleAssignToProject(member.id, p.id)}
                                    className="cursor-pointer gap-2 py-2"
                                >
                                    <div className="w-6 h-6 rounded bg-brand-teal/10 flex items-center justify-center shrink-0">
                                        <Briefcase size={12} className="text-brand-teal" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">{p.name}</p>
                                        <p className="text-[9px] text-gray-400 font-mono">{p.codeName || p.id}</p>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <div className="px-2 py-3 text-center text-xs text-gray-400 italic">
                                No active projects
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            </div>
        );
    };

    // Get team for selected project, sorted by lead > supervisor > tech
    const getTeamForProject = (project: typeof activeProjects[0]) => {
        const teamIds = project.assignedPersonnel || [];
        const team = fieldPersonnel.filter(p => teamIds.includes(p.id));
        team.sort((a, b) => {
            const isLeadA = project.siteLeadIds?.includes(a.id) ? 1 : 0;
            const isLeadB = project.siteLeadIds?.includes(b.id) ? 1 : 0;
            if (isLeadA !== isLeadB) return isLeadB - isLeadA;
            const roleWeight: Record<string, number> = { 'HR': 4, 'Manager': 3, 'Supervisor': 2, 'Tech': 1, 'Customer': 0 };
            return (roleWeight[b.appRole || 'Tech'] || 0) - (roleWeight[a.appRole || 'Tech'] || 0);
        });
        return team;
    };

    return (
        <div className="flex flex-col gap-6" style={{ minHeight: '600px' }}>
            {/* Main split layout */}
            <div className="flex gap-4" style={{ minHeight: '480px' }}>
                {/* LEFT: Project List */}
                <div className="w-64 shrink-0 flex flex-col gap-1 bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-y-auto">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">Active Projects Â· {activeProjects.length}</p>
                    {activeProjects.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">No active projects</div>
                    )}
                    {activeProjects.map(project => {
                        const teamCount = (project.assignedPersonnel || []).length;
                        const isSelected = selectedProjectId === project.id;
                        return (
                            <button
                                key={project.id}
                                onClick={() => setSelectedProjectId(project.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                                    isSelected
                                        ? 'bg-brand-teal text-white shadow-md'
                                        : 'hover:bg-white hover:shadow-sm text-accent-greyDark'
                                }`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-brand-teal/10'}`}>
                                    {(() => {
                                        const client = clients.find(c => c.id === project.clientId);
                                        return client?.logo ? (
                                            <img src={client.logo} alt="" className={`w-full h-full object-cover ${isSelected ? 'brightness-0 invert' : ''}`} />
                                        ) : (
                                            <img src="/latnovva-O-logo.png" alt="" className={`w-5 h-5 object-contain ${isSelected ? 'brightness-0 invert' : ''}`} />
                                        );
                                    })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-accent-greyDark'}`}>
                                        {project.name}
                                    </p>
                                    <p className={`text-[9px] font-semibold mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                        {project.status.toUpperCase()}
                                    </p>
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    {teamCount}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* RIGHT: Project Detail Panel */}
                <div className="flex-1 min-w-0">
                    {selectedProject ? (() => {
                        const team = getTeamForProject(selectedProject);
                        return (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                                {/* Project Header */}
                                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-brand-teal/5 to-transparent flex justify-between items-start shrink-0">
                                    <div>
                                        <Link to={`/projects/${selectedProject.id}`} className="flex items-center gap-2 mb-1 group/title cursor-pointer">
                                            <div className="bg-white border border-gray-100 p-1 rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm group-hover/title:border-brand-teal/30 transition-all">
                                                {(() => {
                                                    const client = clients.find(c => c.id === selectedProject.clientId);
                                                    return client?.logo ? (
                                                        <img src={client.logo} alt="" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <img src="/latnovva-O-logo.png" alt="" className="w-6 h-6 object-contain" />
                                                    );
                                                })()}
                                            </div>
                                            <h2 className="text-lg font-bold text-accent-greyDark leading-tight group-hover/title:text-brand-teal transition-colors flex items-center gap-2">
                                                {selectedProject.name}
                                                <Briefcase size={14} className="opacity-0 group-hover/title:opacity-100 transition-opacity" />
                                            </h2>
                                        </Link>
                                        <p className="text-[10px] font-mono text-brand-teal font-bold ml-12">{selectedProject.codeName || selectedProject.id}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border bg-white ${
                                            selectedProject.status === 'Active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                                            selectedProject.status === 'On Hold' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                                            'text-gray-500 border-gray-200'
                                        }`}>
                                            {selectedProject.status.toUpperCase()}
                                        </span>
                                        {/* Add staff from bench */}
                                        <div className="relative">
                                            <select
                                                className="appearance-none bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20 transition-colors border border-transparent text-[10px] font-bold rounded-lg px-3 py-1.5 pr-7 outline-none cursor-pointer uppercase tracking-widest"
                                                value=""
                                                onChange={(e) => {
                                                    if (e.target.value) handleAssignToProject(e.target.value, selectedProject.id);
                                                }}
                                            >
                                                <option value="" disabled>+ Add Staff</option>

                                                {(() => {

                                                    const addable = getAddableStaff(selectedProject);

                                                    return addable.length > 0 ? (

                                                        addable.map(member => (

                                                            <option key={member.id} value={member.id}>{member.name}</option>

                                                        ))

                                                    ) : (

                                                        <option value="" disabled>No Available Staff</option>

                                                    );

                                                })()}
                                            </select>
                                            <ChevronRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-teal pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Team Body */}
                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Users size={14} className="text-gray-400" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Assigned Team Â· {team.length}
                                        </p>
                                    </div>
                                    {team.length > 0 ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                            {team.map(member => renderPersonnelCard(member, selectedProject.id, selectedProject.siteLeadIds?.includes(member.id)))}
                                        </div>
                                    ) : (
                                        <div className="h-40 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                            <UserMinus size={24} className="mb-2 opacity-50" />
                                            <p className="text-sm font-medium">No personnel assigned</p>
                                            <p className="text-xs mt-1">Use "+ Add Staff" above to deploy team members.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <Briefcase size={32} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">Select a project</p>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM: Unassigned (Bench) */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-soft relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />
                <div className="p-5 pl-7">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                            <User size={18} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base font-bold text-accent-greyDark">Unassigned</h2>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Available personnel not currently deployed.</p>
                        </div>
                        <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold border border-amber-200">
                            {benchedPersonnel.length} Available
                        </span>
                    </div>

                    {benchedPersonnel.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {benchedPersonnel.map(member => renderPersonnelCard(member, null))}
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <Check size={28} className="mb-2 text-emerald-400" />
                            <p className="text-sm font-bold text-accent-greyDark">Everyone is deployed</p>
                            <p className="text-xs mt-1">No unassigned personnel at the moment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

