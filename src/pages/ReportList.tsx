import { useEffect, useState, useMemo, useRef } from 'react';
import { FileText, Search, FileSpreadsheet, Filter, Briefcase, ChevronDown, Plus } from 'lucide-react';
import gsap from 'gsap';
import { useStore } from '../store/useStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function ReportList() {
    const { reports, subReportInstances, projects, userRole, clientId, addReport, clients, userId } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectIdFilter = searchParams.get('project');
    const [filter, setFilter] = useState<'All' | 'Draft' | 'Pending Manager Review' | 'Pending Customer Review' | 'Approved' | 'Closed' | 'Overdue'>('All');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Daily' | 'Form'>('All');
    const [projectFilter, setProjectFilter] = useState<string>(projectIdFilter || 'All');
    const [search, setSearch] = useState('');

    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [projectSearchDropdown, setProjectSearchDropdown] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
    const [newReportProject, setNewReportProject] = useState('');
    const [newReportDate, setNewReportDate] = useState(new Date().toISOString().split('T')[0]);

    const handleCreateReport = () => {
        if (!newReportProject) return;
        const selectedProj = projects.find(p => p.id === newReportProject);
        if (!selectedProj) return;

        // H-03: Prevent duplicate reports for same project + date
        const reportDate = newReportDate || new Date().toISOString().split('T')[0];
        const duplicate = reports.find(r => r.projectId === newReportProject && r.date === reportDate);
        if (duplicate) {
            if (window.confirm(`A report already exists for ${selectedProj.name} on ${reportDate}. Open it instead of creating a new one?`)) {
                navigate(`/reports/${duplicate.id}`);
            }
            setIsCreateReportOpen(false);
            return;
        }

        // M-06: Collision-safe ID using timestamp + random suffix
        const reportId = `REP-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date().toISOString();
        const newRep = {
            id: reportId,
            projectId: selectedProj.id,
            projectName: selectedProj.name,
            clientId: selectedProj.clientId,
            date: reportDate,
            state: 'Draft' as const,
            weather: { temp: 0, condition: 'Unknown' },
            equipment: [],
            customSections: [],
            comments: [],
            notes: '',
            // H-01: Originator trace
            createdBy: userId,
            createdAt: now,
            updatedBy: userId,
            updatedAt: now,
        };
        addReport(newRep);
        setIsCreateReportOpen(false);
        setNewReportProject('');
        setNewReportDate(new Date().toISOString().split('T')[0]);
        navigate(`/reports/${reportId}`);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const today = new Date().toISOString().split('T')[0];

    // Combine Daily Reports and Sub-Reports into a uniform list for display
    const combinedReports = useMemo(() => {
        const unified: any[] = [];
        
        // Add Daily Reports
        reports.forEach(r => {
            const isOverdue = r.date < today && r.state !== 'Approved' && r.state !== 'Closed';
            unified.push({
                type: 'Daily',
                id: r.id,
                projectId: r.projectId,
                clientId: r.clientId,
                projectName: r.projectName,
                date: r.date,
                state: r.state,
                isOverdue
            });
        });

        // Add Sub-Reports
        subReportInstances.forEach(sr => {
            const project = projects.find(p => p.id === sr.projectId);
            const date = sr.createdAt.split('T')[0];
            const isOverdue = date < today && sr.state !== 'Approved' && sr.state !== 'Closed';
            unified.push({
                type: 'Form',
                id: sr.id,
                projectId: sr.projectId,
                clientId: project?.clientId,
                projectName: `${sr.templateName} - ${project?.name || 'Unknown Project'}`,
                date,
                state: sr.state,
                isOverdue
            });
        });

        return unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reports, subReportInstances, projects, today]);


    useEffect(() => {
        gsap.fromTo(
            '.report-item',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
        );
    }, [combinedReports, filter, search]);

    const visibleReports = combinedReports.filter((r) => {
        if (projectFilter !== 'All' && r.projectId !== projectFilter) return false;
        if (typeFilter !== 'All' && r.type !== typeFilter) return false;
        if (userRole === 'Customer') {
            return r.clientId === clientId && ['Approved', 'Closed', 'Pending Customer Review'].includes(r.state);
        }
        if (userRole === 'Tech') {
            return false;
        }
        return true; 
    }).filter((r) => {
        if (filter === 'Overdue') return r.isOverdue;
        if (filter !== 'All' && r.state !== filter) return false;
        if (search && !r.projectName.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark mb-1 text-glow">Reports Database</h1>
                    <p className="text-gray-500">Manage all site documentation, daily logs, and technical forms.</p>
                </div>
                {['Manager', 'Supervisor', 'Tech'].includes(userRole) && (
                    <Dialog open={isCreateReportOpen} onOpenChange={setIsCreateReportOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-bold shadow-soft h-11 px-6 rounded-xl">
                                <Plus size={18} /> New Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create Daily Report</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold">Select Project</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none max-h-60 cursor-pointer"
                                        value={newReportProject}
                                        onChange={(e) => setNewReportProject(e.target.value)}
                                    >
                                        <option value="" disabled>Select an active project...</option>
                                        {clients.map(client => {
                                            const clientProjects = projects.filter(p => p.clientId === client.id && p.status === 'Active');
                                            if (clientProjects.length === 0) return null;
                                            return (
                                                <optgroup key={client.id} label={client.name}>
                                                    {clientProjects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold">Report Date</label>
                                    <Input
                                        type="date"
                                        value={newReportDate}
                                        onChange={(e) => setNewReportDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateReportOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateReport} disabled={!newReportProject}>Create Report</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> Search Reports</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by ID or Project..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-[0.8] min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><FileText size={12} /> Report Type</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none"
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as any)}
                        >
                            <option value="All">All Types</option>
                            <option value="Daily">Daily Reports</option>
                            <option value="Form">Forms</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-1.5 flex-[0.8] min-w-[170px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> Status</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none"
                            value={filter}
                            onChange={e => setFilter(e.target.value as any)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Draft">Draft</option>
                            <option value="Pending Manager Review">Manager Review</option>
                            <option value="Pending Customer Review">Customer Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Closed">Closed</option>
                            <option value="Overdue">Overdue</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[200px] relative z-20" ref={dropdownRef}>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Briefcase size={12} /> Filter Project</label>
                    <div 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-brand-teal transition-all"
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    >
                        <span className="truncate">
                            {projectFilter === 'All' ? 'All Projects' : (projects.find(p => p.id === projectFilter)?.codeName || projects.find(p => p.id === projectFilter)?.name || 'All Projects')}
                        </span>
                        <ChevronDown className={`text-gray-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} size={16} />
                    </div>
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden will-change-transform animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-teal/50"
                                    value={projectSearchDropdown}
                                    onChange={(e) => setProjectSearchDropdown(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                                <div 
                                    className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${projectFilter === 'All' ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                    onClick={() => {
                                        setProjectFilter('All');
                                        setIsProjectDropdownOpen(false);
                                        setProjectSearchDropdown('');
                                    }}
                                >
                                    All Projects
                                </div>
                                {projects.filter(p => !projectSearchDropdown || ((p.name || '') + (p.codeName || '')).toLowerCase().includes(projectSearchDropdown.toLowerCase())).map(p => (
                                    <div 
                                        key={p.id}
                                        className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${projectFilter === p.id ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                        onClick={() => {
                                            setProjectFilter(p.id);
                                            setIsProjectDropdownOpen(false);
                                            setProjectSearchDropdown('');
                                        }}
                                    >
                                        {p.codeName || p.name}
                                    </div>
                                ))}
                                {projects.filter(p => !projectSearchDropdown || ((p.name || '') + (p.codeName || '')).toLowerCase().includes(projectSearchDropdown.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-gray-400 italic">No matching projects found</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleReports.map((report) => (
                    <div
                        key={report.id}
                        className={`report-item card-container cursor-pointer hover:border-brand-teal/50 hover:shadow-float transition-all group relative overflow-hidden flex flex-col h-full ${report.isOverdue ? 'border-status-error/30' : ''}`}
                        onClick={() => navigate(report.type === 'Daily' ? `/reports/${report.id}` : `/sub-reports/${report.id}`)}
                    >
                        <div className={`absolute top-0 left-0 w-1 h-full 
                            ${report.isOverdue ? 'bg-status-error' : 
                              report.state === 'Draft' ? 'bg-status-warning' :
                                report.state.includes('Review') || report.state === 'Approved' ? 'bg-brand-teal' :
                                    'bg-status-success'}`}>
                        </div>

                        <div className="flex justify-between items-start mb-4">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest
                                ${report.isOverdue ? 'bg-status-error/10 text-status-error shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                                  report.state === 'Draft' ? 'bg-status-warning/10 text-status-warning' :
                                    report.state.includes('Review') || report.state === 'Approved' ? 'bg-brand-teal/10 text-brand-teal shadow-[0_0_10px_rgba(20,184,166,0.1)]' :
                                        'bg-status-success/10 text-status-success'}`}>
                                {report.type === 'Form' ? <FileSpreadsheet size={12} /> : <FileText size={12} />}
                                {report.isOverdue ? 'OVERDUE' : (report.state === 'Pending Manager Review' ? 'Reviewing' : report.state)}
                            </span>
                            <span className="text-xs text-brand-teal font-mono font-bold bg-brand-teal/5 px-2 py-1 rounded-md">
                                {report.id}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-accent-greyDark mb-2 group-hover:text-brand-teal transition-colors line-clamp-2 leading-tight">
                            {report.projectName}
                        </h3>

                        <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium">Type</span>
                            <span className="font-bold text-accent-greyDark capitalize">{report.type}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium">Date</span>
                            <span className="font-mono font-bold text-accent-grey">{report.date}</span>
                        </div>
                    </div>
                ))}

                {visibleReports.length === 0 && (
                    <div className="col-span-full card-container py-12 text-center text-gray-500">
                        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-bold text-accent-grey">No reports found.</p>
                        <p className="text-sm">Try adjusting your filters or search terms.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
