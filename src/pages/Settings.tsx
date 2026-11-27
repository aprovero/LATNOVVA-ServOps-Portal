import { useState } from 'react';
import { useStore, Client, Personnel } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Users, Building2, Pencil, Camera, Trash2, Shield, Plus, ListChecks, X, CheckCircle2, Globe, Languages, Key, Bell, ShieldCheck, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/authStore';

export default function Settings() {
    const { t } = useTranslation();
    const { 
        userRole, clients, projects, updateClient, deleteClient, personnel, addPersonnel, deletePersonnel, updatePersonnel, resetDb,
        language, setLanguage, platformSettings, updatePlatformSettings
    } = useStore();
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const { profile } = useAuthStore();
    const [deviceFastLogin, setDeviceFastLogin] = useState(() => {
        return localStorage.getItem('device_fast_login_enabled') === 'true';
    });

    const toggleDeviceFastLogin = (enabled: boolean) => {
        localStorage.setItem('device_fast_login_enabled', enabled ? 'true' : 'false');
        setDeviceFastLogin(enabled);
        const resolvedId = useStore.getState().resolvePersonnelId();
        if (enabled && profile) {
            localStorage.setItem('cached_user_profile', JSON.stringify({
                name: profile.name,
                image: profile.image,
                email: profile.email
            }));
            if (resolvedId && (profile as any).faceDescriptor) {
                localStorage.setItem(`v6_face_descriptor_${resolvedId}`, JSON.stringify((profile as any).faceDescriptor));
            }
        } else {
            localStorage.removeItem('cached_user_profile');
            if (resolvedId) {
                localStorage.removeItem(`v6_face_descriptor_${resolvedId}`);
            }
        }
    };

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteRole, setInviteRole] = useState<'Tech' | 'Supervisor' | 'Manager' | 'Customer' | 'HR'>('Tech');
    const [inviteCompany, setInviteCompany] = useState('');
    const [userSearch, setUserSearch] = useState('');

    const handleInviteUser = async () => {
        const cleanEmail = inviteEmail.trim().toLowerCase();
        if (!cleanEmail) return;
        if (inviteRole === 'Customer' && !inviteCompany) {
            alert('Please select an assigned company for this customer.');
            return;
        }

        try {
            // P0-5 / Item 8: Server-provisioned onboarding (zero hardcoded credentials).
            // When no explicit password is provided, admin_create_user generates a cryptographically
            // random password on the server (never exposed to browser) and we trigger a Supabase
            // password-setup recovery link so the new user sets their own initial password.
            const { data: newUserId, error: rpcError } = await (supabase.rpc as any)('admin_create_user', {
                user_email: cleanEmail,
                user_password: invitePassword.trim() || '',
                user_role: inviteRole,
                user_name: cleanEmail.split('@')[0],
                user_client_id: inviteRole === 'Customer' ? inviteCompany : null,
                user_subsidiary: 'MX',
            });

            if (rpcError) throw rpcError;
            if (!newUserId) throw new Error('User provisioning did not return a valid user ID.');

            // If admin did not specify a custom initial password, send Supabase password-setup link
            if (!invitePassword.trim()) {
                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                    redirectTo: `${window.location.origin}/login`,
                });
                if (resetErr) {
                    console.warn('[Settings] Password setup email warning:', resetErr.message);
                }
            }

            addPersonnel({
                id: String(newUserId),
                name: cleanEmail.split('@')[0],
                email: cleanEmail,
                position: inviteRole === 'Customer' ? 'Customer Contact' : 'Invited User',
                employeeNumber: `EMP-${Math.floor(Math.random() * 1000)}`,
                status: 'Active',
                certifications: [],
                appRole: inviteRole,
                clientId: inviteRole === 'Customer' ? inviteCompany : undefined,
                hasPassword: !!invitePassword.trim(),
                subsidiary: 'MX'
            });
            setIsInviteModalOpen(false);
            setInviteEmail('');
            setInvitePassword('');
            setInviteRole('Tech');
            setInviteCompany('');
            alert(
                invitePassword.trim()
                    ? 'Usuario creado correctamente.'
                    : 'Usuario creado. Se envió un enlace seguro por correo para que establezca su contraseña inicial.'
            );
        } catch (err: any) {
            alert(`Failed to create user securely: ${err.message}`);
        }
    };

    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientLogo, setEditClientLogo] = useState('');

    const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
    const [editPersonnelName, setEditPersonnelName] = useState('');
    const [editPersonnelEmail, setEditPersonnelEmail] = useState('');
    const [editPersonnelPassword, setEditPersonnelPassword] = useState('');
    const [editPersonnelRole, setEditPersonnelRole] = useState('Tech');
    const [editPersonnelCompany, setEditPersonnelCompany] = useState('');
    const [editPersonnelDbo, setEditPersonnelDbo] = useState('');

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
        { id: 'rules', name: 'Platform Rules', description: 'Shift limits and automation rules', icon: ShieldCheck },
        { id: 'system', name: 'Sync Data', description: 'Force refresh environment data', icon: Shield },
    ];

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
                                                        {userRole === 'Manager' && (
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
                        (userRole && ['Manager', 'HR'].includes(userRole)) ? (
                        <div className="bg-white border flex flex-col border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left">
                            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-gray-50 gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2"><Users className="text-brand-teal" size={24}/> User Management</h2>
                                    <p className="text-sm text-gray-500 mt-1">Manage global access and invite new users by email.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Input 
                                        placeholder="Search users..." 
                                        value={userSearch} 
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        className="h-10 bg-white min-w-[200px]"
                                    />
                                    <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-semibold shadow-sm h-10 shrink-0 border-none" onClick={() => setIsInviteModalOpen(true)}>
                                        <Plus size={16} /> Invite User
                                    </Button>
                                </div>
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
                                        {personnel.filter(u => 
                                            u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                                            (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                                            (u.appRole || '').toLowerCase().includes(userSearch.toLowerCase())
                                        ).map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold shrink-0">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-accent-greyDark">{user.name}</p>
                                                                {user.hasPassword && <span title="Password configured"><Key size={12} className="text-amber-500" /></span>}
                                                            </div>
                                                            <p className="text-xs text-gray-400">{user.email || 'No email provided'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-max ${
                                                        user.appRole === 'Manager' ? 'bg-purple-100 text-purple-700' :
                                                        user.appRole === 'HR' ? 'bg-amber-100 text-amber-700' :
                                                        user.appRole === 'Supervisor' ? 'bg-brand-teal/10 text-brand-teal' :
                                                        user.appRole === 'Customer' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        <Shield size={12} />
                                                        {user.appRole || 'Tech'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {(userRole === 'Manager' || user.appRole !== 'Manager') && (
                                                    <>
                                                    <button onClick={() => {
                                                        setEditingPersonnel(user);
                                                        setEditPersonnelName(user.name);
                                                        setEditPersonnelEmail(user.email || '');
                                                        setEditPersonnelPassword('');
                                                        setEditPersonnelRole(user.appRole || 'Tech');
                                                        setEditPersonnelCompany(user.clientId || '');
                                                        setEditPersonnelDbo(user.dbo || '');
                                                    }} className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors mr-2">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => deletePersonnel(user.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {personnel.filter(u => 
                                            u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                                            (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                                            (u.appRole || '').toLowerCase().includes(userSearch.toLowerCase())
                                        ).length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-gray-400">No users found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ) : (
                            <div className="max-w-md mx-auto text-center space-y-6 py-12">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                                    <Shield size={40} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-accent-greyDark">Access Restricted</h2>
                                    <p className="text-gray-500 mt-2">Only Managers and HR personnel can manage users and invitations.</p>
                                </div>
                                <Button onClick={() => setActiveTab(null)} className="bg-brand-teal text-white">Back to Settings</Button>
                            </div>
                        )
                    ) : activeTab === 'wbs' ? (
                         <WBSTemplateManager />
                    ) : activeTab === 'rules' ? (
                        <div className="max-w-2xl mx-auto space-y-8 py-6 text-left">
                            <div>
                                <h2 className="text-2xl font-bold text-accent-greyDark flex items-center gap-2">
                                    <ShieldCheck className="text-brand-teal" size={28} />
                                    Platform Rules & Automation
                                </h2>
                                <p className="text-gray-500 mt-1">Configure automated alerts and platform-wide behavior thresholds.</p>
                            </div>

                            <div className="space-y-6">
                                {/* Shift Notification Card */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                                                <Bell size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-accent-greyDark">Daily Push Reminders</h3>
                                                <p className="text-sm text-gray-500">Send daily push notifications for clock-in and clock-out.</p>
                                            </div>
                                        </div>
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableShiftNotifications: true })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${platformSettings.enableShiftNotifications ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}
                                            >
                                                ON
                                            </button>
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableShiftNotifications: false })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!platformSettings.enableShiftNotifications ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                                            >
                                                OFF
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 pt-2">
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs leading-relaxed flex items-start gap-3">
                                            <div className="mt-0.5"><Shield size={14} /></div>
                                            <p>When enabled, registered devices will receive a push notification at 7:30 AM to remind users to clock in, and at 7:00 PM if a shift remains open.</p>
                                        </div>
                                    </div>
                                </div>


                                {/* Geofencing Settings Card */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-teal-100 text-teal-600 rounded-xl">
                                                <MapPin size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-accent-greyDark">Geofence Validation</h3>
                                                <p className="text-sm text-gray-500">Configure geofence validation options and limits.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 pt-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                {language === 'es' ? 'Radio de Geocerca (metros)' : 'Geofence Radius (meters)'}
                                            </Label>
                                            <div className="flex items-center gap-4">
                                                <Input 
                                                    type="number"
                                                    min="50"
                                                    max="5000"
                                                    step="50"
                                                    className="h-11 border-gray-200 w-32 font-bold"
                                                    value={platformSettings.geofenceRadius}
                                                    onChange={e => updatePlatformSettings({ geofenceRadius: parseInt(e.target.value) || 250 })}
                                                />
                                                <span className="text-sm text-gray-400 font-medium italic">
                                                    {language === 'es' ? 'metros de radio alrededor de las coordenadas del proyecto' : 'meters radius around project coordinates'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                {language === 'es' ? 'Límite de Precisión GPS (metros)' : 'GPS Accuracy Limit (meters)'}
                                            </Label>
                                            <div className="flex items-center gap-4">
                                                <Input 
                                                    type="number"
                                                    min="10"
                                                    max="1000"
                                                    step="10"
                                                    className="h-11 border-gray-200 w-32 font-bold"
                                                    value={platformSettings.gpsAccuracyThreshold}
                                                    onChange={e => updatePlatformSettings({ gpsAccuracyThreshold: parseInt(e.target.value) || 100 })}
                                                />
                                                <span className="text-sm text-gray-400 font-medium italic">
                                                    {language === 'es' ? 'radio máximo de precisión para un estado GPS válido' : 'maximum allowed accuracy radius for valid GPS status'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-teal-700 text-xs leading-relaxed flex items-start gap-3">
                                            <div className="mt-0.5"><ShieldCheck size={14} /></div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider mb-1">
                                                    {language === 'es' ? 'Reglas de Geocerca y GPS:' : 'Geofence & GPS Rules:'}
                                                </p>
                                                <p>
                                                    {language === 'es' 
                                                        ? `Los marcajes fuera del radio de geocerca se marcarán como no verificados. Los marcajes con una precisión GPS superior a ${platformSettings.gpsAccuracyThreshold}m se marcarán como de baja precisión.`
                                                        : `Punches outside of the geofence radius will be flagged as unverified. GPS signals with accuracy radius larger than ${platformSettings.gpsAccuracyThreshold}m will be flagged as low accuracy.`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Facial ID Verification Card */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-brand-teal">
                                                <Camera size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-accent-greyDark">
                                                    {language === 'es' ? 'Validación de Identidad Facial (Biometría)' : 'Facial ID Identity Validation'}
                                                </h3>
                                                <p className="text-xs text-gray-400">
                                                    {language === 'es' ? 'Validar la identidad del usuario mediante cámara al realizar marcajes.' : 'Validate user identity via camera snapshots on clock-in/out.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex bg-gray-100 p-1.5 rounded-xl self-start md:self-auto">
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableFacialId: true })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${platformSettings.enableFacialId ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}
                                            >
                                                {language === 'es' ? 'Activado' : 'Enabled'}
                                            </button>
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableFacialId: false })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!platformSettings.enableFacialId ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                                            >
                                                {language === 'es' ? 'Desactivado' : 'Disabled'}
                                            </button>
                                        </div>
                                    </div>
                                    {platformSettings.enableFacialId && (
                                        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-teal-700 text-xs leading-relaxed flex items-start gap-3">
                                            <div className="mt-0.5"><ShieldCheck size={14} /></div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider mb-1">
                                                    {language === 'es' ? 'Reglas de Validación Facial:' : 'Facial ID Rules:'}
                                                </p>
                                                <p>
                                                    {language === 'es' 
                                                        ? 'Los usuarios sin biometría registrada serán guiados para registrarse la primera vez que intenten marcar asistencia. Los usuarios con biometría registrada deberán verificar su rostro al marcar.'
                                                        : 'Users without enrolled biometrics will be guided to self-enroll on their first clock-in attempt. Enrolled users will have their face verified via camera snapshot.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Face ID Fast Login (Master Toggle) */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                <Key size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-accent-greyDark">
                                                    {language === 'es' ? 'Acceso Rápido con Facial ID (Master)' : 'Face ID Fast Login (Master)'}
                                                </h3>
                                                <p className="text-xs text-gray-400">
                                                    {language === 'es' ? 'Permitir a los usuarios bloquear/desbloquear su sesión activa con Face ID en sus dispositivos.' : 'Allow users to lock/unlock their active session using Face ID on their devices.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex bg-gray-100 p-1.5 rounded-xl self-start md:self-auto">
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableFastLogin: true })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${platformSettings.enableFastLogin ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-400'}`}
                                            >
                                                {language === 'es' ? 'Activado' : 'Enabled'}
                                            </button>
                                            <button 
                                                onClick={() => updatePlatformSettings({ enableFastLogin: false })}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!platformSettings.enableFastLogin ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                                            >
                                                {language === 'es' ? 'Desactivado' : 'Disabled'}
                                            </button>
                                        </div>
                                    </div>
                                    {platformSettings.enableFastLogin && (
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs leading-relaxed flex items-start gap-3">
                                            <div className="mt-0.5"><ShieldCheck size={14} /></div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider mb-1">
                                                    {language === 'es' ? 'Reglas de Acceso Rápido:' : 'Fast Login Rules:'}
                                                </p>
                                                <p>
                                                    {language === 'es' 
                                                        ? 'Cuando esté activado, los usuarios podrán configurar el bloqueo biométrico de pantalla en su dispositivo actual desde el menú de Ajustes.'
                                                        : 'When enabled, users will be allowed to configure the biometric lock screen on their current device via the local Settings menu.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Browser Notification Permission Card */}
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center text-brand-teal">
                                            <Globe size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-accent-greyDark">Browser Notifications</p>
                                            <p className="text-xs text-gray-400">Receive alerts even when the app is in the background.</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        className={`h-11 px-6 font-bold gap-2 ${'Notification' in window && Notification.permission === 'granted' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700' : 'border-brand-teal/20 text-brand-teal hover:bg-brand-teal/5'}`}
                                        onClick={async () => {
                                            if (!('Notification' in window)) {
                                                alert('This browser does not support desktop notifications');
                                                return;
                                            }
                                            const permission = await Notification.requestPermission();
                                            if (permission === 'granted') {
                                                new Notification('Notifications Enabled!', {
                                                    body: 'You will now receive alerts for long shifts and other important events.',
                                                    icon: '/pwa-192x192.png'
                                                });
                                            }
                                        }}
                                        disabled={'Notification' in window && Notification.permission === 'granted'}
                                    >
                                        {'Notification' in window && Notification.permission === 'granted' ? <><CheckCircle2 size={16} /> Notifications Active</> : <><Bell size={16} /> Request Permission</>}
                                    </Button>
                                </div>
                                {/* Employee Survey Toggle */}
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div>
                                        <p className="font-bold text-accent-greyDark">Employee Feedback Survey</p>
                                        <p className="text-xs text-gray-400">Enable periodic feedback survey prompts for employees. Changes apply automatically.</p>
                                    </div>
                                    <Button
                                        variant={platformSettings.enableSurvey ? 'default' : 'outline'}
                                        className={platformSettings.enableSurvey ? 'bg-brand-teal text-white hover:bg-brand-teal/90 font-bold' : 'font-bold'}
                                        onClick={() => updatePlatformSettings({ enableSurvey: !platformSettings.enableSurvey })}
                                    >
                                        {platformSettings.enableSurvey ? 'Survey Active' : 'Survey Disabled'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'system' ? (
                        <div className="max-w-md mx-auto text-center space-y-6 py-12">
                            <div className="w-20 h-20 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto text-brand-teal">
                                <Shield size={40} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-accent-greyDark">Sync Environment</h2>
                                <p className="text-gray-500 mt-2">Force a clean refresh of local cached data from Supabase. Your browser cache will be reloaded.</p>
                            </div>
                            <Button 
                                onClick={() => {
                                    if (window.confirm('Force environment sync and reload fresh data from Supabase?')) {
                                        resetDb();
                                        window.location.reload();
                                    }
                                }}
                                className="bg-brand-teal hover:bg-brand-teal/90 text-white w-full h-12 text-lg font-bold rounded-xl"
                            >
                                Force Sync & Reload
                            </Button>
                        </div>
                    ) : null}
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

                {/* Local Device Face ID Lock (Only visible if enabled globally) */}
                {platformSettings.enableFastLogin && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-6 animate-in fade-in duration-200">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                                <Key size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-accent-greyDark">
                                    {language === 'es' ? 'Desbloqueo con Face ID' : 'Face ID Lock Screen'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {language === 'es' 
                                        ? 'Bloquear tu sesión activa en este dispositivo con reconocimiento facial.' 
                                        : 'Lock your active session on this device behind a face scan.'}
                                </p>
                                {!(profile as any)?.faceDescriptor && (
                                    <p className="text-xs text-red-500 font-medium mt-1">
                                        ⚠ {language === 'es' 
                                            ? 'Registra tu rostro en Control de Asistencia para activar.' 
                                            : 'Enroll your face in Clock-In to enable.'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div>
                            <Button
                                disabled={!(profile as any)?.faceDescriptor}
                                variant={deviceFastLogin ? 'default' : 'outline'}
                                className={deviceFastLogin ? 'bg-brand-teal hover:bg-brand-teal/90' : ''}
                                onClick={() => toggleDeviceFastLogin(!deviceFastLogin)}
                            >
                                {deviceFastLogin 
                                    ? (language === 'es' ? 'Activado' : 'Enabled') 
                                    : (language === 'es' ? 'Desactivado' : 'Disabled')}
                            </Button>
                        </div>
                    </div>
                )}

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
                            <Label htmlFor="invitePassword">Password (Optional)</Label>
                            <Input
                                id="invitePassword"
                                type="text"
                                value={invitePassword}
                                onChange={(e) => setInvitePassword(e.target.value)}
                                placeholder="Leaves as magic-link only if blank"
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
                                <option value="Office">Office</option>
                                <option value="Supervisor">Supervisor</option>
                                {userRole === 'Manager' && <option value="Manager">Manager</option>}
                                <option value="HR">HR</option>
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
                            <Label htmlFor="editUserPassword">Reset Password (Optional)</Label>
                            <Input
                                id="editUserPassword"
                                type="text"
                                value={editPersonnelPassword}
                                onChange={(e) => setEditPersonnelPassword(e.target.value)}
                                placeholder="Enter a new password here to overwrite."
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
                                <option value="Office">Office</option>
                                <option value="Supervisor">Supervisor</option>
                                {userRole === 'Manager' && <option value="Manager">Manager</option>}
                                <option value="HR">HR</option>
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
                        <div className="grid gap-2">
                            <Label htmlFor="editUserDbo">Date of Birth (DBO)</Label>
                            <Input
                                id="editUserDbo"
                                value={editPersonnelDbo}
                                onChange={(e) => setEditPersonnelDbo(e.target.value)}
                                placeholder="MM/DD/YYYY"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPersonnel(null)}>Cancel</Button>
                        <Button className="bg-brand-teal text-white" onClick={async () => {
                            if (editingPersonnel) {
                                // 1. Dispatch update through authoritative hardened admin_update_user RPC (PASS 15F P1-5)
                                const { error } = await supabase.rpc('admin_update_user', {
                                    target_user_id: editingPersonnel.id,
                                    new_email: editPersonnelEmail || null,
                                    new_password: editPersonnelPassword || null,
                                    new_role: editPersonnelRole,
                                    new_client_id: editPersonnelRole === 'Customer' ? (editPersonnelCompany || null) : null,
                                    new_name: editPersonnelName || null,
                                } as any);

                                if (error) {
                                    alert('Failed to sync auth credentials to backend: ' + error.message);
                                    return;
                                }

                                // 2. Dispatch updates to the local store and database
                                updatePersonnel(editingPersonnel.id, {
                                    name: editPersonnelName,
                                    email: editPersonnelEmail,
                                    appRole: editPersonnelRole as any,
                                    clientId: editPersonnelRole === 'Customer' ? editPersonnelCompany : undefined,
                                    hasPassword: editPersonnelPassword ? true : (editingPersonnel.hasPassword || false),
                                    dbo: editPersonnelDbo
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

