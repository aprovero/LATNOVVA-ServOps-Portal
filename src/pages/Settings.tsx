import { useState } from 'react';
import { useStore, Client, Personnel } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Users, Building2, Pencil, Camera, Trash2, Shield, Plus, ListChecks, X, Cloud, LogIn, LogOut, CheckCircle2, Globe, Link2, Languages } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';

export default function Settings() {
    const { t } = useTranslation();
    const { 
        userRole, userEmail, setUserRole, clients, projects, updateClient, deleteClient, personnel, addPersonnel, deletePersonnel, updatePersonnel, resetDb,
        sharepointConfig, setSharepointConfig, microsoftAuth, setMicrosoftAuth, language, setLanguage
    } = useStore();
    const [activeTab, setActiveTab] = useState<string | null>(null);

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'Tech' | 'Supervisor' | 'Manager' | 'Customer'>('Tech');
    const [inviteCompany, setInviteCompany] = useState('');

    const handleInviteUser = () => {
        if (!inviteEmail) return;
        if (inviteRole === 'Customer' && !inviteCompany) {
            alert('Please select an assigned company for this customer.');
            return;
        }
        
        addPersonnel({
            id: `usr-${Date.now()}`,
            name: inviteEmail.split('@')[0],
            email: inviteEmail,
            position: inviteRole === 'Customer' ? 'Customer Contact' : 'Invited User',
             employeeNumber: `EMP-${Math.floor(Math.random() * 1000)}`,
            status: 'Active',
            certifications: [],
            appRole: inviteRole,
            clientId: inviteRole === 'Customer' ? inviteCompany : undefined
        });
        setIsInviteModalOpen(false);
        setInviteEmail('');
        setInviteRole('Tech');
        setInviteCompany('');
    };

    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientLogo, setEditClientLogo] = useState('');

    const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
    const [editPersonnelName, setEditPersonnelName] = useState('');
    const [editPersonnelEmail, setEditPersonnelEmail] = useState('');
    const [editPersonnelRole, setEditPersonnelRole] = useState('Tech');
    const [editPersonnelCompany, setEditPersonnelCompany] = useState('');

    const handleEditClientSubmit = () => {
        if (!editingClient || !editClientName.trim()) return;
        updateClient(editingClient.id, {
            name: editClientName,
            logo: editClientLogo
        });
        setEditingClient(null);
    };

    const configTabs = [
        { id: 'companies', name: 'Companies', description: 'Manage clients and contractors', icon: Building2 },
        { id: 'users', name: 'Users', description: 'Access control and roles', icon: Users },
        { id: 'wbs', name: 'WBS Templates', description: 'Standard activities and steps', icon: ListChecks },
        { id: 'cloud', name: 'Cloud Storage', description: 'SharePoint & Central Storage config', icon: Cloud },
        { id: 'system', name: 'Sync Data', description: 'Force refresh environment data', icon: Shield },
    ];

    const tab = activeTab ? configTabs.find(t => t.id === activeTab) : null;

    return (
        <>
            {activeTab ? (
                // Inside a tab
                <div className="space-y-6 pb-20 md:pb-0">
                <button 
                    onClick={() => setActiveTab(null)}
                    className="flex items-center gap-2 text-brand-teal font-semibold hover:opacity-80 transition-opacity"
                >
                    ← Back to Settings
                </button>
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                    {activeTab === 'companies' ? (
                        <div className="bg-white border flex flex-col border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2"><Building2 className="text-brand-teal" size={24}/> Client Management</h2>
                                    <p className="text-sm text-gray-500 mt-1">Manage global clients and organization information.</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-500">
                                    <thead className="text-xs text-gray-400 uppercase bg-white border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-bold tracking-wider">Company</th>
                                            <th className="px-6 py-4 font-bold tracking-wider text-center">Active Projects</th>
                                            <th className="px-6 py-4 font-bold tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {clients.map(client => {
                                            const activeCount = projects.filter(p => p.clientId === client.id && p.status === 'Active').length;
                                            return (
                                                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal overflow-hidden border border-brand-teal/20 shrink-0">
                                                                {client.logo ? <img src={client.logo} alt={client.name} className="w-full h-full object-cover" /> : <Building2 size={20} />}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-accent-greyDark">{client.name}</p>
                                                                <p className="text-xs text-gray-400 font-mono mt-0.5">{client.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold bg-brand-teal/10 text-brand-teal border-none">
                                                            {activeCount} Active
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10" onClick={() => {
                                                            setEditingClient(client);
                                                            setEditClientName(client.name);
                                                            setEditClientLogo(client.logo || '');
                                                        }}>
                                                            <Pencil size={16} /> <span className="ml-2 font-medium hidden sm:inline">Edit</span>
                                                        </Button>
                                                        {['Manager'].includes(userRole) && (
                                                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 hover:bg-red-50 ml-2" onClick={() => {
                                                                if (window.confirm(`Are you sure you want to completely delete ${client.name}?`)) {
                                                                    deleteClient(client.id);
                                                                }
                                                            }}>
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === 'users' ? (
                        <div className="bg-white border flex flex-col border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2"><Users className="text-brand-teal" size={24}/> User Management</h2>
                                    <p className="text-sm text-gray-500 mt-1">Manage global access and invite new users by email.</p>
                                </div>
                                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-semibold shadow-sm" onClick={() => setIsInviteModalOpen(true)}>
                                    <Plus size={16} /> Invite User
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-500">
                                    <thead className="text-xs text-gray-400 uppercase bg-white border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-bold tracking-wider">User</th>
                                            <th className="px-6 py-4 font-bold tracking-wider">Role</th>
                                            <th className="px-6 py-4 font-bold tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {personnel.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold shrink-0">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-accent-greyDark">{user.name}</p>
                                                            <p className="text-xs text-gray-400">{user.email || 'No email provided'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-max ${
                                                        user.appRole === 'Manager' ? 'bg-purple-100 text-purple-700' :
                                                        user.appRole === 'Supervisor' ? 'bg-brand-teal/10 text-brand-teal' :
                                                        user.appRole === 'Customer' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        <Shield size={12} />
                                                        {user.appRole || 'Tech'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => {
                                                        setEditingPersonnel(user);
                                                        setEditPersonnelName(user.name);
                                                        setEditPersonnelEmail(user.email || '');
                                                        setEditPersonnelRole(user.appRole || 'Tech');
                                                        setEditPersonnelCompany(user.clientId || '');
                                                    }} className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors mr-2">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => deletePersonnel(user.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {personnel.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-gray-400">No users found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === 'wbs' ? (
                         <WBSTemplateManager />
                    ) : activeTab === 'cloud' ? (
                        <div className="max-w-2xl mx-auto space-y-8 py-6 text-left">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-accent-greyDark flex items-center gap-2">
                                        <Cloud className="text-brand-teal" size={28} />
                                        SharePoint Integration
                                    </h2>
                                    <p className="text-gray-500 mt-1">Configure central storage for high-resolution attachments.</p>
                                </div>
                                {microsoftAuth.isAuthenticated ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1 gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                        <CheckCircle2 size={12} /> Connected
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-gray-400 border-gray-200 px-3 py-1 gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                        Disconnected
                                    </Badge>
                                )}
                            </div>

                            {/* Connection Status */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400">
                                        {microsoftAuth.isAuthenticated ? <CheckCircle2 size={24} className="text-emerald-500" /> : <LogIn size={24} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-accent-greyDark">{microsoftAuth.isAuthenticated ? microsoftAuth.userEmail : 'No Microsoft Account Linked'}</p>
                                        <p className="text-xs text-gray-400">{microsoftAuth.isAuthenticated ? 'Accessing Latnovva Tenant' : 'Central storage is currently disabled.'}</p>
                                    </div>
                                </div>
                                {microsoftAuth.isAuthenticated ? (
                                    <Button variant="outline" className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 gap-2 h-10 px-4 font-bold" onClick={() => setMicrosoftAuth({ isAuthenticated: false, userEmail: undefined })}>
                                        <LogOut size={16} /> Disconnect
                                    </Button>
                                ) : (
                                    <Button className="bg-brand-teal text-white hover:bg-brand-teal/90 gap-2 h-10 px-6 font-bold shadow-sm" onClick={() => setMicrosoftAuth({ isAuthenticated: true, userEmail: 'admin@latnovva.com' /* placeholder logic */ })}>
                                        <LogIn size={16} /> Link Account
                                    </Button>
                                )}
                            </div>

                            {/* SharePoint Config */}
                            <div className="space-y-6 pt-2">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Globe size={18} className="text-brand-teal" />
                                        <h3 className="font-bold text-accent-greyDark uppercase tracking-widest text-xs">Site Configuration</h3>
                                    </div>
                                    
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500">SHAREPOINT SITE URL</Label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    className="h-11 font-mono text-sm border-gray-200"
                                                    value={sharepointConfig.siteUrl || ''} 
                                                    onChange={e => setSharepointConfig({ siteUrl: e.target.value })}
                                                    placeholder="https://latnovva.sharepoint.com/sites/FieldOps" 
                                                />
                                                <Button variant="secondary" className="h-11 px-6 font-bold gap-2">
                                                    <Link2 size={16} /> Discover
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-gray-500">SITE ID</Label>
                                                <Input 
                                                    readOnly 
                                                    className="h-11 bg-gray-50 border-gray-100 text-gray-400 font-mono text-[10px]" 
                                                    value={sharepointConfig.siteId || 'Not Discovered'} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-gray-500">DRIVE (DOC LIBRARY) ID</Label>
                                                <Input 
                                                    readOnly 
                                                    className="h-11 bg-gray-50 border-gray-100 text-gray-400 font-mono text-[10px]" 
                                                    value={sharepointConfig.driveId || 'Not Discovered'} 
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500">ROOT FOLDER PATH</Label>
                                            <Input 
                                                className="h-11 border-gray-200"
                                                value={sharepointConfig.folderPath || 'Report_Attachments'} 
                                                onChange={e => setSharepointConfig({ folderPath: e.target.value })}
                                                placeholder="e.g. Field_Reports/Photos" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-brand-teal/5 border border-brand-teal/10 rounded-xl text-brand-teal text-xs leading-relaxed">
                                    <p className="font-bold mb-1 uppercase tracking-wider">How this works:</p>
                                    Technicians capturing images will have them semantically named and uploaded to the path: 
                                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-brand-teal/20 ml-1">
                                        {sharepointConfig.folderPath || 'Report_Attachments'}/[ProjectName]/[Date]/
                                    </span>
                                </div>

                                <Button className="w-full h-12 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-lg mt-4" disabled={!microsoftAuth.isAuthenticated}>
                                    Validate & Save Configuration
                                </Button>
                            </div>
                        </div>
                    ) : activeTab === 'system' ? (
                        <div className="max-w-md mx-auto text-center space-y-6 py-12">
                            <div className="w-20 h-20 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto text-brand-teal">
                                <Shield size={40} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-accent-greyDark">Sync Environment</h2>
                                <p className="text-gray-500 mt-2">This will force an update of all local projects, clients, and reports with the latest system definitions. Your browser local storage will be refreshed.</p>
                            </div>
                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-orange-800 text-sm">
                                <strong>Warning:</strong> This will overwrite any local changes you've made to mock projects or reports.
                            </div>
                            <Button 
                                onClick={() => {
                                    if (window.confirm('Force environment sync? This will refresh all mock data.')) {
                                        resetDb();
                                        window.location.reload();
                                    }
                                }}
                                className="bg-brand-teal hover:bg-brand-teal/90 text-white w-full h-12 text-lg font-bold rounded-xl"
                            >
                                Force Sync & Reload
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                                {tab && <tab.icon size={32} />}
                            </div>
                            <h2 className="text-2xl font-bold text-accent-greyDark mb-2">{tab?.name} Settings</h2>
                            <p className="text-gray-500 max-w-md mx-auto">This section is currently under development. Here you will be able to configure {tab?.name?.toLowerCase()} for the platform.</p>
                        </>
                    )}
                </div>
            </div>
            ) : (
                // Main settings dashboard
                <div className="space-y-8 pb-20 md:pb-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                            <SettingsIcon size={28} className="text-brand-teal" />
                            {t('settings.title')}
                        </h1>
                        <p className="text-gray-500 mt-1">{t('settings.description', 'Configure platform rules, users, and templates across all projects.')}</p>
                    </div>
                </div>

                {/* Language Selection Section */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-teal/10 rounded-xl text-brand-teal">
                            <Languages size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-accent-greyDark">{t('settings.language')}</h3>
                            <p className="text-sm text-gray-500">{t('settings.language_desc', 'Select your preferred interface language')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant={language === 'en' ? 'default' : 'outline'} 
                            className={language === 'en' ? 'bg-brand-teal hover:bg-brand-teal/90' : ''}
                            onClick={() => setLanguage('en')}
                        >
                            {t('settings.english')}
                        </Button>
                        <Button 
                            variant={language === 'es' ? 'default' : 'outline'} 
                            className={language === 'es' ? 'bg-brand-teal hover:bg-brand-teal/90' : ''}
                            onClick={() => setLanguage('es')}
                        >
                            {t('settings.spanish')}
                        </Button>
                    </div>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <div key={tab.name} onClick={() => setActiveTab(tab.id)} className="card-container flex gap-4 items-start border border-gray-100 hover:border-brand-teal/40 hover:shadow-soft transition-all cursor-pointer group">
                            <div className="p-3 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-brand-teal/10 group-hover:text-brand-teal transition-colors">
                                <Icon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-accent-greyDark group-hover:text-brand-teal transition-colors mb-1">{tab.name}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{tab.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
                
                {userEmail === 'aprovero@latnovva.com' && (
                    <div className="mt-12 bg-purple-50 border border-purple-100 rounded-2xl p-8 max-w-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <Shield className="text-purple-600" size={24} />
                            <h2 className="text-xl font-bold text-purple-900">Developer Overrides (God Mode)</h2>
                        </div>
                        <p className="text-sm text-purple-700 mb-6 relative z-10">Change your global security context to test platform behavior as different roles. Only visible to root administrators.</p>
                        
                        <div className="space-y-2 relative z-10">
                            <Label className="text-purple-800 font-bold text-xs uppercase tracking-wider">Impersonate Role</Label>
                            <select
                                value={userRole}
                                onChange={(e) => setUserRole(e.target.value as any)}
                                className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-900 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                            >
                                <option value="Tech">Tech (Field Execution Level)</option>
                                <option value="Supervisor">Supervisor (Site Management Level)</option>
                                <option value="Manager">Manager (Global Operations Level)</option>
                                <option value="Customer">Company / Customer (Restricted Client Level)</option>
                            </select>
                        </div>
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Globe size={120} />
                        </div>
                    </div>
                )}
                </div>
            )}
            
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

            {/* Invite User Modal */}
            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Invite New User</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="inviteEmail">Email Address</Label>
                            <Input
                                id="inviteEmail"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Access Role</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as any)}
                            >
                                <option value="Tech">Tech</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="Manager">Manager</option>
                                <option value="Customer">Customer</option>
                            </select>
                        </div>
                        {inviteRole === 'Customer' && (
                            <div className="grid gap-2">
                                <Label>Assigned Company</Label>
                                <select
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                    value={inviteCompany}
                                    onChange={e => setInviteCompany(e.target.value)}
                                >
                                    <option value="" disabled>Select a company</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleInviteUser} className="bg-brand-teal hover:bg-brand-teal/90 text-white">Send Invite</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={!!editingPersonnel} onOpenChange={(open) => !open && setEditingPersonnel(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit User: {editingPersonnel?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="editUserName">Full Name</Label>
                            <Input
                                id="editUserName"
                                value={editPersonnelName}
                                onChange={(e) => setEditPersonnelName(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editUserEmail">Email Address</Label>
                            <Input
                                id="editUserEmail"
                                type="email"
                                value={editPersonnelEmail}
                                onChange={(e) => setEditPersonnelEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editUserRole">App Role</Label>
                            <select
                                id="editUserRole"
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                value={editPersonnelRole}
                                onChange={(e) => setEditPersonnelRole(e.target.value as any)}
                            >
                                <option value="Tech">Tech</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="Manager">Manager</option>
                                <option value="Customer">Customer</option>
                            </select>
                        </div>
                        {editPersonnelRole === 'Customer' && (
                            <div className="grid gap-2">
                                <Label>Assigned Company</Label>
                                <select
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none"
                                    value={editPersonnelCompany}
                                    onChange={e => setEditPersonnelCompany(e.target.value)}
                                >
                                    <option value="" disabled>Select a company</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPersonnel(null)}>Cancel</Button>
                        <Button className="bg-brand-teal text-white" onClick={() => {
                            if (editingPersonnel) {
                                updatePersonnel(editingPersonnel.id, {
                                    name: editPersonnelName,
                                    email: editPersonnelEmail,
                                    appRole: editPersonnelRole as any,
                                    clientId: editPersonnelRole === 'Customer' ? editPersonnelCompany : undefined
                                });
                                setEditingPersonnel(null);
                            }
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function WBSTemplateManager() {
    const { scopeTemplates, addScopeTemplate, updateScopeTemplate, deleteScopeTemplate } = useStore();
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const handleCreate = () => {
        if (!newTemplateName.trim()) return;
        addScopeTemplate({
            id: `STPL-${Date.now()}`,
            name: newTemplateName,
            activities: []
        });
        setNewTemplateName('');
        setIsAddModalOpen(false);
    };

    const handleUpdate = () => {
        if (!editingTemplate) return;
        updateScopeTemplate(editingTemplate.id, editingTemplate);
        setEditingTemplate(null);
    };

    const addActivity = () => {
        if (!editingTemplate) return;
        const newAct = {
            id: `act-${Date.now()}`,
            title: 'New Activity',
            steps: [],
            expectedDays: 1
        };
        setEditingTemplate({
            ...editingTemplate,
            activities: [...editingTemplate.activities, newAct]
        });
    };

    const updateActivity = (actId: string, updates: any) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            activities: editingTemplate.activities.map((a: any) => a.id === actId ? { ...a, ...updates } : a)
        });
    };

    const removeActivity = (actId: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            activities: editingTemplate.activities.filter((a: any) => a.id !== actId)
        });
    };

    const addStep = (actId: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            activities: editingTemplate.activities.map((a: any) => 
                a.id === actId ? { ...a, steps: [...a.steps, ''] } : a
            )
        });
    };

    const updateStep = (actId: string, stepIdx: number, val: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            activities: editingTemplate.activities.map((a: any) => {
                if (a.id === actId) {
                    const newSteps = [...a.steps];
                    newSteps[stepIdx] = val;
                    return { ...a, steps: newSteps };
                }
                return a;
            })
        });
    };

    const removeStep = (actId: string, stepIdx: number) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            activities: editingTemplate.activities.map((a: any) => {
                if (a.id === actId) {
                    return { ...a, steps: a.steps.filter((_: any, i: number) => i !== stepIdx) };
                }
                return a;
            })
        });
    };

    return (
        <div className="bg-white border flex flex-col border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2"><ListChecks className="text-brand-teal" size={24}/> WBS Template Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Define standard activities and steps for project scopes.</p>
                </div>
                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-semibold shadow-sm" onClick={() => setIsAddModalOpen(true)}>
                    <Plus size={16} /> New Template
                </Button>
            </div>
            
            <div className="divide-y divide-gray-100">
                {scopeTemplates.map(tpl => (
                    <div key={tpl.id} className="p-6 hover:bg-gray-50 transition-colors flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                                <ListChecks size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-accent-greyDark">{tpl.name}</h3>
                                <p className="text-xs text-gray-400">{tpl.activities.length} Activities • {tpl.activities.reduce((acc, a) => acc + a.steps.length, 0)} Total Steps</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-brand-teal" onClick={() => setEditingTemplate({...tpl})}>
                                <Pencil size={18} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500" onClick={() => {
                                if (window.confirm('Delete this template?')) deleteScopeTemplate(tpl.id);
                            }}>
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Template Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create WBS Template</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input placeholder="e.g. Electrical Installation" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button className="bg-brand-teal text-white" onClick={handleCreate}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Template Modal */}
            <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Template: {editingTemplate?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input value={editingTemplate?.name || ''} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-lg font-bold">Activities</Label>
                                <Button variant="outline" size="sm" onClick={addActivity} className="gap-1 rounded-lg">
                                    <Plus size={14} /> Add Activity
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {editingTemplate?.activities.map((act: any) => (
                                    <div key={act.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                                        <button onClick={() => removeActivity(act.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs uppercase font-bold text-gray-400">Activity Title</Label>
                                                <Input value={act.title} onChange={e => updateActivity(act.id, { title: e.target.value })} className="h-9" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs uppercase font-bold text-gray-400">Expected Days</Label>
                                                <Input type="number" value={act.expectedDays} onChange={e => updateActivity(act.id, { expectedDays: parseInt(e.target.value) || 1 })} className="h-9" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase font-bold text-gray-400 flex justify-between items-center">
                                                Steps / Verification Points
                                                <button onClick={() => addStep(act.id)} className="text-brand-teal hover:underline">+ Add Step</button>
                                            </Label>
                                            <div className="space-y-2">
                                                {act.steps.map((step: string, idx: number) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <Input value={step} onChange={e => updateStep(act.id, idx, e.target.value)} className="h-8 text-sm" placeholder={`Step ${idx + 1}`} />
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-300 hover:text-red-500" onClick={() => removeStep(act.id, idx)}>
                                                            <X size={14} />
                                                        </Button>
                                                    </div>
                                                ))}
                                                {act.steps.length === 0 && <p className="text-[10px] text-gray-400 italic">No steps added yet.</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                        <Button className="bg-brand-teal text-white" onClick={handleUpdate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

