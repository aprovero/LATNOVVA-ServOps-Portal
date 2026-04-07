import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import gsap from 'gsap';
import { FolderGit2, Clock, Activity as ActivityIcon, MapPin, Map, Camera, AlertCircle, Search, Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Project, Client } from '../store/useStore';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { KPIRow } from '../components/dashboard/KPIRow';
import { getRegionName } from '../lib/locationMapper';

// Circular Progress Component
const CircularProgress = ({ progress, size = 'md' }: { progress: number, size?: 'sm' | 'md' }) => {
    const radius = size === 'sm' ? 16 : 30;
    const dim = size === 'sm' ? 40 : 80;
    const strokeWidth = size === 'sm' ? 4 : 8;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg width={dim} height={dim} className="transform -rotate-90">
                <circle
                    cx={dim/2}
                    cy={dim/2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-gray-100"
                />
                <circle
                    cx={dim/2}
                    cy={dim/2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="text-brand-teal transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                />
            </svg>
            <span className={`absolute font-bold text-accent-greyDark ${size === 'sm' ? 'text-[10px]' : 'text-sm'}`}>{progress}%</span>
        </div>
    );
};

export default function Projects() {
    const { projects, reports, clients, userRole, clientId, timesheets, updateClient, addProject } = useStore();
    const [selectedClientId] = useState<string | null>(
        userRole === 'Customer' ? clientId : null
    );

    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [newProject, setNewProject] = useState<Partial<Project>>({
        name: '',
        status: 'Active',
        type: 'Complete',
        progress: 0,
        scopes: [],
        assignedPersonnel: []
    });
    const [isVaidatingNewMap, setIsValidatingNewMap] = useState(false);

    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');
    
    // Edit Customer State
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientLogo, setEditClientLogo] = useState('');
    const handleEditClientSubmit = () => {
        if (!editingClient || !editClientName.trim()) return;
        updateClient(editingClient.id, {
            name: editClientName,
            logo: editClientLogo
        });
        setEditingClient(null);
    };

    const recentReports = reports
        .filter(r => {
            if (userRole === 'Customer') {
                return r.clientId === clientId && r.state !== 'Draft';
            }
            return true;
        })
        .slice()
        .reverse()
        .slice(0, 5);

    // Filter projects for the selected client and user role
    const visibleProjects = useMemo(() => {
        let filtered = projects;

        if (userRole === 'Customer') {
            filtered = filtered.filter(p => p.clientId === clientId);
        } else if (userRole === 'Tech') {
            const currentUserId = 'l1'; // Mocking current user ID as an assigned personnel id for now until user system fully built
            filtered = filtered.filter(p => p.status === 'Active' && p.assignedPersonnel?.includes(currentUserId));
        }

        if (filterCustomer !== 'All') {
            filtered = filtered.filter(p => p.clientId === filterCustomer);
        } else if (selectedClientId && userRole !== 'Customer') {
            filtered = filtered.filter(p => p.clientId === selectedClientId);
        }

        if (filterStatus !== 'All') {
            if (filterStatus === 'Critical') {
                filtered = filtered.filter(p => p.status === 'Active' || p.status === 'On Hold'); // Mock critical logic
            } else {
                filtered = filtered.filter(p => p.status === filterStatus);
            }
        }

        // Sort projects: Active first, then On Hold, then Completed
        const statusWeight: Record<string, number> = { Active: 0, 'On Hold': 1, Completed: 2 };
        filtered.sort((a, b) => (statusWeight[a.status] ?? 3) - (statusWeight[b.status] ?? 3));

        return filtered;
    }, [projects, selectedClientId, filterCustomer, filterStatus, userRole, clientId]);

    useEffect(() => {
        gsap.fromTo(
            '.project-card',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
        );
        gsap.fromTo(
            '.client-card',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
        );
    }, [selectedClientId]);



    return (
        <div className="space-y-8 pb-20 md:pb-0 h-full flex flex-col">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark mb-1">{userRole === 'Customer' ? 'Customer Portal' : 'Global Operations'}</h1>
                    <p className="text-gray-500 font-medium">Real-time tracking and operational intelligence.</p>
                </div>
                {['Manager', 'Supervisor'].includes(userRole) && (
                    <Button onClick={() => setIsAddProjectOpen(true)} className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-bold shadow-soft h-11 px-6 rounded-xl">
                        <Plus size={18} /> New Project
                    </Button>
                )}
            </div>

            {['Manager', 'Supervisor'].includes(userRole) && <KPIRow />}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1">
                {/* Left Column: Projects or Clients */}
                <div className="xl:col-span-2 space-y-4 flex flex-col h-[calc(100vh-250px)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 sm:px-4 rounded-2xl border border-gray-100 shadow-sm shrink-0 gap-4">
                        <div className="flex items-center gap-3">
                            <FolderGit2 className="text-brand-teal" size={20} />
                            <h2 className="text-lg font-bold text-accent-greyDark shrink-0">Projects Directory</h2>
                            <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md ml-1">{visibleProjects.length}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto hidden-scrollbar pb-1 sm:pb-0">
                            {['Manager', 'Supervisor'].includes(userRole) && (
                                <>
                                    <select 
                                        className="bg-gray-50 border border-gray-100 text-sm font-medium text-gray-600 rounded-xl px-3 py-1.5 outline-none focus:border-brand-teal/50 shrink-0"
                                        value={filterCustomer}
                                        onChange={(e) => setFilterCustomer(e.target.value)}
                                    >
                                        <option value="All">All Customers</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <select 
                                        className="bg-gray-50 border border-gray-100 text-sm font-medium text-gray-600 rounded-xl px-3 py-1.5 outline-none focus:border-brand-teal/50 shrink-0"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                    >
                                        <option value="All">All Status</option>
                                        <option value="Active">Active</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Critical">Critical Issues</option>
                                    </select>
                                    
                                    <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                                </>
                            )}
                            <Link to="/live-map">
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-2 border-brand-teal/20 text-brand-teal hover:border-brand-teal hover:bg-brand-teal/5 rounded-xl">
                                    <Map size={14} />
                                    <span className="hidden sm:inline">Live Map View</span>
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">Project</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden sm:table-cell">Customer</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">Status</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">Progress</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden lg:table-cell">Team / Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                        {visibleProjects.map(proj => (
                                            <tr key={proj.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-4 align-middle">
                                                    {['Supervisor', 'Manager'].includes(userRole) ? (
                                                        <Link to={`/projects/${proj.id}`} className="font-bold text-accent-greyDark hover:text-brand-teal block">
                                                            {proj.name}
                                                        </Link>
                                                    ) : (
                                                        <Link to={`/reports?project=${proj.id}`} className="font-bold text-accent-greyDark group-hover:text-brand-teal block">
                                                            {proj.name}
                                                        </Link>
                                                    )}
                                                    <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                                        {proj.codeName ? <span className="text-brand-teal font-bold">{proj.codeName}</span> : null} 
                                                        {proj.codeName ? ' • ' : ''}
                                                        {proj.id} • {proj.type}
                                                    </span>
                                                    {proj.location && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                                                            <MapPin size={10} />
                                                            <span className="truncate max-w-[150px]">{getRegionName(proj.location)}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle hidden sm:table-cell">
                                                    <span className="text-sm font-semibold text-accent-greyDark">{clients.find(c => c.id === proj.clientId)?.name}</span>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    {['Supervisor', 'Manager'].includes(userRole) ? (
                                                        <select 
                                                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none appearance-none cursor-pointer
                                                                ${proj.status === 'Active' ? 'bg-status-success/10 text-status-success border-transparent' : 
                                                                  proj.status === 'Completed' ? 'bg-gray-100 text-gray-500 border-transparent' : 
                                                                  'bg-status-error/10 text-status-error border-transparent'}`}
                                                            value={proj.status}
                                                            onChange={(e) => {
                                                                alert(`Mock Status Update: Set to ${e.target.value}`)
                                                            }}
                                                        >
                                                            <option value="Active">Active</option>
                                                            <option value="On Hold">On Hold</option>
                                                            <option value="Completed">Completed</option>
                                                        </select>
                                                    ) : (
                                                        <Badge variant={proj.status === 'Active' ? 'default' : proj.status === 'Completed' ? 'secondary' : 'destructive'}
                                                            className={proj.status === 'Active' ? 'bg-status-success/10 text-status-success hover:bg-status-success/20 border-none' : ''}>
                                                            {proj.status}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <CircularProgress size="sm" progress={(() => {
                                                            const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                            if (allActs.length === 0) return proj.progress || 0;
                                                            const totalProgress = allActs.reduce((sum, act) => sum + act.progress, 0);
                                                            return Math.round(totalProgress / allActs.length);
                                                        })()} />
                                                        <div className="hidden md:block">
                                                            <p className="text-sm font-bold text-accent-greyDark leading-none">
                                                                {(() => {
                                                                    const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                                    const totalProgress = allActs.reduce((sum, act) => sum + act.progress, 0);
                                                                    return allActs.length > 0 ? Math.round(totalProgress / allActs.length) : proj.progress || 0;
                                                                })()}%
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 font-medium">Accomplished</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle hidden lg:table-cell">
                                                    <div className="flex -space-x-1.5 mb-1.5">
                                                        {(proj.assignedPersonnel || []).slice(0, 3).map((id, i) => (
                                                            <div key={i} className="w-6 h-6 rounded-full bg-brand-teal/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand-teal">
                                                                {id.charAt(0).toUpperCase()}
                                                            </div>
                                                        ))}
                                                        {(proj.assignedPersonnel || []).length > 3 && (
                                                            <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                                +{(proj.assignedPersonnel || []).length - 3}
                                                            </div>
                                                        )}
                                                        {(!proj.assignedPersonnel || proj.assignedPersonnel.length === 0) && (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-gray-400" />
                                                        <span className="text-xs font-bold text-gray-600">
                                                            {timesheets.filter(t => t.projectId === proj.id).reduce((sum, t) => sum + t.hours, 0)} hrs
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {visibleProjects.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-12 text-center text-gray-500">
                                                    <FolderGit2 size={48} className="mx-auto mb-4 text-gray-300" />
                                                    <p className="text-lg font-medium text-accent-greyDark">No projects found</p>
                                                    <p className="text-sm mt-1">There are no active projects to display.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                </div>

                {['Supervisor', 'Manager'].includes(userRole) && (
                    <div className="flex flex-col h-full space-y-6">
                        {/* Right Column: Intelligence Layer */}
                        <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                                <ActivityIcon className="text-brand-teal" size={24} />
                                Intelligence Feed
                        </h2>

                        {/* Alerts Summary */}
                        <div className="flex flex-col gap-3">
                            <div className="bg-status-error/10 border border-status-error/20 p-4 rounded-2xl flex items-start gap-3">
                                <AlertCircle size={20} className="text-status-error shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-status-error text-sm mb-0.5">Attention Required</h4>
                                    <p className="text-xs text-status-error/80">3 projects reported critical issues today.</p>
                                </div>
                            </div>
                        </div>

                        <Card className="flex-1 rounded-3xl border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                                <CardTitle className="text-base text-accent-greyDark">Recent Activity</CardTitle>
                                <CardDescription>Timeline of operations and reports.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-y-auto">
                                <div className="divide-y divide-gray-100 relative">
                                    {recentReports.map(report => (
                                        <div
                                            key={report.id}
                                            className="flex items-start gap-4 p-5 hover:bg-gray-50 transition-colors group relative"
                                        >
                                            <div className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 z-10 border-2 border-white shadow-sm ${
                                                report.state === 'Approved' || report.state === 'Closed' ? 'bg-status-success' :
                                                report.state.includes('Review') ? 'bg-status-warning' :
                                                report.state === 'Draft' ? 'bg-blue-500' : 'bg-status-error'
                                                }`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-sm font-bold text-accent-greyDark truncate pr-2 group-hover:text-brand-teal cursor-pointer hover:underline" onClick={() => window.location.href = `/reports/${report.id}`}>{report.projectName}</p>
                                                    <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{report.date}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate mb-2">Report {report.id} • {report.state}</p>
                                                
                                                {/* Action needed indicator */}
                                                {report.state === 'Pending Manager Review' && ['Manager'].includes(userRole) && (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-brand-teal text-brand-teal hover:bg-brand-teal/10 rounded-lg" onClick={() => window.location.href = `/reports/${report.id}`}>Review Now</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {recentReports.length === 0 && (
                                        <div className="p-8 text-center text-gray-500">
                                            <Clock size={32} className="mx-auto mb-3 text-gray-300" />
                                            <p className="text-sm">No recent activity.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Edit Customer Modal */}
            <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Customer ({editingClient?.name})</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="editCustomerName">Customer / Company Name</Label>
                            <Input
                                id="editCustomerName"
                                value={editClientName}
                                onChange={(e) => setEditClientName(e.target.value)}
                                placeholder="E.g., COR Solutions"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Company Logo Thumbnail</Label>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="w-16 h-16 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal overflow-hidden border border-gray-100 shrink-0">
                                    {editClientLogo ? (
                                        <img src={editClientLogo} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera size={24} />
                                    )}
                                </div>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setEditClientLogo(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="cursor-pointer flex-1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingClient(null)}>Cancel</Button>
                        <Button onClick={handleEditClientSubmit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* New Project Modal */}
            <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
                    <div className="bg-brand-teal p-6 text-white">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            <FolderGit2 size={24} /> Create New Project
                        </DialogTitle>
                        <p className="text-white/70 text-sm mt-1">Initialize a new operations tracking environment.</p>
                    </div>
                    <div className="p-6 space-y-5">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Project Name</Label>
                                <Input placeholder="e.g. Solar Site Alpha" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-11 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client / Customer</Label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                    value={newProject.clientId || ''}
                                    onChange={e => setNewProject({...newProject, clientId: e.target.value})}
                                >
                                    <option value="" disabled>Select Client...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Location / Coordinates</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Address or lat,lng" 
                                        value={newProject.location || ''} 
                                        onChange={e => setNewProject({...newProject, location: e.target.value})} 
                                        className="h-11 rounded-xl flex-1"
                                    />
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className={`h-11 w-11 shrink-0 rounded-xl ${newProject.location ? 'border-brand-teal text-brand-teal bg-brand-teal/5' : ''}`}
                                        disabled={!newProject.location}
                                        onClick={() => setIsValidatingNewMap(true)}
                                    >
                                        <Map size={18} />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Code Name</Label>
                                <Input placeholder="e.g. SN-001" value={newProject.codeName || ''} onChange={e => setNewProject({...newProject, codeName: e.target.value})} className="h-11 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Type</Label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                    value={newProject.systemType || 'Solar'}
                                    onChange={e => setNewProject({...newProject, systemType: e.target.value})}
                                >
                                    <option value="Solar">Solar</option>
                                    <option value="BESS">BESS</option>
                                    <option value="Hybrid">Hybrid</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                       </div>
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 flex gap-3">
                        <Button variant="ghost" onClick={() => setIsAddProjectOpen(false)} className="rounded-xl h-11">Cancel</Button>
                        <Button 
                            className="bg-brand-teal hover:bg-brand-teal/90 text-white font-bold h-11 px-8 rounded-xl flex-1"
                            disabled={!newProject.name || !newProject.clientId}
                            onClick={() => {
                                addProject({
                                    ...newProject as Project,
                                    id: `PROJ-${Date.now()}`,
                                    progress: 0,
                                    scopes: []
                                });
                                setIsAddProjectOpen(false);
                            }}
                        >
                            Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Interactive Map Validation for New Project */}
            <Dialog open={isVaidatingNewMap} onOpenChange={setIsValidatingNewMap}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <div className="bg-brand-teal p-5 text-white flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                            <MapPin className="w-6 h-6" /> Confirm Pin on Map
                        </DialogTitle>
                    </div>
                    <div className="p-6 bg-white space-y-5">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                                <Search size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Location</p>
                                <p className="text-accent-greyDark font-bold text-base">{newProject.location}</p>
                            </div>
                        </div>

                        <div className="w-full h-[350px] rounded-2xl overflow-hidden border border-gray-100 shadow-soft relative group">
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(newProject.location || '')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                allowFullScreen
                            />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                 <div className="w-10 h-10 bg-brand-teal/20 rounded-full flex items-center justify-center animate-ping" />
                                 <MapPin size={32} className="text-brand-teal drop-shadow-lg absolute" style={{ marginTop: '-32px' }} />
                            </div>
                        </div>
                        
                        <p className="text-xs text-gray-400 text-center italic bg-gray-50 py-2 rounded-lg border border-dashed border-gray-200">
                             Visualizing location based on provided address/coordinates. Confirm current pin position is correct.
                        </p>

                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setIsValidatingNewMap(false)} className="flex-1 h-12 rounded-xl text-gray-500 font-bold">Adjust Location</Button>
                            <Button 
                                className="flex-1 h-12 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold gap-2 shadow-soft"
                                onClick={() => setIsValidatingNewMap(false)}
                            >
                                <Check size={18} /> Confirm Pin Placement
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

