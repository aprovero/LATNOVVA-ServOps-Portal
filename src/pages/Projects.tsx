import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import gsap from 'gsap';
import { FolderGit2, Clock, Activity as ActivityIcon, ChevronRight, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ManageScopesModal } from '../components/project/ManageScopesModal';
import { Project } from '../store/useStore';

// Circular Progress Component
const CircularProgress = ({ progress }: { progress: number }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg width="80" height="80" className="transform -rotate-90">
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-100"
                />
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="text-brand-teal transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                />
            </svg>
            <span className="absolute text-sm font-bold text-accent-greyDark">{progress}%</span>
        </div>
    );
};

export default function Projects() {
    const { projects, reports, clients, userRole, clientId, timesheets } = useStore();
    const [selectedClientId, setSelectedClientId] = useState<string | null>(
        userRole === 'Customer' ? clientId : null
    );
    const [manageScopesProject, setManageScopesProject] = useState<Project | null>(null);

    const recentReports = reports.slice().reverse().slice(0, 5); // get 5 most recent

    // Filter projects for the selected client and user role
    const visibleProjects = useMemo(() => {
        let filtered = projects;

        if (userRole === 'Customer') {
            filtered = filtered.filter(p => p.clientId === clientId);
        } else if (userRole === 'Tech') {
            const currentUserId = 'l1'; // Mocking current user ID as an assigned personnel id for now until user system fully built
            filtered = filtered.filter(p => p.status === 'Active' && p.assignedPersonnel?.includes(currentUserId));
        }

        if (selectedClientId && userRole !== 'Customer') {
            filtered = filtered.filter(p => p.clientId === selectedClientId);
        }

        // Sort projects: Active first, then On Hold, then Completed
        const statusWeight: Record<string, number> = { Active: 0, 'On Hold': 1, Completed: 2 };
        filtered.sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);

        return filtered;
    }, [projects, selectedClientId, userRole, clientId]);

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

    const handleClientSelect = (id: string) => {
        setSelectedClientId(id);
    };

    const handleBack = () => {
        if (userRole !== 'Customer') {
            setSelectedClientId(null);
        }
    };

    return (
        <div className="space-y-8 pb-20 md:pb-0 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold text-accent-greyDark mb-1">Global Dashboard</h1>
                <p className="text-gray-500">Manage projects and review recent activity.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1">
                {/* Left Column: Projects or Clients */}
                <div className="xl:col-span-2 space-y-6">
                    {!selectedClientId ? (
                        <>
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                                    <Users className="text-brand-teal" size={24} />
                                    Customers
                                </h2>
                                <span className="text-sm font-medium text-gray-500">{clients.length} Total</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {clients.map((client) => {
                                    const clientProjects = projects.filter(p => p.clientId === client.id);
                                    const activeCount = clientProjects.filter(p => p.status === 'Active').length;

                                    return (
                                        <div
                                            key={client.id}
                                            onClick={() => handleClientSelect(client.id)}
                                            className="client-card bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-brand-teal/30 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal group-hover:bg-brand-teal group-hover:text-white transition-colors overflow-hidden border border-gray-100 shrink-0">
                                                    {client.logo ? (
                                                        <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Users size={24} />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-accent-greyDark group-hover:text-brand-teal transition-colors">
                                                        {client.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 font-medium">
                                                        {activeCount} Active {activeCount === 1 ? 'Project' : 'Projects'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {userRole !== 'Customer' && (
                                        <Button variant="ghost" size="icon" onClick={handleBack} className="text-gray-500 hover:text-brand-teal hover:bg-brand-teal/10 rounded-full h-8 w-8">
                                            <ArrowLeft size={20} />
                                        </Button>
                                    )}
                                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                                        <FolderGit2 className="text-brand-teal" size={24} />
                                        {clients.find(c => c.id === selectedClientId)?.name || 'Projects'}
                                    </h2>
                                </div>
                                <span className="text-sm font-medium text-gray-500">{visibleProjects.length} Total</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {visibleProjects.map((proj) => (
                                    <Link
                                        to={`/reports?project=${proj.id}`}
                                        key={proj.id}
                                        className="project-card block bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-brand-teal/30 cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-accent-greyDark mb-1 group-hover:text-brand-teal transition-colors">{proj.name}</h3>
                                                <p className="text-xs text-gray-400 font-mono">{proj.id} • {proj.type}</p>
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                <Badge variant={proj.status === 'Active' ? 'default' : proj.status === 'Completed' ? 'secondary' : 'destructive'}
                                                    className={proj.status === 'Active' ? 'bg-status-success/10 text-status-success hover:bg-status-success/20 border-none' : ''}>
                                                    {proj.status}
                                                </Badge>
                                                {['Supervisor', 'Manager'].includes(userRole) && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 text-xs px-2 relative z-10 bg-white hover:bg-brand-teal hover:text-white border-gray-200 transition-colors"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setManageScopesProject(proj);
                                                        }}
                                                    >
                                                        Manage WBS
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm text-gray-500 font-medium">Accomplished</p>
                                                <p className="text-xs text-gray-400">
                                                    {(() => {
                                                        const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                        const completed = allActs.filter(a => a.status === 'Completed').length;
                                                        return `${completed} of ${allActs.length} activities`;
                                                    })()}
                                                </p>
                                                <div className="flex items-center gap-1 mt-2 bg-gray-50 border border-gray-100 px-2 py-1 rounded w-fit">
                                                    <Clock size={12} className="text-brand-teal" />
                                                    <span className="text-xs font-bold text-gray-600">
                                                        {timesheets.filter(t => t.projectId === proj.id).reduce((sum, t) => sum + t.hours, 0)} hrs logged
                                                    </span>
                                                </div>
                                            </div>
                                            <CircularProgress progress={(() => {
                                                const allActs = proj.scopes?.flatMap(s => s.activities) || [];
                                                if (allActs.length === 0) return proj.progress;
                                                const totalProgress = allActs.reduce((sum, act) => sum + act.progress, 0);
                                                return Math.round(totalProgress / allActs.length);
                                            })()} />
                                        </div>
                                    </Link>
                                ))}
                                {visibleProjects.length === 0 && (
                                    <div className="col-span-1 md:col-span-2 p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
                                        <FolderGit2 size={48} className="mx-auto mb-4 text-gray-300" />
                                        <p className="text-lg font-medium text-accent-greyDark">No projects found</p>
                                        <p className="text-sm mt-1">This customer doesn't have any projects yet.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Right Column: Activity Feed */}
                <div className="flex flex-col h-full space-y-6">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                        <ActivityIcon className="text-brand-teal" size={24} />
                        Activity Feed
                    </h2>

                    <Card className="flex-1 rounded-2xl border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                            <CardTitle className="text-base">Recent Reports</CardTitle>
                            <CardDescription>Latest submissions from the field.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-y-auto">
                            <div className="divide-y divide-gray-100">
                                {recentReports.map(report => (
                                    <Link
                                        to={`/reports/${report.id}`}
                                        key={report.id}
                                        className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${report.state === 'Closed' ? 'bg-status-success' :
                                            report.state.includes('Review') || report.state === 'Approved' ? 'bg-status-warning' : 'bg-gray-300'
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm font-bold text-accent-greyDark truncate pr-2 group-hover:text-brand-teal">{report.projectName}</p>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">{report.date}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{report.id} • {report.state}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300 mt-2 group-hover:text-brand-teal transition-colors" />
                                    </Link>
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
            </div>

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
