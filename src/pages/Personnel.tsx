import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useStore, Personnel as PersonnelType } from '../store/useStore';
import {
    User, Plus, Trash2, Shield, Award, Search, Camera, ExternalLink,
    Activity, FolderGit2, Network, List, ChevronDown, Phone, Mail,
    Briefcase, CheckCircle2, CircleDashed, Save, ArrowLeft, X
} from 'lucide-react';
import OrgChartView from '../components/personnel/OrgChartView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';

export default function Personnel() {
    const { t } = useTranslation();
    const { personnel, addPersonnel, updatePersonnel, deletePersonnel, userRole, projects } = useStore();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('q') || '';
    });
    const [filterRole, setFilterRole] = useState('All');
    const [viewMode, setViewMode] = useState<'list' | 'org'>('list');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Partial<PersonnelType> | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q !== null) {
            setSearchTerm(q);
            // If the query is a direct ID match, auto-select that person
            const match = personnel.find(p => p.id.toLowerCase() === q.toLowerCase());
            if (match) {
                setSelectedPersonId(match.id);
                setEditDraft({ ...match });
            }
        }
    }, [location.search, personnel]);

    // Add modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPerson, setNewPerson] = useState<Partial<PersonnelType> | null>(null);

    const isManager = userRole === 'Manager';
    const isHROrManager = ['Manager', 'HR'].includes(userRole);

    // Select a person → load into edit draft
    const handleSelectPerson = (person: PersonnelType) => {
        setSelectedPersonId(person.id);
        setEditDraft({ ...person });
        setIsSaved(false);
    };

    // Save edits inline
    const handleSave = async () => {
        if (!editDraft?.id) return;
        
        try {
            // Sycn auth layer first completely bypassing RLS securely
            const { error } = await supabase.rpc('admin_update_user', {
                target_user_id: editDraft.id,
                new_email: editDraft.email || '',
                new_role: editDraft.appRole || 'Tech',
                new_password: editDraft.password || ''
            } as any);

            if (error) throw error;
            
            updatePersonnel(editDraft.id, editDraft);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch(err: any) {
            alert('Failed to sync auth credentials to backend: ' + err.message);
        }
    };

    // Add new person
    const handleAdd = async () => {
        if (!newPerson?.name || !newPerson?.position || !newPerson?.email) {
            alert(t('personnel.alerts.email_required', 'Name, Position, and Email are absolutely required to explicitly invite a new user to the secure system.'));
            return;
        }

        try {
            // First, trigger the secure backend RPC to create physical Supabase Auth user & linked Profile Trigger
            const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
                user_email: newPerson.email,
                user_name: newPerson.name,
                user_role: newPerson.appRole || 'Tech',
                user_password: newPerson.password || ''
            } as any);

            if (error) throw error;

            const created: PersonnelType = {
                id: newUserId,
                name: newPerson.name,
                position: newPerson.position,
                employeeNumber: newPerson.employeeNumber || `EMP-${Math.floor(Math.random() * 1000)}`,
                phoneNumber: newPerson.phoneNumber,
                email: newPerson.email,
                image: newPerson.image,
                status: newPerson.status || 'Active',
                sharedFolderLink: newPerson.sharedFolderLink,
                certifications: newPerson.certifications || [],
                appRole: newPerson.appRole || 'Tech',
                prevailingWage: newPerson.prevailingWage || false,
                emergencyContact: newPerson.emergencyContact,
                onboardingDate: newPerson.onboardingDate,
                regularRate: newPerson.regularRate,
                rainyDayRate: newPerson.rainyDayRate,
                overtimeRate: newPerson.overtimeRate,
                mealAllowance: newPerson.mealAllowance,
                gasAllowance: newPerson.gasAllowance,
                truckAllowance: newPerson.truckAllowance,
                leadPay: newPerson.leadPay,
                deductions: newPerson.deductions,
                totalPerdiem: newPerson.totalPerdiem,
            };
            
            // Sync locally & backend via zustand trigger updates
            addPersonnel(created);
            setIsAddModalOpen(false);
            setNewPerson(null);
            
            // Auto-select newly created person
            setSelectedPersonId(created.id);
            setEditDraft({ ...created });
        } catch (err: any) {
            alert(`Failed to seamlessly invite user: ${err.message}`);
        }
    };

    const handleAddCert = (draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        setter({ ...draft, certifications: [...(draft.certifications || []), { name: '', expirationDate: '', hasAttachment: false }] });
    };

    const handleUpdateCert = (index: number, field: string, value: string, draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        const certs = [...(draft.certifications || [])];
        certs[index] = { ...certs[index], [field]: value };
        setter({ ...draft, certifications: certs });
    };

    const handleRemoveCert = (index: number, draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        setter({ ...draft, certifications: (draft.certifications || []).filter((_, i) => i !== index) });
    };

    // Filter + sort: active first, inactive at bottom
    const filteredPersonnel = personnel
        .filter(p => p.appRole !== 'Customer')
        .filter(p => filterRole === 'All' ? true : p.appRole === filterRole)
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            if (a.status === b.status) return a.name.localeCompare(b.name);
            return a.status === 'Active' ? -1 : 1;
        });

    const selectedPerson = personnel.find(p => p.id === selectedPersonId) ?? null;
    const assignedProject = selectedPerson
        ? projects.find(p => p.assignedPersonnel?.includes(selectedPerson.id))
        : null;

    const renderCertsEditor = (draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => (
        <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Award size={12} className="text-brand-teal" /> {t('personnel.profile.certifications')}
                </label>
                <Button variant="outline" size="sm" onClick={() => handleAddCert(draft, setter)} className="h-7 gap-1 rounded-lg text-xs">
                    <Plus size={12} /> {t('personnel.profile.add_cert')}
                </Button>
            </div>
            {(draft.certifications || []).map((cert, index) => (
                <div key={index} className="flex gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-xl relative group">
                    <button onClick={() => handleRemoveCert(index, draft, setter)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                    </button>
                    <div className="flex-1">
                        <Input
                            placeholder={`${t('personnel.profile.cert_name')} (e.g. OSHA 30)`}
                            value={cert.name}
                            onChange={e => handleUpdateCert(index, 'name', e.target.value, draft, setter)}
                            className="h-8 text-xs bg-white border-gray-200 mb-1.5"
                        />
                    </div>
                    <div className="w-32 shrink-0">
                        <Input
                            type="date"
                            value={cert.expirationDate}
                            onChange={e => handleUpdateCert(index, 'expirationDate', e.target.value, draft, setter)}
                            className="h-8 text-xs bg-white border-gray-200"
                        />
                    </div>
                </div>
            ))}
            {(!draft.certifications || draft.certifications.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    {t('personnel.profile.no_certs')}. {t('common.actions')}.
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <User className="text-brand-teal" size={28} />
                        {t('nav.personnel')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('personnel.subtitle')}</p>
                </div>

                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button
                            className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6"
                            onClick={() => setNewPerson(null)}
                        >
                            <Plus size={18} /> {t('personnel.new_personnel')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-accent-greyDark">{t('personnel.new_personnel')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.name')}</label>
                                <Input placeholder="e.g. John Doe" value={newPerson?.name || ''} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.position')}</label>
                                    <Input placeholder="e.g. Lead Electrician" value={newPerson?.position || ''} onChange={e => setNewPerson({ ...newPerson, position: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><FolderGit2 size={14} className="text-brand-teal" /> {t('personnel.columns.id')}</label>
                                    <Input placeholder="e.g. EMP-1234" value={newPerson?.employeeNumber || ''} onChange={e => setNewPerson({ ...newPerson, employeeNumber: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.email')}</label>
                                    <Input type="email" placeholder="john.doe@latnovva.com" value={newPerson?.email || ''} onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">Password (Optional)</label>
                                    <Input type="text" placeholder="Leaves as magic link if blank" value={newPerson?.password || ''} onChange={e => setNewPerson({ ...newPerson, password: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.phone')}</label>
                                    <Input placeholder="e.g. 956-280-8290" value={newPerson?.phoneNumber || ''} onChange={e => setNewPerson({ ...newPerson, phoneNumber: e.target.value })} />
                                </div>
                            </div>
                            {isManager && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Shield size={14} className="text-brand-teal" /> {t('personnel.columns.role')}</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.appRole || 'Tech'} onChange={e => setNewPerson({ ...newPerson, appRole: e.target.value as any })}>
                                            <option value="Tech">Tech</option>
                                            <option value="Supervisor">Supervisor</option>
                                            <option value="Manager">Manager</option>
                                            <option value="HR">HR</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Activity size={14} className="text-brand-teal" /> {t('personnel.columns.status')}</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.status || 'Active'} onChange={e => setNewPerson({ ...newPerson, status: e.target.value as any })}>
                                            <option value="Active">{t('common.active')}</option>
                                            <option value="Inactive">{t('common.inactive')}</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                                <div className="space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.emergency_contact')}</label>
                                            <Input placeholder="e.g. Jane Doe (956-...)" value={newPerson?.emergencyContact || ''} onChange={e => setNewPerson({ ...newPerson, emergencyContact: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.onboarding_date')}</label>
                                            <Input type="date" value={newPerson?.onboardingDate || ''} onChange={e => setNewPerson({ ...newPerson, onboardingDate: e.target.value })} />
                                        </div>
                                    </div>

                                    {isHROrManager && (
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                <Shield size={14} /> {t('personnel.finance.title')}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.regular_hours')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.regularRate || ''} onChange={e => setNewPerson({ ...newPerson, regularRate: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.rainy_day')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.rainyDayRate || ''} onChange={e => setNewPerson({ ...newPerson, rainyDayRate: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.over_time')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.overtimeRate || ''} onChange={e => setNewPerson({ ...newPerson, overtimeRate: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.meal_days')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.mealAllowance || ''} onChange={e => setNewPerson({ ...newPerson, mealAllowance: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.gas_day')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.gasAllowance || ''} onChange={e => setNewPerson({ ...newPerson, gasAllowance: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.truck')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.truckAllowance || ''} onChange={e => setNewPerson({ ...newPerson, truckAllowance: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.lead_pay')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.leadPay || ''} onChange={e => setNewPerson({ ...newPerson, leadPay: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.deductions')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.deductions || ''} onChange={e => setNewPerson({ ...newPerson, deductions: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.total_perdiem')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.totalPerdiem || ''} onChange={e => setNewPerson({ ...newPerson, totalPerdiem: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><ExternalLink size={14} className="text-brand-teal" /> {t('personnel.certs_folder')}</label>
                                        <Input placeholder={t('personnel.certs_folder_placeholder')} value={newPerson?.sharedFolderLink || ''} onChange={e => setNewPerson({ ...newPerson, sharedFolderLink: e.target.value })} />
                                    </div>
                                </div>
                            <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">{t('personnel.profile_photo')}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-brand-teal/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-brand-teal">
                                        {newPerson?.image ? <img src={newPerson.image} alt="Preview" className="w-full h-full object-cover" /> : <Camera size={20} />}
                                    </div>
                                    <Input type="file" accept="image/*" className="h-9 text-xs cursor-pointer flex-1"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) { const r = new FileReader(); r.onloadend = () => setNewPerson({ ...newPerson, image: r.result as string }); r.readAsDataURL(file); }
                                        }}
                                    />
                                </div>
                            </div>
                            {newPerson && renderCertsEditor(newPerson, setNewPerson)}
                            <Button className="w-full mt-2 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAdd}>
                                {t('personnel.create_user')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-[1.5] min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> {t('personnel.filters.search')}</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                            placeholder={t('personnel.filters.search_placeholder')}
                            className="pl-10 w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal h-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Shield size={12} /> {t('personnel.filters.role')}</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer h-10"
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                        >
                            <option value="All">{t('personnel.filters.all_roles')}</option>
                            <option value="Tech">Techs</option>
                            <option value="Supervisor">Supervisors</option>
                            <option value="Manager">Managers</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-xl items-center self-end h-10 ml-auto xl:ml-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <List size={16} /> {t('common.search')}
                    </button>
                    <button
                        onClick={() => setViewMode('org')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'org' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Network size={16} /> {t('personnel.columns.project')}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'list' ? (
                <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: '560px' }}>
                    {/* LEFT: Person List */}
                    <div className={`w-full md:w-64 shrink-0 flex flex-col bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-y-auto gap-0.5 ${selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">
                            {t('personnel.directory_count', { count: filteredPersonnel.length })}
                        </p>

                        {filteredPersonnel.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 px-4 text-center">
                                <User size={28} className="mb-2 opacity-30" />
                                <p className="text-xs font-medium">{t('common.no_results')}</p>
                            </div>
                        )}

                        {filteredPersonnel.map(person => {
                            const isSelected = selectedPersonId === person.id;
                            const isInactive = person.status === 'Inactive';
                            return (
                                <button
                                    key={person.id}
                                    onClick={() => handleSelectPerson(person)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                                        isSelected
                                            ? 'bg-brand-teal text-white shadow-md'
                                            : isInactive
                                                ? 'hover:bg-white hover:shadow-sm opacity-50'
                                                : 'hover:bg-white hover:shadow-sm'
                                    }`}
                                >
                                    {/* Square avatar (matches Deployments style) */}
                                    <div className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 relative ${
                                        isSelected ? 'bg-white/20 text-white' : isInactive ? 'bg-gray-200 text-gray-400' : 'bg-brand-teal/10 text-brand-teal'
                                    }`}>
                                        {person.image
                                            ? <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                            : person.name.charAt(0)
                                        }
                                        {/* Status dot */}
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${isSelected ? 'border-brand-teal' : 'border-gray-50'} ${person.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-accent-greyDark'}`}>
                                                {person.name}
                                            </p>
                                            {person.prevailingWage && (
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white' : 'bg-brand-teal'}`} title="Prevailing Wage" />
                                            )}
                                        </div>
                                        <p className={`text-[10px] font-semibold mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                            {person.position}
                                        </p>
                                    </div>

                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 uppercase ${
                                        isSelected
                                            ? 'bg-white/20 text-white'
                                            : person.appRole === 'Supervisor'
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {person.appRole}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* RIGHT: Detail / Edit Panel */}
                    <div className={`flex-1 min-w-0 ${!selectedPersonId ? 'hidden md:block' : 'block'}`}>
                        {editDraft && selectedPerson ? (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                                {/* Profile Header */}
                                <div className={`p-6 border-b border-gray-100 shrink-0 ${selectedPerson.status === 'Inactive' ? 'bg-gray-50' : 'bg-gradient-to-r from-brand-teal/5 to-transparent'}`}>
                                    <div className="flex items-center gap-5">
                                        <button 
                                            onClick={() => setSelectedPersonId(null)}
                                            className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
                                        >
                                            <ArrowLeft size={20} className="text-accent-greyDark" />
                                        </button>
                                        {/* Avatar + Photo Upload */}
                                        <div className="relative shrink-0 group">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-brand-teal/10 flex items-center justify-center text-brand-teal text-2xl font-bold">
                                                {editDraft.image
                                                    ? <img src={editDraft.image} alt={editDraft.name} className="w-full h-full object-cover" />
                                                    : editDraft.name?.charAt(0)
                                                }
                                            </div>
                                            <label className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                <Camera size={18} className="text-white" />
                                                <input type="file" accept="image/*" className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) { const r = new FileReader(); r.onloadend = () => setEditDraft(d => d ? { ...d, image: r.result as string } : d); r.readAsDataURL(file); }
                                                    }}
                                                />
                                            </label>
                                            {/* Status dot */}
                                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow ${selectedPerson.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h2 className="text-xl font-bold text-accent-greyDark leading-tight">{selectedPerson.name}</h2>
                                                    <p className="text-sm text-brand-teal font-semibold mt-0.5">{selectedPerson.position}</p>
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                            selectedPerson.appRole === 'Supervisor' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                            selectedPerson.appRole === 'Manager' ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20' :
                                                            'bg-gray-100 text-gray-500 border-gray-200'
                                                        }`}>
                                                            {selectedPerson.appRole}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                                            selectedPerson.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}>
                                                            {selectedPerson.status === 'Active' ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
                                                            {selectedPerson.status}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                                            #{selectedPerson.employeeNumber}
                                                        </span>
                                                        {selectedPerson.prevailingWage && (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                                                <Award size={10} /> {t('personnel.prevailing_wage')}
                                                            </span>
                                                        )}
                                                        {assignedProject && (
                                                            <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-full border border-brand-teal/20 flex items-center gap-1">
                                                                <Briefcase size={10} /> {assignedProject.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-3 shrink-0">
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={handleSelectPerson.bind(null, selectedPerson)}
                                                            className="h-9 px-4 rounded-xl text-xs gap-1.5 border-gray-200 hover:bg-gray-50"
                                                        >
                                                            <X size={14} /> {t('common.cancel', 'Cancel')}
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={handleSave}
                                                            className={`h-9 px-5 rounded-xl text-xs font-bold gap-1.5 transition-all ${isSaved ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-brand-teal hover:bg-brand-teal/90'} text-white shadow-soft`}
                                                        >
                                                            {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                                            {isSaved ? t('personnel.saved') : t('personnel.profile.save')}
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {selectedPerson.email && (
                                                            <a href={`mailto:${selectedPerson.email}`} className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title={selectedPerson.email}>
                                                                <Mail size={16} />
                                                            </a>
                                                        )}
                                                        {selectedPerson.phoneNumber && (
                                                            <a href={`tel:${selectedPerson.phoneNumber}`} className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title={selectedPerson.phoneNumber}>
                                                                <Phone size={16} />
                                                            </a>
                                                        )}
                                                        {selectedPerson.sharedFolderLink && (
                                                            <a href={selectedPerson.sharedFolderLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title="Certs Folder">
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                        {isManager && (
                                                            <button
                                                                onClick={() => { deletePersonnel(selectedPerson.id); setSelectedPersonId(null); setEditDraft(null); }}
                                                                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                                                                title="Delete Personnel"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Form Body */}
                                <div className="p-6 flex-1 overflow-y-auto space-y-5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('personnel.edit_info')}</p>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.name')}</label>
                                        <Input value={editDraft.name || ''} onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.position')}</label>
                                            <Input value={editDraft.position || ''} onChange={e => setEditDraft(d => d ? { ...d, position: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><FolderGit2 size={14} className="text-brand-teal" /> {t('personnel.columns.id')}</label>
                                            <Input value={editDraft.employeeNumber || ''} onChange={e => setEditDraft(d => d ? { ...d, employeeNumber: e.target.value } : d)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Email Address</label>
                                            <Input type="email" value={editDraft.email || ''} onChange={e => setEditDraft(d => d ? { ...d, email: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Reset Password (Optional)</label>
                                            <Input type="text" placeholder="Enter new password to override" value={editDraft.password || ''} onChange={e => setEditDraft(d => d ? { ...d, password: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Phone Number</label>
                                            <Input value={editDraft.phoneNumber || ''} onChange={e => setEditDraft(d => d ? { ...d, phoneNumber: e.target.value } : d)} />
                                        </div>
                                    </div>

                                    {isHROrManager && (
                                        <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Shield size={14} className="text-brand-teal" /> {t('personnel.columns.role')}</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.appRole || 'Tech'} onChange={e => setEditDraft(d => d ? { ...d, appRole: e.target.value as any } : d)}>
                                                    <option value="Tech">Tech</option>
                                                    <option value="Supervisor">Supervisor</option>
                                                    <option value="Manager">Manager</option>
                                                    <option value="HR">HR</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Activity size={14} className="text-brand-teal" /> {t('personnel.columns.status')}</label>
                                            <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.status || 'Active'} onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value as any } : d)}>
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.emergency_contact')}</label>
                                            <Input value={editDraft.emergencyContact || ''} onChange={e => setEditDraft(d => d ? { ...d, emergencyContact: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.onboarding_date')}</label>
                                            <Input type="date" value={editDraft.onboardingDate || ''} onChange={e => setEditDraft(d => d ? { ...d, onboardingDate: e.target.value } : d)} />
                                        </div>
                                    </div>

                                    {isHROrManager && (
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                <Shield size={14} /> {t('personnel.finance.title')}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.regular_hours')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.regularRate || ''} onChange={e => setEditDraft(d => d ? { ...d, regularRate: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.rainy_day')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.rainyDayRate || ''} onChange={e => setEditDraft(d => d ? { ...d, rainyDayRate: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.over_time')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.overtimeRate || ''} onChange={e => setEditDraft(d => d ? { ...d, overtimeRate: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.meal_days')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.mealAllowance || ''} onChange={e => setEditDraft(d => d ? { ...d, mealAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.gas_day')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.gasAllowance || ''} onChange={e => setEditDraft(d => d ? { ...d, gasAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.truck')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.truckAllowance || ''} onChange={e => setEditDraft(d => d ? { ...d, truckAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.lead_pay')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.leadPay || ''} onChange={e => setEditDraft(d => d ? { ...d, leadPay: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.deductions')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.deductions || ''} onChange={e => setEditDraft(d => d ? { ...d, deductions: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.total_perdiem')}</label>
                                                    <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.totalPerdiem || ''} onChange={e => setEditDraft(d => d ? { ...d, totalPerdiem: parseFloat(e.target.value) || 0 } : d)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><ExternalLink size={14} className="text-brand-teal" /> {t('personnel.certs_folder')}</label>
                                        <Input placeholder="e.g. OneDrive or Google Drive URL" value={editDraft.sharedFolderLink || ''} onChange={e => setEditDraft(d => d ? { ...d, sharedFolderLink: e.target.value } : d)} />
                                    </div>

                                    {renderCertsEditor(editDraft, (d) => setEditDraft(d))}


                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                <User size={36} className="mb-3 opacity-30" />
                                <p className="text-sm font-medium text-accent-greyDark">{t('personnel.select_prompt')}</p>
                                <p className="text-xs mt-1">Click anyone from the list to view and edit their profile.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <OrgChartView />
            )}
        </div>
    );
}
