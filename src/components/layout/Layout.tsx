import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Settings, User, Activity, Search, Bell, Plus, Wrench, CheckSquare, Calendar as CalendarIcon, AlertTriangle, Clock, MapPin, Map as MapIcon, Fingerprint } from 'lucide-react';
import { useStore, Project } from '../../store/useStore';
import { AddScopeModal } from '../project/AddScopeModal';
import gsap from 'gsap';
import { differenceInDays, parseISO } from 'date-fns';

import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../ui/dialog';
import { Label } from '../ui/label';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { userRole, setUserRole, tools, personnel, clients, projects, addClient, addProject, reports, addReport, clientId } = useStore();

    // Dialog States
    const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);

    // Form States
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerLogo, setNewCustomerLogo] = useState('');
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectCodeName, setNewProjectCodeName] = useState('');
    const [newProjectClient, setNewProjectClient] = useState('');
    const [newProjectType, setNewProjectType] = useState<'Complete' | 'Simple'>('Complete');
    const [newProjectLocation, setNewProjectLocation] = useState('');
    const [newProjectSize, setNewProjectSize] = useState('');
    const [newProjectSystemType, setNewProjectSystemType] = useState('Solar');
    const [newlyCreatedProject, setNewlyCreatedProject] = useState<Project | null>(null);
    const [isPreviewMapOpen, setIsPreviewMapOpen] = useState(false);
    const [newReportProject, setNewReportProject] = useState('');
    const [newReportDate, setNewReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [newReportCompany, setNewReportCompany] = useState('');
    const [locationError, setLocationError] = useState('');
    // Compute Notifications
    const notifications: { id: string; title: string; message: string; type: 'warning' | 'error', link?: string }[] = [];

    if (userRole !== 'Customer') {
        tools.forEach(tool => {
            if (!tool.certificationExpiry) return;
            const daysLeft = differenceInDays(parseISO(tool.certificationExpiry), new Date());
            if (daysLeft < 0) {
                notifications.push({ id: `t-exp-${tool.id}`, title: 'Tool Expired', message: `${tool.name} (${tool.serialNumber}) certification has expired.`, type: 'error', link: `/tools?q=${encodeURIComponent(tool.serialNumber)}` });
            } else if (daysLeft <= 30) {
                notifications.push({ id: `t-warn-${tool.id}`, title: 'Tool Expiring Soon', message: `${tool.name} (${tool.serialNumber}) expires in ${daysLeft} days.`, type: 'warning', link: `/tools?q=${encodeURIComponent(tool.serialNumber)}` });
            }
        });

        personnel.forEach(person => {
            // Techs only see their own personnel warnings
            if (userRole === 'Tech') {
                const isCurrentUser = person.id === useStore.getState().userId;
                if (!isCurrentUser) return;
            }

            person.certifications.forEach(cert => {
                if (!cert.expirationDate) return;
                const daysLeft = differenceInDays(parseISO(cert.expirationDate), new Date());
                if (daysLeft < 0) {
                    notifications.push({ id: `p-exp-${person.id}-${cert.name}`, title: 'Certification Expired', message: `${person.name}'s ${cert.name} has expired.`, type: 'error', link: `/personnel?q=${encodeURIComponent(person.name)}` });
                } else if (daysLeft <= 30) {
                    notifications.push({ id: `p-warn-${person.id}-${cert.name}`, title: 'Certification Expiring', message: `${person.name}'s ${cert.name} expires in ${daysLeft} days.`, type: 'warning', link: `/personnel?q=${encodeURIComponent(person.name)}` });
                }
            });
        });

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const pendingReports = reports.filter(r => r.state === 'Pending Manager Review');
            pendingReports.forEach(r => {
                notifications.push({
                    id: `rep-mgr-${r.id}`,
                    title: 'Report Approval Required',
                    message: `Report ${r.id} (${r.projectName}) is awaiting your review.`,
                    type: 'warning',
                    link: `/reports/${r.id}`
                });
            });
        }
    } else {
        const pendingReports = reports.filter(r => r.clientId === clientId && r.state === 'Pending Customer Review');
        pendingReports.forEach(r => {
            notifications.push({
                id: `rep-cust-${r.id}`,
                title: 'Review Required',
                message: `Report ${r.id} for project ${r.projectName} is pending your approval.`,
                type: 'warning',
                link: `/reports/${r.id}`
            });
        });
    }

    useEffect(() => {
        // Reveal animation
        gsap.fromTo(
            '.nav-item',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
        );
    }, []);

    const navGroups = [
        {
            name: 'OPERATIONS',
            links: [
                { name: 'Projects', path: '/projects', icon: Home, roles: ['Tech', 'Supervisor', 'Manager', 'Customer'] },
                { name: 'Live Map', path: '/live-map', icon: MapIcon, roles: ['Supervisor', 'Manager'] },
                { name: 'Reports', path: '/reports', icon: FileText, roles: ['Supervisor', 'Manager', 'Customer'] },
                { name: 'Timesheets', path: '/timesheets', icon: Clock, roles: ['Tech', 'Supervisor', 'Manager'] },
            ]
        },
        {
            name: 'RESOURCES',
            links: [
                { name: 'Personnel', path: '/personnel', icon: User, roles: ['Supervisor', 'Manager'] },
                { name: 'Tools', path: '/tools', icon: Wrench, roles: ['Supervisor', 'Manager'] },
            ]
        },
        {
            name: 'INTELLIGENCE',
            links: [
                { name: 'Data Analysis', path: '/analysis', icon: Activity, roles: ['Supervisor', 'Manager'] },
                { name: 'Calendar', path: '/calendar', icon: CalendarIcon, roles: ['Supervisor', 'Manager'] },
            ]
        },
        {
            name: 'SYSTEM',
            links: [
                { name: 'Templates', path: '/templates', icon: CheckSquare, roles: ['Supervisor', 'Manager'] },
                { name: 'Settings', path: '/settings', icon: Settings, roles: ['Supervisor', 'Manager'] },
            ]
        }
    ];

    const flatNavLinks = navGroups.flatMap(g => g.links).filter(link => link.roles.includes(userRole));

    const handleCreateCustomer = () => {
        if (!newCustomerName) return;
        const newClient = {
            id: `CUST_${newCustomerName.toUpperCase().replace(/\s+/g, '_')}`,
            name: newCustomerName,
            logo: newCustomerLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(newCustomerName)}&background=random&color=fff`,
        };
        addClient(newClient);
        setIsCreateCustomerOpen(false);
        setNewCustomerName('');
        setNewCustomerLogo('');
        alert(`Company ${newCustomerName} saved successfully!`);
    };

    const handleCreateProject = () => {
        if (!newProjectName || !newProjectClient) return;

        // Basic Coordinate or Address Validation
        if (newProjectLocation) {
            const isCoord = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(newProjectLocation.trim());
            if (!isCoord && newProjectLocation.trim().length < 5) {
                setLocationError("Please enter valid GPS coordinates (lat, lng) or a full address.");
                return;
            }
        }
        setLocationError('');

        const newProj: Project = {
            id: `PROJ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            clientId: newProjectClient,
            name: newProjectName,
            codeName: newProjectCodeName,
            type: newProjectType,
            status: 'Active' as const,
            progress: 0,
            scopes: [],
            location: newProjectLocation,
            projectSize: newProjectSize,
            systemType: newProjectSystemType,
        };
        addProject(newProj);
        setIsCreateProjectOpen(false);
        setNewProjectName('');
        setNewProjectCodeName('');
        setNewProjectClient('');
        setNewProjectLocation('');
        setNewProjectSize('');
        setNewProjectSystemType('Solar');
        
        // Open the Manage Scopes Modal directly for onboarding
        setNewlyCreatedProject(newProj);
        navigate('/projects');
    };

    const handleGetGPS = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNewProjectLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
            },
            (error) => {
                alert(`Error getting location: ${error.message}`);
            }
        );
    };

    const handleCreateReport = () => {
        if (!newReportProject) return;
        const selectedProj = projects.find(p => p.id === newReportProject);
        if (!selectedProj) return;

        const reportId = `REP-${(reports.length + 1).toString().padStart(3, '0')}`;
        const newRep = {
            id: reportId,
            projectId: selectedProj.id,
            projectName: selectedProj.name,
            clientId: selectedProj.clientId,
            date: newReportDate || new Date().toISOString().split('T')[0],
            state: 'Draft' as const,
            weather: { temp: 0, condition: 'Unknown' },
            equipment: [],
            customSections: [],
            comments: [],
            notes: '',
        };
        addReport(newRep);
        setIsCreateReportOpen(false);
        setNewReportProject('');
        setNewReportDate(new Date().toISOString().split('T')[0]);
        navigate(`/reports/${reportId}`);
    };

    return (
        <div className="flex h-screen w-full bg-surface-alt font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-gray-100 flex flex-col justify-between hidden md:flex shadow-soft z-10 relative">
                <div className="px-6 py-6 pb-2">
                    {/* Logo Setup */}
                    <div className="flex items-center gap-4 mb-8">
                        <img src="/cor-logo.png" alt="COR Solutions" className="h-[26px] object-contain" />
                        <div className="w-px h-6 bg-gray-300"></div>
                        <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-[26px] object-contain" />
                    </div>
                    <nav className="space-y-6">
                        {/* Clock In — pinned above nav groups, visible to Tech + Supervisor */}
                        {['Tech', 'Supervisor'].includes(userRole) && (() => {
                            const isClockActive = location.pathname.startsWith('/clock-in');
                            return (
                                <Link
                                    to="/clock-in"
                                    className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 font-semibold ${
                                        isClockActive
                                            ? 'bg-emerald-500/10 text-emerald-600'
                                            : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                >
                                    <Fingerprint size={18} className="text-emerald-500" />
                                    <span>Clock In</span>
                                </Link>
                            );
                        })()}
                        {navGroups.map(group => {
                            const visibleLinks = group.links.filter(link => link.roles.includes(userRole));
                            if (visibleLinks.length === 0) return null;
                            
                            return (
                                <div key={group.name} className="space-y-2">
                                    <h3 className="text-[11px] font-bold text-accent-greyLight tracking-wider px-2 mb-2">{group.name}</h3>
                                    <div className="space-y-1">
                                        {visibleLinks.map(link => {
                                            const Icon = link.icon;
                                            const isActive = location.pathname.startsWith(link.path);
                                            return (
                                                <Link
                                                    key={link.name}
                                                    to={link.path}
                                                    className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                                                        isActive 
                                                            ? 'bg-brand-teal/10 text-brand-teal font-semibold' 
                                                            : 'text-accent-greyDark hover:bg-gray-50 font-medium hover:text-brand-teal'
                                                    }`}
                                                >
                                                    <Icon size={18} className={isActive ? 'text-brand-teal' : 'text-accent-greyLight'} />
                                                    <span>{link.name}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg text-accent-greyDark">
                                <User size={20} />
                            </div>
                            <div className="text-sm">
                                <p className="font-bold text-accent-greyDark">Role</p>
                                <p className="text-xs text-gray-500">{userRole}</p>
                            </div>
                        </div>
                    </div>
                    {useStore.getState().personnel.find(p => p.id === useStore.getState().userId)?.email === 'aprovero@latnovva.com' && (
                        <select
                            value={userRole}
                            onChange={(e) => setUserRole(e.target.value as any)}
                            className="w-full bg-surface-alt border border-gray-200 rounded-xl px-3 py-2 text-sm text-accent-grey outline-none focus:ring-1 focus:ring-brand-teal mt-4"
                        >
                            <option value="Tech">Tech</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Manager">Manager</option>
                            <option value="Customer">Company</option>
                        </select>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative flex flex-col bg-[#F8FAFC]">
                {/* Desktop Top Bar */}
                <header className="hidden md:flex bg-white h-[64px] min-h-[64px] shrink-0 border-b border-gray-100 items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
                    {/* Search */}
                    <div className="flex items-center flex-1">
                        <div className="relative w-full max-w-md hidden lg:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder="Search projects, reports, tasks..."
                                className="pl-10 bg-gray-50 border-gray-200 focus-visible:ring-brand-teal h-10 rounded-xl w-full"
                            />
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        {['Tech', 'Supervisor', 'Manager'].includes(userRole) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-sm px-6">
                                        <Plus size={18} />
                                        CREATE
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl border-gray-100 shadow-xl">
                                    {['Supervisor', 'Manager'].includes(userRole) && (
                                        <>
                                            <DropdownMenuItem onClick={() => setIsCreateCustomerOpen(true)} className="cursor-pointer">
                                                New Company
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setIsCreateProjectOpen(true)} className="cursor-pointer">
                                                New Project
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuItem onClick={() => setIsCreateReportOpen(true)} className="cursor-pointer">
                                        New Report
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {['Tech', 'Supervisor', 'Manager'].includes(userRole) && <div className="w-px h-8 bg-gray-200 mx-2"></div>}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="outline-none relative p-2 text-gray-500 hover:text-brand-teal transition-colors rounded-full hover:bg-gray-100">
                                    <Bell size={20} />
                                    {notifications.length > 0 && (
                                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[9px] text-white flex items-center justify-center font-bold">
                                            {notifications.length}
                                        </span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 rounded-xl border-gray-100 shadow-xl max-h-[400px] overflow-y-auto">
                                <DropdownMenuLabel>Alerts & Notifications</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                if (n.link) navigate(n.link);
                                            }}
                                            className={`p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex gap-3 items-start ${n.link ? 'cursor-pointer' : ''}`}
                                        >
                                            <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                <AlertTriangle size={14} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-accent-greyDark">{n.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="outline-none flex items-center gap-2">
                                    <Avatar className="h-9 w-9 border-2 border-transparent hover:border-brand-teal transition-all cursor-pointer">
                                        <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
                                        <AvatarFallback className="bg-brand-teal/10 text-brand-teal font-semibold text-sm">US</AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl border-gray-100 shadow-xl">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer">Profile Settings</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer">Notification Preferences</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">Log out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Mobile Header */}
                <header className="md:hidden bg-white p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <img src="/cor-logo.png" alt="COR" className="h-4 object-contain" />
                        <div className="w-px h-4 bg-gray-200"></div>
                        <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-4 object-contain" />
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 text-gray-500 rounded-full bg-gray-50">
                            <Search size={18} />
                        </button>
                        <button className="relative p-2 text-gray-500 rounded-full bg-gray-50">
                            <Bell size={18} />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                    </div>
                </header>

                <div className="p-4 md:p-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
                    <Outlet />
                    
                    {/* Global Footer (Desktop & Mobile) */}
                    <div className="mt-auto pt-16 pb-6 border-t border-transparent flex flex-col items-center gap-4 w-full">
                        <img src="/APROVERO_LOGO.png" alt="Aprovero Logo" className="h-[28px] opacity-80" />
                        <p className="text-[10px] text-gray-400 text-center leading-relaxed px-4 font-bold border-t border-gray-200 pt-4 pb-12 w-full max-w-sm">
                            &copy; {new Date().getFullYear()} LATNOVVA & COR Solutions.<br/>All Rights Reserved.<br/><span className="italic font-normal">Powered by aprovero</span>
                        </p>
                    </div>
                </div>
            </main>

            {/* Bottom Nav Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-gray-100 flex justify-around p-3 z-30 pb-safe shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
                {/* Clock In pinned first for Tech/Supervisor */}
                {['Tech', 'Supervisor'].includes(userRole) && (
                    <Link
                        to="/clock-in"
                        className={`flex flex-col items-center p-2 rounded-xl transition-colors ${location.pathname.startsWith('/clock-in') ? 'text-emerald-600' : 'text-emerald-500'}`}
                    >
                        <Fingerprint size={24} className="mb-1" />
                        <span className="text-[10px] font-semibold">Clock In</span>
                    </Link>
                )}
                {flatNavLinks.slice(0, ['Tech', 'Supervisor'].includes(userRole) ? 4 : 5).map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.path);
                    return (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive ? 'text-brand-teal' : 'text-accent-grey'}`}
                        >
                            <Icon size={24} className="mb-1" />
                            <span className="text-[10px] font-semibold">{link.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Dialogs */}
            <Dialog open={isCreateCustomerOpen} onOpenChange={setIsCreateCustomerOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Company</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="customerName">Company Name</Label>
                            <Input
                                id="customerName"
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="Enter company name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="customerLogo">Logo Thumbnail (Optional)</Label>
                            <div className="flex items-center gap-4">
                                {newCustomerLogo && (
                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 shrink-0">
                                        <img src={newCustomerLogo} alt="Logo preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <Input
                                    id="customerLogo"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setNewCustomerLogo(reader.result as string);
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
                        <Button variant="outline" onClick={() => setIsCreateCustomerOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCustomer}>Save Company</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="projectName">Project Name</Label>
                            <Input
                                id="projectName"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="Enter project name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="projectCodeName">Code Name / Notation (Optional)</Label>
                            <Input
                                id="projectCodeName"
                                value={newProjectCodeName}
                                onChange={(e) => setNewProjectCodeName(e.target.value)}
                                placeholder="E.g., EST-LNV-000 CDMX"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Client</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={newProjectClient}
                                onChange={(e) => setNewProjectClient(e.target.value)}
                            >
                                <option value="" disabled>Select a client</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Project Type</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={newProjectType}
                                onChange={(e) => setNewProjectType(e.target.value as any)}
                            >
                                <option value="Complete">Complete (with phases)</option>
                                <option value="Simple">Simple (single goal)</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="projectLocation">Site Location (Address or Coordinates)</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="projectLocation"
                                    value={newProjectLocation}
                                    onChange={(e) => {
                                        setNewProjectLocation(e.target.value);
                                        setLocationError('');
                                    }}
                                    placeholder="E.g., 123 Solar Way or 30.2672, -97.7431"
                                    className="flex-1"
                                />
                                <Button type="button" variant="outline" onClick={handleGetGPS} className="px-3" title="Get Current GPS Location">
                                    <Fingerprint size={18} className="text-emerald-500" />
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => {
                                        if (newProjectLocation.trim()) setIsPreviewMapOpen(true);
                                    }} 
                                    className={`px-3 ${newProjectLocation.trim() ? 'border-brand-teal text-brand-teal bg-brand-teal/5' : ''}`}
                                    title="Validate on Map"
                                    disabled={!newProjectLocation.trim()}
                                >
                                    <MapIcon size={18} />
                                </Button>
                            </div>
                            {locationError && <p className="text-xs text-red-500 font-medium">{locationError}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="projectSize">Project Size</Label>
                            <Input
                                id="projectSize"
                                value={newProjectSize}
                                onChange={(e) => setNewProjectSize(e.target.value)}
                                placeholder="E.g., 50 MW"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>System Type</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={newProjectSystemType}
                                onChange={(e) => setNewProjectSystemType(e.target.value)}
                            >
                                <option value="Solar">Solar</option>
                                <option value="BESS">BESS</option>
                                <option value="Hybrid">Hybrid</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateProjectOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateProject}>Create Project</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateReportOpen} onOpenChange={setIsCreateReportOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create Daily Report</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Select Company</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={newReportCompany}
                                onChange={(e) => {
                                    setNewReportCompany(e.target.value);
                                    setNewReportProject('');
                                }}
                            >
                                <option value="" disabled>Select a company</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Select Project</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={newReportProject}
                                onChange={(e) => setNewReportProject(e.target.value)}
                                disabled={!newReportCompany}
                            >
                                <option value="" disabled>Select a project</option>
                                {projects.filter(p => p.status === 'Active' && p.clientId === newReportCompany).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="reportDate">Report Date</Label>
                            <Input
                                id="reportDate"
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

            {newlyCreatedProject && (
                <AddScopeModal 
                    open={!!newlyCreatedProject} 
                    onOpenChange={(open) => !open && setNewlyCreatedProject(null)} 
                    project={newlyCreatedProject} 
                />
            )}

            <Dialog open={isPreviewMapOpen} onOpenChange={setIsPreviewMapOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl border-none">
                    <div className="bg-brand-teal p-4 text-white flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <MapIcon className="w-5 h-5" />
                            Location Validation
                        </DialogTitle>
                    </div>
                    <div className="p-4 bg-white space-y-4">
                        <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <MapPin className="text-brand-teal shrink-0 mt-0.5" size={18} />
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Previewing Location</p>
                                <p className="accent-greyDark font-medium text-sm">{newProjectLocation}</p>
                            </div>
                        </div>

                        <div className="w-full h-[350px] rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-50">
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(newProjectLocation)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                allowFullScreen
                            />
                        </div>
                        
                        <div className="flex justify-between items-center pt-2">
                            <p className="text-[10px] text-gray-400 italic font-medium max-w-[250px]">
                                Confirm the pin matches your equipment's site location.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setIsPreviewMapOpen(false)}>Close Preview</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
