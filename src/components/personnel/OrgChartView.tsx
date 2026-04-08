import { useState } from 'react';
import { useStore, Personnel } from '../../store/useStore';
import { User, Briefcase, Filter, ChevronDown, Check, UserMinus } from 'lucide-react';

export default function OrgChartView() {
    const { personnel, projects, updateProject } = useStore();
    const [showInactive, setShowInactive] = useState(false);

    // Initial Filter: Exclude Managers from field deployments and the bench
    const activePersonnel = personnel.filter(p => (showInactive ? true : p.status !== 'Inactive') && p.appRole !== 'Manager');

    const assignedPersonnelIds = new Set(projects.flatMap(p => p.assignedPersonnel || []));
    const benchedPersonnel = activePersonnel.filter(p => !assignedPersonnelIds.has(p.id));

    const activeProjects = projects.filter(p => p.status === 'Active' || p.status === 'On Hold');

    const handleAssignToProject = (personId: string, projectId: string | null) => {
        // First remove from all projects
        projects.forEach(p => {
            if ((p.assignedPersonnel || []).includes(personId)) {
                updateProject(p.id, { assignedPersonnel: p.assignedPersonnel!.filter(id => id !== personId) });
            }
        });
        
        // Add to new project if applicable
        if (projectId) {
            const tempProject = projects.find(p => p.id === projectId);
            if (tempProject) {
                updateProject(projectId, { assignedPersonnel: [...(tempProject.assignedPersonnel || []), personId] });
            }
        }
    };

    const renderPersonnelCard = (member: Personnel, currentProjectId: string | null, isLead: boolean = false) => (
        <div key={member.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-brand-teal/30 group">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden shrink-0">
                    {member.image ? <img src={member.image} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-accent-greyDark leading-none truncate">{member.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${member.appRole === 'Manager' ? 'bg-brand-teal text-white' : member.appRole === 'Supervisor' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                            {member.appRole}
                        </span>
                        {isLead && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/20 uppercase tracking-wider">
                                L
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
                    title="Move to Bench"
                >
                    <UserMinus size={14} />
                </button>
            ) : (
                <div className="relative">
                    <select 
                        className="appearance-none bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-600 rounded-lg px-2 py-1 pr-6 focus:ring-2 focus:ring-brand-teal outline-none cursor-pointer hover:bg-gray-100 uppercase tracking-wider max-w-[120px] truncate"
                        value="bench"
                        onChange={(e) => handleAssignToProject(member.id, e.target.value === 'bench' ? null : e.target.value)}
                    >
                        <option value="bench">Assign to...</option>
                        <optgroup label="Active Projects">
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.codeName || p.name}</option>
                            ))}
                        </optgroup>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm h-10 w-fit ml-auto">
                    <Filter size={14} className="text-gray-400" />
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showInactive} 
                            onChange={() => setShowInactive(!showInactive)}
                            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                        />
                        Show Inactive Ops
                    </label>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Active Deployments (Projects) */}
                <div className="bg-surface-alt p-6 rounded-3xl border border-gray-100">
                    <div className="flex items-center gap-3 mb-6 outline-none">
                        <div className="bg-brand-teal p-2 rounded-xl text-white shadow-soft">
                            <Briefcase size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-accent-greyDark">Active Deployments</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {activeProjects.map(project => {
                            const teamIds = project.assignedPersonnel || [];
                            const team = activePersonnel.filter(p => teamIds.includes(p.id));
                            
                            // Sort logic: Leads first, then Supervisors, then Techs
                            team.sort((a, b) => {
                                const isLeadA = project.siteLeadIds?.includes(a.id) ? 1 : 0;
                                const isLeadB = project.siteLeadIds?.includes(b.id) ? 1 : 0;
                                if (isLeadA !== isLeadB) return isLeadB - isLeadA;
                                
                                const roleWeight = { 'Manager': 3, 'Supervisor': 2, 'Tech': 1, 'Customer': 0 };
                                const weightA = roleWeight[a.appRole || 'Tech'] || 0;
                                const weightB = roleWeight[b.appRole || 'Tech'] || 0;
                                return weightB - weightA;
                            });
                            
                            return (
                                <div key={project.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-accent-greyDark text-base leading-tight">{project.name}</h3>
                                            <p className="text-[10px] font-mono text-brand-teal mt-1 font-bold">{project.codeName || project.id}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white ${
                                                project.status === 'Active' ? 'text-emerald-600 border-emerald-200' :
                                                project.status === 'On Hold' ? 'text-amber-600 border-amber-200' :
                                                'text-gray-500 border-gray-200'
                                            }`}>
                                            {project.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Team</p>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="appearance-none bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20 transition-colors border border-transparent text-[10px] font-bold rounded-lg px-2 py-1 pr-6 outline-none cursor-pointer uppercase tracking-widest bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%230d9488%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_4px_center]"
                                                    value=""
                                                    onChange={(e) => {
                                                        if (e.target.value) handleAssignToProject(e.target.value, project.id);
                                                    }}
                                                >
                                                    <option value="" disabled>+ Add Staff</option>
                                                    {benchedPersonnel.length > 0 ? (
                                                        benchedPersonnel.map(member => (
                                                            <option key={member.id} value={member.id}>{member.name}</option>
                                                        ))
                                                    ) : (
                                                        <option value="" disabled>No Unassigned Staff</option>
                                                    )}
                                                </select>
                                                <span className="text-xs font-bold text-accent-greyDark bg-gray-100 px-2 py-0.5 rounded-md min-w-[24px] text-center">{team.length}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                            {team.length > 0 ? (
                                                team.map(member => renderPersonnelCard(member, project.id, project.siteLeadIds?.includes(member.id)))
                                            ) : (
                                                <div className="py-6 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                                    <UserMinus size={20} className="mb-2 opacity-50" />
                                                    <p className="text-xs font-medium">No personnel assigned</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Unassigned */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-soft relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-accent-greyDark">Unassigned</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">Available personnel currently unassigned to active field operations.</p>
                        </div>
                        <span className="ml-auto bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold border border-amber-200">
                            {benchedPersonnel.length} Available
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {benchedPersonnel.length > 0 ? (
                            benchedPersonnel.map(member => renderPersonnelCard(member, null))
                        ) : (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                <Check size={32} className="mb-2 text-emerald-400" />
                                <p className="text-sm font-bold text-accent-greyDark">No Unassigned Personnel</p>
                                <p className="text-xs mt-1">Everyone is currently deployed to active projects.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
