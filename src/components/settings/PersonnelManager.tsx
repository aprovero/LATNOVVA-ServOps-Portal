import { useState } from 'react';
import { useStore, Personnel, Certification } from '../../store/useStore';
import { Plus, Trash2, Edit2, ShieldAlert, Award, ChevronLeft } from 'lucide-react';

interface PersonnelManagerProps {
    onBack: () => void;
}

export default function PersonnelManager({ onBack }: PersonnelManagerProps) {
    const { personnel, addPersonnel, updatePersonnel, deletePersonnel } = useStore();

    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<Partial<Personnel>>({
        name: '',
        position: '',
        employeeNumber: '',
        dbo: '',
        certifications: []
    });

    const resetForm = () => {
        setFormData({ name: '', position: '', employeeNumber: '', dbo: '', certifications: [] });
        setIsEditing(null);
        setIsAdding(false);
    };

    const handleSave = () => {
        if (!formData.name || !formData.position) return;

        if (isEditing) {
            updatePersonnel(isEditing, formData);
        } else {
            addPersonnel({
                ...formData,
                id: `EMP-${Date.now()}`
            } as Personnel);
        }
        resetForm();
    };

    const handleEdit = (person: Personnel) => {
        setFormData(person);
        setIsEditing(person.id);
        setIsAdding(true);
    };

    const handleAddCert = () => {
        setFormData({
            ...formData,
            certifications: [...(formData.certifications || []), { name: '', expirationDate: '' }]
        });
    };

    const handleUpdateCert = (index: number, field: keyof Certification, value: string) => {
        const updatedCards = [...(formData.certifications || [])];
        updatedCards[index] = { ...updatedCards[index], [field]: value };
        setFormData({ ...formData, certifications: updatedCards });
    };

    const handleRemoveCert = (index: number) => {
        const updatedCards = [...(formData.certifications || [])];
        updatedCards.splice(index, 1);
        setFormData({ ...formData, certifications: updatedCards });
    };

    const isExpired = (dateString: string) => {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    };

    if (isAdding) {
        return (
            <div className="card-container max-w-2xl">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <button onClick={resetForm} className="text-gray-400 hover:text-brand-teal transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-accent-greyDark">
                        {isEditing ? 'Edit Personnel' : 'Add Personnel'}
                    </h2>
                </div>

                <div className="space-y-4 mb-8">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input-field mt-1"
                            placeholder="e.g. John Doe"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Position</label>
                            <input
                                type="text"
                                value={formData.position || ''}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                className="input-field mt-1"
                                placeholder="e.g. Senior Electrician"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Employee Number</label>
                            <input
                                type="text"
                                value={formData.employeeNumber || ''}
                                onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                                className="input-field mt-1"
                                placeholder="e.g. EMP-1234"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Date of Birth (DBO)</label>
                        <input
                            type="text"
                            value={formData.dbo || ''}
                            onChange={(e) => setFormData({ ...formData, dbo: e.target.value })}
                            className="input-field mt-1"
                            placeholder="e.g. 05/19/2003"
                        />
                    </div>
                </div>

                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-accent-greyDark flex items-center gap-2">
                            <Award size={18} className="text-brand-teal" /> Certifications
                        </h3>
                        <button onClick={handleAddCert} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                            <Plus size={14} /> Add Cert
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.certifications?.map((cert, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Certification Name</label>
                                    <input
                                        type="text"
                                        value={cert.name}
                                        onChange={(e) => handleUpdateCert(idx, 'name', e.target.value)}
                                        className="w-full bg-transparent border-b border-gray-300 focus:border-brand-teal outline-none py-1 mt-1 text-sm text-accent-greyDark"
                                        placeholder="e.g. OSHA 30"
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Expiration</label>
                                    <input
                                        type="date"
                                        value={cert.expirationDate}
                                        onChange={(e) => handleUpdateCert(idx, 'expirationDate', e.target.value)}
                                        className={`w-full bg-transparent border-b border-gray-300 outline-none py-1 mt-1 text-sm
                                            ${isExpired(cert.expirationDate) ? 'text-status-error font-semibold focus:border-status-error' : 'text-accent-greyDark focus:border-brand-teal'}`}
                                    />
                                </div>
                                <button onClick={() => handleRemoveCert(idx)} className="mt-6 text-gray-400 hover:text-status-error transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {(!formData.certifications || formData.certifications.length === 0) && (
                            <p className="text-sm text-gray-500 text-center py-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                No certifications added.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={resetForm} className="px-4 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary py-2 px-6">
                        Save Personnel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={onBack} className="flex items-center gap-2 text-brand-teal font-semibold hover:underline mb-4">
                        <ChevronLeft size={20} /> Back to Settings
                    </button>
                    <h2 className="text-2xl font-bold text-accent-greyDark">Personnel Management</h2>
                    <p className="text-gray-500 text-sm">Manage staff and view active certifications</p>
                </div>
                <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2 py-2 px-4">
                    <Plus size={18} /> Add Personnel
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personnel.map((person) => (
                    <div key={person.id} className="card-container relative group hover:border-brand-teal/30 transition-colors">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(person)} className="p-2 text-gray-400 hover:text-brand-teal bg-white rounded-lg shadow-sm border border-gray-100">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => deletePersonnel(person.id)} className="p-2 text-gray-400 hover:text-status-error bg-white rounded-lg shadow-sm border border-gray-100">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-accent-greyDark">{person.name}</h3>
                            <p className="text-sm text-brand-teal font-semibold">{person.position}</p>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-400 font-mono">{person.employeeNumber}</p>
                                {person.dbo && <p className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">DBO: {person.dbo}</p>}
                            </div>
                        </div>

                        <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                            {person.certifications.length > 0 ? (
                                person.certifications.map((cert, idx) => {
                                    const expired = isExpired(cert.expirationDate);
                                    return (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 font-medium">{cert.name}</span>
                                            <div className="flex items-center gap-2">
                                                {expired && <ShieldAlert size={14} className="text-status-error" />}
                                                <span className={`text-xs ${expired ? 'text-status-error font-bold' : 'text-gray-400'}`}>
                                                    {cert.expirationDate ? new Date(cert.expirationDate).toLocaleDateString() : 'No Expire'}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-xs text-gray-400 italic">No certifications listed</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {personnel.length === 0 && (
                <div className="card-container text-center py-16">
                    <Award size={48} className="mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-bold text-gray-600 mb-2">No Personnel Found</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mb-6">You haven't added any employees yet. Add personnel to assign them to projects and track their certifications.</p>
                    <button onClick={() => setIsAdding(true)} className="btn-secondary flex items-center gap-2 py-2 px-4 mx-auto">
                        <Plus size={18} /> Add First Employee
                    </button>
                </div>
            )}
        </div>
    );
}
