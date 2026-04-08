import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore, Personnel as PersonnelType } from '../store/useStore';
import { User, Plus, Trash2, Shield, Award, Search, Camera, ExternalLink, Activity, FolderGit2, Network, List, ChevronDown, Filter } from 'lucide-react';
import OrgChartView from '../components/personnel/OrgChartView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Personnel() {
    const { personnel, addPersonnel, updatePersonnel, deletePersonnel, userRole, projects } = useStore();
    const location = useLocation();
    


    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('q') || '';
    });
    const [filterRole, setFilterRole] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [viewMode, setViewMode] = useState<'list' | 'org'>('list');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q !== null) {
            setSearchTerm(q);
        }
    }, [location.search]);
    

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [currentPerson, setCurrentPerson] = useState<Partial<PersonnelType> | null>(null);

    const handleAdd = () => {
        if (!currentPerson?.name || !currentPerson?.position) return;

        addPersonnel({
            id: `usr-${Date.now()}`,
            name: currentPerson.name,
            position: currentPerson.position,
            employeeNumber: currentPerson.employeeNumber || `EMP-${Math.floor(Math.random() * 1000)}`,
            phoneNumber: currentPerson.phoneNumber,
            email: currentPerson.email,
            image: currentPerson.image,
            status: currentPerson.status || 'Active',
            sharedFolderLink: currentPerson.sharedFolderLink,
            certifications: currentPerson.certifications || [],
            appRole: currentPerson.appRole || 'Tech'
        });

        setIsAddModalOpen(false);
        setCurrentPerson(null);
    };

    const handleEdit = () => {
        if (!currentPerson?.id) return;
        updatePersonnel(currentPerson.id, currentPerson);
        setIsEditModalOpen(false);
        setCurrentPerson(null);
    };

    const openEdit = (person: PersonnelType) => {
        setCurrentPerson(person);
        setIsEditModalOpen(false); // trigger re-render hack
        setTimeout(() => setIsEditModalOpen(true), 0);
    };

    // Only Supervisors and Managers can view/edit this page (enforced by route), 
    // but we can further restrict Manager-only features like role assignment.
    const isManager = userRole === 'Manager';

    const handleAddCert = () => {
        const newCerts = [...(currentPerson?.certifications || []), { name: '', expirationDate: '', hasAttachment: false }];
        setCurrentPerson({ ...currentPerson, certifications: newCerts });
    };

    const handleUpdateCert = (index: number, field: string, value: any) => {
        const newCerts = [...(currentPerson?.certifications || [])];
        newCerts[index] = { ...newCerts[index], [field]: value };
        setCurrentPerson({ ...currentPerson, certifications: newCerts });
    };

    const handleRemoveCert = (index: number) => {
        const newCerts = (currentPerson?.certifications || []).filter((_, i) => i !== index);
        setCurrentPerson({ ...currentPerson, certifications: newCerts });
    };

    const renderCertifications = () => (
        <div className="space-y-4 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                    <Award size={14} className="text-brand-teal" /> Certifications
                </label>
                <Button variant="outline" size="sm" onClick={handleAddCert} className="h-8 gap-1 rounded-lg">
                    <Plus size={14} /> Add Cert
                </Button>
            </div>
            {(currentPerson?.certifications || []).map((cert, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl relative group">
                     <button onClick={() => handleRemoveCert(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                     </button>
                     <div className="flex gap-2 mr-6">
                        <div className="flex-1">
                            <Input 
                                placeholder="Cert. Name (e.g. OSHA 30)" 
                                value={cert.name} 
                                onChange={e => handleUpdateCert(index, 'name', e.target.value)}
                                className="h-8 text-sm bg-white border-gray-200"
                            />
                        </div>
                        <div className="w-1/3">
                            <Input 
                                type="date"
                                value={cert.expirationDate} 
                                onChange={e => handleUpdateCert(index, 'expirationDate', e.target.value)}
                                className="h-8 text-sm bg-white border-gray-200"
                            />
                        </div>
                     </div>
                </div>
            ))}
            {(!currentPerson?.certifications || currentPerson.certifications.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">No certifications added. Add safety or technical certs here.</p>
            )}
        </div>
    );

    const filteredPersonnel = personnel
        .filter(p => p.appRole !== 'Customer' && p.appRole !== 'Manager')
        .filter(p => filterRole === 'All' ? true : p.appRole === filterRole)
        .filter(p => filterStatus === 'All' ? true : p.status === filterStatus)
        .filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <User className="text-brand-teal" size={28} />
                        Personnel
                    </h1>
                    <p className="text-gray-500 mt-1">Manage field staff and internal employees.</p>
                </div>

                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6">
                            <Plus size={18} /> Add Personnel
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px] rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-accent-greyDark">Create New User</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">Full Name</label>
                                <Input
                                    placeholder="e.g. John Doe"
                                    value={currentPerson?.name || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">Job Title / Position</label>
                                    <Input
                                        placeholder="e.g. Lead Electrician"
                                        value={currentPerson?.position || ''}
                                        onChange={e => setCurrentPerson({ ...currentPerson, position: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                        <FolderGit2 size={14} className="text-brand-teal" /> Employee ID
                                    </label>
                                    <Input
                                        placeholder="e.g. EMP-1234"
                                        value={currentPerson?.employeeNumber || ''}
                                        onChange={e => setCurrentPerson({ ...currentPerson, employeeNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">Email Address</label>
                                    <Input
                                        type="email"
                                        placeholder="john.doe@latnovva.com"
                                        value={currentPerson?.email || ''}
                                        onChange={e => setCurrentPerson({ ...currentPerson, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">Phone Number</label>
                                    <Input
                                        placeholder="e.g. 956-280-8290"
                                        value={currentPerson?.phoneNumber || ''}
                                        onChange={e => setCurrentPerson({ ...currentPerson, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            {isManager && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                            <Shield size={14} className="text-brand-teal" /> App Role
                                        </label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                            value={currentPerson?.appRole || 'Tech'}
                                            onChange={e => setCurrentPerson({ ...currentPerson, appRole: e.target.value as any })}
                                        >
                                            <option value="Tech">Tech</option>
                                            <option value="Supervisor">Supervisor</option>
                                            <option value="Manager">Manager</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                            <Activity size={14} className="text-brand-teal" /> Status
                                        </label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                            value={currentPerson?.status || 'Active'}
                                            onChange={e => setCurrentPerson({ ...currentPerson, status: e.target.value as any })}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                    <ExternalLink size={14} className="text-brand-teal" /> Certs Folder Link
                                </label>
                                <Input
                                    placeholder="e.g. OneDrive or Google Drive URL"
                                    value={currentPerson?.sharedFolderLink || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, sharedFolderLink: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Profile Photo</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-brand-teal/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-brand-teal">
                                        {currentPerson?.image ? (
                                            <img src={currentPerson.image} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera size={24} />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <Input 
                                            type="file" 
                                            accept="image/*" 
                                            className="h-9 text-xs cursor-pointer"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setCurrentPerson({ ...currentPerson, image: reader.result as string });
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        <p className="text-[10px] text-gray-400">JPG, PNG allowed. Max 2MB.</p>
                                    </div>
                                </div>
                            </div>

                            {renderCertifications()}

                            <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAdd}>
                                Save User
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-[1.5] min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> Search Directory</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                            placeholder="Find by name, role or email..."
                            className="pl-10 w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Shield size={12} /> Filter Role</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer h-10"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                        >
                            <option value="All">All Roles</option>
                            <option value="Tech">Techs</option>
                            <option value="Supervisor">Supervisors</option>
                            <option value="Manager">Managers</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> Status</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer h-10"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active Only</option>
                            <option value="Inactive">Inactive Only</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-xl items-center self-end h-10 ml-auto xl:ml-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <List size={16} /> List
                    </button>
                    <button
                        onClick={() => setViewMode('org')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'org' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Network size={16} /> Deployments
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPersonnel.map(person => {
                const assignedProject = projects.find(p => p.assignedPersonnel?.includes(person.id));
                
                return (
                    <div 
                        key={person.id} 
                        className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all flex flex-col group relative"
                        onClick={() => openEdit(person)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-full overflow-hidden border shadow-sm flex items-center justify-center font-bold text-base ${person.status === 'Active' ? 'border-brand-teal/20 bg-brand-teal/10' : 'border-gray-200 bg-gray-100 gray-400'}`}>
                                    {person.image ? (
                                        <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className={person.status === 'Active' ? 'text-brand-teal' : 'text-gray-400'}>{person.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${person.status === 'Active' ? 'bg-status-success' : 'bg-gray-300'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-accent-greyDark truncate mb-0.5">{person.name}</h3>
                                <p className="text-xs font-bold text-brand-teal truncate">{person.position}</p>
                            </div>
                        </div>

                        {assignedProject ? (
                            <div className="mt-3 p-2.5 bg-brand-teal/5 rounded-lg border border-brand-teal/10">
                                <p className="text-[9px] font-bold text-brand-teal uppercase mb-0.5 flex items-center gap-1">
                                    <FolderGit2 size={10} /> Currently Assigned
                                </p>
                                <p className="text-xs font-bold text-accent-greyDark truncate">{assignedProject.name}</p>
                            </div>
                        ) : (
                            <div className="mt-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
                                <p className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                    <Plus size={10} /> Unassigned
                                </p>
                            </div>
                        )}
                        
                        <div className="mt-3 flex justify-between items-center">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold font-mono border border-gray-200">
                                #{person.employeeNumber}
                            </span>
                            {isManager && (
                                <button onClick={(e) => { e.stopPropagation(); deletePersonnel(person.id); }} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-sm hover:bg-red-50" title="Delete Personnel">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

                {filteredPersonnel.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
                        <User size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-accent-greyDark">No personnel found</p>
                        <p className="text-sm mt-1">Add staff to begin managing app access and certifications.</p>
                    </div>
                )}
            </div>
            ) : (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[600px] w-full max-w-full">
                    <OrgChartView />
                </div>
            )}

            {/* Edit Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-accent-greyDark">Edit User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-accent-greyDark">Full Name</label>
                            <Input
                                value={currentPerson?.name || ''}
                                onChange={e => setCurrentPerson({ ...currentPerson, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">Job Title / Position</label>
                                <Input
                                    value={currentPerson?.position || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, position: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                    <FolderGit2 size={14} className="text-brand-teal" /> Employee ID
                                </label>
                                <Input
                                    value={currentPerson?.employeeNumber || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, employeeNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        {isManager && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                        <Shield size={14} className="text-brand-teal" /> App Role
                                    </label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={currentPerson?.appRole || 'Tech'}
                                        onChange={e => setCurrentPerson({ ...currentPerson, appRole: e.target.value as any })}
                                    >
                                        <option value="Tech">Tech</option>
                                        <option value="Supervisor">Supervisor</option>
                                        <option value="Manager">Manager</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                        <Activity size={14} className="text-brand-teal" /> Status
                                    </label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={currentPerson?.status || 'Active'}
                                        onChange={e => setCurrentPerson({ ...currentPerson, status: e.target.value as any })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">Email Address</label>
                                <Input
                                    type="email"
                                    placeholder="john.doe@latnovva.com"
                                    value={currentPerson?.email || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">Phone Number</label>
                                <Input
                                    placeholder="e.g. 956-280-8290"
                                    value={currentPerson?.phoneNumber || ''}
                                    onChange={e => setCurrentPerson({ ...currentPerson, phoneNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                <ExternalLink size={14} className="text-brand-teal" /> Certs Folder Link
                            </label>
                            <Input
                                placeholder="e.g. OneDrive or Google Drive URL"
                                value={currentPerson?.sharedFolderLink || ''}
                                onChange={e => setCurrentPerson({ ...currentPerson, sharedFolderLink: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Profile Photo</label>
                             <div className="flex items-center gap-4">
                                 <div className="w-16 h-16 rounded-full bg-brand-teal/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-brand-teal">
                                     {currentPerson?.image ? (
                                         <img src={currentPerson.image} alt="Preview" className="w-full h-full object-cover" />
                                     ) : (
                                         <Camera size={24} />
                                     )}
                                 </div>
                                 <div className="flex-1 space-y-1">
                                     <Input 
                                         type="file" 
                                         accept="image/*" 
                                         className="h-9 text-xs cursor-pointer"
                                         onChange={e => {
                                             const file = e.target.files?.[0];
                                             if (file) {
                                                 const reader = new FileReader();
                                                 reader.onloadend = () => setCurrentPerson({ ...currentPerson, image: reader.result as string });
                                                 reader.readAsDataURL(file);
                                             }
                                         }}
                                     />
                                     <p className="text-[10px] text-gray-400">Change profile picture.</p>
                                 </div>
                             </div>
                         </div>

                        {renderCertifications()}

                        <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleEdit}>
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
