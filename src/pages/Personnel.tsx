import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore, Personnel as PersonnelType } from '../store/useStore';
import { User, Plus, Edit2, Trash2, Shield, Award, FilePlus, Calendar, AlertTriangle, Search, Camera, ExternalLink, Activity, FolderGit2, Network, List } from 'lucide-react';
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

    const [filterCertification, setFilterCertification] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

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

    const allCertifications = Array.from(new Set(
        personnel
            .filter(p => p.appRole !== 'Customer')
            .flatMap(p => p.certifications || [])
            .map(c => c.name)
            .filter(Boolean)
    )).sort();

    const filteredPersonnel = personnel
        .filter(p => p.appRole !== 'Customer' && p.appRole !== 'Manager')
        .filter(p => filterCertification ? p.certifications?.some(c => c.name.toLowerCase() === filterCertification.toLowerCase()) : true)
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
                        <User className="text-brand-teal" size={32} />
                        Personnel
                    </h1>
                    <p className="text-gray-500 mt-1">Manage field staff and internal employees.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="relative shrink-0">
                        <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                            className="pl-10 w-full md:w-56 bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-brand-teal h-11 rounded-xl text-sm text-accent-grey appearance-none"
                            value={filterCertification}
                            onChange={(e) => setFilterCertification(e.target.value)}
                        >
                            <option value="">All Certifications</option>
                            {allCertifications.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Find by name, role or email..."
                            className="pl-10 w-full md:w-64 bg-white border-gray-200 focus-visible:ring-brand-teal h-11 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto hidden-scrollbar">
                        <select
                            className="bg-transparent border-none outline-none text-xs font-bold text-gray-500 px-2 h-8 cursor-pointer"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                        >
                            <option value="All">All Roles</option>
                            <option value="Tech">Techs</option>
                            <option value="Supervisor">Supervisors</option>
                            <option value="Manager">Managers</option>
                        </select>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <select
                            className="bg-transparent border-none outline-none text-xs font-bold text-gray-500 px-2 h-8 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active Only</option>
                            <option value="Inactive">Inactive Only</option>
                        </select>
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                            <Plus size={18} /> Add User
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPersonnel.map(person => {
                const assignedProject = projects.find(p => p.assignedPersonnel?.includes(person.id));
                
                return (
                    <div key={person.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft relative group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="relative">
                                <div className={`w-14 h-14 rounded-full overflow-hidden border-2 shadow-sm flex items-center justify-center font-bold text-lg ${person.status === 'Active' ? 'border-brand-teal/20 bg-brand-teal/10' : 'border-gray-200 bg-gray-100 gray-400'}`}>
                                    {person.image ? (
                                        <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className={person.status === 'Active' ? 'text-brand-teal' : 'text-gray-400'}>{person.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${person.status === 'Active' ? 'bg-status-success' : 'bg-gray-300'}`} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openEdit(person)} className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                {isManager && (
                                    <button onClick={() => deletePersonnel(person.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-accent-greyDark mb-0.5 truncate">{person.name}</h3>
                        <p className="text-xs font-bold text-brand-teal mb-3">{person.position}</p>
                        
                        <div className="space-y-2 mb-5">
                            <p className="text-xs text-gray-500 flex items-center gap-2">
                                <span className="font-bold uppercase tracking-wider text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{person.appRole || 'Tech'}</span>
                            </p>
                            {person.email && (
                                <p className="text-xs text-gray-500 flex items-center gap-2 truncate">
                                    <FilePlus size={12} className="text-gray-300" />
                                    {person.email}
                                </p>
                            )}
                            {person.phoneNumber && person.phoneNumber !== '-' && (
                                <p className="text-xs text-gray-500 flex items-center gap-2 truncate">
                                    <Activity size={12} className="text-gray-300" />
                                    {person.phoneNumber}
                                </p>
                            )}
                        </div>

                        {assignedProject ? (
                            <div className="p-3 bg-brand-teal/5 rounded-xl border border-brand-teal/10 mb-4">
                                <p className="text-[10px] font-bold text-brand-teal uppercase mb-1 flex items-center gap-1">
                                    <FolderGit2 size={10} /> Currently Assigned
                                </p>
                                <p className="text-xs font-bold text-accent-greyDark truncate">{assignedProject.name}</p>
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 mb-4 border-dashed">
                                <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                    <Plus size={10} /> Unassigned
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 mt-auto">
                            {person.certifications && person.certifications.length > 0 && (
                                <div className="space-y-1 mb-2">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Award size={10} /> Certifications ({person.certifications.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {person.certifications.map((c, i) => {
                                            const isExpired = c.expirationDate && new Date(c.expirationDate) < new Date();
                                            return (
                                                <div key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isExpired ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                                    {isExpired ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                                                    {c.name} {isExpired && ' (EXPIRED)'}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold font-mono border border-gray-200 w-fit">
                                #{person.employeeNumber}
                            </span>
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
