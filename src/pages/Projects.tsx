import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import gsap from 'gsap';
import { FolderGit2, Clock, Activity as ActivityIcon, MapPin, Map, Camera, Building2, ChevronDown, Filter, Search, Check, Plus, Target } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Project, Client } from '../store/useStore';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
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
    const { t } = useTranslation();
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
        assignedPersonnel: [],
        siteLeadIds: [],
        prevailingWage: false
    });
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [isVaidatingNewMap, setIsValidatingNewMap] = useState(false);

    const [searchParams] = useSearchParams();
    const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'All');
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
            const currentPersonnelId = useStore.getState().resolvePersonnelId();
            if (currentPersonnelId) {
                filtered = filtered.filter(p => p.status === 'Active' && p.assignedPersonnel?.includes(currentPersonnelId));
            } else {
                // Return empty if we can't find the tech, as they shouldn't see anything they aren't assigned to.
                // We handle the UI warning in the render section below.
                filtered = [];
            }
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        {userRole === 'Customer' ? t('projects.customer_portal', 'Customer Portal') : t('projects.global_ops', 'Global Operations')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('projects.subtitle', 'Real-time tracking and operational intelligence.')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {userRole !== 'Customer' && (
                        <Link to="/live-map">
                            <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50 gap-2 font-bold shadow-soft h-11 px-6 rounded-xl">
                                <Map size={18} /> <span className="hidden sm:inline">{t('nav.live_map')}</span>
                            </Button>
                        </Link>
                    )}
                    {['Manager', 'Supervisor'].includes(userRole) && (
                        <Button onClick={() => setIsAddProjectOpen(true)} className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-bold shadow-soft h-11 px-6 rounded-xl">
                            <Plus size={18} /> {t('projects.new_project')}
                        </Button>
                    )}
                </div>
            </div>

            {['Manager', 'Supervisor'].includes(userRole) && <KPIRow />}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1">
                {/* Left Column: Projects or Clients */}
                <div className="xl:col-span-2 space-y-4 flex flex-col h-[calc(100vh-250px)]">
                        {/* Filters */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end mb-4">
                            <div className="flex items-center gap-3 w-full sm:w-auto sm:mr-auto shrink-0 mb-2 sm:mb-0">
                                <h2 className="text-lg font-bold text-accent-greyDark flex items-center gap-2">
                                    <FolderGit2 className="text-brand-teal" size={20} />
                                    {t('projects.directory', 'Projects Directory')}
                                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{visibleProjects.length}</span>
                                </h2>
                            </div>
                            
                            {['Manager', 'Supervisor'].includes(userRole) && (
                                <div className="space-y-1.5 flex-[0.8] min-w-[200px]">
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Building2 size={12} /> {t('projects.filters.customer', 'Filter Customer')}</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer"
                                            value={filterCustomer}
                                            onChange={(e) => setFilterCustomer(e.target.value)}
                                        >
                                            <option value="All">{t('common.all_customers', 'All Customers')}</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>
                            )}

                            {['Manager', 'Supervisor'].includes(userRole) && (
                                <div className="space-y-1.5 flex-[0.8] min-w-[150px]">
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> {t('common.status')}</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                        >
                                            <option value="All">{t('common.all_status', 'All Status')}</option>
                                            <option value="Active">{t('common.active')}</option>
                                            <option value="On Hold">{t('common.on_hold')}</option>
                                            <option value="Completed">{t('common.completed')}</option>
                                            <option value="Critical">{t('common.critical_issues', 'Critical Issues')}</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>
                            )}
                        </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('projects.table.project', 'Project')}</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden sm:table-cell">{t('projects.table.customer', 'Customer')}</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('projects.table.status', 'Status')}</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider">{t('projects.table.progress', 'Progress')}</th>
                                        <th className="p-4 text-xs font-bold text-accent-greyLight uppercase tracking-wider hidden lg:table-cell">{t('projects.table.reported_time', 'Reported Time')}</th>
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
                                                        {proj.id}
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
                                                                alert(`${t('common.success')}: ${e.target.value}`)
                                                            }}
                                                        >
                                                            <option value="Active">{t('common.active')}</option>
                                                            <option value="On Hold">{t('common.on_hold')}</option>
                                                            <option value="Completed">{t('common.completed')}</option>
                                                        </select>
                                                    ) : (
                                                        <Badge variant={proj.status === 'Active' ? 'default' : proj.status === 'Completed' ? 'secondary' : 'destructive'}
                                                            className={proj.status === 'Active' ? 'bg-status-success/10 text-status-success hover:bg-status-success/20 border-none' : ''}>
                                                            {proj.status === 'Active' ? t('common.active') : proj.status === 'Completed' ? t('common.completed') : t('common.on_hold')}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <CircularProgress size="sm" progress={(() => {
                                                            const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                            if (allActs.length === 0) return 0; // Forced 0% for ghost progress elimination
                                                            const totalProgress = allActs.reduce((sum, act) => sum + act.progress, 0);
                                                            return Math.round(totalProgress / allActs.length);
                                                        })()} />
                                                        <div className="hidden md:block">
                                                            <p className="text-sm font-bold text-accent-greyDark leading-none">
                                                                {(() => {
                                                                    const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                                    const totalProgress = allActs.reduce((sum, act) => sum + act.progress, 0);
                                                                    return allActs.length > 0 ? Math.round(totalProgress / allActs.length) : 0;
                                                                })()}%
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 font-medium">{t('projects.accomplished', 'Accomplished')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle hidden lg:table-cell">
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
                                                    <p className="text-lg font-bold text-accent-greyDark leading-tight">
                                                        {userRole === 'Tech' && !useStore.getState().resolvePersonnelId() 
                                                            ? t('projects.alerts.unresolved_identity', 'Identity Unresolved') 
                                                            : t('projects.empty.title', 'No projects found')}
                                                    </p>
                                                    <p className="text-sm mt-2 text-gray-400 max-w-xs mx-auto">
                                                        {userRole === 'Tech' && !useStore.getState().resolvePersonnelId() 
                                                            ? t('projects.alerts.unresolved_identity_desc', 'Your account email is not mapped to a personnel record. Please contact administration to link your profile.') 
                                                            : t('projects.empty.subtitle', 'There are no active projects to display for the current filters.')}
                                                    </p>
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
                                {t('projects.intelligence_feed', 'Intelligence Feed')}
                        </h2>

                        {/* Removed Redundant Alerts Summary */}

                        <Card className="flex-1 rounded-3xl border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                                <CardTitle className="text-base text-accent-greyDark">{t('projects.recent_activity', 'Recent Activity')}</CardTitle>
                                <CardDescription>{t('projects.activity_desc', 'Timeline of operations and reports.')}</CardDescription>
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
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-brand-teal text-brand-teal hover:bg-brand-teal/10 rounded-lg" onClick={() => window.location.href = `/reports/${report.id}`}>{t('reports.actions.review_now', 'Review Now')}</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {recentReports.length === 0 && (
                                        <div className="p-8 text-center text-gray-500">
                                            <Clock size={32} className="mx-auto mb-3 text-gray-300" />
                                            <p className="text-sm">{t('projects.no_recent_activity', 'No recent activity.')}</p>
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
                        <DialogTitle>{t('common.edit')} {t('projects.table.customer')} ({editingClient?.name})</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="editCustomerName">{t('projects.labels.customer_name', 'Customer / Company Name')}</Label>
                            <Input
                                id="editCustomerName"
                                value={editClientName}
                                onChange={(e) => setEditClientName(e.target.value)}
                                placeholder={t('projects.placeholders.customer_example', 'E.g., COR Solutions')}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t('projects.labels.logo_thumbnail', 'Company Logo Thumbnail')}</Label>
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
                        <Button variant="outline" onClick={() => setEditingClient(null)}>{t('common.cancel')}</Button>
                        <Button onClick={handleEditClientSubmit}>{t('common.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* New Project Modal */}
            <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
                    <div className="bg-brand-teal p-6 text-white">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            <FolderGit2 size={24} /> {t('projects.new_project')}
                        </DialogTitle>
                        <p className="text-white/70 text-sm mt-1">{t('projects.subtitle')}</p>
                    </div>
                    <div className="p-6 space-y-5">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('common.name')}</Label>
                                <Input placeholder="e.g. Solar Site Alpha" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-11 rounded-xl" />
                            </div>
                             <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projects.table.customer')}</Label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                    value={newProject.clientId || ''}
                                    onChange={e => setNewProject({...newProject, clientId: e.target.value})}
                                >
                                    <option value="" disabled>{t('common.all_customers')}...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projects.location')}</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder={t('projects.location')} 
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
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projects.system_type')}</Label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                    value={newProject.systemType || 'Solar'}
                                    onChange={e => setNewProject({...newProject, systemType: e.target.value})}
                                >
                                    <option value="Solar">Solar</option>
                                    <option value="BESS">BESS</option>
                                    <option value="Hybrid">Hybrid</option>
                                    <option value="Other">{t('common.other')}</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2 flex items-center gap-2 p-3 bg-brand-teal/5 rounded-2xl border border-brand-teal/10">
                                <Checkbox 
                                    id="prevailingWage" 
                                    checked={newProject.prevailingWage}
                                    onCheckedChange={(checked) => setNewProject({...newProject, prevailingWage: !!checked})}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="prevailingWage"
                                        className="text-sm font-bold text-accent-greyDark leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        Prevailing Wage Project
                                    </Label>
                                    <p className="text-xs text-gray-500">
                                        All personnel assigned will be automatically flagged for prevailing wage.
                                    </p>
                                </div>
                            </div>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div>
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">{t('projects.labels.assign_team', 'Assign Team & Leads')}</Label>
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <Input 
                                        placeholder={t('projects.placeholders.search_personnel', 'Search personnel...')} 
                                        value={personnelSearch}
                                        onChange={e => setPersonnelSearch(e.target.value)}
                                        className="pl-10 h-10 rounded-xl bg-gray-50/50 border-gray-100"
                                    />
                                </div>
                                <div className="max-h-[220px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                    {useStore.getState().personnel
                                        .filter(p => !personnelSearch || p.name.toLowerCase().includes(personnelSearch.toLowerCase()) || p.position.toLowerCase().includes(personnelSearch.toLowerCase()))
                                        .map(person => {
                                            const isAssigned = newProject.assignedPersonnel?.includes(person.id);
                                            const isLead = newProject.siteLeadIds?.includes(person.id);
                                            
                                            return (
                                                <div 
                                                    key={person.id} 
                                                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                                        isAssigned ? 'border-brand-teal/30 bg-brand-teal/5' : 'border-gray-50 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                                                            {person.image ? <img src={person.image} className="w-full h-full object-cover" /> : person.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-accent-greyDark">{person.name}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase font-medium">{person.position}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const currentAssigned = newProject.assignedPersonnel || [];
                                                                const nextAssigned = isAssigned 
                                                                    ? currentAssigned.filter(id => id !== person.id)
                                                                    : [...currentAssigned, person.id];
                                                                
                                                                let nextLeads = newProject.siteLeadIds || [];
                                                                if (isAssigned) {
                                                                    nextLeads = nextLeads.filter(id => id !== person.id);
                                                                }
                                                                
                                                                setNewProject({...newProject, assignedPersonnel: nextAssigned, siteLeadIds: nextLeads});
                                                            }}
                                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                                isAssigned ? 'bg-brand-teal text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {isAssigned ? 'Assigned' : 'Assign'}
                                                        </button>
                                                        
                                                        {isAssigned && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    const currentLeads = newProject.siteLeadIds || [];
                                                                    const nextLeads = isLead 
                                                                        ? currentLeads.filter(id => id !== person.id)
                                                                        : [...currentLeads, person.id];
                                                                    setNewProject({...newProject, siteLeadIds: nextLeads});
                                                                }}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                                                    isLead ? 'bg-status-success text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                                                }`}
                                                                title={t('projects.mark_as_lead', 'Mark as Site Lead')}
                                                            >
                                                                <Target size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
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
                                    scopes: [],
                                    assignedPersonnel: newProject.assignedPersonnel || [],
                                    siteLeadIds: newProject.siteLeadIds || []
                                });
                                setIsAddProjectOpen(false);
                            }}
                        >
                            {t('projects.new_project')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Interactive Map Validation for New Project */}
            <Dialog open={isVaidatingNewMap} onOpenChange={setIsValidatingNewMap}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <div className="bg-brand-teal p-5 text-white flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                            <MapPin className="w-6 h-6" /> {t('projects.confirm_pin', 'Confirm Pin on Map')}
                        </DialogTitle>
                    </div>
                    <div className="p-6 bg-white space-y-5">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                                <Search size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('projects.labels.target_location', 'Target Location')}</p>
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
                             {t('projects.alerts.visualizing_location', 'Visualizing location based on provided address/coordinates. Confirm current pin position is correct.')}
                        </p>

                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setIsValidatingNewMap(false)} className="flex-1 h-12 rounded-xl text-gray-500 font-bold">Adjust Location</Button>
                            <Button 
                                className="flex-1 h-12 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold gap-2 shadow-soft"
                                onClick={() => setIsValidatingNewMap(false)}
                            >
                                <Check size={18} /> {t('projects.confirm_pin_placement', 'Confirm Pin Placement')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

