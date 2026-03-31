import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import gsap from 'gsap';
import { FolderGit2, Clock, Activity as ActivityIcon, MapPin, ExternalLink, Map, Camera, AlertCircle, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ManageScopesModal } from '../components/project/ManageScopesModal';
import { AddScopeModal } from '../components/project/AddScopeModal';
import { Project, Client } from '../store/useStore';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { KPIRow } from '../components/dashboard/KPIRow';

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
    const { projects, reports, clients, userRole, clientId, timesheets, updateClient } = useStore();
    const [selectedClientId] = useState<string | null>(
        userRole === 'Customer' ? clientId : null
    );
    const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');
    const [manageScopesProject, setManageScopesProject] = useState<Project | null>(null);
    const [addScopeProject, setAddScopeProject] = useState<Project | null>(null);
    const [mapProject, setMapProject] = useState<Project | null>(null);
    
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

                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                                <button 
                                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-brand-teal' : 'text-gray-400 hover:text-gray-600'}`} 
                                    onClick={() => setViewMode('table')}
                                >
                                    <List size={16} /> <span className="hidden sm:inline">Table</span>
                                </button>
                                {['Manager', 'Supervisor'].includes(userRole) && (
                                    <button 
                                        className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-brand-teal' : 'text-gray-400 hover:text-gray-600'}`} 
                                        onClick={() => setViewMode('map')}
                                    >
                                        <MapPin size={16} /> <span className="hidden sm:inline">Map</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'table' ? (
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
                                            <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {visibleProjects.map(proj => (
                                            <tr key={proj.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-4 align-middle">
                                                    <Link to={`/reports?project=${proj.id}`} className="font-bold text-accent-greyDark group-hover:text-brand-teal block">
                                                        {proj.name}
                                                    </Link>
                                                    <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                                        {proj.codeName ? <span className="text-brand-teal font-bold">{proj.codeName}</span> : null} 
                                                        {proj.codeName ? ' • ' : ''}
                                                        {proj.id} • {proj.type}
                                                    </span>
                                                    {proj.location && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-teal bg-brand-teal/5 border border-brand-teal/10 px-2 py-1 rounded w-fit cursor-pointer hover:bg-brand-teal/10 transition-colors" onClick={() => setMapProject(proj)}>
                                                            <MapPin size={12} />
                                                            <span className="truncate max-w-[150px]">{proj.location}</span>
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
                                                            <p className="text-[11px] font-bold text-gray-700">
                                                                {(() => {
                                                                    const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                                    const completed = allActs.filter(a => a.status === 'Completed').length;
                                                                    return `${completed}/${allActs.length}`;
                                                                })()} Acts
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
                                                <td className="p-4 align-middle text-right">
                                                    {['Supervisor', 'Manager'].includes(userRole) ? (
                                                        <div className="flex items-center justify-end gap-2 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="outline" size="sm" className="h-8 text-xs border-gray-200 text-gray-600 hover:text-brand-teal hover:border-brand-teal/50 transition-colors" onClick={() => setManageScopesProject(proj)}>
                                                                WBS
                                                            </Button>
                                                            <Button variant="default" size="sm" className="h-8 text-xs bg-brand-teal hover:bg-brand-teal/90 text-white shadow-soft" onClick={() => setAddScopeProject(proj)}>
                                                                + Scope
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/reports?project=${proj.id}`}>
                                                            <Button variant="ghost" size="sm" className="h-8 text-brand-teal hover:bg-brand-teal/10 font-bold">View</Button>
                                                        </Link>
                                                    )}
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
                    ) : (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1 relative flex items-center justify-center">
                            {/* Embedded Map */}
                            {visibleProjects.filter(p => p.location).length > 0 ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    style={{ border: 0, minHeight: '400px' }}
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(visibleProjects.find(p => p.location)?.location || 'USA')}&t=&z=5&ie=UTF8&iwloc=&output=embed`}
                                    allowFullScreen
                                />
                            ) : (
                                <div className="text-center text-gray-500 p-12">
                                    <Map size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium text-accent-greyDark">No Locations Available</p>
                                    <p className="text-sm mt-1">None of the visible projects have location data.</p>
                                </div>
                            )}
                            
                            {/* Overlay Card for Map View */}
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-gray-100 w-64 z-10 hidden sm:block">
                                <h3 className="font-bold text-accent-greyDark mb-3 text-sm flex items-center gap-2">
                                    <MapPin size={16} className="text-brand-teal" /> Global Coverage
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Mappable Projects</span>
                                        <span className="font-bold text-brand-teal">{visibleProjects.filter(p => p.location).length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Total Teams</span>
                                        <span className="font-bold text-brand-teal">
                                            {new Set(visibleProjects.flatMap(p => p.assignedPersonnel || [])).size}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {userRole !== 'Customer' && (
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

            {manageScopesProject && (
                <ManageScopesModal 
                    open={!!manageScopesProject} 
                    onOpenChange={(open) => !open && setManageScopesProject(null)} 
                    project={manageScopesProject as Project} 
                />
            )}

            {addScopeProject && (
                <AddScopeModal 
                    open={!!addScopeProject} 
                    onOpenChange={(open) => !open && setAddScopeProject(null)} 
                    project={addScopeProject as Project} 
                />
            )}

            <Dialog open={!!mapProject} onOpenChange={(open) => !open && setMapProject(null)}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl border-none">
                    <div className="bg-brand-teal p-4 text-white flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Map className="w-5 h-5" />
                            Location - {mapProject?.name}
                        </DialogTitle>
                    </div>
                    <div className="p-4 bg-white space-y-4">
                        <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <MapPin className="text-brand-teal shrink-0 mt-0.5" size={18} />
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Stated Address / Coordinates</p>
                                <p className="text-accent-greyDark font-medium text-sm">{mapProject?.location}</p>
                            </div>
                        </div>

                        {mapProject && mapProject.location && (
                            <div className="w-full h-[300px] rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapProject.location || '')}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                    allowFullScreen
                                />
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setMapProject(null)}>Close</Button>
                            <Button 
                                className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2"
                                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(mapProject?.location || '')}`, '_blank')}
                            >
                                <ExternalLink size={16} /> Open in Maps Apps
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
        </div>
    );
}
