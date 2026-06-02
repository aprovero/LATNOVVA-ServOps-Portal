import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Settings, User, Search, Bell, CheckSquare, AlertTriangle, Clock, MapPin, Map as MapIcon, Fingerprint, Download, X, UploadCloud, Trash2, FileSpreadsheet } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useStore, Project } from '../../store/useStore';
import { useAuthStore } from '../../lib/authStore';
import { useTranslation } from 'react-i18next';
import { AddScopeModal } from '../project/AddScopeModal';
import gsap from 'gsap';
import { SyncStatus } from '../SyncStatus';

import CommandSearch from '../search/CommandSearch';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
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
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { userRole, setAuthData, personnel, updatePersonnel, clients, projects, addClient, addProject, reports, addReport, clientId, dismissedNotifications, dismissNotification, clearNotifications, platformSettings } = useStore();
    const { canInstall, triggerInstall } = usePWAInstall();
    const { signOut } = useAuthStore();

    // Dialog States
    const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
    const [isOfflineLogoutWarningOpen, setIsOfflineLogoutWarningOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [accountDocuments, setAccountDocuments] = useState<{ id: string; name: string; url: string; type: string; uploadDate: string; }[]>([]);
    const [accountDbo, setAccountDbo] = useState('');
    const [accountEmployeeNumber, setAccountEmployeeNumber] = useState('');
    const [accountEmergencyContactName, setAccountEmergencyContactName] = useState('');
    const [accountEmergencyContactPhone, setAccountEmergencyContactPhone] = useState('');
    const [accountImage, setAccountImage] = useState('');
    const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);

    // Command Search
    const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);

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
    const [locationError, setLocationError] = useState('');
    // Compute Notifications
    const notifications: { id: string; title: string; message: string; type: 'warning' | 'error', link?: string }[] = [];

    if (userRole !== 'Customer') {
        // [DISABLED] Certification expiry warnings - requested to hide due to noise
        /*
        (tools || []).forEach(tool => {
            if (!tool.certificationExpiry) return;
            const daysLeft = differenceInDays(parseISO(tool.certificationExpiry), new Date());
            if (daysLeft < 0) {
                notifications.push({ id: `t-exp-${tool.id}`, title: t('notifications.tool_expired', 'Tool Expired'), message: `${tool.name} (${tool.serialNumber}) ${t('notifications.expired_desc', 'certification has expired')}.`, type: 'error', link: `/tools?q=${encodeURIComponent(tool.serialNumber)}` });
            } else if (daysLeft <= 30) {
                notifications.push({ id: `t-warn-${tool.id}`, title: t('notifications.tool_expiring', 'Tool Expiring Soon'), message: `${tool.name} (${tool.serialNumber}) ${t('notifications.expires_in_days', 'expires in {{days}} days', { days: daysLeft })}.`, type: 'warning', link: `/tools?q=${encodeURIComponent(tool.serialNumber)}` });
            }
        });

        const resolvedId = useStore.getState().resolvePersonnelId();
        personnel.forEach(person => {
            // Techs only see their own personnel warnings
            if (userRole === 'Tech') {
                const isCurrentUser = person.id === resolvedId;
                if (!isCurrentUser) return;
            }

            (person.certifications || []).forEach(cert => {
                if (!cert.expirationDate) return;
                const daysLeft = differenceInDays(parseISO(cert.expirationDate), new Date());
                if (daysLeft < 0) {
                    notifications.push({ id: `p-exp-${person.id}-${cert.name}`, title: t('notifications.cert_expired', 'Certification Expired'), message: `${person.name}'s ${cert.name} ${t('notifications.expired_desc', 'has expired')}.`, type: 'error', link: `/personnel?q=${encodeURIComponent(person.name)}` });
                } else if (daysLeft <= 30) {
                    notifications.push({ id: `p-warn-${person.id}-${cert.name}`, title: t('notifications.cert_expiring', 'Certification Expiring'), message: `${person.name}'s ${cert.name} ${t('notifications.expires_in_days', 'expires in {{days}} days', { days: daysLeft })}.`, type: 'warning', link: `/personnel?q=${encodeURIComponent(person.name)}` });
                }
            });
        });
        */

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const pendingReports = (reports || []).filter(r => r.state === 'Pending Manager Review');
            pendingReports.forEach(r => {
                notifications.push({
                    id: `rep-mgr-${r.id}`,
                    title: t('notifications.report_approval', 'Report Approval Required'),
                    message: `${t('reports.report')} ${r.id} (${r.projectName}) ${t('notifications.awaiting_review', 'is awaiting your review')}.`,
                    type: 'warning',
                    link: `/reports/${r.id}`
                });
            });
        }
    } else {
        const pendingReports = (reports || []).filter(r => r.clientId === clientId && r.state === 'Pending Customer Review');
        pendingReports.forEach(r => {
            notifications.push({
                id: `rep-cust-${r.id}`,
                title: t('notifications.review_required', 'Review Required'),
                message: `${t('reports.report')} ${r.id} ${t('common.for')} ${t('projects.table.project')} ${r.projectName} ${t('notifications.pending_approval', 'is pending your approval')}.`,
                type: 'warning',
                link: `/reports/${r.id}`
            });
        });
    }

    // ── Proactive Shift Check (H-01) ──
    const myPersonId = useStore.getState().resolvePersonnelId();
    if (myPersonId && ['Tech', 'Supervisor'].includes(userRole) && platformSettings.enableShiftNotifications) {
        const activeSession = useStore.getState().timesheets.find(t => t.personnelId === myPersonId && t.timeIn && !t.timeOut);
        if (activeSession && activeSession.punches) {
            const inPunch = activeSession.punches.find(p => p.type === 'clockIn');
            if (inPunch) {
                const hours = (new Date().getTime() - new Date(inPunch.timestamp).getTime()) / 3600000;
                if (hours >= platformSettings.shiftLengthThreshold) {
                    const notificationId = `long-shift-${myPersonId}-${activeSession.id}`;
                    const title = t('notifications.long_shift_title', 'HEY!');
                    const message = t('notifications.long_shift_desc', "Did you forget to check out? You've been working for more than {{hours}} hours.", { hours: platformSettings.shiftLengthThreshold });
                    
                    notifications.push({
                        id: notificationId,
                        title,
                        message,
                        type: 'warning',
                        link: '/clock-in'
                    });

                    // Push Browser Notification if permission granted and not already dismissed
                    if (!dismissedNotifications.includes(notificationId) && 'Notification' in window && Notification.permission === 'granted') {
                        // Only trigger if we haven't shown it recently for this specific shift
                        const lastNotif = sessionStorage.getItem(`notif_${notificationId}`);
                        if (!lastNotif) {
                            new Notification(title, {
                                body: message,
                                icon: '/pwa-192x192.png',
                                tag: notificationId
                            });
                            sessionStorage.setItem(`notif_${notificationId}`, 'true');
                        }
                    }
                }
            }
        }
    }

    // Filter out dismissed notifications
    const activeNotifications = notifications.filter(n => !dismissedNotifications.includes(n.id));

    useEffect(() => {
        // Reveal animation
        if (document.querySelector('.nav-item')) {
            gsap.fromTo(
                '.nav-item',
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
            );
        }
    }, []);

    const navGroups = [
        {
            name: t('nav.operations'),
            links: [
                { name: t('nav.live_map'), path: '/live-map', icon: MapIcon, roles: ['Supervisor', 'Manager'] },
                { name: t('nav.projects'), path: '/projects', icon: Home, roles: ['Tech', 'Supervisor', 'Manager', 'Customer', 'Office', 'HR'] },
            ]
        },
        {
            name: t('nav.resources'),
            links: [
                { name: t('nav.personnel'), path: '/personnel', icon: User, roles: ['Supervisor', 'Manager', 'HR'] },
                { name: t('nav.timesheets'), path: '/timesheets', icon: Clock, roles: ['Tech', 'Supervisor', 'Manager', 'HR', 'Office'] },
                { name: 'Nómina', path: '/nomina', icon: FileSpreadsheet, roles: ['Manager', 'HR'] },
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
        alert(t('projects.alerts.company_saved', 'Company {{name}} saved successfully!', { name: newCustomerName }));
    };

    const handleCreateProject = () => {
        if (!newProjectName || !newProjectClient) return;

        // Basic Coordinate or Address Validation
        if (newProjectLocation) {
            const isCoord = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(newProjectLocation.trim());
            if (!isCoord && newProjectLocation.trim().length < 5) {
                setLocationError(t('projects.alerts.invalid_gps', 'Please enter valid GPS coordinates (lat, lng) or a full address.'));
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
            alert(t('projects.alerts.gps_not_supported', 'Geolocation is not supported by your browser'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNewProjectLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
            },
            (error) => {
                alert(`${t('common.error')} ${t('projects.alerts.location_error', 'getting location')}: ${error.message}`);
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

    const { updateAccount, user } = useAuthStore();

    const handleAccountUpdate = async () => {
        if (!accountName) return;
        setIsUpdatingAccount(true);
        try {
            await updateAccount(accountName, accountPassword || undefined);
            
            // Also update the personnel record in the database
            const resId = useStore.getState().resolvePersonnelId();
            if (resId) {
                await updatePersonnel(resId, {
                    name: accountName,
                    dbo: accountDbo,
                    employeeNumber: accountEmployeeNumber,
                    emergencyContactName: accountEmergencyContactName,
                    emergencyContactPhone: accountEmergencyContactPhone,
                    image: accountImage,
                    documents: accountDocuments
                });
            }

            setIsAccountModalOpen(false);
            setAccountPassword('');
            alert(t('common.saved', 'Changes saved successfully!'));
        } catch (err: any) {
            alert(t('common.error_saving', 'Error saving changes') + ': ' + err.message);
        } finally {
            setIsUpdatingAccount(false);
        }
    };

    useEffect(() => {
        if (isAccountModalOpen) {
            if (user?.user_metadata?.name) {
                setAccountName(user.user_metadata.name);
            }
            const resId = useStore.getState().resolvePersonnelId();
            const person = personnel.find(p => p.id === resId);
            if (person) {
                setAccountDbo(person.dbo || '');
                setAccountEmployeeNumber(person.employeeNumber || '');
                setAccountEmergencyContactName(person.emergencyContactName || '');
                setAccountEmergencyContactPhone(person.emergencyContactPhone || '');
                setAccountImage(person.image || '');
                setAccountDocuments(person.documents || []);
            }
        }
    }, [isAccountModalOpen, user, personnel]);

    return (
        <div className="flex h-screen w-full bg-surface-alt font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-gray-100 flex flex-col justify-between hidden md:flex shadow-soft z-10 relative">
                <div className="px-6 py-6 pb-2">
                    {/* Logo Setup */}
                    <div className="flex items-center gap-4 mb-8">
                        <img src="/S&S-logo.png" alt="Servicios y Soluciones" className="h-[26px] object-contain" />
                        <div className="w-px h-6 bg-gray-300"></div>
                        <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-[26px] object-contain" />
                    </div>
                    <nav className="space-y-6">
                        {/* Clock In — pinned above nav groups, visible to Tech + Supervisor + Office */}
                        {['Tech', 'Supervisor', 'Office'].includes(userRole) && (() => {
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
                                    <span>{t('nav.clock_in')}</span>
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
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 border border-gray-100 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                            {(() => {
                                const resId = useStore.getState().resolvePersonnelId();
                                const person = personnel.find(p => p.id === resId);
                                if (person?.image) {
                                    return <img src={person.image} alt={person.name} className="w-full h-full object-cover" />;
                                }
                                return <User size={18} className="text-accent-greyDark" />;
                            })()}
                        </div>
                        <div className="text-sm min-w-0">
                            <p className="font-bold text-accent-greyDark truncate">
                                {useStore.getState().getCurrentUserName()}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{t(`auth.${userRole.toLowerCase()}`, userRole)}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative flex flex-col bg-[#F8FAFC]">
                {/* Desktop Top Bar */}
                <header className="hidden md:flex bg-white h-[64px] min-h-[64px] shrink-0 border-b border-gray-100 items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
                    {/* Search placeholder for alignment */}
                    <div className="flex items-center flex-1">
                        <CommandSearch
                            onNewReport={() => setIsCreateReportOpen(true)}
                            onNewProject={() => setIsCreateProjectOpen(true)}
                            isOpen={isSearchPaletteOpen}
                            onOpenChange={setIsSearchPaletteOpen}
                            showButton={true}
                            showModal={false}
                            isGlobal={false}
                        />
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">

                        <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100 mr-2 px-3">
                            <img src="https://flagcdn.com/w20/mx.png" srcSet="https://flagcdn.com/w40/mx.png 2x" width="20" alt="MX" className="mr-2 rounded-sm" title="Mexico Portal" />
                            <span className="text-xs font-bold text-gray-500 hidden sm:inline">LATNOVVA MEXICO</span>
                            {['Admin', 'Manager', 'HR'].includes(userRole || '') && (
                                <>
                                    <div className="w-px h-4 bg-gray-200 mx-2"></div>
                                    <button 
                                        onClick={() => window.location.href = "https://latnovvaservops.onrender.com"}
                                        className="opacity-50 hover:opacity-100 hover:scale-110 transition-all flex items-center justify-center p-1 rounded-md hover:bg-gray-200"
                                        title="Switch to US Portal"
                                    >
                                        <img src="https://flagcdn.com/w20/us.png" srcSet="https://flagcdn.com/w40/us.png 2x" width="20" alt="US" className="rounded-sm" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* PWA Install Button — only shown when installable */}
                        {canInstall && (
                            <button
                                id="pwa-install-btn-desktop"
                                onClick={() => triggerInstall()}
                                className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-brand-teal/10 border border-brand-teal/30 rounded-xl hover:bg-brand-teal/20 transition-all duration-200 text-brand-teal outline-none group"
                                title="Install LATNOVVA Service Operations as an app"
                            >
                                <Download size={13} className="shrink-0 group-hover:translate-y-0.5 transition-transform" />
                                <span className="text-xs font-semibold">{t('common.install', 'Install App')}</span>
                            </button>
                        )}
                        
                        <SyncStatus />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="outline-none relative p-2 text-gray-500 hover:text-brand-teal transition-colors rounded-full hover:bg-gray-100">
                                    <Bell size={20} />
                                    {activeNotifications.length > 0 && (
                                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[9px] text-white flex items-center justify-center font-bold">
                                            {activeNotifications.length}
                                        </span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 rounded-xl border-gray-100 shadow-xl overflow-hidden flex flex-col max-h-[480px]">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                                    <DropdownMenuLabel className="p-0 font-bold text-accent-greyDark">{t('notifications.title_badge', 'Alerts & Notifications')}</DropdownMenuLabel>
                                    {activeNotifications.length > 0 && (
                                        <button 
                                            onClick={() => clearNotifications(activeNotifications.map((n: any) => n.id))}
                                            className="text-[10px] font-bold text-brand-teal hover:text-brand-teal/80 uppercase tracking-widest"
                                        >
                                            {t('common.clear_all', 'Clear All')}
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-y-auto">
                                    {activeNotifications.length === 0 ? (
                                        <div className="p-10 text-center text-sm text-gray-500 flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                                <Bell size={24} />
                                            </div>
                                            <p>{t('notifications.empty', 'No new notifications')}</p>
                                        </div>
                                    ) : (
                                        activeNotifications.map((n: any) => (
                                            <div 
                                                key={n.id} 
                                                className={`p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex gap-3 items-start relative group outline-none`}
                                            >
                                                <div 
                                                    className={`mt-0.5 p-1.5 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}
                                                    onClick={() => n.link && navigate(n.link)}
                                                >
                                                    <AlertTriangle size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0" onClick={() => n.link && navigate(n.link)}>
                                                    <p className="text-sm font-bold text-accent-greyDark leading-tight">{n.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dismissNotification(n.id);
                                                    }}
                                                    className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                    title="Dismiss"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Gear menu — all roles see Log out; Manager+Supervisor also see Settings & Templates */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="outline-none flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 hover:bg-brand-teal/10 text-accent-greyLight hover:text-brand-teal transition-all">
                                    <Settings size={18} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-gray-100 shadow-xl">
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setIsAccountModalOpen(true)}>
                                    <User size={14} className="text-gray-400" /> {t('nav.my_profile', 'My Profile')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {(['Manager', 'Supervisor', 'HR'].includes(userRole)) && (
                                    <>
                                        <DropdownMenuLabel className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2 py-1.5">{t('auth.admin', 'Admin')}</DropdownMenuLabel>
                                        
                                        {userRole === 'Manager' && (
                                            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => navigate('/settings')}>
                                                <Settings size={14} className="text-gray-400" /> {t('nav.settings')}
                                            </DropdownMenuItem>
                                        )}
                                        

                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuSeparator />

                                <DropdownMenuItem 
                                    className="cursor-pointer flex items-center justify-center p-0 hover:bg-transparent focus:bg-transparent" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
                                    }}
                                >
                                    <div className="flex items-center gap-0 bg-gray-50 rounded-lg p-1 w-full border border-gray-100">
                                        <div className={`flex-1 py-1 text-center text-[10px] font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}>
                                            EN
                                        </div>
                                        <div className={`flex-1 py-1 text-center text-[10px] font-bold rounded-md transition-all ${i18n.language === 'es' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}>
                                            ES
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 gap-2"
                                    onClick={() => {
                                        if (!navigator.onLine) {
                                            setIsOfflineLogoutWarningOpen(true);
                                        } else {
                                            signOut();
                                        }
                                    }}
                                >
                                    {t('auth.logout')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                    </div>
                </header>

                {/* Mobile Header */}
                <header className="md:hidden bg-white p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <img src="/S&S-logo.png" alt="S&S" className="h-4 object-contain" />
                        <div className="w-px h-4 bg-gray-200"></div>
                        <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-4 object-contain" />
                    </div>
                    <div className="flex items-center gap-3">
                        {/* PWA Install — mobile */}
                        {canInstall && (
                            <button
                                id="pwa-install-btn-mobile"
                                onClick={() => triggerInstall()}
                                className="p-2 text-brand-teal rounded-full bg-brand-teal/10 hover:bg-brand-teal/20 transition-colors"
                                aria-label={t('common.install')}
                                title={t('common.install_title', 'Install LATNOVVA Service Operations')}
                            >
                                <Download size={18} />
                            </button>
                        )}
                        {/* Search — opens command palette */}
                        <button
                            onClick={() => setIsSearchPaletteOpen(true)}
                            className="p-2 text-gray-500 hover:text-brand-teal rounded-full bg-gray-50 hover:bg-teal-50 transition-colors"
                            aria-label="Open search"
                        >
                            <Search size={18} />
                        </button>
                        {/* Notifications bell */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="relative p-2 text-gray-500 rounded-full bg-gray-50 outline-none">
                                    <Bell size={18} />
                                    {activeNotifications.length > 0 && (
                                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 rounded-xl border-gray-100 shadow-xl overflow-hidden flex flex-col max-h-[400px]">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                                    <DropdownMenuLabel className="p-0 font-bold text-accent-greyDark">{t('nav.notifications', 'Alerts & Notifications')}</DropdownMenuLabel>
                                    {activeNotifications.length > 0 && (
                                        <button 
                                            onClick={() => clearNotifications(activeNotifications.map((n: any) => n.id))}
                                            className="text-[10px] font-bold text-brand-teal hover:text-brand-teal/80 uppercase tracking-widest"
                                        >
                                            {t('common.clear_all', 'Clear All')}
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-y-auto">
                                    {activeNotifications.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                                <Bell size={20} />
                                            </div>
                                            <p>{t('notifications.empty', 'No new notifications')}</p>
                                        </div>
                                    ) : (
                                        activeNotifications.map((n: any) => (
                                            <div 
                                                key={n.id} 
                                                className={`p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex gap-3 items-start relative group outline-none`}
                                            >
                                                <div 
                                                    className={`mt-0.5 p-1.5 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}
                                                    onClick={() => n.link && navigate(n.link)}
                                                >
                                                    <AlertTriangle size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0" onClick={() => n.link && navigate(n.link)}>
                                                    <p className="text-sm font-bold text-accent-greyDark leading-tight">{n.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dismissNotification(n.id);
                                                    }}
                                                    className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                    title="Dismiss"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-6 bg-gray-100 mx-1"></div>

                        {/* Gear menu — mobile */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="outline-none flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 hover:bg-brand-teal/10 text-gray-400 hover:text-brand-teal transition-all">
                                    <Settings size={18} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-gray-100 shadow-xl">
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setIsAccountModalOpen(true)}>
                                    <User size={14} className="text-gray-400" /> {t('nav.my_profile', 'My Profile')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {(['Manager', 'Supervisor', 'HR'].includes(userRole)) && (
                                    <>
                                        <DropdownMenuLabel className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2 py-1.5">{t('auth.admin', 'Admin')}</DropdownMenuLabel>
                                        
                                        {userRole === 'Manager' && (
                                            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => navigate('/settings')}>
                                                <Settings size={14} className="text-gray-400" /> {t('nav.settings')}
                                            </DropdownMenuItem>
                                        )}
                                        
                                        {['Manager', 'Supervisor'].includes(userRole) && (
                                            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => navigate('/templates')}>
                                                <CheckSquare size={14} className="text-gray-400" /> {t('nav.templates')}
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuItem 
                                    className="cursor-pointer flex items-center justify-center p-0 hover:bg-transparent focus:bg-transparent" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
                                    }}
                                >
                                    <div className="flex items-center gap-0 bg-gray-50 rounded-lg p-1 w-full border border-gray-100">
                                        <div className={`flex-1 py-1 text-center text-[10px] font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}>
                                            EN
                                        </div>
                                        <div className={`flex-1 py-1 text-center text-[10px] font-bold rounded-md transition-all ${i18n.language === 'es' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}>
                                            ES
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 gap-2" onClick={() => signOut()}>
                                    {t('auth.logout')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>


                <div className="p-4 md:p-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
                    <Outlet />
                </div>

                {/* Global Search Component - handles its own modal triggered by CMD+K or mobile/header triggers */}
                <CommandSearch
                    onNewReport={() => setIsCreateReportOpen(true)}
                    onNewProject={() => setIsCreateProjectOpen(true)}
                    isOpen={isSearchPaletteOpen}
                    onOpenChange={setIsSearchPaletteOpen}
                    showButton={false}
                    showModal={true}
                    isGlobal={true}
                />
                
                {/* Global Footer (Desktop & Mobile) */}
                <div className="mt-auto py-6 px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 w-full opacity-60 hover:opacity-100 transition-opacity bg-white/50 border-t border-gray-100 mix-blend-multiply">
                    <div className="text-[10px] text-accent-grey/50 text-center md:text-left font-bold uppercase tracking-wider">
                        &copy; {new Date().getFullYear()} LATNOVVA & COR Solutions. All Rights Reserved.
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-2">
                        <span className="text-[10px] italic text-accent-grey/60">Powered by</span>
                        <img src="/APROVERO_LOGO.png" alt="Aprovero Logo" className="h-[20px] md:h-[24px] object-contain mix-blend-multiply" />
                    </div>
                </div>
            </main>

            {/* Bottom Nav Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-gray-100 flex overflow-x-auto no-scrollbar items-center p-3 z-30 pb-safe shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] gap-1">
                {/* Clock In pinned first for Tech/Supervisor/Office */}
                {['Tech', 'Supervisor', 'Office'].includes(userRole) && (
                    <Link
                        to="/clock-in"
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors shrink-0 min-w-[72px] ${location.pathname.startsWith('/clock-in') ? 'text-emerald-600' : 'text-emerald-500'}`}
                    >
                        <Fingerprint size={24} className="mb-1" />
                        <span className="text-[10px] font-semibold">{t('nav.clock_in')}</span>
                    </Link>
                )}
                {flatNavLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.path);
                    return (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors shrink-0 min-w-[72px] ${isActive ? 'text-brand-teal' : 'text-accent-grey'}`}
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
                            <Label>Select Project</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none max-h-60"
                                value={newReportProject}
                                onChange={(e) => {
                                    setNewReportProject(e.target.value);
                                }}
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

            {/* ── Offline Logout Warning ─────────────────────────────────────── */}
            <Dialog open={isOfflineLogoutWarningOpen} onOpenChange={setIsOfflineLogoutWarningOpen}>
                <DialogContent className="max-w-sm rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle size={18} className="shrink-0" />
                            You're offline
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Your device has no internet connection. Any changes you made since going offline
                        may <strong>not</strong> have been saved to the server yet.
                    </p>
                    <p className="text-sm text-gray-500">
                        If you log out now, those unsaved changes could be lost. We recommend staying
                        signed in until your connection is restored.
                    </p>
                    <DialogFooter className="flex gap-2 mt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setIsOfflineLogoutWarningOpen(false)}
                        >
                            Stay Signed In
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => {
                                setIsOfflineLogoutWarningOpen(false);
                                setAuthData('', '');
                                signOut();
                            }}
                        >
                            Log Out Anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Account Settings Modal ─────────────────────────────────────── */}
            <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                            <User size={20} className="text-brand-teal" />
                            {t('nav.my_profile', 'My Profile')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center gap-4">
                            <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">{t('personnel.profile_photo', 'Profile Photo')}</Label>
                            <div className="flex items-center gap-4 w-full">
                                <div className="w-16 h-16 rounded-full bg-brand-teal/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-brand-teal">
                                    {accountImage ? <img src={accountImage} alt="Profile" className="w-full h-full object-cover" /> : <User size={24} />}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Input 
                                        type="file" 
                                        accept="image/*" 
                                        className="h-9 text-xs cursor-pointer bg-white"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) { 
                                                const r = new FileReader(); 
                                                r.onloadend = () => setAccountImage(r.result as string); 
                                                r.readAsDataURL(file); 
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-gray-400 italic">Self-service photo update.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">{t('personnel.columns.name', 'Full Name')}</Label>
                            <Input 
                                value={accountName} 
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="E.g. John Doe"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('personnel.columns.id', 'Employee #')}</Label>
                                <Input 
                                    value={accountEmployeeNumber} 
                                    onChange={(e) => setAccountEmployeeNumber(e.target.value)}
                                    placeholder="EMP-1234"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('personnel.profile.dbo', 'Date of Birth')}</Label>
                                <Input 
                                    type="date"
                                    value={accountDbo} 
                                    onChange={(e) => setAccountDbo(e.target.value)}
                                    className="block"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 p-3 bg-brand-teal/5 rounded-xl border border-brand-teal/10">
                            <Label className="text-xs font-bold text-brand-teal uppercase tracking-wider">{t('personnel.profile.emergency_contact', 'Emergency Contact')}</Label>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase">{t('personnel.profile.emergency_contact_name', 'Contact Name')}</Label>
                                    <Input 
                                        value={accountEmergencyContactName} 
                                        onChange={(e) => setAccountEmergencyContactName(e.target.value)}
                                        placeholder="Jane Doe"
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase">{t('personnel.profile.emergency_contact_phone', 'Contact Phone')}</Label>
                                    <Input 
                                        value={accountEmergencyContactPhone} 
                                        onChange={(e) => setAccountEmergencyContactPhone(e.target.value)}
                                        placeholder="956-280-8290"
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-50">{t('personnel.profile.email', 'Email Address')}</Label>
                            <Input 
                                value={user?.email || ''} 
                                disabled 
                                className="bg-gray-50 border-gray-100 opacity-60"
                            />
                        </div>

                        <div className="space-y-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-blue-800 uppercase tracking-wider">My Documents</Label>
                            </div>
                            <div className="space-y-2">
                                {accountDocuments.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">No documents uploaded.</p>
                                ) : (
                                    accountDocuments.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between bg-white p-2 border border-gray-100 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText size={14} className="text-blue-500 shrink-0" />
                                                <span className="text-xs font-semibold truncate" title={doc.name}>{doc.name}</span>
                                            </div>
                                            <button 
                                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                onClick={() => setAccountDocuments(prev => prev.filter(d => d.id !== doc.id))}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="pt-2">
                                <Label className="flex items-center justify-center gap-2 cursor-pointer w-full bg-white border border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 rounded-xl py-4 transition-all">
                                    <UploadCloud size={18} />
                                    <span className="text-xs font-bold">Upload Document</span>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const newDoc = {
                                                    id: `doc-${Date.now()}`,
                                                    name: file.name,
                                                    url: '#', // Mock flow: don't upload anywhere yet
                                                    type: file.type || 'document',
                                                    uploadDate: new Date().toISOString()
                                                };
                                                setAccountDocuments(prev => [...prev, newDoc]);
                                            }
                                        }}
                                    />
                                </Label>
                                <p className="text-[10px] text-gray-400 text-center mt-2">Upload driver's licenses, tax forms, etc. Max 5MB.</p>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <Label className="text-sm font-semibold">Change Password</Label>
                            <Input 
                                type="password" 
                                value={accountPassword} 
                                onChange={(e) => setAccountPassword(e.target.value)}
                                placeholder="Enter new password to update"
                            />
                            <p className="text-[10px] text-gray-400">Leave blank to keep your current password.</p>
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setIsAccountModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold" 
                            onClick={handleAccountUpdate}
                            disabled={isUpdatingAccount || !accountName}
                        >
                            {isUpdatingAccount ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
